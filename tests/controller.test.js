import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/controller.js";

test("controller mounts once, delegates native actions, loads catalog, and restores", async () => {
  const calls = [];
  const previousButton = {click: () => calls.push("previous")};
  const nextButton = {click: () => calls.push("next")};
  const nativeCatalogItem = {addEventListener() {}, removeEventListener() {}};
  const scrollEvents = [];
  const pane = {
    scrollTop: 0,
    scrollHeight: 100,
    clientHeight: 50,
    addEventListener: (...args) => scrollEvents.push(["add", ...args]),
    removeEventListener: (...args) => scrollEvents.push(["remove", ...args]),
  };
  const box = {parentNode: {insertBefore() {}, removeChild() {}}, scrollTop: 0, addEventListener() {calls.push("box-scroll");}};
  const body = {append: (node) => {node.parentNode = body;}};
  const uiCallbacks = {};
  const dockMounts = [];
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot: () => {},
    renderCatalog: (entries) => {calls.push(["renderCatalog", entries.length]);},
    renderMessage: (message) => {calls.push(["message", message]);},
    setStatus: (state, message) => {calls.push(["status", state, message]);},
    destroy: () => calls.push("ui-destroy"),
  };
  const adapter = {
    matchesReaderPage: () => true,
    getReaderBox: () => box,
    parseReaderSnapshot: () => ({bookId: "book-1", chapterId: "c-1", bookTitle: "测试书", chapterTitle: "第一章", previousButton, nextButton}),
    findNativeCatalogItem: () => nativeCatalogItem,
    findNativeButton: () => null,
    getCurrentChapterId: () => "c-1",
  };
  const skinFactory = {create: (options) => {Object.assign(uiCallbacks, options); return ui;}};
  const transferApi = {
    mount: () => ({scrollElement: pane, getProgress: () => 0.2, setProgress: (value) => calls.push(["setProgress", value]), restore: () => calls.push("transfer-restore")}),
  };
  const store = {
    getSettings: async () => ({enabled: true, density: "comfortable"}),
    setEnabled: async (value) => {calls.push(["enabled", value]);},
    getRead: async () => false,
    setRead: async () => {},
    getProgress: async () => 0.4,
    setProgress: async () => {},
  };
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {body, createComment: () => ({})},
    locationLike: new URL("https://fanqienovel.com/reader/book-1?chapter_id=c-1"),
    windowLike: {scrollX: 0, scrollY: 0, addEventListener() {}},
    navigationTimeoutMs: 0,
    adapter,
    skinFactory,
    transferApi,
    nativeCatalogDock: {
      mount: (options) => {
        dockMounts.push(options);
        return {restore: () => true};
      },
    },
    catalogFactory: {
      create: () => ({
        load: async () => [{chapterId: "c-1", title: "第一章", active: true, visited: false, element: {click: () => calls.push("chapter")}}],
        dispose() {},
      }),
    },
    store,
  });

  assert.equal(await controller.start(), true);
  assert.equal(dockMounts.length, 1);
  assert.equal(dockMounts[0].shell, ui.root);
  assert.deepEqual(calls.filter((call) => Array.isArray(call) && call[0] === "setProgress"), [["setProgress", 0.4]]);
  assert.equal(calls.includes("box-scroll"), false);
  assert.equal(scrollEvents[0][0], "add");
  assert.equal(await controller.start(), true);
  assert.equal(calls.filter((call) => call === "transfer-restore").length, 0);
  await uiCallbacks.onPrev();
  await uiCallbacks.onNext();
  assert.deepEqual(calls.filter((call) => call === "previous" || call === "next").slice(-2), ["previous", "next"]);
  await controller.loadCatalog();
  assert.equal(calls.includes("catalog"), false);
  assert.deepEqual(calls.filter((call) => Array.isArray(call) && call[0] === "renderCatalog").at(-1), ["renderCatalog", 1]);
  await uiCallbacks.onChapterSelect({element: {click: () => calls.push("chapter")}});
  assert.equal(calls.at(-1), "chapter");
  await uiCallbacks.onRestore();
  assert.equal(calls.filter((call) => call === "transfer-restore").length, 1);
  assert.equal(scrollEvents.at(-1)[0], "remove");
});

test("controller refuses to navigate through a detached catalog entry", async () => {
  let selectChapter;
  let clicked = 0;
  const pane = {addEventListener() {}, removeEventListener() {}};
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot() {},
    setStatus: (_state, message) => { ui.status = message; },
    destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {body: {append() {}, removeChild() {}}, createComment: () => ({})},
    locationLike: new URL("https://fanqienovel.com/reader/book-1?chapter_id=c-1"),
    windowLike: {addEventListener() {}, setTimeout, clearTimeout},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => ({parentNode: {}}),
      parseReaderSnapshot: () => ({bookId: "book-1", chapterId: "c-1"}),
    },
    skinFactory: {create: (options) => { selectChapter = options.onChapterSelect; return ui; }},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => true})},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}},
  });
  assert.equal(await controller.start(), true);
  const detached = {parentNode: null, click: () => {clicked += 1;}};
  assert.equal(await selectChapter({chapterId: "c-2", element: detached}), false);
  assert.equal(clicked, 0);
  assert.equal(ui.status, "章节条目不可用");
});

test("controller enables tab appearance after mount and releases early transition on disable", async () => {
  const calls = [];
  const pane = {addEventListener() {}, removeEventListener() {}};
  const box = {parentNode: {insertBefore() {}, removeChild() {}}};
  const ui = {root: {parentNode: null}, refs: {readerPane: pane}, renderSnapshot() {}, setStatus() {}, destroy() {calls.push("destroy");}};
  const tabAppearance = {
    enable() { calls.push("appearance-enable"); return true; },
    restore() { calls.push("appearance-restore"); return true; },
  };
  const earlyTransition = {
    release() { calls.push("early-release"); return true; },
  };
  const controller = globalThis.Fqmail.controller.create({
    documentLike: {body: {append(node) {node.parentNode = this;}}, querySelector() { return null; }},
    locationLike: new URL("https://fanqienovel.com/reader/100"),
    windowLike: {addEventListener() {}, removeEventListener() {}},
    adapter: {matchesReaderPage: () => true, getReaderBox: () => box, parseReaderSnapshot: () => ({bookId: "100", chapterId: "100", chapterTitle: "第一章"})},
    skinFactory: {create: () => ui},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => true})},
    store: {getSettings: async () => ({enabled: true}), getProgress: async () => 0, setProgress: async () => {}, setRead: async () => {}, setEnabled: async () => {}},
    tabAppearance,
    earlyTransition,
  });
  assert.equal(await controller.start(), true);
  assert.equal(calls.includes("appearance-enable"), true);
  await controller.disable();
  assert.equal(calls.includes("appearance-restore"), true);
  assert.equal(calls.includes("early-release"), true);
});
