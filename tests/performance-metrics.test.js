import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/performance-metrics.js";

class Target {
  constructor() { this.attributes = new Map(); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}

function makeClock() {
  let now = 100;
  let nextFrame = 0;
  const frames = new Map();
  return {
    performanceLike: {now: () => now},
    windowLike: {
      requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
      cancelAnimationFrame(id) { frames.delete(id); },
    },
    advance(ms) { now += ms; },
    paint() { for (const [id, callback] of [...frames]) { frames.delete(id); callback(now); } },
    pendingFrames() { return frames.size; },
  };
}

function readSamples(target) {
  return JSON.parse(target.getAttribute("data-fqmail-perf") || "{}");
}

test("performance metrics records visible catalog first-build and resync samples separately", () => {
  const clock = makeClock();
  const target = new Target();
  const documentLike = {visibilityState: "visible"};
  const metrics = globalThis.Fqmail.performanceMetrics.create({documentLike, windowLike: clock.windowLike, performanceLike: clock.performanceLike});
  metrics.attach(target);

  const first = metrics.begin("catalog-first", 1089);
  clock.advance(12);
  first.finish();
  assert.equal(clock.pendingFrames(), 1);
  clock.paint();
  clock.paint();

  const resync = metrics.begin("catalog-resync", 1089);
  clock.advance(8);
  resync.finish();
  clock.paint();
  clock.paint();

  const samples = readSamples(target);
  assert.equal(samples["catalog-first"].length, 1);
  assert.equal(samples["catalog-resync"].length, 1);
  assert.deepEqual(Object.keys(samples["catalog-first"][0]).sort(), ["count", "domMs", "ms", "operation", "seq", "valid"]);
  assert.equal(samples["catalog-first"][0].count, 1089);
  assert.equal(samples["catalog-first"][0].valid, true);
  assert.equal(samples["catalog-first"][0].domMs, 12);
  assert.equal(samples["catalog-first"][0].ms, 12);
  assert.equal(samples["catalog-resync"][0].valid, true);
});

test("performance metrics keeps only the latest three samples and marks cancellation or hidden frames invalid", () => {
  const clock = makeClock();
  const target = new Target();
  const documentLike = {visibilityState: "visible"};
  const metrics = globalThis.Fqmail.performanceMetrics.create({documentLike, windowLike: clock.windowLike, performanceLike: clock.performanceLike});
  metrics.attach(target);

  for (let index = 0; index < 4; index += 1) {
    const measure = metrics.begin("catalog-search", 1089);
    clock.advance(1);
    measure.finish();
    clock.paint();
    clock.paint();
  }
  let samples = readSamples(target)["catalog-search"];
  assert.equal(samples.length, 3);
  assert.equal(samples[0].count, 1089);
  assert.equal(samples[0].valid, true);

  const cancelled = metrics.begin("catalog-filter", 1089);
  cancelled.cancel();
  const hidden = metrics.begin("catalog-filter", 1089);
  documentLike.visibilityState = "hidden";
  hidden.finish();
  clock.paint();
  samples = readSamples(target)["catalog-filter"];
  assert.equal(samples.length, 2);
  assert.equal(samples.every((sample) => sample.valid === false && sample.ms === null), true);
  assert.equal(clock.pendingFrames(), 0);

  metrics.dispose();
  assert.equal(metrics.begin("catalog-search", 1089), null);
});

test("performance metric failures never interrupt the catalog interaction", () => {
  const target = new Target();
  const metrics = globalThis.Fqmail.performanceMetrics.create({
    documentLike: {visibilityState: "visible"},
    windowLike: {requestAnimationFrame() { throw new Error("frame unavailable"); }},
    performanceLike: {now() { throw new Error("clock unavailable"); }},
  });
  metrics.attach(target);
  const measure = metrics.begin("catalog-filter", 3);
  assert.doesNotThrow(() => measure.finish());
  assert.equal(readSamples(target)["catalog-filter"][0].valid, false);
});

test("performance metrics invalidate hidden-start and hidden-during measurements", () => {
  const clock = makeClock();
  const target = new Target();
  const visibilityListeners = [];
  let removedListeners = 0;
  const documentLike = {
    visibilityState: "hidden",
    addEventListener(name, listener) { if (name === "visibilitychange") visibilityListeners.push(listener); },
    removeEventListener(name) { if (name === "visibilitychange") removedListeners += 1; },
  };
  const metrics = globalThis.Fqmail.performanceMetrics.create({documentLike, windowLike: clock.windowLike, performanceLike: clock.performanceLike});
  metrics.attach(target);

  const hiddenStart = metrics.begin("catalog-search", 2);
  documentLike.visibilityState = "visible";
  hiddenStart.finish();
  clock.paint();
  clock.paint();

  const hiddenDuring = metrics.begin("catalog-filter", 2);
  documentLike.visibilityState = "hidden";
  visibilityListeners.forEach((listener) => listener());
  documentLike.visibilityState = "visible";
  hiddenDuring.finish();
  clock.paint();
  clock.paint();

  const samples = readSamples(target);
  assert.equal(samples["catalog-search"][0].valid, false);
  assert.equal(samples["catalog-filter"][0].valid, false);
  assert.equal(removedListeners, 2);
});

test("performance metrics cancels an older same-operation measure and does not double-schedule finish", () => {
  const clock = makeClock();
  const target = new Target();
  const metrics = globalThis.Fqmail.performanceMetrics.create({documentLike: {visibilityState: "visible"}, windowLike: clock.windowLike, performanceLike: clock.performanceLike});
  metrics.attach(target);
  const first = metrics.begin("catalog-search", 4);
  assert.equal(first.finish(), true);
  assert.equal(first.finish(), false);
  assert.equal(clock.pendingFrames(), 1);
  const second = metrics.begin("catalog-search", 4);
  assert.equal(clock.pendingFrames(), 0);
  const samples = readSamples(target)["catalog-search"];
  assert.equal(samples.length, 1);
  assert.equal(samples[0].valid, false);
  assert.equal(second.finish(), true);
  assert.equal(clock.pendingFrames(), 1);
  second.cancel();
});
