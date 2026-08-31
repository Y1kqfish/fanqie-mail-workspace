import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("M3 native sync prompt is independent and does not project a native control", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.fqmail-native-catalog-sync-prompt\s*\{/);
  assert.match(css, /\.fqmail-native-catalog-sync-message/);
  assert.match(css, /\.fqmail-catalog-sync-slot\s*\{[^}]*pointer-events\s*:\s*auto/s);
  assert.doesNotMatch(css, /\.fqmail-native-catalog-(?:dock|label)/);
  assert.doesNotMatch(css, /\.fqmail-native-catalog-sync-prompt[^{]*\{[^}]*pointer-events\s*:\s*none/s);
  assert.doesNotMatch(css, /(^|\n)\s*(button|input|p|h1|h2|h3|body|html)\s*[{,]/m);
});
