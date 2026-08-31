import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/catalog-session-client.js";

test("catalog session client exposes repeatable save, restore, and clear calls", async () => {
  const messages = [];
  const client = globalThis.Fqmail.catalogSession.create({
    runtime: {sendMessage: async (message) => { messages.push(message); return {ok: true, record: {entries: []}}; }},
  });

  await client.save({entries: [{chapterId: "100", title: "第一章"}], sourceChapterId: "100", bookId: "book"});
  await client.restore({currentChapterId: "100", bookId: "book"});
  await client.clear();

  assert.deepEqual(messages.map((message) => message.type), [
    "fqmail:catalog-session-save",
    "fqmail:catalog-session-restore",
    "fqmail:catalog-session-clear",
  ]);
});
