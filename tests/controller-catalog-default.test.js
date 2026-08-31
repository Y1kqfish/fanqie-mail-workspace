import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/controller.js";

test("catalog runtime uses the explicit native reader sync by default", async () => {
  let syncStarts = 0;
  let syncOptions;
  let nativeItemLookups = 0;
  let catalogCreates = 0;
  const status = {textContent: ""};
  const chapterList = {children: []};
  const ui = {
    root: {textContent: "", parentNode: null},
    refs: {readerPane: {addEventListener() {}, removeEventListener() {}}, catalogSyncSlot: {hidden: false}, status, chapterList},
    renderSnapshot: () => {chapterList.children = [{}];},
    renderCatalog: () => {},
    setStatus: (state, message) => {ui.root.state = state; status.textContent = message;},
    destroy() {},
  };
  const adapter = {
    matchesReaderPage: () => true,
    getReaderBox: () => ({parentNode: {}}),
    parseReaderSnapshot: () => ({bookId: "book-1", chapterId: "chapter-1", chapterTitle: "第一章"}),
    findNativeCatalogItem: () => { nativeItemLookups += 1; return {parentNode: {parentNode: {id: "app"}}, addEventListener() {}, removeEventListener() {}}; },
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {
      body: {append(node) {node.parentNode = this;}, removeChild() {}},
    querySelector: (selector) => selector === "#app" ? {append(node) {node.parentNode = this;}} : null,
      createComment: () => ({}),
    },
    locationLike: new URL("https://fanqienovel.com/reader/book-1"),
    windowLike: {addEventListener() {}, setTimeout, clearTimeout},
    adapter,
    catalogFactory: {create: () => { catalogCreates += 1; return {load: async () => [], dispose() {}}; }},
    nativeCatalogDock: {mount: () => ({restore: () => true, isConnected: () => true})},
    skinFactory: {create: () => ui},
    transferApi: {mount: () => ({scrollElement: ui.refs.readerPane, getProgress: () => 0, setProgress() {}, restore: () => true})},
    nativeCatalogSync: {create: (options) => {syncOptions = options; return {start: () => {syncStarts += 1; return true;}, dispose() {}, cancel() {return true;}};}},
    store: {getSettings: async () => ({enabled: true}), setRead: async () => {}, getProgress: async () => 0, setProgress: async () => {}},
  });

  assert.equal(await controller.start(), true);
  assert.equal(nativeItemLookups, 1);
  assert.equal(catalogCreates, 1);
  assert.equal(syncStarts, 0);
  assert.equal(ui.refs.catalogSyncSlot.hidden, false);
  assert.equal(chapterList.children.length, 1);
  assert.equal(status.textContent, "正文已连接");
  assert.equal(typeof syncOptions, "undefined");
});
