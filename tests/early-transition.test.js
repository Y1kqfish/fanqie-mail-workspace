import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/early-transition.js";

class Node {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this.textContent = "";
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  removeChild(node) {
    this.children = this.children.filter((child) => child !== node);
    node.parentNode = null;
  }

  remove() {
    this.parentNode?.removeChild?.(this);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
}

function makeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  return {
    windowLike: {
      setTimeout(callback, delay) {
        const id = ++nextId;
        timers.set(id, {callback, at: now + delay});
        return id;
      },
      clearTimeout(id) { timers.delete(id); },
    },
    tick(ms) {
      now += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

function makeDocument() {
  const body = new Node("body");
  const head = new Node("head");
  const documentLike = {
    body,
    head,
    createElement(tagName) { return new Node(tagName); },
    querySelector(selector) {
      if (selector === "[data-fqmail-early-transition]") return body.children.find((node) => node.getAttribute("data-fqmail-early-transition") === "true") || null;
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return {documentLike, body, head};
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return {promise, resolve, reject};
}

test("early transition shows one lightweight shell and ready releases it idempotently", async () => {
  const {documentLike, body} = makeDocument();
  const clock = makeClock();
  const settings = deferred();
  const transition = globalThis.Fqmail.earlyTransition.create({
    documentLike,
    windowLike: clock.windowLike,
    storageArea: {get: () => settings.promise},
  });

  assert.equal(transition.start(), true);
  assert.equal(body.children.length, 1);
  assert.equal(body.children[0].getAttribute("data-fqmail-early-transition"), "true");
  settings.resolve({"fqmail:settings": {enabled: true}});
  await Promise.resolve();
  assert.equal(transition.isActive(), true);
  assert.equal(transition.ready(), true);
  assert.equal(transition.ready(), false);
  assert.equal(body.children.length, 0);
});

test("early transition releases on disabled, rejected, late settings, and the five-second hard cap", async () => {
  const disabledDoc = makeDocument();
  const disabledClock = makeClock();
  const disabled = globalThis.Fqmail.earlyTransition.create({documentLike: disabledDoc.documentLike, windowLike: disabledClock.windowLike, storageArea: {get: async () => ({"fqmail:settings": {enabled: false}})}});
  assert.equal(disabled.start(), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disabled.isActive(), false);

  const rejectedDoc = makeDocument();
  const rejected = globalThis.Fqmail.earlyTransition.create({documentLike: rejectedDoc.documentLike, windowLike: makeClock().windowLike, storageArea: {get: async () => { throw new Error("storage"); }}});
  assert.equal(rejected.start(), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rejected.isActive(), false);

  const lateDoc = makeDocument();
  const lateClock = makeClock();
  const lateSettings = deferred();
  const late = globalThis.Fqmail.earlyTransition.create({documentLike: lateDoc.documentLike, windowLike: lateClock.windowLike, storageArea: {get: () => lateSettings.promise}});
  late.start();
  lateClock.tick(301);
  assert.equal(late.isActive(), false);
  lateSettings.resolve({"fqmail:settings": {enabled: true}});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lateDoc.body.children.length, 0);

  const cappedDoc = makeDocument();
  const cappedClock = makeClock();
  const capped = globalThis.Fqmail.earlyTransition.create({documentLike: cappedDoc.documentLike, windowLike: cappedClock.windowLike, storageArea: {get: async () => ({"fqmail:settings": {enabled: true}})}});
  capped.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(capped.isActive(), true);
  cappedClock.tick(4999);
  assert.equal(capped.isActive(), true);
  cappedClock.tick(1);
  assert.equal(capped.isActive(), false);
});

test("early transition is safe when body and head are not ready and never recreates document roots", () => {
  const clock = makeClock();
  const documentLike = {body: null, head: null, createElement: () => new Node("div"), querySelector: () => null, addEventListener() {}, removeEventListener() {}};
  const transition = globalThis.Fqmail.earlyTransition.create({documentLike, windowLike: clock.windowLike, storageArea: {get: async () => ({"fqmail:settings": {enabled: true}})}});
  assert.doesNotThrow(() => transition.start());
  assert.equal(transition.isActive(), true);
  assert.equal(documentLike.documentElement, undefined);
});

test("early transition mounts as soon as body appears before DOMContentLoaded", async () => {
  const clock = makeClock();
  const settings = deferred();
  const observers = [];
  class FakeObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
    fire(records = []) { if (!this.disconnected) this.callback(records); }
  }
  const documentLike = {
    body: null,
    head: new Node("head"),
    createElement(tagName) { return new Node(tagName); },
    querySelector(selector) {
      if (selector === "[data-fqmail-early-transition]") {
        return this.body?.children.find((node) => node.getAttribute("data-fqmail-early-transition") === "true") || null;
      }
      return null;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const transition = globalThis.Fqmail.earlyTransition.create({
    documentLike,
    windowLike: {...clock.windowLike, MutationObserver: FakeObserver},
    storageArea: {get: () => settings.promise},
  });

  assert.equal(transition.start(), true);
  settings.resolve({"fqmail:settings": {enabled: true}});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(documentLike.body, null);

  documentLike.body = new Node("body");
  assert.equal(observers.length, 1);
  observers[0].fire([{addedNodes: [documentLike.body]}]);
  assert.equal(documentLike.body.children.length, 1);
  assert.equal(documentLike.body.children[0].getAttribute("data-fqmail-early-transition"), "true");
  transition.ready();
  assert.equal(observers[0].disconnected, true);
});
