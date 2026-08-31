import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("screenshot CSS pins the 2560 coordinate contract and icon sizing", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.fqmail-shell\s*\{[^}]*grid-template-columns:\s*49px\s+214px\s+354px\s+minmax\(0,\s*1fr\)\s+305px/s);
  assert.match(css, /\.fqmail-shell\s*\{[^}]*grid-template-rows:\s*48px\s+77px/s);
  assert.match(css, /\.fqmail-brand\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*216px/s);
  assert.match(css, /\.fqmail-search-shell\s*\{[^}]*width:\s*350px[^}]*height:\s*32px/s);
  assert.match(css, /\.fqmail-content-grid\s*\{[^}]*padding-left:\s*1px[^}]*grid-template-columns:\s*212px\s+351px\s+4px\s+minmax\(0,\s*1fr\)\s+305px/s);
  assert.doesNotMatch(css, /\.fqmail-taskbar|\.fqmail-task-tab/);
  assert.match(css, /\.fqmail-icon-only\s*\{[^}]*width:\s*32px[^}]*height:\s*32px[^}]*padding:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.fqmail-icon-only \.fqmail-icon\s*\{[^}]*margin:\s*0/s);
});

test("screenshot CSS keeps the four responsive contracts and reader font untouched", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  for (const width of [1919, 1279, 959, 719]) assert.match(css, new RegExp(`@media\\s*\\(max-width:\\s*${width}px\\)`));
  assert.match(css, /@media[\s\S]*?1919px[\s\S]*?grid-template-columns:\s*212px\s+351px\s+4px\s+minmax\(0,\s*1fr\)\s+48px/);
  assert.match(css, /@media[\s\S]*?1279px[\s\S]*?\.fqmail-ad-rail[^}]*display:\s*none/);
  assert.match(css, /@media[\s\S]*?719px[\s\S]*?grid-template-rows:\s*auto\s+minmax\(180px,\s*34vh\)\s+minmax\(50vh,\s*1fr\)/);
  assert.doesNotMatch(css, /fqmail-catalog-slot|fqmail-native-catalog-control/);
  assert.doesNotMatch(css, /(^|[\n,])\s*(button|input|p|h1|h2|h3|body|html)\s*[{,]/m);
  assert.doesNotMatch(css, /\.fqmail-reader-pane[^}]*font-family/);
  assert.doesNotMatch(css, /fqmail-taskbar|fqmail-task-tab/);
});

test("reader pane overrides only the moved reader box background", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.fqmail-shell\s+\.fqmail-reader-pane\s*>\s*\.muye-reader-box\s*\{[^}]*background-color:\s*#fff\s*!important/s);
  assert.doesNotMatch(css, /(?<!fqmail-reader-pane\s*>\s*)\.muye-reader-box\s*\{[^}]*background(?:-color)?\s*:/s);
});
