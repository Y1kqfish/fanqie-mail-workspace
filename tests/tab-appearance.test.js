import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/outlook-favicon.js";
import "../src/core/tab-appearance.js";

class FakeNode {
  constructor(tagName, attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = {...attrs};
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
  }

  append(node) {
    node.parentNode?.removeChild?.(node);
    node.parentNode = this;
    this.children.push(node);
  }

  removeChild(node) {
    this.children = this.children.filter((child) => child !== node);
    node.parentNode = null;
  }

  remove() { this.parentNode?.removeChild?.(this); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
}

function makeDocument() {
  const title = new FakeNode("title");
  title.textContent = "第1章 风雨 - 番茄小说官网";
  const head = new FakeNode("head");
  const nativeIcons = [new FakeNode("link", {rel: "icon", href: "/favicon.ico"}), new FakeNode("link", {rel: "shortcut icon", href: "/old.ico"})];
  head.append(title, ...nativeIcons);
  const body = new FakeNode("body");
  const documentLike = {
    head,
    body,
    title: title.textContent,
    createElement(tagName) { return new FakeNode(tagName); },
    querySelector(selector) {
      if (selector === "title") return head.children.find((node) => node.tagName === "TITLE") || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'link[rel~="icon"]') return head.children.filter((node) => /(^|\s)icon(\s|$)/i.test(node.getAttribute("rel") || ""));
      return [];
    },
  };
  return {documentLike, head, body, title, nativeIcons};
}

class FakeObserver {
  static instances = [];
  constructor(callback) { this.callback = callback; this.disconnected = false; FakeObserver.instances.push(this); }
  observe(target) { this.target = target; }
  disconnect() { this.disconnected = true; }
  fire(records = []) { if (!this.disconnected) this.callback(records); }
}

test("tab appearance keeps the latest native title while applying a fixed local Outlook title", () => {
  const fixture = makeDocument();
  const appearance = globalThis.Fqmail.tabAppearance.create({documentLike: fixture.documentLike, windowLike: {MutationObserver: FakeObserver}});
  assert.equal(appearance.enable(), true);
  assert.equal(fixture.documentLike.title, "收件箱 - Outlook");
  assert.equal(appearance.getNativeTitle(), "第1章 风雨 - 番茄小说官网");

  fixture.title.textContent = "第2章 清晨 - 番茄小说官网";
  FakeObserver.instances.at(-1).fire([{target: fixture.title}]);
  assert.equal(appearance.getNativeTitle(), "第2章 清晨 - 番茄小说官网");
  assert.equal(fixture.documentLike.title, "收件箱 - Outlook");

  assert.equal(appearance.restore(), true);
  assert.equal(fixture.documentLike.title, "第2章 清晨 - 番茄小说官网");
  assert.equal(appearance.restore(), false);
});

test("tab appearance owns one local favicon without changing native icon attributes or resurrecting stale icons", () => {
  const fixture = makeDocument();
  const appearance = globalThis.Fqmail.tabAppearance.create({documentLike: fixture.documentLike, windowLike: {MutationObserver: FakeObserver}});
  appearance.enable();
  const local = fixture.head.children.filter((node) => node.getAttribute("data-fqmail-tab-icon") === "true");
  assert.equal(local.length, 1);
  assert.match(local[0].getAttribute("href"), /^data:image\/svg\+xml/);
  assert.deepEqual(fixture.nativeIcons.map((node) => node.attributes), [
    {rel: "icon", href: "/favicon.ico"},
    {rel: "shortcut icon", href: "/old.ico"},
  ]);

  const dynamic = new FakeNode("link", {rel: "icon", href: "/new.ico", sizes: "32x32"});
  fixture.head.append(dynamic);
  FakeObserver.instances.at(-1).fire([{addedNodes: [dynamic]}]);
  assert.equal(fixture.head.children.at(-1).getAttribute("data-fqmail-tab-icon"), "true");
  appearance.restore();
  assert.equal(fixture.head.children.some((node) => node.getAttribute("data-fqmail-tab-icon") === "true"), false);
  assert.equal(fixture.head.children.includes(dynamic), true);
});

test("tab appearance enable and dispose are idempotent and observe title replacement", () => {
  const fixture = makeDocument();
  const appearance = globalThis.Fqmail.tabAppearance.create({documentLike: fixture.documentLike, windowLike: {MutationObserver: FakeObserver}});
  assert.equal(appearance.enable(), true);
  assert.equal(appearance.enable(), false);
  const replacement = new FakeNode("title"); replacement.textContent = "第3章 - 番茄小说官网";
  fixture.head.removeChild(fixture.title); fixture.head.append(replacement);
  FakeObserver.instances.at(-1).fire([{removedNodes: [fixture.title], addedNodes: [replacement]}]);
  assert.equal(appearance.getNativeTitle(), "第3章 - 番茄小说官网");
  appearance.dispose();
  assert.equal(fixture.documentLike.title, "第3章 - 番茄小说官网");
  assert.equal(appearance.dispose(), false);
});
