import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import "../src/skins/outlook/personas.js";

test("local personas provide a diverse deterministic identity catalog", async () => {
  const personas = globalThis.Fqmail?.outlookPersonas;
  assert.ok(personas, "personas must register in the content-script scope");
  assert.ok(personas.names.length >= 40);
  assert.ok(new Set(personas.names.map((name) => name[0])).size >= 20);
  assert.ok(new Set(personas.records.map((record) => record.gender)).has("女"));
  assert.ok(new Set(personas.records.map((record) => record.gender)).has("男"));
  const first = personas.pick("book-1", "chapter-1");
  assert.deepEqual(first, personas.pick("book-1", "chapter-1"));
  assert.match(first.initial, /^[\u4e00-\u9fff]$/);
  assert.ok(personas.colors.includes(first.color));
  const samples = new Set(["chapter-1", "chapter-2", "chapter-3", "chapter-4"].map((id) => personas.pick("book-1", id).name));
  assert.ok(samples.size >= 2);
  const source = await readFile(new URL("../src/skins/outlook/personas.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random/);
});
