import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/controller.js";
import "../src/core/native-catalog-dock.js";
import "../src/core/catalog-controller.js";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/tokens.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";
import "../src/skins/outlook/index.js";

class DomNode {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.className = "";
    this.textContent = "";
    this.attributes = {};
    this.style = {cssText: ""};
    this.listeners = new Map();
    this.classList = {add: (...names) => {this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" ");}};
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node.parentNode?.removeChild) node.parentNode.removeChild(node);
      this.children.push(node);
      node.parentNode = this;
    }
  }

  appendChild(node) { this.append(node); return node; }
  insertBefore(node, reference) {
    if (node.parentNode?.removeChild) node.parentNode.removeChild(node);
    const index = reference ? this.children.indexOf(reference) : this.children.length;
    this.children.splice(index < 0 ? this.children.length : index, 0, node);
    node.parentNode = this;
  }
  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
  }
  remove() { this.parentNode?.removeChild?.(this); }
  replaceChildren(...nodes) {
    for (const child of [...this.children]) this.removeChild(child);
    this.append(...nodes);
  }
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  removeEventListener(name, listener) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter((candidate) => candidate !== listener));
  }
  dispatchUserClick() {
    let current = this;
    const event = {type: "click", target: this, currentTarget: this, isTrusted: true};
    while (current) {
      for (const listener of current.listeners.get("click") || []) listener(event);
      current = current.parentNode;
    }
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "style") this.style.cssText = String(value);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "style") this.style.cssText = "";
  }
  closest(selector) {
    let current = this;
    while (current) {
      if (selector === ".fqmail-shell" && current.className.split(/\s+/).includes("fqmail-shell")) return current;
      if (selector === ".reader-toolbar-item" && current.className.split(/\s+/).includes("reader-toolbar-item")) return current;
      if (selector === ".muye-reader" && current.className.split(/\s+/).includes("muye-reader")) return current;
      current = current.parentNode;
    }
    return null;
  }
  getBoundingClientRect() { return {left: 100, top: 200, width: 70, height: 34}; }
}

function buildPage() {
  const app = new DomNode("div");
  app.id = "app";
  const readerRoot = new DomNode("div");
  readerRoot.className = "muye-reader";
  const box = new DomNode("div");
  box.className = "muye-reader-box";
  readerRoot.append(box);
  const toolbar = new DomNode("div");
  toolbar.className = "reader-toolbar";
  toolbar.style.position = "fixed";
  const nativeItem = new DomNode("div");
  nativeItem.className = "reader-toolbar-item";
  nativeItem.textContent = "目录";
  const nativeLabel = new DomNode("div");
  nativeLabel.textContent = "目录";
  nativeItem.append(nativeLabel);
  toolbar.append(nativeItem);
  app.append(readerRoot, toolbar);
  return {app, readerRoot, box, toolbar, nativeItem, nativeLabel};
}

function documentFor(page) {
  return {
    body: new DomNode("body"),
    createElement: (tagName) => new DomNode(tagName),
    createElementNS: (namespaceURI, tagName) => new DomNode(tagName),
    createComment: (value) => ({nodeType: 8, value, parentNode: null}),
    querySelector: (selector) => selector === "#app" ? page.app : selector === ".muye-reader" ? page.readerRoot : null,
  };
}

function transferFor(page) {
  return {
    mount: ({box, pane}) => ({
      scrollElement: pane,
      getProgress: () => 0,
      setProgress() {},
      restore() { pane.removeChild(box); page.readerRoot.append(box); return true; },
    }),
  };
}

test("native catalog item remains the only React-owned directory control", async () => {
  const page = buildPage();
  const documentLike = documentFor(page);
  const originalNativeStyle = page.nativeItem.style.cssText;
  const originalNativeClassName = page.nativeItem.className;
  let siteClicks = 0;
  page.app.addEventListener("click", (event) => {
    if (event.target === page.nativeLabel && page.nativeItem.parentNode === page.toolbar) siteClicks += 1;
  });
  const entries = Array.from({length: 1085}, (_, index) => ({
    chapterId: "c-" + (index + 1),
    title: "第" + (index + 1) + "章",
    active: index === 0,
    visited: false,
  }));
  let skin;
  let waitCalls = 0;
  let readManyCalls = 0;
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike,
    locationLike: new URL("https://fanqienovel.com/reader/book-1?chapter_id=c-1"),
    windowLike: {innerWidth: 1440, addEventListener() {}, removeEventListener() {}},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => page.box,
      findNativeCatalogItem: () => page.nativeItem,
      parseReaderSnapshot: () => ({bookId: "book-1", chapterId: "c-1", bookTitle: "测试书", chapterTitle: "第一章"}),
      parseCatalog: () => entries,
    },
    skinFactory: {
      create: (options) => {
        skin = globalThis.Fqmail.outlook.create({documentLike, ...options});
        return skin;
      },
    },
    transferApi: transferFor(page),
    nativeCatalogDock: globalThis.Fqmail.nativeCatalogDock,
    catalogFactory: {
      create: (options) => globalThis.Fqmail.catalog.create({
        ...options,
        waitForCatalog: async () => { waitCalls += 1; return true; },
        store: {getReadMany: async () => { readManyCalls += 1; return {}; }},
      }),
    },
    store: {getSettings: async () => ({enabled: true})},
  });

  assert.equal(await controller.start(), true);
  assert.equal(page.nativeItem.parentNode, page.toolbar);
  assert.ok(skin.refs.catalogSyncSlot);
  assert.equal(page.nativeItem.getAttribute("aria-hidden"), null);
  assert.equal(page.nativeItem.style.cssText, originalNativeStyle);
  assert.match(page.nativeItem.className, /fqmail-native-catalog-dock/);

  page.nativeLabel.dispatchUserClick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(siteClicks, 1);
  assert.equal(waitCalls, 1);
  assert.equal(readManyCalls, 1);
  assert.equal(skin.refs.chapterList.children.length, 1085);
  assert.equal(skin.root.getAttribute("data-fqmail-state"), "success");
  assert.equal(await controller.disable(), true);
  assert.equal(page.nativeItem.parentNode, page.toolbar);
  assert.equal(page.nativeItem.style.cssText, originalNativeStyle);
  assert.equal(page.nativeItem.className, originalNativeClassName);
});

test("SPA replacement disposes the old dock and keeps one visible native control", async () => {
  const page = buildPage();
  const secondItem = new DomNode("div");
  secondItem.className = "reader-toolbar-item";
  secondItem.textContent = "目录";
  const documentLike = documentFor(page);
  let currentItem = page.nativeItem;
  let currentBox = page.box;
  const secondBox = new DomNode("div");
  secondBox.className = "muye-reader-box";
  let dockMounts = 0;
  let catalogLoads = 0;
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike,
    locationLike: new URL("https://fanqienovel.com/reader/book-1?chapter_id=c-1"),
    windowLike: {innerWidth: 1440, addEventListener() {}, removeEventListener() {}},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => currentBox,
      findNativeCatalogItem: () => currentItem,
      parseReaderSnapshot: () => ({bookId: "book-1", chapterId: currentBox === page.box ? "c-1" : "c-2", bookTitle: "测试书", chapterTitle: "章节"}),
    },
    skinFactory: {create: (options) => globalThis.Fqmail.outlook.create({documentLike, ...options})},
    transferApi: transferFor(page),
    nativeCatalogDock: {
      mount(options) {
        dockMounts += 1;
        return globalThis.Fqmail.nativeCatalogDock.mount(options);
      },
    },
    catalogFactory: {create: () => ({load: async () => {catalogLoads += 1; return [];}, dispose() {}})},
    store: {getSettings: async () => ({enabled: true})},
  });

  assert.equal(await controller.start(), true);
  page.toolbar.removeChild(page.nativeItem);
  page.toolbar.append(secondItem);
  currentItem = secondItem;
  currentBox = secondBox;
  await controller.refresh();
  assert.equal(dockMounts, 2);
  assert.equal(page.nativeItem.parentNode, null);
  assert.equal(secondItem.parentNode, page.toolbar);
  page.nativeItem.dispatchUserClick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(catalogLoads, 0);
  secondItem.dispatchUserClick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(catalogLoads, 1);
  assert.equal(await controller.disable(), true);
});
