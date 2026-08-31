import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/controller.js";
import "../src/core/catalog-controller.js";

test("catalog wait performs a final DOM check at the timeout boundary", async () => {
  const OriginalObserver = globalThis.MutationObserver;
  let ready = false;
  class SilentMutationObserver {
    observe() {}
    disconnect() {}
  }
  globalThis.MutationObserver = SilentMutationObserver;
  try {
    setTimeout(() => {ready = true;}, 2);
    const found = await globalThis.Fqmail.catalog.defaultWaitForCatalog(
      {querySelector: () => ({})},
      {parseCatalog: () => ready ? [{chapterId: "c-1"}] : []},
      8,
    );
    assert.equal(found, true);
  } finally {
    globalThis.MutationObserver = OriginalObserver;
  }
});

function makeHarness({catalogEntries = [], waitForCatalog = async () => {}, boxes = null, hasNativeCatalog = true} = {}) {
  const events = [];
  let currentBox = boxes?.[0] || {parentNode: {}, addEventListener() {}, removeEventListener() {}};
  let catalogReady = catalogEntries.length > 0;
  const nativeCatalogItem = {
    addEventListener() {},
    removeEventListener() {},
  };
  const callbacks = {};
  const body = {
    children: [],
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  };
  const pane = {
    scrollTop: 0,
    scrollHeight: 100,
    clientHeight: 50,
    addEventListener: (...args) => events.push(["pane-add", ...args]),
    removeEventListener: (...args) => events.push(["pane-remove", ...args]),
  };
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot() {},
    renderCatalog: (entries) => events.push(["render-catalog", entries]),
    renderMessage: (message) => events.push(["message", message]),
    setStatus: (state, message) => events.push(["status", state, message]),
    destroy: () => body.removeChild(ui.root),
  };
  const adapter = {
    matchesReaderPage: () => true,
    getReaderBox: () => currentBox,
    parseReaderSnapshot: () => ({bookId: "book-1", chapterId: currentBox.chapterId || "c-1", bookTitle: "测试书", chapterTitle: currentBox.chapterId || "第一章"}),
    findNativeCatalogItem: () => hasNativeCatalog ? nativeCatalogItem : null,
    parseCatalog: () => catalogReady ? catalogEntries : [],
  };
  const skinFactory = {
    create: (options) => {
      Object.assign(callbacks, options);
      return ui;
    },
  };
  const transferApi = {
    mount: () => ({
      scrollElement: pane,
      getProgress: () => 0.7,
      setProgress: (value) => events.push(["set-progress", value]),
      restore: () => events.push("transfer-restore"),
    }),
  };
  const store = {
    getSettings: async () => ({enabled: true}),
    setEnabled: async () => {},
    getRead: async () => false,
    setRead: async () => {},
    getProgress: async () => 0.2,
    setProgress: async (bookId, chapterId, value) => events.push(["save-progress", bookId, chapterId, value]),
  };
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {body, createComment: () => ({})},
    locationLike: new URL("https://fanqienovel.com/reader/chapter-1"),
    windowLike: {addEventListener() {}, setTimeout},
    adapter,
    skinFactory,
    transferApi,
    store,
    nativeCatalogDock: {mount: () => ({restore() {return true;}})},
    catalogFactory: {
      create: (options) => globalThis.Fqmail.catalog.create({...options, waitForCatalog}),
    },
  });
  callbacks.onLoadCatalog = controller.loadCatalog;
  return {
    controller,
    callbacks,
    events,
    body,
    adapter,
    store,
    pane,
    setCatalogReady(value) {catalogReady = value;},
    setCurrentBox(box) {currentBox = box;},
  };
}

function makeNavigationHarness({onNativeClick = () => {}, navigationTimeoutMs = 20} = {}) {
  const events = [];
  let chapterId = "c-1";
  const callbacks = {};
  const box = {parentNode: {}, children: [], addEventListener() {}, removeEventListener() {}};
  const pane = {
    children: [],
    addEventListener() {},
    removeEventListener() {},
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  };
  const nextButton = {
    parentNode: box,
    click() {
      onNativeClick(() => {chapterId = "c-2";});
    },
  };
  box.children.push(nextButton);
  const body = {
    children: [],
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  };
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot() {},
    setStatus: (state, message) => events.push(["status", state, message]),
    destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {body, createComment: () => ({})},
    locationLike: new URL("https://fanqienovel.com/reader/chapter-1"),
    windowLike: {addEventListener() {}},
    navigationTimeoutMs,
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => box,
      parseReaderSnapshot: () => ({
        bookId: "book-1",
        chapterId,
        bookTitle: "测试书",
        chapterTitle: chapterId === "c-1" ? "第一章" : "第二章",
        previousButton: null,
        nextButton,
      }),
      findNativeButton: () => nextButton,
    },
    skinFactory: {
      create: (options) => {
        Object.assign(callbacks, options);
        return ui;
      },
    },
    transferApi: {
      mount: () => ({
        scrollElement: pane,
        getProgress: () => 0,
        setProgress() {},
        restore() {},
      }),
    },
    store: {getSettings: async () => ({enabled: true})},
  });
  return {controller, callbacks, events};
}

function makeDisableHarness({restoreResult, reloadMode = "function"} = {}) {
  const events = [];
  const body = {
    children: [],
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  };
  const pane = {
    addEventListener: () => events.push("pane-add"),
    removeEventListener: () => events.push("pane-remove"),
  };
  const box = {parentNode: {}, addEventListener() {}, removeEventListener() {}};
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot() {},
    setStatus() {},
    destroy() {
      events.push("shell-destroy");
      body.removeChild(ui.root);
    },
  };
  const reload = reloadMode === "function"
    ? () => events.push("reload")
    : reloadMode === "throw"
      ? () => { events.push("reload"); throw new Error("reload unavailable"); }
      : undefined;
  class FakeMutationObserver {
    constructor() {}
    observe() {}
    disconnect() {events.push("observer-disconnect");}
  }
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {body, createComment: () => ({})},
    locationLike: {reload},
    windowLike: {addEventListener() {}, MutationObserver: FakeMutationObserver},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => box,
      parseReaderSnapshot: () => ({bookId: "book-1", chapterId: "c-1", bookTitle: "测试书", chapterTitle: "第一章"}),
    },
    skinFactory: {create: () => ui},
    transferApi: {
      mount: () => ({
        scrollElement: pane,
        getProgress: () => 0,
        setProgress() {},
        restore: () => {
          events.push("transfer-restore");
          return restoreResult;
        },
      }),
    },
    store: {
      getSettings: async () => ({enabled: true}),
      setEnabled: async (value) => events.push(["set-enabled", value]),
    },
  });
  return {controller, events};
}

test("directory loading is mutually exclusive and reports success or timeout", async () => {
  const messages = [];
  const originalError = console.error;
  console.error = (...args) => messages.push(args);
  try {
  let release;
  const pendingWait = new Promise((resolve) => {release = resolve;});
  const success = makeHarness({
    catalogEntries: [{chapterId: "c-1", title: "第一章", active: true, visited: false}],
    waitForCatalog: async () => pendingWait,
  });
  await success.controller.start();
  const first = success.callbacks.onLoadCatalog();
  const second = success.callbacks.onLoadCatalog();
  release();
  await Promise.all([first, second]);
  assert.deepEqual(success.events.filter((event) => Array.isArray(event) && event[0] === "status").at(-1), ["status", "success", "目录已加载 1 章"]);

  const timeout = makeHarness({waitForCatalog: async () => false});
  await timeout.controller.start();
  await timeout.callbacks.onLoadCatalog();
  assert.equal(timeout.events.filter((event) => Array.isArray(event) && event[0] === "render-catalog").length, 0);
  assert.deepEqual(timeout.events.filter((event) => Array.isArray(event) && event[0] === "status").at(-1), ["status", "error", "目录点击成功但目录未出现"]);
  assert.deepEqual(messages, [["[Fqmail] 目录点击成功但目录未出现"]]);
  } finally {
    console.error = originalError;
  }
});

test("controller reloads once after failed restore and only after cleanup", async () => {
  const failed = makeDisableHarness({restoreResult: false});
  await failed.controller.start();
  failed.events.length = 0;
  assert.equal(await failed.controller.disable(), false);
  assert.equal(failed.events.filter((event) => event === "reload").length, 1);
  const enabledIndex = failed.events.findIndex((event) => Array.isArray(event) && event[0] === "set-enabled");
  const disconnectIndex = failed.events.indexOf("observer-disconnect");
  const removeIndex = failed.events.indexOf("pane-remove");
  const restoreIndex = failed.events.indexOf("transfer-restore");
  const destroyIndex = failed.events.indexOf("shell-destroy");
  const reloadIndex = failed.events.indexOf("reload");
  assert.ok(enabledIndex < disconnectIndex);
  assert.ok(disconnectIndex < removeIndex);
  assert.ok(removeIndex < restoreIndex);
  assert.ok(restoreIndex < destroyIndex);
  assert.ok(destroyIndex < reloadIndex);

  const restored = makeDisableHarness({restoreResult: true});
  await restored.controller.start();
  assert.equal(await restored.controller.disable(), true);
  assert.equal(restored.events.includes("reload"), false);
});

test("controller reports short recovery error when reload is unavailable or throws", async () => {
  const messages = [];
  const originalError = console.error;
  console.error = (...args) => messages.push(args);
  try {
    for (const reloadMode of ["missing", "throw"]) {
      const harness = makeDisableHarness({restoreResult: false, reloadMode});
      await harness.controller.start();
      assert.equal(await harness.controller.disable(), false);
    }
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(messages, [["[Fqmail] 恢复失败"], ["[Fqmail] 恢复失败"]]);
});

test("new reader box saves old pane progress and keeps one shell", async () => {
  const firstBox = {chapterId: "c-1", parentNode: {}, addEventListener() {}, removeEventListener() {}};
  const secondBox = {chapterId: "c-2", parentNode: {}, addEventListener() {}, removeEventListener() {}};
  const harness = makeHarness({boxes: [firstBox]});
  await harness.controller.start();
  harness.setCurrentBox(secondBox);
  await harness.controller.refresh();
  assert.deepEqual(harness.events.filter((event) => Array.isArray(event) && event[0] === "save-progress"), [["save-progress", "book-1", "c-1", 0.7]]);
  assert.equal(harness.body.children.length, 1);
  assert.equal(harness.events.filter((event) => event === "transfer-restore").length, 1);
});

test("controller snapshots native controls before transfer and keeps the native root available", async () => {
  const snapshotOrder = [];
  const readerRoot = {style: {display: "block"}};
  const box = {
    parentNode: {},
    closest: () => readerRoot,
    addEventListener() {},
    removeEventListener() {},
  };
  const pane = {
    addEventListener() {},
    removeEventListener() {},
  };
  let transferMounted = false;
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot() {},
    setStatus() {},
    destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {
      body: {append() {}},
      documentElement: {setAttribute() {}},
      createComment: () => ({}),
    },
    locationLike: new URL("https://fanqienovel.com/reader/chapter-1"),
    windowLike: {addEventListener() {}},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => box,
      parseReaderSnapshot: () => {
        snapshotOrder.push(transferMounted);
        return {bookId: "book-1", chapterId: "c-1", bookTitle: "测试书", chapterTitle: "第一章"};
      },
    },
    skinFactory: {create: () => ui},
    transferApi: {
      mount: () => {
        transferMounted = true;
        return {scrollElement: pane, getProgress: () => 0, setProgress() {}, restore() {}};
      },
    },
    store: {getSettings: async () => ({enabled: true})},
  });

  await controller.start();
  assert.deepEqual(snapshotOrder, [false, true]);
  assert.equal(readerRoot.style.display, "block");
});

test("missing catalog diagnostics do not log an undefined error argument", async () => {
  const messages = [];
  const originalError = console.error;
  console.error = (...args) => messages.push(args);
  try {
    const harness = makeHarness({hasNativeCatalog: false});
    await harness.controller.start();
    await harness.callbacks.onLoadCatalog();
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(messages, [["[Fqmail] 未找到番茄原生目录按钮"]]);
});

test("failed mount clears catalog dock and controller ownership", async () => {
  const item = {parentNode: {}};
  const pane = {addEventListener() {}, removeEventListener() {}};
  const events = [];
  const originalError = console.error;
  console.error = () => {};
  let parseCount = 0;
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot() {},
    setStatus() {},
    destroy() {},
  };
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {body: {append() {}}, createComment: () => ({})},
    locationLike: new URL("https://fanqienovel.com/reader/chapter-1"),
    windowLike: {addEventListener() {}},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => ({parentNode: {}, addEventListener() {}, removeEventListener() {}}),
      findNativeCatalogItem: () => item,
      parseReaderSnapshot: () => {
        parseCount += 1;
        if (parseCount > 1) throw new Error("mount failed");
        return {bookId: "book-1", chapterId: "c-1", bookTitle: "测试书", chapterTitle: "第一章"};
      },
    },
    skinFactory: {create: () => ui},
    transferApi: {mount: () => ({scrollElement: pane, getProgress: () => 0, setProgress() {}, restore: () => {events.push("reader-restore"); return true;}})},
    nativeCatalogDock: {mount: () => ({restore: () => {events.push("dock-restore"); return true;}})},
    catalogFactory: {create: () => ({load: async () => [], dispose: () => events.push("catalog-dispose")})},
    store: {getSettings: async () => ({enabled: true}), setEnabled: async () => {}},
  });

  try {
    assert.equal(await controller.start(), false);
    assert.equal(events.filter((event) => event === "dock-restore").length, 1);
    assert.equal(events.filter((event) => event === "catalog-dispose").length, 1);
    await controller.disable();
    assert.equal(events.filter((event) => event === "dock-restore").length, 1);
    assert.equal(events.filter((event) => event === "catalog-dispose").length, 1);
  } finally {
    console.error = originalError;
  }
});

test("controller reparses the moved box after native navigation controls appear", async () => {
  const body = {
    children: [],
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  };
  const paneEvents = [];
  const pane = {
    addEventListener: (...args) => paneEvents.push(["add", ...args]),
    removeEventListener: (...args) => paneEvents.push(["remove", ...args]),
  };
  const box = {parentNode: {}, addEventListener() {}, removeEventListener() {}};
  const nextButton = {click() {}};
  const rendered = [];
  let parseCount = 0;
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot: (snapshot) => rendered.push(snapshot),
    setStatus() {},
    destroy: () => body.removeChild(ui.root),
  };
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {body, createComment: () => ({})},
    locationLike: new URL("https://fanqienovel.com/reader/chapter-1"),
    windowLike: {addEventListener() {}},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => box,
      parseReaderSnapshot: () => {
        parseCount += 1;
        return {
          bookId: "book-1",
          chapterId: "c-1",
          bookTitle: "测试书",
          chapterTitle: "第一章",
          previousButton: null,
          nextButton: parseCount >= 2 ? nextButton : null,
        };
      },
    },
    skinFactory: {create: () => ui},
    transferApi: {
      mount: () => ({
        scrollElement: pane,
        getProgress: () => 0,
        setProgress() {},
        restore() {},
      }),
    },
    store: {getSettings: async () => ({enabled: true})},
  });

  await controller.start();
  assert.equal(rendered.at(-1).nextButton, nextButton);
  assert.equal(body.children.length, 1);
  assert.equal(paneEvents.filter((event) => event[0] === "add").length, 1);
});

test("controller observes the mounted reader box for delayed native controls", async () => {
  const app = {};
  const body = {
    children: [],
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  };
  const box = {parentNode: {}, addEventListener() {}, removeEventListener() {}};
  const pane = {addEventListener() {}, removeEventListener() {}};
  const observedTargets = new Set();
  let observerCallback;
  let observerInstance;
  let disconnectCount = 0;
  let nativeReady = false;
  let currentBox = box;
  class FakeMutationObserver {
    constructor(callback) {
      observerCallback = callback;
      observerInstance = this;
    }

    observe(target) {
      observedTargets.add(target);
    }

    disconnect() {
      disconnectCount += 1;
      observedTargets.clear();
    }

    notify(target) {
      if (observedTargets.has(target)) observerCallback([{target, addedNodes: [], removedNodes: []}]);
    }
  }
  const rendered = [];
  const nextButton = {click() {}};
  const ui = {
    root: {},
    refs: {readerPane: pane},
    renderSnapshot: (snapshot) => rendered.push(snapshot),
    setStatus() {},
    destroy: () => body.removeChild(ui.root),
  };
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {
      body,
      createComment: () => ({}),
      querySelector: (selector) => selector === "#app" ? app : null,
    },
    locationLike: new URL("https://fanqienovel.com/reader/chapter-1"),
    windowLike: {addEventListener() {}, MutationObserver: FakeMutationObserver},
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => currentBox,
      parseReaderSnapshot: () => ({
        bookId: "book-1",
        chapterId: "c-1",
        bookTitle: "测试书",
        chapterTitle: "第一章",
        nextButton: nativeReady ? nextButton : null,
      }),
    },
    skinFactory: {create: () => ui},
    transferApi: {
      mount: () => ({
        scrollElement: pane,
        getProgress: () => 0,
        setProgress() {},
        restore() {},
      }),
    },
    store: {getSettings: async () => ({enabled: true})},
  });

  await controller.start();
  assert.equal(observedTargets.has(app), true);
  assert.equal(observedTargets.has(box), true);
  nativeReady = true;
  const before = rendered.length;
  observerInstance.notify(box);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.ok(rendered.length > before);
  assert.equal(rendered.at(-1).nextButton, nextButton);

  const secondBox = {parentNode: {}, addEventListener() {}, removeEventListener() {}};
  currentBox = secondBox;
  await controller.refresh();
  assert.ok(disconnectCount >= 1);
  assert.equal(observedTargets.has(box), false);
  assert.equal(observedTargets.has(secondBox), true);
});

test("native navigation requires the app event root after box transfer", async () => {
  const makeNode = (parent = null) => ({
    parentNode: parent,
    children: [],
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  });
  const app = makeNode();
  const body = makeNode();
  const readerRoot = makeNode(app);
  const box = makeNode(readerRoot);
  const nextButton = {
    parentNode: box,
    click() {
      let current = this;
      while (current) {
        if (current === app) app.navigated = true;
        current = current.parentNode;
      }
    },
  };
  box.append(nextButton);
  readerRoot.append(box);
  const detachedShell = makeNode(body);
  const detachedPane = makeNode(detachedShell);
  detachedPane.append(box);
  nextButton.click();
  assert.equal(app.navigated, undefined);
  detachedPane.removeChild(box);
  readerRoot.append(box);

  const pane = makeNode();
  const shellRoot = makeNode();
  const ui = {
    root: shellRoot,
    refs: {readerPane: pane},
    renderSnapshot() {},
    setStatus() {},
    destroy() {shellRoot.parentNode?.removeChild?.(shellRoot);},
  };
  const callbacks = {};
  let chapterId = "c-1";
  const nativeNext = {
    parentNode: box,
    click() {
      let current = this;
      while (current) {
        if (current === app) {
          app.navigated = true;
          chapterId = "c-2";
        }
        current = current.parentNode;
      }
    },
  };
  box.children = [nativeNext];
  const controller = globalThis.Fqmail.controller.create({
    catalogEnabled: true,
    documentLike: {
      body,
      createComment: () => ({}),
      querySelector: (selector) => selector === "#app" ? app : null,
    },
    locationLike: new URL("https://fanqienovel.com/reader/chapter-1"),
    windowLike: {addEventListener() {}},
    navigationTimeoutMs: 20,
    adapter: {
      matchesReaderPage: () => true,
      getReaderBox: () => box,
      parseReaderSnapshot: () => ({
        bookId: "book-1",
        chapterId,
        bookTitle: "测试书",
        chapterTitle: "章节",
        previousButton: null,
        nextButton: nativeNext,
      }),
    },
    skinFactory: {
      create: (options) => {
        Object.assign(callbacks, options);
        shellRoot.append(pane);
        return ui;
      },
    },
    transferApi: {
      mount: ({pane: targetPane, box: targetBox}) => {
        targetPane.append(targetBox);
        return {
          scrollElement: targetPane,
          getProgress: () => 0,
          setProgress() {},
          restore() {
            targetPane.removeChild(targetBox);
            readerRoot.append(targetBox);
          },
        };
      },
    },
    store: {getSettings: async () => ({enabled: true})},
  });

  await controller.start();
  await callbacks.onNext();
  assert.equal(app.navigated, true);
  assert.equal(body.children.length, 0);
  assert.equal(app.children.includes(shellRoot), true);
});

test("successful native navigation leaves loading and reports connected", async () => {
  const harness = makeNavigationHarness({
    onNativeClick: (changeChapter) => changeChapter(),
  });
  await harness.controller.start();
  assert.equal(await harness.callbacks.onNext(), true);
  assert.deepEqual(harness.events.filter((event) => event[0] === "status").at(-1), ["status", "ready", "正文已连接"]);
});

test("native navigation timeout reports an error instead of staying loading", async () => {
  const harness = makeNavigationHarness({navigationTimeoutMs: 5});
  await harness.controller.start();
  assert.equal(await harness.callbacks.onNext(), false);
  assert.deepEqual(harness.events.filter((event) => event[0] === "status").at(-1), ["status", "error", "章节切换未生效"]);
});
