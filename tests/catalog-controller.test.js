import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/catalog-controller.js";

test("catalog controller shares one load, batches read state, and preserves order", async () => {
  const elements = Array.from({length: 1085}, (_, index) => ({index}));
  const source = elements.map((element, index) => ({
    chapterId: "c-" + index,
    title: "第" + index + "章",
    active: index === 7,
    visited: false,
    element,
  }));
  let readManyCalls = 0;
  const controller = globalThis.Fqmail.catalog.create({
    adapter: {parseCatalog: () => source},
    store: {
      getReadMany: async (bookId, chapterIds) => {
        readManyCalls += 1;
        assert.equal(bookId, "book-1");
        assert.equal(chapterIds.length, 1085);
        return {"c-7": true};
      },
    },
    waitForCatalog: async () => true,
  });
  const first = controller.load("book-1");
  assert.equal(controller.load("book-1"), first);
  const entries = await first;
  assert.equal(entries.length, 1085);
  assert.equal(readManyCalls, 1);
  assert.equal(entries[7].visited, true);
  assert.equal(entries[7].element, elements[7]);
  assert.equal(Object.keys(entries[7]).includes("element"), false);
  assert.equal(entries[1084].chapterId, "c-1084");
  controller.dispose();
});

test("default catalog wait observes app and body and performs a final timeout check", async () => {
  const OriginalObserver = globalThis.MutationObserver;
  const observed = [];
  let callback;
  class Observer {
    constructor(next) { callback = next; }
    observe(target) { observed.push(target); }
    disconnect() {}
  }
  globalThis.MutationObserver = Observer;
  try {
    const app = {};
    const body = {};
    let ready = false;
    const documentLike = {
      querySelector(selector) { return selector === "#app" ? app : selector === "body" ? body : null; },
    };
    const promise = globalThis.Fqmail.catalog.defaultWaitForCatalog(
      documentLike,
      {parseCatalog: () => ready ? [{chapterId: "c-1"}] : []},
      20,
    );
    assert.deepEqual(observed, [app, body]);
    ready = true;
    callback();
    assert.equal(await promise, true);
  } finally {
    globalThis.MutationObserver = OriginalObserver;
  }
});

test("disposing a catalog controller rejects its pending load as cancelled", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const controller = globalThis.Fqmail.catalog.create({
    adapter: {parseCatalog: () => []},
    waitForCatalog: async () => pending,
  });
  const loading = controller.load("book-1");
  controller.dispose();
  release(true);
  await assert.rejects(loading, (error) => error.kind === "disposed");
});
