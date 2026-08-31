import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/controller.js";

function makeHarness({replaceOnShow = true} = {}) {
  const timers = [];
  const observers = [];
  let currentBox;
  let skinCreates = 0;
  let showNativeCalls = 0;
  let showPaneCalls = 0;
  let shellHidden = false;
  let nativeStarts = 0;
  let nativeOptions = null;
  let skinOptions = null;

  class FakeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observeCalls = 0;
      this.disconnectCalls = 0;
      observers.push(this);
    }
    observe() { this.observeCalls += 1; }
    disconnect() { this.disconnectCalls += 1; }
    emit(records) { this.callback(records); }
  }

  const app = {append(node) { node.parentNode = app; }};
  const readerRoot = {className: "muye-reader"};
  const makeBox = () => ({parentNode: readerRoot, closest: () => readerRoot});
  currentBox = makeBox();
  const nativeItem = {parentNode: readerRoot, addEventListener() {}, removeEventListener() {}};
  const pane = {addEventListener() {}, removeEventListener() {}};
  const locationLike = {href: "https://fanqienovel.com/reader/100"};

  const skinFactory = {
    create(options) {
      skinCreates += 1;
      skinOptions = options;
      const root = {parentNode: null, style: {}, setAttribute() {}, remove() { this.parentNode = null; }};
      return {
        root,
        refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
        renderSnapshot() {}, renderCatalog() {}, setStatus() {}, setCatalogState() {},
        enterNativeCatalogSync() { shellHidden = true; },
        exitNativeCatalogSync() { shellHidden = false; },
        destroy() {},
        options,
      };
    },
  };

  const transfer = {
    scrollElement: pane,
    getProgress: () => 0,
    setProgress() {},
    showNative() {
      showNativeCalls += 1;
      if (replaceOnShow) {
        currentBox = makeBox();
        observers[0]?.emit([{target: app, addedNodes: [currentBox], removedNodes: []}]);
      }
      return true;
    },
    showPane() { showPaneCalls += 1; return true; },
    restore: () => true,
  };

  const controller = globalThis.Fqmail.controller.create({
    documentLike: {
      querySelector(selector) { return selector === "#app" ? app : null; },
      body: app,
      documentElement: {setAttribute() {}},
      addEventListener() {}, removeEventListener() {},
    },
    locationLike,
    windowLike: {
      MutationObserver: FakeObserver,
      addEventListener() {}, removeEventListener() {},
      setTimeout(fn, ms) { const timer = {fn, ms, cancelled: false}; timers.push(timer); return timer; },
      clearTimeout(timer) { if (timer) timer.cancelled = true; },
    },
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => currentBox,
      findNativeCatalogItem: () => nativeItem,
      parseReaderSnapshot: () => ({bookId: "book", chapterId: "100", chapterTitle: "第一章"}),
    },
    skinFactory,
    transferApi: {mount: () => transfer},
    nativeCatalogDock: {mount: () => ({restore: () => true, isConnected: () => true})},
    catalogFactory: {create: () => ({load: async () => [], dispose() {}})},
    nativeCatalogSync: {create(options) {
      nativeOptions = options;
      return {
        start() { nativeStarts += 1; return true; },
        dispose() {},
        cancel() { return true; },
      };
    }},
    store: {
      getSettings: async () => ({enabled: true}), getProgress: async () => 0,
      setProgress: async () => {}, setRead: async () => {}, getReadMany: async () => ({}),
      setEnabled: async () => {},
    },
  });

  return {
    controller, timers, observers, get nativeOptions() { return nativeOptions; }, get skinOptions() { return skinOptions; },
    get skinCreates() { return skinCreates; }, get showNativeCalls() { return showNativeCalls; },
    get showPaneCalls() { return showPaneCalls; }, get shellHidden() { return shellHidden; },
    get nativeStarts() { return nativeStarts; },
    runTimers() { for (const timer of timers.splice(0)) if (!timer.cancelled) timer.fn(); },
  };
}

test("native sync transition ignores showNative box mutations and keeps the native session alive", async () => {
  const harness = makeHarness();
  await harness.controller.start();
  assert.equal(await harness.skinOptions.onCatalogSync(), true);
  harness.runTimers();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(harness.skinCreates, 1);
  assert.equal(harness.showNativeCalls, 1);
  assert.equal(harness.showPaneCalls, 0);
  assert.equal(harness.shellHidden, true);
  assert.equal(harness.nativeStarts, 1);
  assert.ok(harness.nativeOptions);
  await harness.nativeOptions.onError({kind: "timeout", message: "目录超时"});
  assert.equal(harness.showPaneCalls, 1);
  assert.equal(harness.shellHidden, false);
  assert.ok(harness.observers[0].observeCalls >= 2);
});

test("native sync success, cancel, and error each restore once and allow a new start", async () => {
  const harness = makeHarness({replaceOnShow: false});
  await harness.controller.start();
  assert.equal(harness.nativeStarts, 0);
  assert.equal(harness.observers.length, 1);
  await harness.skinOptions.onCatalogSync();
  await harness.nativeOptions.onSuccess([{chapterId: "100", title: "第一章"}]);
  assert.equal(harness.showPaneCalls, 1);
  await harness.skinOptions.onCatalogSync();
  await harness.nativeOptions.onCancel();
  assert.equal(harness.showPaneCalls, 2);
  await harness.skinOptions.onCatalogSync();
  await harness.nativeOptions.onError({kind: "timeout", message: "目录超时"});
  assert.equal(harness.showPaneCalls, 3);
  assert.equal(harness.nativeStarts, 3);
  assert.ok(harness.observers[0].observeCalls >= 8);
});

test("entering native sync cancels a lifecycle refresh that was already queued", async () => {
  const harness = makeHarness({replaceOnShow: false});
  await harness.controller.start();
  harness.observers[0].emit([{target: {}, addedNodes: [], removedNodes: []}]);
  assert.equal(harness.timers.length, 1);
  assert.equal(await harness.skinOptions.onCatalogSync(), true);
  harness.runTimers();
  await Promise.resolve();
  assert.equal(harness.skinCreates, 1);
  assert.equal(harness.showPaneCalls, 0);
  assert.equal(harness.shellHidden, true);
});
