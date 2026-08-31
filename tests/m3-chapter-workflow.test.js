import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/tokens.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";
import "../src/skins/outlook/index.js";
import "../src/core/native-catalog-dock.js";
import "../src/core/catalog-controller.js";
import "../src/core/native-catalog-sync.js";
import "../src/core/performance-metrics.js";

class DomNode {
  constructor(tagName = "div", {text = "", classes = []} = {}) {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.parentNode = null;
    this.className = classes.join(" ");
    this.textContent = text;
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {cssText: ""};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.readOnly = false;
    this.tabIndex = 0;
    this.appendCount = 0;
    this.fragmentAppendCount = 0;
    this.scrollIntoViewCalls = 0;
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(" "); },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
  }

  append(...nodes) {
    this.appendCount += 1;
    for (const node of nodes) {
      if (!node) continue;
      if (node.nodeType === 11) {
        this.fragmentAppendCount += 1;
        for (const child of node.children.splice(0)) {
          child.parentNode = this;
          this.children.push(child);
        }
        continue;
      }
      node.parentNode?.removeChild?.(node);
      node.parentNode = this;
      this.children.push(node);
    }
  }

  appendChild(node) { this.append(node); return node; }
  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
    return node;
  }
  replaceChildren(...nodes) { for (const child of [...this.children]) this.removeChild(child); this.append(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); this[name] = String(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, listener) { const list = this.listeners.get(name) || []; list.push(listener); this.listeners.set(name, list); }
  removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) || []).filter((item) => item !== listener)); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) || []) listener({...event, target: event.target || this, currentTarget: this}); }
  click() { if (!this.disabled) this.dispatchEvent({type: "click", isTrusted: true}); }
  scrollIntoView() { this.scrollIntoViewCalls += 1; }
  getBoundingClientRect() { return this.rect || {left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0}; }
  querySelectorAll(selector) {
    const className = selector.startsWith(".") ? selector.slice(1) : null;
    const result = [];
    const visit = (node) => {
      if (className && node.classList.contains(className)) result.push(node);
      for (const child of node.children) visit(child);
    };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function makeDocument() {
  const documentLike = {
    body: new DomNode("body"),
    createElement: (tagName) => new DomNode(tagName),
    createElementNS: (_namespace, tagName) => new DomNode(tagName),
    createDocumentFragment: () => Object.assign(new DomNode("fragment"), {nodeType: 11}),
  };
  return documentLike;
}

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].join("");
}

function makeNativeCatalogFixture() {
  const app = new DomNode("div", {classes: ["app"]});
  app.id = "app";
  const toolbar = new DomNode("div", {classes: ["reader-toolbar"]});
  toolbar.style.position = "fixed";
  const nativeNode = new DomNode("div", {classes: ["reader-toolbar-item"]});
  const label = new DomNode("div", {text: "目录"});
  nativeNode.append(label);
  toolbar.append(nativeNode);
  app.append(toolbar);
  nativeNode.rect = {left: 20, top: 60, width: 70, height: 32, right: 90, bottom: 92};
  return {app, toolbar, nativeNode, label};
}

test("M3 native sync prompt is independent from the shell and exposes cancel", () => {
  const documentLike = makeDocument();
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike: {setTimeout, clearTimeout}});
  assert.equal(typeof skin.enterNativeCatalogSync, "function");
  assert.equal(typeof skin.updateNativeCatalogSync, "function");
  assert.equal(typeof skin.exitNativeCatalogSync, "function");
  let cancelled = 0;
  assert.equal(skin.enterNativeCatalogSync({message: "请点击番茄原生目录", onCancel: () => {cancelled += 1;}, onFallback: () => {}}), true);
  assert.equal(skin.root.style.visibility, "hidden");
  assert.equal(skin.root.style.pointerEvents, "none");
  const prompt = documentLike.body.querySelector(".fqmail-native-catalog-sync-prompt");
  assert.ok(prompt);
  skin.updateNativeCatalogSync({state: "error", message: "目录未打开"});
  assert.equal(prompt.querySelector(".fqmail-native-catalog-sync-fallback").hidden, false);
  prompt.querySelector(".fqmail-native-catalog-sync-cancel").click();
  assert.equal(cancelled, 1);
  skin.exitNativeCatalogSync();
  assert.equal(skin.root.style.visibility, "");
  assert.equal(skin.root.style.pointerEvents, "");
  assert.equal(documentLike.body.querySelector(".fqmail-native-catalog-sync-prompt"), null);
});

test("M3 native catalog dock keeps the native parent and docks its verified text target", () => {
  const {app, nativeNode, label} = makeNativeCatalogFixture();
  const shell = new DomNode("section", {classes: ["fqmail-shell"]});
  const slot = new DomNode("div", {classes: ["fqmail-catalog-sync-slot"]});
  slot.rect = {left: 240, top: 92, width: 104, height: 40, right: 344, bottom: 132};
  const windowLike = {innerWidth: 1440, addEventListener() {}, removeEventListener() {}};
  const originalParent = nativeNode.parentNode;
  const originalClass = nativeNode.className;
  let trustedClicks = 0;
  const dock = globalThis.Fqmail.nativeCatalogDock.mount({nativeNode, shell, slot, windowLike, onTrustedClick: () => {trustedClicks += 1;}});

  assert.equal(nativeNode.parentNode, originalParent);
  assert.equal(label.getAttribute("data-fqmail-label"), "同步邮件");
  assert.equal(label.classList.contains("fqmail-native-catalog-label"), true);
  assert.equal(nativeNode.style.position, "fixed");
  assert.equal(nativeNode.style.left, "240px");
  assert.equal(nativeNode.style.top, "92px");
  assert.equal(nativeNode.style.width, "104px");
  assert.equal(nativeNode.style.height, "40px");
  assert.equal(shell.style.left || "", "");
  nativeNode.click();
  assert.equal(trustedClicks, 1);
  assert.equal(dock.restore(), true);
  assert.equal(nativeNode.parentNode, originalParent);
  assert.equal(nativeNode.className, originalClass);
  assert.equal(label.getAttribute("data-fqmail-label"), null);
});

test("M3 skin exposes a sync slot and keeps search usable only after catalog ready", () => {
  const documentLike = makeDocument();
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike: {setTimeout, clearTimeout}});
  assert.ok(skin.refs.catalogSyncSlot);
  assert.equal(skin.root.querySelectorAll(".fqmail-catalog-button").length, 0);
  assert.equal(skin.refs.searchBox.readOnly, false);
  skin.refs.searchBox.value = "第1";
  skin.refs.searchBox.dispatchEvent({type: "input"});
  assert.match(skin.refs.status.textContent, /先同步邮件/);
});

test("locked native chapters remain visible but cannot trigger navigation", () => {
  const documentLike = makeDocument();
  let selects = 0;
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike: {setTimeout, clearTimeout}, onChapterSelect: () => {selects += 1;}});
  skin.renderCatalog([{chapterId: "100", title: "锁定章节", locked: true}], {currentChapterId: "100"});
  const row = skin.refs.messageList.querySelector(".fqmail-message-row");
  assert.equal(row.getAttribute("aria-disabled"), "true");
  row.click();
  assert.equal(selects, 0);
});

test("an empty or failed catalog never removes the current chapter fallback message", () => {
  const documentLike = makeDocument();
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike: {setTimeout, clearTimeout}});
  skin.renderSnapshot({
    bookId: "book-1",
    chapterId: "chapter-1",
    bookTitle: "测试书",
    chapterTitle: "第一章",
    previousButton: {},
    nextButton: {},
  });
  const fallback = skin.refs.messageList.querySelector(".fqmail-message-row");

  assert.ok(fallback);
  assert.equal(skin.renderCatalog([], {currentChapterId: "chapter-1"}), false);
  skin.setCatalogState("error", "目录点击成功但目录未出现");

  const rows = skin.refs.messageList.querySelectorAll(".fqmail-message-row");
  assert.equal(rows.length, 1);
  assert.equal(rows[0], fallback);
  assert.equal(skin.refs.prevButton.disabled, false);
  assert.equal(skin.refs.nextButton.disabled, false);
});

test("M3 catalog rendering commits 1087 rows once and reuses rows for search and filters", () => {
  const documentLike = makeDocument();
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike: {setTimeout, clearTimeout}});
  const entries = Array.from({length: 1087}, (_, index) => ({
    chapterId: `c-${index}`,
    title: `第${index}章`,
    active: index === 7,
    visited: index % 2 === 0,
    element: new DomNode("div"),
  }));
  skin.setCatalogState("loading", "正在读取章节");
  skin.renderCatalog(entries, {currentChapterId: "c-7"});
  skin.setCatalogState("ready", "已同步 1087 章");
  const rows = skin.refs.messageList.querySelectorAll(".fqmail-message-row");
  assert.equal(rows.length, 1087);
  const originalRow = rows[1000];
  const appendCountAfterInitial = skin.refs.messageList.appendCount;
  assert.equal(skin.refs.messageList.fragmentAppendCount, 1);
  skin.refs.searchBox.value = "第1000章";
  skin.refs.searchBox.dispatchEvent({type: "input"});
  assert.equal(rows.find((row) => !row.hidden), originalRow);
  assert.equal(rows.filter((row) => !row.hidden).length, 1);
  const unread = skin.refs.folderPane.querySelectorAll(".fqmail-folder-row").find((row) => textOf(row).trim() === "未读邮件");
  assert.ok(unread);
  unread.click();
  assert.equal(rows.filter((row) => !row.hidden).length, 0);
  skin.refs.searchBox.value = "";
  skin.refs.searchBox.dispatchEvent({type: "input"});
  assert.equal(rows.filter((row) => !row.hidden).length, 543);
  assert.equal(rows.find((row) => !row.hidden), rows[1]);
  assert.equal(skin.refs.messageList.fragmentAppendCount, 1);
  assert.ok(skin.refs.messageList.appendCount >= appendCountAfterInitial);
});

test("M3 chapter identity updates current and read filters without rebuilding rows", () => {
  const documentLike = makeDocument();
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike: {setTimeout, clearTimeout}});
  const entries = [
    {chapterId: "c-1", title: "第一章", active: true, visited: false, element: new DomNode("div")},
    {chapterId: "c-2", title: "第二章", active: false, visited: false, element: new DomNode("div")},
    {chapterId: "c-3", title: "第三章", active: false, visited: true, element: new DomNode("div")},
  ];
  skin.renderCatalog(entries, {currentChapterId: "c-1"});
  skin.setCatalogState("ready", "已同步 3 章");
  const rows = skin.refs.messageList.querySelectorAll(".fqmail-message-row");
  const secondRow = rows[1];
  const read = skin.refs.folderPane.querySelectorAll(".fqmail-folder-row").find((row) => textOf(row).trim() === "已读邮件");
  read.click();
  assert.equal(rows.filter((row) => !row.hidden).length, 1);
  assert.equal(rows[2].getAttribute("data-fqmail-chapter-state"), "read");
  skin.renderSnapshot({bookId: "book-1", chapterId: "c-2", bookTitle: "书", chapterTitle: "第二章"});
  assert.equal(rows[1], secondRow);
  assert.equal(rows[1].getAttribute("data-fqmail-chapter-state"), "current");
  assert.equal(rows[1].getAttribute("aria-selected"), "true");
  assert.equal(rows.filter((row) => !row.hidden).length, 2);
});

test("M3 catalog controller retains same-book session metadata and clears it on dispose", async () => {
  const entries = [{chapterId: "c-1", title: "第一章", active: true, visited: false, element: new DomNode("div")}];
  const controller = globalThis.Fqmail.catalog.create({
    adapter: {parseCatalog: () => entries},
    waitForCatalog: async () => true,
    store: {getReadMany: async () => ({})},
  });
  const loaded = await controller.load("book-1");
  assert.equal(controller.getSession("book-1"), loaded);
  assert.deepEqual(controller.getSession("other-book"), []);
  controller.dispose();
  assert.deepEqual(controller.getSession("book-1"), []);
});

test("M3 chapter workflow stays within the local 1087-row interaction budget", () => {
  const documentLike = makeDocument();
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike: {setTimeout, clearTimeout}});
  const entries = Array.from({length: 1087}, (_, index) => ({
    chapterId: `perf-${index}`,
    title: `性能章节${index}`,
    active: index === 0,
    visited: index % 2 === 0,
    element: new DomNode("div"),
  }));
  const initialStart = performance.now();
  skin.renderCatalog(entries, {currentChapterId: "perf-0"});
  const initialMs = performance.now() - initialStart;
  skin.setCatalogState("ready", "已同步 1087 章");

  const queryStart = performance.now();
  skin.refs.searchBox.value = "性能章节1000";
  skin.refs.searchBox.dispatchEvent({type: "input"});
  const unread = skin.refs.folderPane.querySelectorAll(".fqmail-folder-row").find((row) => textOf(row).trim() === "未读邮件");
  unread.click();
  const queryMs = performance.now() - queryStart;

  assert.ok(initialMs <= 1000, `initial catalog render took ${initialMs.toFixed(2)}ms`);
  assert.ok(queryMs <= 100, `query/filter update took ${queryMs.toFixed(2)}ms`);
});

test("M3 performance metrics expose real skin catalog and interaction timing samples", () => {
  const documentLike = makeDocument();
  documentLike.visibilityState = "visible";
  let now = 100;
  let nextFrame = 0;
  const frames = new Map();
  const windowLike = {
    setTimeout,
    clearTimeout,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const performanceMetrics = globalThis.Fqmail.performanceMetrics.create({
    documentLike,
    windowLike,
    performanceLike: {now: () => now},
  });
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike, performanceMetrics});
  const entries = Array.from({length: 1089}, (_, index) => ({
    chapterId: `timed-${index}`,
    title: `计时章节${index}`,
    active: index === 0,
    visited: index % 2 === 0,
  }));

  const firstMeasure = skin.beginCatalogMeasure(entries.length);
  now += 25;
  assert.equal(skin.renderCatalog(entries, {currentChapterId: "timed-0", performanceMeasure: firstMeasure}), true);
  assert.equal(frames.size, 1);
  now += 5;
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }

  const resyncMeasure = skin.beginCatalogMeasure(entries.length);
  skin.renderCatalog(entries, {currentChapterId: "timed-0", performanceMeasure: resyncMeasure});
  now += 4;
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }

  skin.setCatalogState("ready", "已同步 1089 章");
  skin.refs.searchBox.value = "计时章节1000";
  skin.refs.searchBox.dispatchEvent({type: "input"});
  now += 3;
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }
  const unread = skin.refs.folderPane.querySelectorAll(".fqmail-folder-row").find((row) => textOf(row).trim() === "未读邮件");
  unread.click();
  now += 2;
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }
  for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); }

  const samples = JSON.parse(skin.root.getAttribute("data-fqmail-perf"));
  assert.equal(samples["catalog-first"][0].count, 1089);
  assert.equal(samples["catalog-first"][0].valid, true);
  assert.equal(samples["catalog-resync"][0].valid, true);
  assert.equal(samples["catalog-search"][0].valid, true);
  assert.equal(samples["catalog-filter"][0].valid, true);
  assert.equal(Object.keys(samples).every((operation) => samples[operation].every((sample) => Object.keys(sample).sort().join(",") === "count,domMs,ms,operation,seq,valid")), true);
  performanceMetrics.dispose();
});

test("skin destroy cancels pending performance frames before removing its root", () => {
  const documentLike = makeDocument();
  documentLike.visibilityState = "visible";
  const frames = new Map();
  let nextFrame = 0;
  const windowLike = {
    setTimeout,
    clearTimeout,
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  const performanceMetrics = globalThis.Fqmail.performanceMetrics.create({
    documentLike,
    windowLike,
    performanceLike: {now: () => 10},
  });
  const skin = globalThis.Fqmail.outlook.create({documentLike, windowLike, performanceMetrics});
  const measure = skin.beginCatalogMeasure(1);
  skin.renderCatalog([{chapterId: "pending", title: "待取消", visited: false}], {performanceMeasure: measure});
  assert.equal(frames.size, 1);
  skin.destroy();
  assert.equal(frames.size, 0);
  assert.equal(JSON.parse(skin.root.getAttribute("data-fqmail-perf"))["catalog-first"][0].valid, false);
});
