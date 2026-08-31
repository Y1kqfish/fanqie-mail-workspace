import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/controller.js";

function makeHarness({bookId = "book-1", chapterId = "100", storageArea = null, catalogSession = null, storeOverrides = {}, performanceProbe = null} = {}) {
  let currentBox = {chapterId, parentNode: {}};
  const app = {children: [], append(node) { this.children.push(node); node.parentNode = this; }, removeChild(node) { this.children = this.children.filter((item) => item !== node); node.parentNode = null; }};
  const pane = {children: [], addEventListener() {}, removeEventListener() {}, append(node) { this.children.push(node); node.parentNode = this; }, removeChild(node) { this.children = this.children.filter((item) => item !== node); node.parentNode = null; }};
  const rendered = [];
  const catalogRenders = [];
  const callbacks = {};
  const syncOptions = [];
  const store = {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, getReadMany: async () => ({}), setEnabled: async () => {}, ...storeOverrides};
  const skinFactory = {create(options) { Object.assign(callbacks, options); return {
    root: {parentNode: null, setAttribute() {}, remove() { app.removeChild(this); }},
    refs: {readerPane: pane, catalogSyncSlot: {hidden: false}, status: {textContent: ""}},
    renderSnapshot(snapshot) { rendered.push(snapshot); }, renderCatalog(entries, options = {}) { catalogRenders.push(entries); options.performanceMeasure?.finish?.(); },
    beginCatalogMeasure(count) { return performanceProbe?.begin?.(count) || null; },
    setStatus() {}, setCatalogState() {}, enterNativeCatalogSync() {}, updateNativeCatalogSync() {}, exitNativeCatalogSync() {}, destroy() {},
  }; }};
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {querySelector(selector) { return selector === "#app" ? app : null; }, body: app, documentElement: {setAttribute() {}}, addEventListener() {}, removeEventListener() {}},
    locationLike: {href: `https://fanqienovel.com/reader/${chapterId}`, assign() {}},
    windowLike: {addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => currentBox, parseReaderSnapshot: () => ({bookId, chapterId: currentBox.chapterId, chapterTitle: `第${currentBox.chapterId}章`})},
    skinFactory,
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, showNative: () => true, showPane: () => true, restore: () => true})},
    nativeCatalogSync: {create(options) { syncOptions.push(options); return {start: () => true, dispose() {}, cancel() { return true; }}; }},
    catalogSession,
    storageArea,
    store,
  });
  return {controller, callbacks, syncOptions, rendered, catalogRenders, setBox(box) {currentBox = box;}};
}

test("catalog restore timing starts before the batched read-state merge", async () => {
  let now = 0;
  const measures = [];
  const performanceProbe = {
    begin(count) {
      const measure = {count, startedAt: now, finishedAt: null, finish() { this.finishedAt = now; }, cancel() { this.cancelled = true; }};
      measures.push(measure);
      return measure;
    },
  };
  const harness = makeHarness({
    bookId: "",
    chapterId: "101",
    performanceProbe,
    storeOverrides: {getReadMany: async () => { now = 75; return {}; }},
    catalogSession: {create: () => ({async restore() { return {bookId: "title:%E6%B5%8B%E8%AF%95", entries: [{chapterId: "101", title: "第二章", visited: false}]}; }})},
  });

  await harness.controller.start();
  assert.equal(measures.length, 1);
  assert.equal(measures[0].count, 1);
  assert.equal(measures[0].startedAt, 0);
  assert.equal(measures[0].finishedAt, 75);
});

test("same-book remount restores the complete session catalog and moves active state to the new chapter", async () => {
  const harness = makeHarness();
  await harness.controller.start();
  await harness.callbacks.onCatalogSync();
  const entries = Array.from({length: 1087}, (_, index) => ({chapterId: String(100 + index), title: `第${index + 1}章`, visited: false, active: index === 0}));
  await harness.syncOptions[0].onSuccess(entries);
  harness.setBox({chapterId: "101", parentNode: {}});
  await harness.controller.refresh();
  const restored = harness.catalogRenders.at(-1);
  assert.equal(restored.length, 1087);
  assert.equal(restored.find((entry) => entry.chapterId === "101").active, true);
  assert.equal(restored.find((entry) => entry.chapterId === "101").visited, true);
});

test("catalog sync can be started again after an error", async () => {
  const harness = makeHarness();
  await harness.controller.start();
  assert.equal(await harness.callbacks.onCatalogSync(), true);
  await harness.syncOptions[0].onError({kind: "timeout", message: "目录超时"});
  assert.equal(await harness.callbacks.onCatalogSync(), true);
  assert.equal(harness.syncOptions.length, 2);
  await harness.controller.disable();
});

test("chapter navigation saves repeatable metadata before leaving the page", async () => {
  const session = {records: [], saves: 0};
  const catalogSession = {
    create() {
      return {
        async save(payload) { session.saves += 1; session.records.push(payload); return {ok: true}; },
        async restore() { return session.records.at(-1) || null; },
        async clear() { return {ok: true}; },
      };
    },
  };
  const first = makeHarness({catalogSession});
  await first.controller.start();
  await first.callbacks.onCatalogSync();
  await first.syncOptions[0].onSuccess([
    {chapterId: "100", title: "第一章", order: 0, href: "https://fanqienovel.com/reader/100", visited: true},
    {chapterId: "101", title: "第二章", order: 1, href: "https://fanqienovel.com/reader/101", visited: false},
  ]);
  assert.equal(await first.callbacks.onChapterSelect({chapterId: "101", title: "第二章", href: "https://fanqienovel.com/reader/101"}), true);
  assert.equal(session.saves, 1);
  assert.equal(session.records.at(-1).entries.length, 2);

  const next = makeHarness({chapterId: "101", catalogSession});
  await next.controller.start();
  assert.equal(next.catalogRenders.at(-1).length, 2);
  const repeated = makeHarness({chapterId: "100", catalogSession});
  await repeated.controller.start();
  assert.equal(repeated.catalogRenders.at(-1).length, 2);
  await first.controller.disable();
  await next.controller.disable();
  await repeated.controller.disable();
});

test("same-tab catalog session survives a new controller document and can be restored repeatedly", async () => {
  const session = {record: null, saves: 0, restores: 0, clears: 0};
  const catalogSession = {
    create() {
      return {
        async save(payload) { session.saves += 1; session.record = payload; return {ok: true}; },
        async restore() { session.restores += 1; return session.record; },
        async clear() { session.clears += 1; session.record = null; return {ok: true}; },
      };
    },
  };
  const first = makeHarness({catalogSession});
  await first.controller.start();
  await first.callbacks.onCatalogSync();
  await first.syncOptions[0].onSuccess([
    {chapterId: "100", title: "第一章", order: 0, href: "https://fanqienovel.com/reader/100", visited: true},
    {chapterId: "101", title: "第二章", order: 1, href: "https://fanqienovel.com/reader/101", visited: false},
  ]);
  assert.equal(await first.callbacks.onChapterSelect({chapterId: "101", title: "第二章", href: "https://fanqienovel.com/reader/101"}), true);
  assert.equal(session.saves, 1);

  const next = makeHarness({chapterId: "101", catalogSession});
  await next.controller.start();
  assert.equal(session.restores, 2);
  assert.equal(next.catalogRenders.at(-1).length, 2);
  const repeated = makeHarness({chapterId: "100", catalogSession});
  await repeated.controller.start();
  assert.equal(session.restores, 3);
  assert.equal(repeated.catalogRenders.at(-1).length, 2);
});

test("unknown book identity restores by verified current-chapter membership", async () => {
  const catalogSession = {
    create() {
      return {
        async restore() {
          return {
            bookId: "title:%E6%B5%8B%E8%AF%95%E4%B9%A6",
            entries: [
              {chapterId: "100", title: "第一章", order: 0, href: "https://fanqienovel.com/reader/100", visited: false},
              {chapterId: "101", title: "第二章", order: 1, href: "https://fanqienovel.com/reader/101", visited: false},
            ],
          };
        },
      };
    },
  };
  const harness = makeHarness({bookId: "", chapterId: "101", catalogSession});
  await harness.controller.start();
  assert.equal(harness.catalogRenders.at(-1).length, 2);
  assert.equal(harness.catalogRenders.at(-1).find((entry) => entry.chapterId === "101").active, true);
});
