import test from "node:test";
import assert from "node:assert/strict";

test("content startup passes tab appearance into the controller and releases early transition after mount", async () => {
  const calls = [];
  const appearance = {enable() {}, restore() {}};
  const early = {ready() {calls.push("ready");}, release() {calls.push("release");}};
  let controllerOptions = null;
  globalThis.location = new URL("https://fanqienovel.com/reader/100");
  globalThis.Fqmail = {
    fanqie: {matchesReaderPage: () => true},
    tabAppearance: {create() {calls.push("appearance-create"); return appearance;}},
    earlyTransition: {instance: early},
    controller: {create(options) {controllerOptions = options; return {start: async () => true, toggle() {}};}},
    platform: {onMessage() {}},
  };

  await import("../src/content.js?transition-test");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controllerOptions.tabAppearance, appearance);
  assert.deepEqual(calls, ["appearance-create", "ready"]);
});

test("content startup releases both temporary layers when the controller fails", async () => {
  const calls = [];
  const appearance = {enable() {}, restore() {calls.push("appearance-restore");}};
  const early = {ready() {}, release() {calls.push("early-release");}};
  let controllerOptions = null;
  globalThis.location = new URL("https://fanqienovel.com/reader/101");
  globalThis.Fqmail = {
    fanqie: {matchesReaderPage: () => true},
    tabAppearance: {create() {return appearance;}},
    earlyTransition: {instance: early},
    controller: {create(options) {controllerOptions = options; return {start: async () => {throw new Error("mount");}, toggle() {}};}},
    platform: {onMessage() {}},
  };

  await import("../src/content.js?transition-failure-test");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controllerOptions.earlyTransition, early);
  assert.deepEqual(calls, ["appearance-restore", "early-release"]);
});
