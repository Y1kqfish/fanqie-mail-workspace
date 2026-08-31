import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/storage.js";

test("state keys use stable book and chapter ids", () => {
  const {chapterReadKey, chapterProgressKey} = globalThis.Fqmail.storage;
  assert.equal(chapterReadKey("book/42", "chapter 7"), "fqmail:read:book%2F42:chapter%207");
  assert.equal(chapterProgressKey("book/42", "chapter 7"), "fqmail:progress:book%2F42:chapter%207");
});

test("progress values are clamped to the reader range", () => {
  const {normalizeProgress} = globalThis.Fqmail.storage;
  assert.equal(normalizeProgress(-1), 0);
  assert.equal(normalizeProgress(0.5), 0.5);
  assert.equal(normalizeProgress(2), 1);
  assert.equal(normalizeProgress(Number.NaN), 0);
});

test("getReadMany performs one storage read and returns chapter keyed state", async () => {
  let calls = 0;
  const storageArea = {
    async get(keys) {
      calls += 1;
      assert.deepEqual(keys, [
        "fqmail:read:book-1:c-1",
        "fqmail:read:book-1:c-2",
        "fqmail:read:book-1:c-3",
      ]);
      return {"fqmail:read:book-1:c-2": true};
    },
    async set() {},
  };
  const store = globalThis.Fqmail.storage.createStore(storageArea);
  assert.deepEqual(await store.getReadMany("book-1", ["c-1", "c-2", "c-3"]), {
    "c-1": false,
    "c-2": true,
    "c-3": false,
  });
  assert.equal(calls, 1);
});
