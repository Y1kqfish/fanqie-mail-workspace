import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";

test("Manifest content scripts execute in one classic global scope and register Fanqie adapter", async () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = JSON.parse(await readFile(path.join(projectRoot, "manifest.json"), "utf8"));
  const context = vm.createContext({
    URL,
    location: new URL("https://example.com/not-reader"),
    browser: undefined,
    chrome: undefined,
    console,
  });

  for (const relativeScript of manifest.content_scripts[0].js) {
    const scriptPath = path.join(projectRoot, relativeScript);
    const source = await readFile(scriptPath, "utf8");
    assert.doesNotThrow(
      () => vm.runInContext(source, context, {filename: scriptPath}),
      "classic content script failed: " + relativeScript,
    );
  }

  for (const relativeScript of manifest.content_scripts[1].js) {
    const scriptPath = path.join(projectRoot, relativeScript);
    const source = await readFile(scriptPath, "utf8");
    assert.doesNotThrow(
      () => vm.runInContext(source, context, {filename: scriptPath}),
      "classic idle content script failed: " + relativeScript,
    );
  }

  assert.equal(typeof context.Fqmail.fanqie.matchesReaderPage, "function");
  assert.equal(typeof context.Fqmail.earlyTransition.create, "function");
  assert.equal(typeof context.Fqmail.tabAppearance.create, "function");
  assert.equal(typeof context.Fqmail.performanceMetrics.create, "function");
  assert.equal(typeof context.Fqmail.catalogPageParser.parse, "function");
  assert.equal(context.Fqmail.catalogPageSource, undefined);
  assert.equal(typeof context.Fqmail.catalogPageWorkflow.create, "function");
  assert.equal(typeof context.Fqmail.nativeCatalogSync.create, "function");
  assert.equal(context.Fqmail.nativeCatalogDock, undefined);
  assert.equal(context.Fqmail.catalog, undefined);
  assert.equal(typeof context.Fqmail.fluentIcons.create, "function");
  assert.equal(typeof context.Fqmail.outlookTokens, "object");
  assert.equal(typeof context.Fqmail.outlookPersonas.pick, "function");
  assert.equal(typeof context.Fqmail.outlookComponents.createIconButton, "function");
  assert.equal(typeof context.Fqmail.outlookComponents.createSplitCommand, "function");
  assert.equal(typeof context.Fqmail.outlookComponents.createMenu, "function");

  const pageContext = vm.createContext({
    URL,
    location: new URL("https://fanqienovel.com/page/123"),
    browser: undefined,
    chrome: undefined,
    console,
  });
  for (const relativeScript of manifest.content_scripts[2].js) {
    const scriptPath = path.join(projectRoot, relativeScript);
    const source = await readFile(scriptPath, "utf8");
    assert.doesNotThrow(
      () => vm.runInContext(source, pageContext, {filename: scriptPath}),
      "classic page content script failed: " + relativeScript,
    );
  }
  assert.equal(typeof pageContext.Fqmail.catalogPageCollector.create, "function");
});

test("content startup errors are reported instead of being silently swallowed", async () => {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = await readFile(path.join(projectRoot, "src/content.js"), "utf8");
  assert.match(source, /console\.error\("\[Fqmail\]/);
  assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);
});
