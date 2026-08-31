import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/tokens.js";
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
    this.style = {};
    this.disabled = false;
    this.value = "";
    this.classList = {
      add: (...names) => {
        this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" ");
      },
      remove: (...names) => {
        this.className = this.className.split(/\s+/).filter((name) => name && !names.includes(name)).join(" ");
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

  appendChild(node) {
    this.append(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    this[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

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

  click() {
    this.dispatchEvent({type: "click"});
  }

  focus() {
    this.dispatchEvent({type: "focus"});
  }

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

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
  }

  remove() {
    this.parentNode?.removeChild?.(this);
  }
}

function makeDocument() {
  return {
    createElement: (tagName) => new DomNode(tagName),
    createElementNS: (namespaceURI, tagName) => new DomNode(tagName, namespaceURI),
  };
}

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].join("");
}

test("skin builds the Outlook workspace with a catalog sync slot", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike: makeDocument()});
  for (const ref of ["topbar", "searchBox", "appRail", "ribbon", "folderPane", "messageListPane", "readerPane", "utilityRail", "prevButton", "nextButton", "restoreButton", "toggleButton", "status"]) {
    assert.ok(skin.refs[ref], ref);
  }
  assert.equal(skin.root.querySelectorAll(".fqmail-shell").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-topbar").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-app-rail").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-ribbon").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-folder-pane").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-message-list-pane").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-reader-pane").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-ad-rail").length, 1);
  assert.equal(skin.refs.catalogSyncSlot.className, "fqmail-catalog-sync-slot");
  assert.equal(skin.root.querySelectorAll(".fqmail-catalog-button").length, 0);
  assert.equal(textOf(skin.root).includes("目录"), false);
  assert.equal(skin.refs.searchBox.disabled, false);
  assert.equal(skin.refs.searchBox.readOnly, false);
  assert.equal(skin.refs.searchBox.getAttribute("aria-disabled"), null);
});

test("renderSnapshot replaces the only current message using real identity", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike: makeDocument()});
  skin.renderSnapshot({
    bookTitle: "测试书",
    chapterId: "chapter-5",
    chapterTitle: "第5章 真实章节",
    previousButton: {},
    nextButton: {},
  }, true);
  let rows = skin.refs.messageListPane.querySelectorAll(".fqmail-message-row");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute("data-chapter-id"), "chapter-5");
  assert.equal(rows[0].getAttribute("aria-selected"), "true");
  assert.match(textOf(rows[0]), /第5章 真实章节/);
  skin.renderSnapshot({bookTitle: "测试书", chapterId: "chapter-6", chapterTitle: "第6章 新章节"}, true);
  rows = skin.refs.messageListPane.querySelectorAll(".fqmail-message-row");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute("data-chapter-id"), "chapter-6");
});

test("presentation controls show a reversible notice without controller side effects", () => {
  const timers = [];
  const calls = [];
  const skin = globalThis.Fqmail.outlook.create({
    documentLike: makeDocument(),
    windowLike: {setTimeout: (callback) => {timers.push(callback); return timers.length;}, clearTimeout() {}},
    onPrev: () => calls.push("prev"),
    onNext: () => calls.push("next"),
    onRestore: () => calls.push("restore"),
    onToggle: () => calls.push("toggle"),
  });
  const presentation = skin.root.querySelector(".fqmail-command-button");
  assert.ok(presentation);
  presentation.click();
  assert.match(skin.refs.status.textContent, /此控件仅作界面展示/);
  assert.deepEqual(calls, []);
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(skin.refs.status.textContent, "正文已连接");
  skin.refs.searchBox.value = "章节";
  skin.refs.searchBox.dispatchEvent({type: "input"});
  assert.match(skin.refs.status.textContent, /先同步邮件/);
});

test("Outlook zones expose real mail semantics and presentation-only actions", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike: makeDocument()});
  for (const className of ["fqmail-topbar-settings", "fqmail-topbar-help", "fqmail-topbar-notifications", "fqmail-account-avatar"]) {
    assert.equal(skin.root.querySelectorAll("." + className).length, 1, className);
  }
  assert.equal(skin.refs.appRail.querySelectorAll(".fqmail-rail-item").length, 6);
  for (const item of skin.refs.appRail.querySelectorAll(".fqmail-rail-item")) {
    assert.equal(item.tagName, "button");
    assert.ok(item.getAttribute("title"));
  }
  assert.equal(skin.refs.folderPane.querySelectorAll(".fqmail-folder-row").length, 12);
  assert.equal(skin.refs.messageListPane.querySelectorAll(".fqmail-message-list-header").length, 1);
  assert.equal(skin.refs.readerMeta.querySelectorAll(".fqmail-reader-sender").length, 1);
  assert.equal(skin.refs.moreButton.getAttribute("aria-haspopup"), "menu");
});
