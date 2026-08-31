import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/native-catalog-sync.js";

class Node {
  constructor(tag = "div", {classes = [], text = ""} = {}) {
    this.tagName = tag.toUpperCase();
    this.className = classes.join(" ");
    this.textContent = text;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
    };
  }

  append(...nodes) { for (const node of nodes) { node.parentNode?.removeChild?.(node); node.parentNode = this; this.children.push(node); } }
  appendChild(node) { this.append(node); return node; }
  removeChild(node) { const index = this.children.indexOf(node); if (index >= 0) this.children.splice(index, 1); node.parentNode = null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener, options) { const list = this.listeners.get(type) || []; list.push({listener, capture: options === true || options?.capture === true}); this.listeners.set(type, list); }
  removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item.listener !== listener)); }
  dispatchUserClick(target = this) {
    const path = [];
    for (let node = target; node; node = node.parentNode) path.push(node);
    const event = {type: "click", target, isTrusted: true};
    for (const node of path.slice().reverse()) for (const item of node.listeners.get("click") || []) if (item.capture) item.listener(event);
    for (const node of path) for (const item of node.listeners.get("click") || []) if (!item.capture) item.listener(event);
  }
  click() { this.dispatchUserClick(this); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.children) {
        const isChapter = selector === ".reader-catalog .chapter[data-item-id]"
          && child.classList.contains("chapter") && child.attributes.has("data-item-id")
          && child.parentNode?.classList.contains("reader-catalog");
        const isText = selector === ".chapter-text" && child.classList.contains("chapter-text");
        const isClass = /^\.[A-Za-z0-9_-]+$/.test(selector) && child.classList.contains(selector.slice(1));
        if (isChapter || isText || isClass) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
}

function makeDocument() {
  const app = new Node("div"); app.id = "app";
  const toolbar = new Node("div", {classes: ["reader-toolbar"]});
  const nativeItem = new Node("div", {classes: ["reader-toolbar-item"]});
  const nativeLabel = new Node("div", {text: "目录"});
  nativeItem.append(nativeLabel); toolbar.append(nativeItem);
  const reader = new Node("div", {classes: ["muye-reader"]}); reader.append(toolbar); app.append(reader);
  const documentLike = {
    body: new Node("body"),
    querySelector(selector) { return selector === "#app" ? app : app.querySelector(selector); },
    querySelectorAll(selector) { return app.querySelectorAll(selector); },
  };
  return {documentLike, app, reader, toolbar, nativeItem, nativeLabel};
}

function addCatalog(documentLike, count = 2, current = "100") {
  const catalog = new Node("div", {classes: ["reader-catalog"]});
  for (let index = 0; index < count; index += 1) {
    const id = String(Number(current) + index);
    const chapter = new Node("div", {classes: ["chapter", ...(index === 0 ? ["active"] : []), ...(index === 1 ? ["visited"] : [])]});
    chapter.setAttribute("data-item-id", id); chapter.dataset.itemId = id;
    chapter.append(new Node("div", {classes: ["chapter-text"], text: `第${index + 1}章`})); catalog.append(chapter);
  }
  documentLike.querySelector("#app").append(catalog);
  return catalog;
}

test("native catalog sync exposes the approved reader-page workflow", () => {
  assert.ok(globalThis.Fqmail?.nativeCatalogSync, "native catalog sync must be registered");
});

test("sync observes one real user click, keeps native ancestry, and waits for close", async () => {
  const page = makeDocument();
  let siteClicks = 0; let success; let errors = 0; let observer;
  const windowLike = {setTimeout, clearTimeout, MutationObserver: class { constructor(callback) { observer = {callback}; } observe() {} disconnect() {} }};
  page.app.addEventListener("click", () => { siteClicks += 1; addCatalog(page.documentLike, 2, "100"); });
  const session = globalThis.Fqmail.nativeCatalogSync.create({
    documentLike: page.documentLike,
    windowLike,
    adapter: {findNativeCatalogItem: () => page.nativeItem},
    currentChapterId: "100",
    timeoutMs: 100,
    onSuccess: (entries) => { success = entries; },
    onError: () => { errors += 1; },
  });
  const originalParent = page.nativeItem.parentNode;
  assert.equal(session.start(), true);
  assert.equal(page.nativeItem.clickCalls, undefined);
  page.nativeLabel.dispatchUserClick(page.nativeLabel);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(siteClicks, 1);
  assert.equal(session.getState(), "awaiting-close");
  assert.equal(page.nativeItem.parentNode, originalParent);
  assert.equal(errors, 0);
  assert.equal(success, undefined);
  page.documentLike.querySelector("#app").removeChild(page.documentLike.querySelector(".reader-catalog"));
  observer.callback();
  assert.equal(success.length, 2);
  assert.equal(success[0].chapterId, "100");
  assert.equal(success[0].order, 0);
  assert.equal(session.start(), false);
});

test("native parser preserves duplicate titles by unique id and derives state and same-origin href", () => {
  const page = makeDocument();
  const catalog = new Node("div", {classes: ["reader-catalog"]});
  for (const [id, locked] of [["100", false], ["101", true], ["102", false]]) {
    const chapter = new Node("div", {classes: ["chapter", locked ? "locked" : "visited"]});
    chapter.setAttribute("data-item-id", id); chapter.dataset.itemId = id;
    chapter.append(new Node("div", {classes: ["chapter-text"], text: "重复标题"})); catalog.append(chapter);
  }
  page.app.append(catalog);
  const entries = globalThis.Fqmail.nativeCatalogSync.parse(page.documentLike, {href: "https://fanqienovel.com/reader/100"}, "100");
  assert.deepEqual(entries.map((entry) => entry.chapterId), ["100", "101", "102"]);
  assert.deepEqual(entries.map((entry) => entry.title), ["重复标题", "重复标题", "重复标题"]);
  assert.equal(entries[1].locked, true);
  assert.equal(entries[2].visited, true);
  assert.equal(entries[0].href, "https://fanqienovel.com/reader/100");
});

test("native parser accepts a large real catalog without assuming a fixed book count", () => {
  const page = makeDocument();
  addCatalog(page.documentLike, 1087, "100");
  const entries = globalThis.Fqmail.nativeCatalogSync.parse(page.documentLike, {href: "https://fanqienovel.com/reader/100"}, "100");
  assert.equal(entries.length, 1087);
  assert.deepEqual(entries.slice(0, 2).map((entry) => entry.order), [0, 1]);
  assert.equal(Object.keys(entries[0]).includes("element"), false);
});

test("cancel and dispose clean the native sync listener without changing the native tree", () => {
  const page = makeDocument();
  let errors = 0;
  const session = globalThis.Fqmail.nativeCatalogSync.create({
    documentLike: page.documentLike,
    windowLike: {setTimeout, clearTimeout},
    adapter: {findNativeCatalogItem: () => page.nativeItem},
    currentChapterId: "100",
    onError: () => { errors += 1; },
  });
  assert.equal(session.start(), true);
  assert.equal(session.cancel(), true);
  assert.equal(session.getState(), "idle");
  page.nativeLabel.dispatchUserClick(page.nativeLabel);
  assert.equal(errors, 0);
  session.dispose();
  assert.equal(page.nativeItem.parentNode, page.toolbar);
});

test("sync captures an already-open catalog and reports timeout without changing the page", async () => {
  const page = makeDocument(); addCatalog(page.documentLike, 1, "100");
  let success = 0; let error;
  const session = globalThis.Fqmail.nativeCatalogSync.create({
    documentLike: page.documentLike,
    windowLike: {setTimeout, clearTimeout},
    adapter: {findNativeCatalogItem: () => page.nativeItem},
    currentChapterId: "100",
    timeoutMs: 20,
    onSuccess: () => { success += 1; },
    onError: (next) => { error = next; },
  });
  assert.equal(session.start(), true);
  assert.equal(session.getState(), "awaiting-close");
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(success, 0);
  assert.equal(error.kind, "catalog-not-closed");
  assert.equal(page.nativeItem.parentNode.className, "reader-toolbar");
});

test("an already-open native catalog can be captured even if its toolbar node was rebuilt", () => {
  const page = makeDocument();
  addCatalog(page.documentLike, 1, "100");
  let captured; let observer;
  class Observer { constructor(callback) { observer = {callback}; } observe() {} disconnect() {} }
  const session = globalThis.Fqmail.nativeCatalogSync.create({
    documentLike: page.documentLike,
    windowLike: {setTimeout, clearTimeout, MutationObserver: Observer},
    adapter: {findNativeCatalogItem: () => null},
    currentChapterId: "100",
    onSuccess: (entries) => { captured = entries; },
  });
  assert.equal(session.start(), true);
  assert.equal(session.getState(), "awaiting-close");
  page.documentLike.querySelector("#app").removeChild(page.documentLike.querySelector(".reader-catalog"));
  observer.callback();
  assert.equal(captured.length, 1);
});

test("mask without chapters reports an incomplete native catalog after the stable window", async () => {
  const page = makeDocument();
  const mask = new Node("div", {classes: ["catalog-mask"]});
  page.app.append(mask);
  let error;
  const observerHolder = {};
  class Observer { constructor(callback) { observerHolder.callback = callback; } observe() {} disconnect() {} }
  const session = globalThis.Fqmail.nativeCatalogSync.create({
    documentLike: page.documentLike,
    windowLike: {setTimeout, clearTimeout, MutationObserver: Observer},
    adapter: {findNativeCatalogItem: () => page.nativeItem},
    currentChapterId: "100",
    timeoutMs: 100,
    maskStableMs: 5,
    onError: (next) => { error = next; },
  });
  assert.equal(session.start(), true);
  observerHolder.callback();
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(error.kind, "incomplete");
  assert.match(error.message, /目录面板未完整生成/);
});

test("a catalog mask followed by chapters is captured instead of reporting an incomplete panel", async () => {
  const page = makeDocument();
  const mask = new Node("div", {classes: ["catalog-mask"]});
  page.app.append(mask);
  let captured; let observerCallback;
  class Observer { constructor(callback) { observerCallback = callback; } observe() {} disconnect() {} }
  const session = globalThis.Fqmail.nativeCatalogSync.create({
    documentLike: page.documentLike,
    windowLike: {setTimeout, clearTimeout, MutationObserver: Observer},
    adapter: {findNativeCatalogItem: () => page.nativeItem}, currentChapterId: "100", timeoutMs: 100, maskStableMs: 5,
    onSuccess: (entries) => { captured = entries; }, onError: (error) => { throw error; },
  });
  assert.equal(session.start(), true);
  observerCallback();
  addCatalog(page.documentLike, 2, "100");
  observerCallback();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(session.getState(), "awaiting-close");
  assert.equal(captured, undefined);
  page.documentLike.querySelector("#app").removeChild(page.documentLike.querySelector(".reader-catalog"));
  observerCallback();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

test("no mask and no chapters still waits for the normal timeout", async () => {
  const page = makeDocument(); let error;
  const session = globalThis.Fqmail.nativeCatalogSync.create({
    documentLike: page.documentLike, windowLike: {setTimeout, clearTimeout}, adapter: {findNativeCatalogItem: () => page.nativeItem}, currentChapterId: "100", timeoutMs: 20,
    onError: (next) => { error = next; },
  });
  assert.equal(session.start(), true);
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(error, undefined);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(error.kind, "timeout");
});
