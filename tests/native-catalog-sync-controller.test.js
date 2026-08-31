import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/native-catalog-sync.js";
import "../src/core/controller.js";

test("controller routes sync mail to the native reader workflow and never starts hidden page loading", async () => {
  let syncCallback;
  let nativeStarts = 0;
  let sourceLoads = 0;
  const pane = {addEventListener() {}, removeEventListener() {}};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const status = {textContent: ""};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}},
    refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status},
    renderSnapshot() {}, setStatus(_state, message) { status.textContent = message; }, setCatalogState() {},
    enterNativeCatalogSync() {}, updateNativeCatalogSync() {}, exitNativeCatalogSync() {}, destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {
      querySelector(selector) { return selector === "#app" ? app : null; },
      body: app,
      documentElement: {setAttribute() {}},
      addEventListener() {}, removeEventListener() {},
    },
    locationLike: {href: "https://fanqienovel.com/reader/100"},
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => box,
      findNativeCatalogItem: () => ({parentNode: {}}),
      parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"}),
    },
    skinFactory: {create(options) { syncCallback = options.onCatalogSync; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, showNative: () => true, showPane: () => true, restore: () => true})},
    nativeCatalogSync: {create: () => ({start() { nativeStarts += 1; return true; }, dispose() {}, cancel() {}})},
    catalogPageSource: {getPageUrl: () => "https://fanqienovel.com/page/book", load: async () => { sourceLoads += 1; }},
    catalogPageWorkflow: {create: () => ({load: async () => { sourceLoads += 1; }, dispose() {}})},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  assert.equal(typeof syncCallback, "function");
  assert.equal(await syncCallback(), true);
  assert.equal(nativeStarts, 1);
  assert.equal(sourceLoads, 0);
  await controller.disable();
});

test("controller atomically renders native entries after close and merges local read state once", async () => {
  let syncOptions; let rendered; let readMany = 0; let status = ""; let measureCancelled = 0;
  const pane = {addEventListener() {}, removeEventListener() {}};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}},
    refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
    renderSnapshot() {}, renderCatalog(entries) { rendered = entries; }, beginCatalogMeasure() { return {finish() {}, cancel() { measureCancelled += 1; }}; },
    setStatus(_state, message) { status = message; }, setCatalogState() {},
    enterNativeCatalogSync() {}, updateNativeCatalogSync() {}, exitNativeCatalogSync() {}, destroy() {},
  };
  const nativeSession = {start: () => true, dispose() {}, cancel() {return true;}};
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: "https://fanqienovel.com/reader/100"},
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"}), findNativeCatalogItem: () => ({parentNode: {}})},
    skinFactory: {create(options) { syncOptions = options; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, showNative: () => true, showPane: () => true, restore: () => true})},
    nativeCatalogSync: {create(options) { syncOptions.native = options; return nativeSession; }},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, getReadMany: async () => {readMany += 1; return {"101": true};}, setEnabled: async () => {}},
  });
  await controller.start();
  await syncOptions.onCatalogSync();
  await syncOptions.native.onSuccess([
    {chapterId: "100", title: "第一章", visited: false},
    {chapterId: "101", title: "第二章", visited: false},
  ]);
  assert.equal(readMany, 1);
  assert.equal(rendered[1].visited, true);
  assert.match(status, /目录已加载 2 章/);
  await controller.disable();
});

test("controller cancels catalog timing when the native session save fails", async () => {
  let syncOptions; let cancelled = 0;
  const pane = {addEventListener() {}, removeEventListener() {}};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}},
    refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
    renderSnapshot() {}, renderCatalog() {}, beginCatalogMeasure() { return {finish() {}, cancel() { cancelled += 1; }}; },
    setStatus() {}, setCatalogState() {}, enterNativeCatalogSync() {}, updateNativeCatalogSync() {}, exitNativeCatalogSync() {}, destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: "https://fanqienovel.com/reader/100"},
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, findNativeCatalogItem: () => ({parentNode: {}}), parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"})},
    skinFactory: {create(options) { syncOptions = options; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, showNative: () => true, showPane: () => true, restore: () => true})},
    nativeCatalogSync: {create(options) { syncOptions.native = options; return {start: () => true, dispose() {}, cancel() {return true;}}; }},
    catalogSession: {create: () => ({save: async () => ({ok: false}), clear: async () => ({ok: true})})},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, getReadMany: async () => ({}), setEnabled: async () => {}},
  });
  await controller.start();
  await syncOptions.onCatalogSync();
  await syncOptions.native.onSuccess([{chapterId: "100", title: "第一章", visited: false}]);
  assert.equal(cancelled, 1);
  await controller.disable();
});

test("controller never bypasses a locked native chapter", async () => {
  let selectChapter; const assigned = []; let status = "";
  const pane = {addEventListener() {}, removeEventListener() {}};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}}, refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
    renderSnapshot() {}, setStatus(_state, message) { status = message; }, setCatalogState() {}, destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: "https://fanqienovel.com/reader/100", assign(href) { assigned.push(href); }},
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"})},
    skinFactory: {create(options) { selectChapter = options.onChapterSelect; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, showNative: () => true, showPane: () => true, restore: () => true})},
    nativeCatalogSync: {create: () => ({start: () => true, dispose() {}, cancel() {return true;}})},
    store: {getSettings: async () => ({enabled: true}), setEnabled: async () => {}, setProgress: async () => {}, getProgress: async () => 0, setRead: async () => {}},
  });
  await controller.start();
  assert.equal(await selectChapter({chapterId: "101", href: "https://fanqienovel.com/reader/101", locked: true}), false);
  assert.deepEqual(assigned, []);
  assert.match(status, /锁定/);
  await controller.disable();
});

test("作品页回退只有在原生同步失败后由用户明确触发", async () => {
  let syncOptions; let fallbackStarts = 0; let opened = 0; let renders = 0; let status = "";
  const pane = {addEventListener() {}, removeEventListener() {}};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}}, refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
    renderSnapshot() {}, renderCatalog() { renders += 1; }, setStatus(_state, message) { status = message; }, setCatalogState() {},
    enterNativeCatalogSync() {}, updateNativeCatalogSync() {}, exitNativeCatalogSync() {}, destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: "https://fanqienovel.com/reader/100"},
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, open() { opened += 1; return {}; }},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"})},
    skinFactory: {create(options) { syncOptions = options; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, showNative: () => true, showPane: () => true, restore: () => true})},
    nativeCatalogSync: {create(options) { syncOptions.native = options; return {start: () => true, dispose() {}, cancel() {return true;}}; }},
    catalogPageParser: {findPageUrl: () => "https://fanqienovel.com/page/book"},
    catalogPageWorkflow: {create: () => ({startFallback() { fallbackStarts += 1; return true; }, dispose() {}})},
    catalogTransfer: {createToken: () => "token-1234"},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  await syncOptions.onCatalogSync();
  syncOptions.native.onError(Object.assign(new Error("目录未打开"), {kind: "timeout"}));
  assert.equal(renders, 0);
  assert.equal(status, "目录未打开");
  assert.equal(syncOptions.native.onFallback(), true);
  assert.equal(fallbackStarts, 1);
  assert.equal(opened, 0);
  await controller.disable();
});

test("controller returns the reader box to the live page before native sync and back after completion", async () => {
  let syncOptions; const events = []; let bound = 0; let unbound = 0;
  const pane = {addEventListener() { bound += 1; }, removeEventListener() { unbound += 1; }};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}},
    refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
    renderSnapshot() {}, renderCatalog() {}, setStatus() {}, setCatalogState() {},
    enterNativeCatalogSync() { events.push("enter"); },
    updateNativeCatalogSync() {}, exitNativeCatalogSync() { events.push("exit"); }, destroy() {},
  };
  const transfer = {
    scrollElement: pane, getProgress: () => 0.25, setProgress() {}, restore: () => true,
    showNative() { events.push("native"); return true; },
    showPane() { events.push("pane"); return true; },
  };
  const nativeSession = {start: () => true, dispose() {}, cancel() { return true; }};
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: "https://fanqienovel.com/reader/100"},
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"}), findNativeCatalogItem: () => ({parentNode: {}})},
    skinFactory: {create(options) { syncOptions = options; return ui; }},
    transferApi: {mount: () => transfer},
    nativeCatalogSync: {create(options) { syncOptions.native = options; return nativeSession; }},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  events.length = 0; bound = 0; unbound = 0;
  assert.equal(await syncOptions.onCatalogSync(), true);
  assert.deepEqual(events.slice(0, 2), ["native", "enter"]);
  assert.equal(unbound >= 1, true);
  await syncOptions.native.onSuccess([{chapterId: "100", title: "第一章", visited: false}]);
  assert.equal(events.includes("pane"), true);
  assert.equal(events.includes("exit"), true);
  assert.equal(bound >= 1, true);
  await controller.disable();
});

test("controller does not enter native sync when the live reader parent cannot be restored", async () => {
  let syncCallback; let nativeStarts = 0; let bound = 0; let status = "";
  const pane = {addEventListener() { bound += 1; }, removeEventListener() {}};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const ui = {root: {parentNode: null, setAttribute() {}, remove() {}}, refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}}, renderSnapshot() {}, setStatus(_state, message) { status = message; }, setCatalogState() {}, enterNativeCatalogSync() { throw new Error("must not hide shell"); }, destroy() {}};
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: "https://fanqienovel.com/reader/100"}, windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"}), findNativeCatalogItem: () => ({parentNode: {}})},
    skinFactory: {create(options) { syncCallback = options.onCatalogSync; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => true, showNative: () => false, showPane: () => true})},
    nativeCatalogSync: {create: () => ({start() { nativeStarts += 1; return true; }, dispose() {}, cancel() { return true; }})},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  assert.equal(await syncCallback(), false);
  assert.equal(nativeStarts, 0);
  assert.match(status, /无法恢复番茄原生阅读布局/);
  assert.equal(bound >= 2, true);
  await controller.disable();
});

test("controller restores the pane and shell after native sync reports an incomplete panel", async () => {
  let syncOptions; const events = []; let status = "";
  const pane = {addEventListener() {}, removeEventListener() {}};
  const box = {parentNode: {}, closest: () => ({className: "muye-reader"})};
  const app = {append(node) { node.parentNode = app; }};
  const ui = {
    root: {parentNode: null, setAttribute() {}, remove() {}}, refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
    renderSnapshot() {}, setStatus(_state, message) { status = message; }, setCatalogState() {},
    enterNativeCatalogSync() { events.push("enter"); }, exitNativeCatalogSync() { events.push("exit"); }, updateNativeCatalogSync() {}, destroy() {},
  };
  const transfer = {scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => true,
    showNative() { events.push("native"); return true; }, showPane() { events.push("pane"); return true; }};
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: "https://fanqienovel.com/reader/100"}, windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"}), findNativeCatalogItem: () => ({parentNode: {}})},
    skinFactory: {create(options) { syncOptions = options; return ui; }}, transferApi: {mount: () => transfer},
    nativeCatalogSync: {create(options) { syncOptions.native = options; return {start: () => true, dispose() {}, cancel() { return true; }}; }},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
  });
  await controller.start();
  await syncOptions.onCatalogSync();
  await syncOptions.native.onError({kind: "incomplete", message: "目录面板未完整生成"});
  assert.deepEqual(events, ["native", "enter", "pane", "exit"]);
  assert.match(status, /目录面板未完整生成/);
  await controller.disable();
});
