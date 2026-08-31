import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
const listeners = [];
const removedListeners = [];
const storageSession = {
  async get(key) { return {[key]: values.get(key)}; },
  async set(record) { for (const [key, value] of Object.entries(record)) values.set(key, value); },
  async remove(key) { values.delete(key); },
};

globalThis.chrome = {
  runtime: {onMessage: {addListener(listener) { listeners.push(listener); }}},
  commands: {onCommand: {addListener() {}}},
  storage: {session: storageSession, local: {remove: async () => {}}},
  tabs: {onRemoved: {addListener(listener) { removedListeners.push(listener); }}, query: async () => [], sendMessage: async () => {}},
};

await import("../src/background.js?catalog-session-test");

function sender(tabId, url = "https://fanqienovel.com/reader/100", frameId = 0) {
  return {tab: {id: tabId, url}, frameId};
}

function entries() {
  return [
    {chapterId: "100", title: "第一章", order: 0, href: "https://fanqienovel.com/reader/100", locked: false, visited: true},
    {chapterId: "101", title: "第二章", order: 1, href: "https://fanqienovel.com/reader/101", locked: false, visited: false},
  ];
}

test("background session isolates catalogs by sender tab and restores repeatedly", async () => {
  const handler = listeners.at(-1);
  assert.ok(handler);
  const saved = await handler({type: "fqmail:catalog-session-save", tabId: 999999, entries: entries(), sourceChapterId: "100", bookId: "book-1"}, sender(7));
  assert.equal(saved.ok, true);
  const other = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "101", bookId: "book-1"}, sender(8));
  assert.equal(other.record, null);
  const first = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "101", bookId: "book-1"}, sender(7));
  const second = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100", bookId: "book-1"}, sender(7));
  assert.equal(first.record.entries.length, 2);
  assert.equal(second.record.entries.length, 2);
  assert.equal(first.record.entries[0].element, undefined);
  assert.equal(first.record.entries[0].active, undefined);
});

test("background session rejects non-reader, non-top-frame, and page-specified tab access", async () => {
  const handler = listeners.at(-1);
  const invalid = await handler({type: "fqmail:catalog-session-save", tabId: 7, entries: entries(), sourceChapterId: "100", bookId: "book-1"}, sender(7, "https://fanqienovel.com/page/1"));
  const frame = await handler({type: "fqmail:catalog-session-save", entries: entries(), sourceChapterId: "100", bookId: "book-1"}, sender(7, undefined, 1));
  assert.equal(invalid.ok, false);
  assert.equal(frame.ok, false);
  assert.equal(removedListeners.length, 1);
});

test("background session preserves the previous record across invalid and quota failures", async () => {
  const handler = listeners.at(-1);
  const tab = sender(21);
  const saved = await handler({type: "fqmail:catalog-session-save", entries: entries(), sourceChapterId: "100", bookId: "book-1"}, tab);
  assert.equal(saved.ok, true);

  const invalid = await handler({type: "fqmail:catalog-session-save", entries: [{...entries()[0], chapterId: "100"}, {...entries()[1], chapterId: "100"}], sourceChapterId: "100", bookId: "book-1"}, tab);
  assert.equal(invalid.ok, false);
  const afterInvalid = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "101", bookId: "book-1"}, tab);
  assert.equal(afterInvalid.record.entries.length, 2);

  const originalSet = storageSession.set;
  storageSession.set = async () => { throw new Error("quota"); };
  const quota = await handler({type: "fqmail:catalog-session-save", entries: entries(), sourceChapterId: "100", bookId: "book-1"}, tab);
  storageSession.set = originalSet;
  assert.deepEqual(quota, {ok: false, kind: "quota"});
  const afterQuota = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100", bookId: "book-1"}, tab);
  assert.equal(afterQuota.record.entries.length, 2);
});

test("background session accepts the metadata limit and clears only the closed tab", async () => {
  const handler = listeners.at(-1);
  const large = Array.from({length: 10000}, (_, index) => ({
    chapterId: String(100000 + index),
    title: `第${index + 1}章`,
    order: index,
    href: `https://fanqienovel.com/reader/${100000 + index}`,
    locked: false,
    visited: false,
  }));
  assert.equal((await handler({type: "fqmail:catalog-session-save", entries: large, sourceChapterId: "100000", bookId: "book-large"}, sender(31))).ok, true);
  const tooMany = await handler({type: "fqmail:catalog-session-save", entries: [...large, {...large[0], chapterId: "999999"}], sourceChapterId: "100000", bookId: "book-large"}, sender(32));
  assert.deepEqual(tooMany, {ok: false, kind: "invalid-record"});

  removedListeners.at(-1)(31);
  const closed = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100000", bookId: "book-large"}, sender(31));
  const other = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100", bookId: "book-large"}, sender(7));
  assert.equal(closed.record, null);
  assert.equal(other.record.entries.length, 2);
});

test("background session rejects a record over the serialized metadata quota", async () => {
  const handler = listeners.at(-1);
  const oversized = Array.from({length: 10000}, (_, index) => {
    const chapterId = String(index) + "9".repeat(400);
    return {
      chapterId,
      title: "章".repeat(200),
      order: index,
      href: `https://fanqienovel.com/reader/${chapterId}`,
      locked: false,
      visited: false,
    };
  });
  const result = await handler({type: "fqmail:catalog-session-save", entries: oversized, sourceChapterId: oversized[0].chapterId, bookId: "book-quota"}, sender(35));
  assert.deepEqual(result, {ok: false, kind: "quota"});
  assert.equal((await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100", bookId: "book-1"}, sender(7))).record.entries.length, 2);
});

test("a recreated background handler restores the same session record", async () => {
  await import("../src/background.js?catalog-session-worker-recreated");
  const handler = listeners.at(-1);
  const restored = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100", bookId: "book-1"}, sender(7));
  assert.equal(restored.record.entries.length, 2);
});

test("invalid stored metadata is discarded without affecting another tab", async () => {
  const handler = listeners.at(-1);
  values.set("fqmail:catalog-session:41", {version: 999, entries: []});
  const restored = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100", bookId: "book-1"}, sender(41));
  assert.deepEqual(restored, {ok: true, record: null});
  assert.equal(values.has("fqmail:catalog-session:41"), false);
  const other = await handler({type: "fqmail:catalog-session-restore", currentChapterId: "100", bookId: "book-1"}, sender(7));
  assert.equal(other.record.entries.length, 2);
});
