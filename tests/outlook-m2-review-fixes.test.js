import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";
import "../src/skins/outlook/index.js";

class DomNode {
  constructor(tagName, namespaceURI = null) {
    this.tagName = tagName.toLowerCase();
    this.namespaceURI = namespaceURI;
    this.children = [];
    this.parentNode = null;
    this.className = "";
    this.textContent = "";
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.readOnly = false;
    this.tabIndex = 0;
    this.value = "";
    this.scrollIntoViewCalls = 0;
    this.classList = {
      add: (...names) => {
        this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" ");
      },
    };
  }

  append(...nodes) {
    for (const node of nodes) {
      if (!node) continue;
      node.parentNode?.removeChild?.(node);
      this.children.push(node);
      node.parentNode = this;
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    this[name] = String(value);
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }

  addEventListener(name, listener) {
    const list = this.listeners.get(name) || [];
    list.push(listener);
    this.listeners.set(name, list);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) {
      listener({...event, currentTarget: this, target: event.target || this});
    }
  }

  click() { this.dispatchEvent({type: "click"}); }

  scrollIntoView() { this.scrollIntoViewCalls += 1; }

  querySelectorAll(selector) {
    const wanted = selector.startsWith(".") ? selector.slice(1) : null;
    const result = [];
    const visit = (node) => {
      if (wanted && node.className.split(/\s+/).includes(wanted)) result.push(node);
      for (const child of node.children) visit(child);
    };
    visit(this);
    return result;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
  }
}

const documentLike = {
  createElement: (tagName) => new DomNode(tagName),
  createElementNS: (namespaceURI, tagName) => new DomNode(tagName, namespaceURI),
};

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].join("");
}

function makeSkin() {
  return globalThis.Fqmail.outlook.create({documentLike, windowLike: {
    setTimeout: () => 1,
    clearTimeout() {},
  }});
}

function folderButton(skin, label) {
  return skin.refs.folderPane.querySelectorAll(".fqmail-folder-row")
    .find((node) => textOf(node).trim() === label);
}

function declarations(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule ${selector}`);
  return Object.fromEntries(match[1].split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf(":");
    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
}

test("rendered skin nodes use the CSS state and content class contracts", () => {
  const skin = makeSkin();
  skin.renderSnapshot({bookTitle: "书", chapterId: "c1", chapterTitle: "第1章"});
  assert.equal(skin.root.querySelectorAll(".fqmail-ribbon-tab--selected").length, 1);
  const row = skin.refs.messageList.querySelector(".fqmail-message-row");
  assert.equal(row.querySelectorAll(".fqmail-message-sender").length, 1);
  assert.equal(row.querySelectorAll(".fqmail-message-subject").length, 1);
  assert.equal(row.querySelectorAll(".fqmail-message-preview").length, 1);
  assert.equal(skin.refs.adRail.querySelectorAll(".fqmail-ad-title").length, 1);
  assert.equal(skin.refs.adRail.querySelectorAll(".fqmail-ad-body").length, 1);
  skin.setStatus("error", "受控错误");
  assert.equal(skin.refs.status.getAttribute("data-fqmail-state"), "error");
});

test("2560px layout model preserves the measured overlap and gaps", async () => {
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  const content = declarations(css, ".fqmail-content-grid");
  const brand = declarations(css, ".fqmail-brand");
  assert.deepEqual(content["grid-template-columns"].match(/minmax\([^)]*\)|\S+/g), [
    "212px", "351px", "4px", "minmax(0, 1fr)", "305px",
  ]);
  assert.equal(brand["box-sizing"], "border-box");
  const x = {launcher: 0, brand: 48, search: 264, main: 49, content: 50};
  x.folder = x.content;
  x.message = x.content + 212;
  x.reader = x.message + 351 + 4;
  assert.deepEqual(x, {launcher: 0, brand: 48, search: 264, main: 49, content: 50, folder: 50, message: 262, reader: 617});
});

test("收件箱 focuses the single current message without controller side effects", () => {
  const calls = [];
  const skin = globalThis.Fqmail.outlook.create({documentLike, onNext: () => calls.push("next")});
  skin.renderSnapshot({bookTitle: "书", chapterId: "c1", chapterTitle: "第1章"});
  const row = skin.refs.messageList.querySelector(".fqmail-message-row");
  const inbox = folderButton(skin, "收件箱");
  assert.ok(inbox);
  inbox.click();
  assert.equal(row.scrollIntoViewCalls, 1);
  assert.deepEqual(calls, []);
});

test("non-Mail application rail items are keyboard/click operable presentation controls", () => {
  const skin = makeSkin();
  const items = skin.refs.appRail.querySelectorAll(".fqmail-rail-item");
  assert.equal(items.length, 6);
  for (const item of items.slice(1)) {
    assert.equal(item.tagName, "button");
    item.click();
    assert.match(skin.refs.status.textContent, /此控件仅作界面展示/);
  }
});

test("icon-only controls hide labels visually without changing accessible names", async () => {
  const skin = makeSkin();
  const css = await readFile(new URL("../src/skins/outlook/styles.css", import.meta.url), "utf8");
  const iconOnly = declarations(css, ".fqmail-icon-only");
  const icon = declarations(css, ".fqmail-icon-only .fqmail-icon");
  const label = declarations(css, ".fqmail-icon-only .fqmail-command-label");
  assert.equal(iconOnly.padding, "0");
  assert.equal(iconOnly.overflow, "hidden");
  assert.equal(icon["margin-right"], "0");
  assert.equal(label.position, "absolute");
  assert.equal(label.width, "1px");
  assert.equal(label.height, "1px");

  const iconOnlyButtons = [
    ...skin.refs.topbar.querySelectorAll(".fqmail-topbar-action"),
    ...skin.refs.appRail.querySelectorAll(".fqmail-rail-item"),
  ];
  assert.equal(iconOnlyButtons.length, 9);
  for (const button of iconOnlyButtons) {
    assert.ok(button.className.split(/\s+/).includes("fqmail-icon-only"));
    assert.ok(button.getAttribute("aria-label"));
    assert.ok(button.getAttribute("title"));
    assert.ok(button.getAttribute("aria-label"));
  }
  assert.equal(skin.refs.topbar.querySelector(".fqmail-topbar-settings").querySelector(".fqmail-icon").getAttribute("data-fqmail-icon-name"), "settings");
  assert.equal(skin.refs.topbar.querySelector(".fqmail-topbar-help").querySelector(".fqmail-icon").getAttribute("data-fqmail-icon-name"), "help");
  assert.equal(skin.refs.topbar.querySelector(".fqmail-topbar-notifications").querySelector(".fqmail-icon").getAttribute("data-fqmail-icon-name"), "notification");
  const renderedIconNames = new Set(skin.root.querySelectorAll(".fqmail-icon").map((icon) => icon.getAttribute("data-fqmail-icon-name")));
  for (const name of ["calendar", "people", "task", "delete", "shieldError", "archive", "reply", "forward", "filter", "sort"]) {
    assert.ok(renderedIconNames.has(name), `skin does not render ${name}`);
  }
  const commandLabel = skin.refs.prevButton.querySelector(".fqmail-command-label");
  assert.equal(commandLabel.className, "fqmail-command-label");
});

test("收件箱 is a real current-message control, not a presentation placeholder", () => {
  const skin = makeSkin();
  skin.renderSnapshot({bookTitle: "书", chapterId: "c1", chapterTitle: "第1章"});
  const inbox = folderButton(skin, "收件箱");
  assert.ok(inbox);
  assert.equal(inbox.getAttribute("aria-disabled"), null);
  assert.equal(inbox.className.split(/\s+/).includes("fqmail-presentation-button"), false);
  assert.equal(inbox.getAttribute("aria-current"), "page");
  const before = skin.refs.status.textContent;
  inbox.click();
  assert.equal(skin.refs.status.textContent, before);
});

test("brand identifies the workspace as Outlook while root and account remain local Fanqie context", () => {
  const skin = makeSkin();
  assert.match(textOf(skin.refs.topbar.querySelector(".fqmail-brand")), /^Outlook$/);
  assert.match(skin.root.getAttribute("aria-label"), /番茄/);
  assert.match(skin.root.querySelector(".fqmail-account-avatar").getAttribute("aria-label"), /本地/);
});

test("search remains visible and prompts before catalog is ready", () => {
  const skin = makeSkin();
  const search = skin.refs.searchBox;
  assert.equal(search.disabled, false);
  assert.equal(search.readOnly, false);
  assert.equal(search.getAttribute("aria-disabled"), null);
  assert.equal(search.tabIndex, 0);
  search.value = "用户输入前";
  search.dispatchEvent({type: "input"});
  assert.equal(search.value, "用户输入前");
  assert.match(skin.refs.status.textContent, /先同步邮件/);
});
