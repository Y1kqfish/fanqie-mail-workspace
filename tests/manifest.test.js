import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("Manifest V3 limits the extension to the reader page and storage", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://fanqienovel.com/reader/*"]);
  assert.equal(manifest.content_scripts[0].run_at, "document_start");
  assert.deepEqual(manifest.content_scripts[0].js, ["src/core/early-transition.js"]);
  assert.deepEqual(manifest.content_scripts[0].css, ["src/core/early-transition.css"]);
  assert.deepEqual(manifest.content_scripts[1].matches, ["https://fanqienovel.com/reader/*"]);
  assert.equal(manifest.content_scripts[1].run_at, "document_idle");
  assert.deepEqual(manifest.commands["toggle-skin"].suggested_key, {"default": "Alt+Shift+M"});
  const scripts = manifest.content_scripts[1].js;
  assert.ok(scripts.indexOf("src/skins/outlook/outlook-favicon.js") < scripts.indexOf("src/core/tab-appearance.js"));
  assert.ok(scripts.indexOf("src/core/tab-appearance.js") < scripts.indexOf("src/adapters/fanqie/parser.js"));
  assert.ok(scripts.indexOf("src/core/catalog-page-parser.js") < scripts.indexOf("src/core/controller.js"));
  assert.ok(scripts.indexOf("src/core/catalog-page-workflow.js") < scripts.indexOf("src/core/controller.js"));
  assert.ok(scripts.indexOf("src/core/native-catalog-sync.js") < scripts.indexOf("src/core/controller.js"));
  assert.ok(scripts.indexOf("src/core/catalog-session-client.js") < scripts.indexOf("src/core/controller.js"));
  assert.ok(scripts.indexOf("src/core/performance-metrics.js") < scripts.indexOf("src/skins/outlook/index.js"));
  assert.ok(scripts.indexOf("src/core/performance-metrics.js") < scripts.indexOf("src/core/controller.js"));
  assert.equal(scripts.includes("src/core/catalog-handoff.js"), false);
  assert.equal(scripts.includes("src/core/catalog-page-source.js"), false);
  assert.equal(scripts.includes("src/core/native-catalog-dock.js"), false);
  assert.equal(scripts.includes("src/core/catalog-controller.js"), false);
  assert.ok(scripts.indexOf("src/skins/outlook/fluent-icons.js") < scripts.indexOf("src/skins/outlook/index.js"));
  assert.ok(scripts.indexOf("src/skins/outlook/tokens.js") < scripts.indexOf("src/skins/outlook/index.js"));
  assert.ok(scripts.indexOf("src/skins/outlook/fluent-icons.js") < scripts.indexOf("src/skins/outlook/components.js"));
  assert.ok(scripts.indexOf("src/skins/outlook/personas.js") >= 0);
  assert.ok(scripts.indexOf("src/skins/outlook/personas.js") < scripts.indexOf("src/skins/outlook/components.js"));
  assert.ok(scripts.indexOf("src/skins/outlook/components.js") < scripts.indexOf("src/skins/outlook/index.js"));
  assert.deepEqual(manifest.content_scripts[2].matches, ["https://fanqienovel.com/page/*"]);
  assert.deepEqual(manifest.content_scripts[2].js, [
    "src/core/catalog-page-parser.js",
    "src/core/catalog-transfer.js",
    "src/page/catalog-collector.js",
  ]);
});
