import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import "../src/skins/outlook/fluent-icons.js";

class SvgNode {
  constructor(namespaceURI, tagName) {
    this.namespaceURI = namespaceURI;
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.classList = {add() {}};
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  append(child) {
    this.children.push(child);
  }
}

function makeSvgDocument() {
  return {
    createElementNS(namespaceURI, tagName) {
      return new SvgNode(namespaceURI, tagName);
    },
  };
}

test("Fluent icons create accessible currentColor SVG without innerHTML", () => {
  const icon = globalThis.Fqmail.fluentIcons.create(makeSvgDocument(), "mail");
  assert.equal(icon.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(icon.getAttribute("viewBox"), "0 0 20 20");
  assert.equal(icon.getAttribute("width"), "20");
  assert.equal(icon.getAttribute("height"), "20");
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  assert.equal(icon.children[0].getAttribute("fill"), "currentColor");
  assert.ok(icon.children[0].getAttribute("d").length > 20);
});

test("named icon uses a title instead of aria-hidden", () => {
  const icon = globalThis.Fqmail.fluentIcons.create(makeSvgDocument(), "search", {title: "搜索"});
  assert.equal(icon.getAttribute("role"), "img");
  assert.equal(icon.getAttribute("aria-label"), "搜索");
  assert.equal(icon.getAttribute("aria-hidden"), null);
});

test("unsupported Fluent icon fails closed", () => {
  assert.throws(() => globalThis.Fqmail.fluentIcons.create(makeSvgDocument(), "unknown"), /Unknown Fluent icon/);
});

test("M2 retains the base locally vendored Fluent icon names", () => {
  for (const name of ["apps", "mail", "bookOpen", "arrowPrevious", "arrowNext", "arrowReset", "search"]) {
    const icon = globalThis.Fqmail.fluentIcons.create(makeSvgDocument(), name);
    assert.equal(icon.namespaceURI, "http://www.w3.org/2000/svg");
    assert.equal(icon.children[0].getAttribute("fill"), "currentColor");
    assert.ok(icon.children[0].getAttribute("d"));
  }
});

test("M2 names the expanded Outlook control icon set independently", () => {
  const paths = new Set();
  for (const name of [
    "settings", "help", "notification", "alert", "calendar", "people", "task",
    "delete", "archive", "reply", "forward", "filter", "sort",
  ]) {
    const icon = globalThis.Fqmail.fluentIcons.create(makeSvgDocument(), name);
    assert.equal(icon.getAttribute("data-fqmail-icon-name"), name);
    const path = icon.children[0].getAttribute("d");
    assert.ok(path);
    paths.add(path);
  }
  assert.equal(paths.size, 13);
});

test("Fluent attribution pins the upstream source and license", async () => {
  const notice = await readFile(new URL("../third_party/fluentui-system-icons/NOTICE.md", import.meta.url), "utf8");
  const license = await readFile(new URL("../third_party/fluentui-system-icons/LICENSE", import.meta.url), "utf8");
  assert.match(notice, /4d685f77b2cb8f3f412a74ec8d920c8c91149528/);
  assert.match(notice, /License: MIT/);
  assert.match(license, /MIT License/);
  assert.match(license, /Microsoft Corporation/);
});

test("Fluent registry exposes the complete screenshot semantic icon set and pinned sources", () => {
  const icons = globalThis.Fqmail.fluentIcons;
  const requiredIcons = [
    "launcher", "search", "feedback", "premium", "notification", "settings",
    "navigation", "mail", "calendar", "people", "task", "moreApps",
    "compose", "chevronDown", "delete", "archive", "shieldError", "folderMove",
    "reply", "replyAll", "forward", "mailRead", "flag", "appFolder", "community",
    "undo", "more", "chevronRight", "inbox", "send", "draft", "junk", "note",
    "checkbox", "sort", "pin", "close", "edit", "selectAll", "filter", "outlookLogo",
  ];
  assert.ok(requiredIcons.length >= 35);
  for (const name of requiredIcons) assert.equal(icons.has(name), true, name);
  assert.deepEqual(icons.names().sort(), [...new Set(icons.names())].sort());
  for (const source of icons.sources()) {
    assert.equal(source.commit, "4d685f77b2cb8f3f412a74ec8d920c8c91149528");
    assert.match(source.file, /^assets\/.+\/SVG\/ic_fluent_[a-z0-9_]+_(12|20)_(regular|filled)\.svg$/);
  }
});

test("Fluent registry creates independently named regular and filled variants", () => {
  const icons = globalThis.Fqmail.fluentIcons;
  const regular = icons.create(makeSvgDocument(), "compose", {variant: "regular"});
  const filled = icons.create(makeSvgDocument(), "compose", {variant: "filled"});
  assert.equal(regular.getAttribute("data-fqmail-icon-name"), "compose");
  assert.equal(regular.getAttribute("data-fqmail-icon-variant"), "regular");
  assert.equal(filled.getAttribute("data-fqmail-icon-variant"), "filled");
  assert.ok(regular.children[0].getAttribute("d"));
  assert.ok(filled.children[0].getAttribute("d"));
  const commandNames = ["compose", "delete", "archive", "shieldError", "folderMove", "replyAll", "mailRead", "flag", "appFolder", "community", "undo", "more"];
  assert.equal(new Set(commandNames).size, commandNames.length);
});
