import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Outlook CSS matches measured desktop and responsive contracts", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.fqmail-topbar\s*\{[^}]*height:\s*48px/s);
  assert.match(css, /\.fqmail-app-rail\s*\{[^}]*width:\s*40px/s);
  assert.match(css, /\.fqmail-ribbon\s*\{[^}]*grid-template-rows:\s*37px\s+40px/s);
  assert.match(css, /\.fqmail-content-grid\s*\{[^}]*grid-template-columns:\s*212px\s+351px\s+4px\s+minmax\(0,\s*1fr\)\s+305px/s);
  assert.match(css, /\.fqmail-search-shell\s*\{[^}]*width:\s*350px[^}]*height:\s*32px/);
  assert.match(css, /\.fqmail-message-list-pane\s*\{[^}]*box-shadow:/s);
  assert.match(css, /\.fqmail-utility-rail\s*\{[^}]*width:\s*305px/s);
  assert.match(css, /@media\s*\(max-width:\s*1919px\)[\s\S]*?grid-template-columns:\s*212px\s+351px\s+4px\s+minmax\(0,\s*1fr\)\s+48px/);
  assert.match(css, /@media\s*\(max-width:\s*1279px\)/);
  assert.match(css, /@media\s*\(max-width:\s*959px\)/);
  assert.match(css, /@media\s*\(max-width:\s*719px\)/);
});
