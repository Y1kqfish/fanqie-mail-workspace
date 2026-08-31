import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/catalog-handoff.js";

function makeStorage() {
  const values = new Map();
  const calls = {get: 0, set: 0, remove: 0};
  return {
    calls,
    async get(key) { calls.get += 1; return {[key]: values.get(key)}; },
    async set(record) { calls.set += 1; for (const [key, value] of Object.entries(record)) values.set(key, value); },
    async remove(key) { calls.remove += 1; values.delete(key); },
    peek(key) { return values.get(key); },
  };
}

function entries(count = 2) {
  return Array.from({length: count}, (_, index) => ({
    chapterId: String(100 + index), title: `第${index + 1}章`, order: index,
    href: `https://fanqienovel.com/reader/${100 + index}`, locked: index === 1, visited: index === 0,
    active: index === 0, element: {shouldNotPersist: true},
  }));
}

test("catalog handoff writes a bounded metadata-only record and consumes it once", async () => {
  const storage = makeStorage();
  const handoff = globalThis.Fqmail.catalogHandoff.create({storageArea: storage, now: () => 1000, ttlMs: 5000});
  await handoff.put({bookId: "book-1", targetChapterId: "101", entries: entries(2)});
  const record = storage.peek(globalThis.Fqmail.catalogHandoff.KEY);
  assert.equal(record.version, 1);
  assert.equal(record.bookId, "book-1");
  assert.equal(record.targetChapterId, "101");
  assert.equal(record.entries[0].element, undefined);
  assert.equal(record.entries.length, 2);
  const consumed = await handoff.consume({bookId: "book-1", targetChapterId: "101"});
  assert.equal(consumed.entries.length, 2);
  assert.equal(await handoff.consume({bookId: "book-1", targetChapterId: "101"}), null);
  assert.equal(storage.calls.get, 2);
  assert.equal(storage.calls.remove, 2);
});

test("catalog handoff rejects expired, mismatched, cross-origin, duplicate, oversized, and invalid records and removes each", async () => {
  const storage = makeStorage();
  let now = 1000;
  const handoff = globalThis.Fqmail.catalogHandoff.create({storageArea: storage, now: () => now, ttlMs: 50, maxEntries: 2});
  await assert.rejects(() => handoff.put({bookId: "book-1", targetChapterId: "101", entries: [
    ...entries(2), {chapterId: "102", title: "第三章", href: "https://fanqienovel.com/reader/102"},
  ]}), /数量/);
  assert.equal(await handoff.consume({bookId: "book-1", targetChapterId: "101"}), null);
  await handoff.put({bookId: "book-1", targetChapterId: "101", entries: entries(2)});
  assert.equal(await handoff.consume({bookId: "other", targetChapterId: "101"}), null);
  await assert.rejects(() => handoff.put({bookId: "book-1", targetChapterId: "101", entries: [{chapterId: "101", title: "坏", href: "https://example.com/reader/101"}]}), /无效/);
  assert.equal(await handoff.consume({bookId: "book-1", targetChapterId: "101"}), null);
  await handoff.put({bookId: "book-1", targetChapterId: "101", entries: entries(2)});
  now = 1100;
  assert.equal(await handoff.consume({bookId: "book-1", targetChapterId: "101"}), null);
  assert.equal(storage.calls.remove, 4);
});
