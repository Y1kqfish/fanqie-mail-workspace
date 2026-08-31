import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import "../src/core/catalog-page-parser.js";
import "../src/core/catalog-transfer.js";
import "../src/core/catalog-page-source.js";
import "../src/core/catalog-page-workflow.js";
import "../src/page/catalog-collector.js";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/tokens.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";
import "../src/skins/outlook/index.js";
import "../src/core/controller.js";

test("catalog page parser counts valid unique reader links, not the page display count", () => {
  const parser = globalThis.Fqmail?.catalogPageParser;
  assert.ok(parser, "catalog page parser must be registered");

  const links = Array.from({length: 1086}, (_, index) => ({
    href: `https://fanqienovel.com/reader/${1000000000000000 + index}`,
    textContent: `第 ${index + 1} 章`,
    getAttribute(name) { return name === "href" ? this.href : null; },
  }));
  links.splice(2, 0, links[1]);
  links.push({href: "https://fanqienovel.com/reader/not-a-number", textContent: "无效"});
  const documentLike = {
    querySelectorAll(selector) {
      assert.equal(selector, 'a[href*="/reader/"]');
      return links;
    },
  };

  const result = parser.parse(documentLike, "https://fanqienovel.com/page/123456789", "1000000000000007");
  assert.equal(result.bookId, "123456789");
  assert.equal(result.actualCount, 1086);
  assert.equal(result.entries.length, 1086);
  assert.equal(result.entries[0].chapterId, "1000000000000000");
  assert.equal(result.entries[0].order, 0);
  assert.equal(result.entries[1085].chapterId, "1000000000001085");
  assert.equal(result.entries[1085].href, "https://fanqienovel.com/reader/1000000000001085");
});

test("catalog page source accepts only the verified same-origin work-page link", () => {
  const parser = globalThis.Fqmail.catalogPageParser;
  const links = [
    {href: "https://example.com/page/999", getAttribute() { return this.href; }},
    {href: "https://fanqienovel.com/page/not-a-book", getAttribute() { return this.href; }},
    {href: "https://fanqienovel.com/page/987654", getAttribute() { return this.href; }},
  ];
  const documentLike = {querySelectorAll(selector) { assert.equal(selector, 'a[href^="/page/"]'); return links; }};
  assert.equal(parser.findPageUrl(documentLike, new URL("https://fanqienovel.com/reader/456")), "https://fanqienovel.com/page/987654");
  assert.throws(() => parser.pageUrl("https://example.com/page/987654"), /作品页链接无效/);
  assert.equal(parser.readerUrl("https://fanqienovel.com/reader/not-a-chapter"), null);
});

test("catalog transfer records are validated, single-use, and expire", async () => {
  const transfer = globalThis.Fqmail?.catalogTransfer;
  assert.ok(transfer, "catalog transfer must be registered");
  const values = new Map();
  let removeCalls = 0;
  const storageArea = {
    async set(record) { for (const [key, value] of Object.entries(record)) values.set(key, value); },
    async get(key) { return {[key]: values.get(key)}; },
    async remove(key) { removeCalls += 1; values.delete(key); },
  };
  let now = 1000;
  const store = transfer.create({storageArea, now: () => now, ttlMs: 50});
  await store.put({token: "token-1", bookId: "123", currentChapterId: "456", entries: [{chapterId: "456", title: "第四五六章", href: "https://fanqienovel.com/reader/456", order: 0}]});
  assert.equal((await store.consume("token-1", {bookId: "123", currentChapterId: "456"})).entries[0].chapterId, "456");
  assert.equal(await store.consume("token-1", {bookId: "123", currentChapterId: "456"}), null);
  assert.equal(removeCalls, 1);
  await store.put({token: "token-2", bookId: "123", currentChapterId: "456", entries: []});
  assert.equal(await store.consume("token-2", {bookId: "999", currentChapterId: "456"}), null);
  now = 2000;
  assert.equal(await store.consume("token-2", {bookId: "123", currentChapterId: "456"}), null);
  assert.equal(removeCalls, 2);
});

test("catalog page source parses a same-origin iframe and always cleans it up", async () => {
  const source = globalThis.Fqmail?.catalogPageSource;
  assert.ok(source, "catalog page source must be registered");
  const iframe = {
    listeners: new Map(),
    sandbox: {tokens: [], add(token) { this.tokens.push(token); }},
    style: {},
    setAttribute(name, value) { this[name] = name === "sandbox" ? this.sandbox : value; },
    addEventListener(name, listener) { this.listeners.set(name, listener); },
    removeEventListener(name, listener) { if (this.listeners.get(name) === listener) this.listeners.delete(name); },
    contentDocument: {
      querySelectorAll() {
        return [
          {href: "https://fanqienovel.com/reader/456", textContent: "第四章", getAttribute() { return this.href; }},
        ];
      },
    },
  };
  const body = {
    append(node) { this.node = node; setTimeout(() => node.listeners.get("load")?.(), 0); },
    removeChild(node) { assert.equal(node, this.node); this.node = null; this.removed = true; },
  };
  const documentLike = {body, createElement() { return iframe; }};
  const result = await source.load({
    documentLike,
    pageUrl: "https://fanqienovel.com/page/123",
    currentChapterId: "456",
    timeoutMs: 100,
  });
  assert.equal(result.bookId, "123");
  assert.equal(result.actualCount, 1);
  assert.equal(result.entries[0].href, "https://fanqienovel.com/reader/456");
  assert.deepEqual(iframe.sandbox.tokens, ["allow-same-origin"]);
  assert.equal(body.removed, true);
});

test("page collector requires a legal sync token and writes one validated transfer", async () => {
  const collectorApi = globalThis.Fqmail?.catalogPageCollector;
  assert.ok(collectorApi, "catalog page collector must be registered");
  let writes = 0;
  const transfer = {put: async (record) => { writes += 1; return record; }};
  const documentLike = {
    querySelectorAll(selector) {
      assert.equal(selector, 'a[href*="/reader/"]');
      return [{href: "https://fanqienovel.com/reader/456", textContent: "第四章", getAttribute() { return this.href; }}];
    },
  };
  const locationLike = {href: "https://fanqienovel.com/page/123", hash: "#fqmail-sync=token-1234&chapterId=456"};
  const collector = collectorApi.create({documentLike, locationLike, transfer, parser: globalThis.Fqmail.catalogPageParser});
  assert.equal(await collector.run(), true);
  assert.equal(await collector.run(), false);
  assert.equal(writes, 1);
});

test("Outlook skin exposes one visual sync action without a native catalog control", () => {
  let clicks = 0;
  const documentLike = {
    createElement(tagName) {
      return {
        tagName,
        children: [],
        append(...nodes) { this.children.push(...nodes); },
        setAttribute() {},
        addEventListener(type, listener) { this.listener = type === "click" ? listener : this.listener; },
        click() { this.listener?.({isTrusted: true}); },
      };
    },
    createElementNS() { return this.createElement("svg"); },
  };
  const skin = globalThis.Fqmail.outlook.create({documentLike, onCatalogSync: () => { clicks += 1; }});
  assert.ok(skin.refs.catalogSyncButton, "catalog sync button must be exposed");
  assert.equal(skin.root.querySelectorAll?.(".fqmail-native-catalog-control")?.length || 0, 0);
  skin.refs.catalogSyncButton.click();
  assert.equal(clicks, 1);
});

test("catalog sync slot keeps its visual button hit-testable", async () => {
  const styles = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.fqmail-catalog-sync-slot\s*\{[^}]*pointer-events:\s*auto/);
  assert.doesNotMatch(styles, /\.fqmail-catalog-sync-slot\s*\{[^}]*pointer-events:\s*none/);
});

test("controller syncs the directory from the real work page and never asks the native catalog dock", async () => {
  let sourceLoads = 0;
  let renderedEntries = null;
  let nativeDockCalls = 0;
  let readManyCalls = 0;
  let status = "";
  const button = {addEventListener(type, listener) { this.listener = type === "click" ? listener : this.listener; }, click() { this.listener?.({isTrusted: true}); }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}},
    refs: {readerPane: {addEventListener() {}, removeEventListener() {}}, catalogSyncButton: button, status: {textContent: ""}},
    renderSnapshot() {},
    renderCatalog(entries) { renderedEntries = entries; },
    setStatus(_state, message) { status = message; },
    setCatalogState() {},
    destroy() {},
  };
  const box = {parentNode: {}};
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? {append(node) { node.parentNode = this; }} : null; }, body: {append() {}, removeChild() {}}, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: new URL("https://fanqienovel.com/reader/456"),
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "123", chapterId: "456", chapterTitle: "第四章"}), findNativeCatalogItem: () => {nativeDockCalls += 1; return null;}},
    skinFactory: {create: (options) => { button.listener = options.onCatalogSync; return ui; }},
    transferApi: {mount: () => ({scrollElement: ui.refs.readerPane, getProgress: () => 0, setProgress() {}, restore: () => true})},
    nativeCatalogDock: {mount: () => {nativeDockCalls += 1; throw new Error("old dock must not run");}},
    catalogPageSource: {getPageUrl: () => "https://fanqienovel.com/page/123", load: async () => { sourceLoads += 1; return {bookId: "123", actualCount: 1, entries: [{chapterId: "456", title: "第四章", href: "https://fanqienovel.com/reader/456", order: 0}]}; }},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, getReadMany: async () => { readManyCalls += 1; return {456: true}; }, setEnabled: async () => {}},
  });
  assert.equal(await controller.start(), true);
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sourceLoads, 1);
  assert.equal(nativeDockCalls, 0);
  assert.equal(renderedEntries[0].chapterId, "456");
  assert.equal(renderedEntries[0].visited, true);
  assert.equal(readManyCalls, 1);
  assert.match(status, /目录已加载 1 章/);
});

test("page workflow opens the visible fallback only after silent sync fails", async () => {
  const workflowApi = globalThis.Fqmail?.catalogPageWorkflow;
  assert.ok(workflowApi, "catalog page workflow must be registered");
  const errors = [];
  const opened = [];
  const changeListeners = [];
  const workflow = workflowApi.create({
    source: {load: async () => { const error = new Error("timeout"); error.kind = "timeout"; throw error; }, makeFallbackUrl: ({pageUrl, currentChapterId, token}) => `${pageUrl}#fqmail-sync=${token}&chapterId=${currentChapterId}`},
    transferApi: {createToken: () => "token-1234", transferKey: (token) => `fqmail:catalog-transfer:${token}`, create: () => ({consume: async () => ({status: "success", entries: [{chapterId: "456"}]})})},
    storageArea: {onChanged: {addListener(listener) { changeListeners.push(listener); }, removeListener() {}}},
    windowLike: {open(url) { opened.push(url); return {}; }},
    onError: (error) => errors.push(error.kind),
  });
  assert.equal(await workflow.load({pageUrl: "https://fanqienovel.com/page/123", currentChapterId: "456"}), null);
  assert.deepEqual(errors, ["timeout"]);
  assert.equal(workflow.startFallback({pageUrl: "https://fanqienovel.com/page/123", bookId: "123", currentChapterId: "456"}), true);
  assert.deepEqual(opened, ["https://fanqienovel.com/page/123#fqmail-sync=token-1234&chapterId=456"]);
  assert.equal(changeListeners.length, 1);
  workflow.dispose();
});

test("controller preserves the current mail after silent failure and opens fallback only on the next sync", async () => {
  let sourceLoads = 0;
  const opened = [];
  const listeners = [];
  let sync;
  let status = "";
  const pane = {addEventListener() {}, removeEventListener() {}};
  const button = {addEventListener(type, listener) { if (type === "click") this.listener = listener; }, click() { this.listener?.({isTrusted: true}); }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}},
    refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, catalogSyncButton: button, status: {textContent: ""}},
    renderSnapshot() {}, renderCatalog() {}, setCatalogState(_state, message) { status = message; },
    setStatus(_state, message) { status = message; }, destroy() {},
  };
  const box = {parentNode: {}};
  const source = {
    getPageUrl: () => "https://fanqienovel.com/page/123",
    load: async () => { sourceLoads += 1; const error = new Error("timeout"); error.kind = "timeout"; throw error; },
    makeFallbackUrl: ({pageUrl, currentChapterId, token}) => `${pageUrl}#fqmail-sync=${token}&chapterId=${currentChapterId}`,
  };
  const transferApi = {createToken: () => "token-1234", transferKey: (token) => `fqmail:catalog-transfer:${token}`, create: () => ({consume: async () => null})};
  const storageArea = {onChanged: {addListener(listener) { listeners.push(listener); }, removeListener() {}}};
  const locationLike = new URL("https://fanqienovel.com/reader/456");
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? {append(node) { node.parentNode = this; }} : null; }, body: {append() {}, removeChild() {}}, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike,
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, open(url) { opened.push(url); return {}; }},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "123", chapterId: "456", chapterTitle: "第四章"})},
    skinFactory: {create: (options) => { sync = options.onCatalogSync; button.listener = sync; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => true})},
    catalogPageSource: source,
    catalogPageWorkflow: globalThis.Fqmail.catalogPageWorkflow,
    catalogTransfer: transferApi,
    storageArea,
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sourceLoads, 1);
  assert.equal(opened.length, 0);
  assert.equal(status, "静默同步受限，点击继续同步");
  button.click();
  assert.equal(opened.length, 1);
  assert.equal(listeners.length, 1);
  assert.equal(typeof sync, "function");
  await controller.disable();
});

test("empty static page parsing arms the visible fallback without discarding the current mail", async () => {
  let startFallbackCalls = 0;
  let rendered = 0;
  let status = "";
  const pane = {addEventListener() {}, removeEventListener() {}};
  const button = {addEventListener(type, listener) { if (type === "click") this.listener = listener; }, click() { this.listener?.({isTrusted: true}); }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}},
    refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, catalogSyncButton: button, status: {textContent: ""}},
    renderSnapshot() {}, renderCatalog() { rendered += 1; },
    setCatalogState(_state, message) { status = message; }, setStatus(_state, message) { status = message; }, destroy() {},
  };
  const box = {parentNode: {}};
  const source = {
    getPageUrl: () => "https://fanqienovel.com/page/123",
    load: async () => { const error = new Error("静态目录尚未出现"); error.kind = "empty"; throw error; },
    makeFallbackUrl: () => "https://fanqienovel.com/page/123#fqmail-sync=token-1234&chapterId=456",
  };
  const workflow = {
    create: ({onError}) => ({
      load: async () => { onError(Object.assign(new Error("empty"), {kind: "empty"})); return null; },
      startFallback: () => { startFallbackCalls += 1; return true; },
      dispose() {},
    }),
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? {append(node) { node.parentNode = this; }} : null; }, body: {append() {}, removeChild() {}}, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: new URL("https://fanqienovel.com/reader/456"),
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "123", chapterId: "456", chapterTitle: "第四章"})},
    skinFactory: {create: (options) => { button.listener = options.onCatalogSync; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => true})},
    catalogPageSource: source,
    catalogPageWorkflow: workflow,
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  button.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(status, "静默同步受限，点击继续同步");
  assert.equal(rendered, 0);
  button.click();
  assert.equal(startFallbackCalls, 1);
  await controller.disable();
});

test("page collector waits for a complete dynamic directory and writes one success record", async () => {
  const collectorApi = globalThis.Fqmail.catalogPageCollector;
  let links = [];
  let writes = [];
  let disconnects = 0;
  class FakeObserver {
    constructor(listener) { this.listener = listener; }
    observe() { FakeObserver.instance = this; }
    disconnect() { disconnects += 1; }
  }
  const documentLike = {
    body: {append() {}},
    querySelectorAll(selector) { assert.equal(selector, 'a[href*="/reader/"]'); return links; },
    documentElement: {},
    createElement() { return {style: {}, setAttribute() {}}; },
  };
  const transfer = {put: async (record) => { writes.push(record); }};
  const collector = collectorApi.create({
    documentLike,
    locationLike: {href: "https://fanqienovel.com/page/123", hash: "#fqmail-sync=token-1234&chapterId=999"},
    windowLike: {MutationObserver: FakeObserver, setTimeout, clearTimeout},
    transfer,
    parser: globalThis.Fqmail.catalogPageParser,
    timeoutMs: 100,
    pollIntervalMs: 5,
  });
  const pending = collector.run();
  setTimeout(() => {
    links = Array.from({length: 1085}, (_, index) => ({href: `https://fanqienovel.com/reader/${1000 + index}`, textContent: `第${index + 1}章`, getAttribute() { return this.href; }}));
    FakeObserver.instance?.listener([{target: documentLike.body, addedNodes: links, removedNodes: []}]);
  }, 10);
  setTimeout(() => {
    links.push({href: "https://fanqienovel.com/reader/999", textContent: "第1086章", getAttribute() { return this.href; }});
    FakeObserver.instance?.listener([{target: documentLike.body, addedNodes: [links.at(-1)], removedNodes: []}]);
  }, 20);
  assert.equal(await pending, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, "success");
  assert.equal(writes[0].entries.length, 1086);
  assert.equal(writes[0].entries[0].chapterId, "1000");
  assert.equal(writes[0].entries.at(-1).chapterId, "999");
  assert.ok(disconnects >= 1);
});

test("page collector writes one timeout error only after the current chapter never appears", async () => {
  let writes = [];
  let links = [{href: "https://fanqienovel.com/reader/1000", textContent: "第一章", getAttribute() { return this.href; }}];
  let disconnects = 0;
  let clearCalls = 0;
  class FakeObserver { observe() {} disconnect() { disconnects += 1; } }
  const collector = globalThis.Fqmail.catalogPageCollector.create({
    documentLike: {body: {}, documentElement: {}, querySelectorAll() { return links; }},
    locationLike: {href: "https://fanqienovel.com/page/123", hash: "#fqmail-sync=token-1234&chapterId=999"},
    windowLike: {MutationObserver: FakeObserver, setTimeout, clearTimeout: (timer) => { clearCalls += 1; clearTimeout(timer); }},
    transfer: {put: async (record) => { writes.push(record); }},
    parser: globalThis.Fqmail.catalogPageParser,
    timeoutMs: 25,
    pollIntervalMs: 5,
  });
  assert.equal(await collector.run(), false);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].status, "error");
  assert.equal(writes[0].kind, "timeout");
  assert.ok(disconnects >= 1);
  assert.ok(clearCalls >= 1);
});

test("page catalog entries navigate through validated reader hrefs without synthetic clicks", async () => {
  let selectChapter;
  const assigned = [];
  const pane = {addEventListener() {}, removeEventListener() {}};
  const ui = {root: {parentNode: null, setAttribute() {}, remove() {}}, refs: {readerPane: pane}, renderSnapshot() {}, setStatus() {}, destroy() {}};
  const box = {parentNode: {}};
  const locationLike = {href: "https://fanqienovel.com/reader/456", assign(href) { assigned.push(href); }};
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? {append(node) { node.parentNode = this; }} : null; }, body: {append() {}, removeChild() {}}, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike,
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "123", chapterId: "456", chapterTitle: "第四章"})},
    skinFactory: {create: (options) => { selectChapter = options.onChapterSelect; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => true})},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  assert.equal(await selectChapter({chapterId: "789", href: "https://fanqienovel.com/reader/789"}), true);
  assert.deepEqual(assigned, ["https://fanqienovel.com/reader/789"]);
  await controller.disable();
});
