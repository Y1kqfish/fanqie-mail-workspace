import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Outlook CSS declares the 2560px seven-zone coordinate system", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.fqmail-shell\s*\{[^}]*grid-template-rows:\s*48px/s);
  assert.match(css, /\.fqmail-launcher\s*\{[^}]*width:\s*48px/s);
  assert.match(css, /\.fqmail-search-shell\s*\{[^}]*width:\s*350px[^}]*height:\s*32px/s);
  assert.match(css, /\.fqmail-app-rail\s*\{[^}]*width:\s*40px/s);
  assert.match(css, /\.fqmail-main-surface\s*\{[^}]*grid-template-rows:\s*77px/s);
  assert.match(css, /\.fqmail-content-grid\s*\{[^}]*grid-template-columns:\s*212px\s+351px\s+4px\s+minmax\(0,\s*1fr\)\s+305px/s);
  assert.match(css, /\.fqmail-utility-rail\s*\{[^}]*width:\s*305px/s);
  assert.match(css, /\.fqmail-message-list-pane\s*\{[^}]*margin-top:\s*8px/s);
  assert.match(css, /\.fqmail-message-list-pane\s*\{[^}]*border-radius:\s*4px\s+4px\s+0\s+0/s);
  assert.doesNotMatch(css, /grid-template-columns:\s*188px\s+351px\s+minmax\(0,\s*1fr\)/);
});

test("Outlook CSS declares the four requested responsive ranges", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(max-width:\s*1919px\)/);
  assert.match(css, /@media\s*\(max-width:\s*1279px\)/);
  assert.match(css, /@media\s*\(max-width:\s*959px\)/);
  assert.match(css, /@media\s*\(max-width:\s*719px\)/);
  assert.match(css, /@media\s*\(max-width:\s*1919px\)[\s\S]*?grid-template-columns:\s*212px\s+351px\s+4px\s+minmax\(0,\s*1fr\)\s+48px/);
  assert.match(css, /@media\s*\(max-width:\s*1279px\)[\s\S]*?display:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*719px\)[\s\S]*?grid-template-rows:\s*auto\s+minmax\(180px,\s*34vh\)\s+minmax\(50vh,\s*1fr\)/);
});

test("M2 skin CSS keeps every selector in the fqmail namespace", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /(^|[\n,])\s*(button|input|p|h1|h2|h3|body|html)\s*[{,]/m);
  assert.doesNotMatch(css, /fqmail-catalog-slot|fqmail-native-catalog-control/);
});

test("message list pane forms a constrained two-row scroll viewport without wheel interception", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  assert.match(css, /\.fqmail-message-list-pane\s*\{[^}]*display:\s*grid[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.fqmail-message-list\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain/s);
  const skin = await readFile(new URL("../src/skins/outlook/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(skin, /addEventListener\s*\(\s*["']wheel["']/);
});
