import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/tokens.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";
import "../src/skins/outlook/index.js";

class MiniNode {
  constructor(tagName, namespaceURI = null) {
    this.tagName = tagName;
    this.namespaceURI = namespaceURI;
    this.children = [];
    this.parentNode = null;
    this.className = "";
    this.textContent = "";
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.classList = {add: (...names) => {
      this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" ");
    }};
  }

  append(...children) {
    for (const child of children) {
      if (!child) continue;
      this.children.push(child);
      child.parentNode = this;
    }
  }

  appendChild(child) { this.append(child); return child; }

  replaceChildren(...children) {
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    this[name] = String(value);
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  click() {
    this.listeners.get("click")?.({currentTarget: this, target: this});
  }

  querySelectorAll(selector) {
    const wanted = selector.startsWith(".") ? selector.slice(1) : "";
    const result = [];
    const visit = (node) => {
      if (wanted && node.className.split(/\s+/).includes(wanted)) result.push(node);
      for (const child of node.children) visit(child);
    };
    visit(this);
    return result;
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const miniDocument = {
  createElement: (tagName) => new MiniNode(tagName),
  createElementNS: (namespaceURI, tagName) => new MiniNode(tagName, namespaceURI),
};

function textOf(node) {
  return [node.textContent, ...node.children.map(textOf)].join("");
}

test("Outlook skin exposes the 1:1 shell refs and forwards real commands", () => {
  const events = [];
  const skin = globalThis.Fqmail.outlook.create({
    documentLike: miniDocument,
    onPrev: () => events.push("prev"),
    onNext: () => events.push("next"),
    onRestore: () => events.push("restore"),
    onToggle: () => events.push("toggle"),
  });
  for (const ref of ["topbar", "searchBox", "appRail", "ribbon", "folderPane", "messageListPane", "readerPane", "utilityRail", "prevButton", "nextButton", "restoreButton", "toggleButton", "status"]) {
    assert.ok(skin.refs[ref], ref);
  }
  assert.equal(skin.root.querySelectorAll(".fqmail-shell").length, 1);
  assert.ok(skin.refs.catalogSyncSlot);
  assert.equal(skin.root.querySelectorAll(".fqmail-catalog-button").length, 0);
  assert.equal(textOf(skin.root).includes("目录"), false);
  assert.equal(skin.refs.searchBox.disabled, false);
  assert.equal(skin.refs.searchBox.readOnly, false);
  assert.equal(skin.refs.searchBox.getAttribute("aria-disabled"), null);
  skin.renderSnapshot({previousButton: {}, nextButton: {}}, true);
  skin.refs.prevButton.click();
  skin.refs.nextButton.click();
  skin.refs.restoreButton.click();
  skin.refs.toggleButton.click();
  assert.deepEqual(events, ["prev", "next", "restore", "toggle"]);
});

test("renderSnapshot shows exactly one current mail row and reader heading", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike: miniDocument});
  skin.renderSnapshot({
    bookTitle: "测试书",
    chapterId: "chapter-5",
    chapterTitle: "第5章 之前你叫我小白",
    previousButton: {},
    nextButton: {},
  }, true);
  let rows = skin.refs.messageListPane.querySelectorAll(".fqmail-message-row");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute("data-chapter-id"), "chapter-5");
  assert.equal(rows[0].getAttribute("aria-selected"), "true");
  assert.match(textOf(rows[0]), /第5章 之前你叫我小白/);
  assert.match(textOf(skin.refs.readerRegion), /第5章 之前你叫我小白/);
  skin.renderSnapshot({bookTitle: "测试书", chapterId: "chapter-6", chapterTitle: "第6章 清晨"}, true);
  rows = skin.refs.messageListPane.querySelectorAll(".fqmail-message-row");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute("data-chapter-id"), "chapter-6");
});

test("status remains controlled and only reports supported states", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike: miniDocument});
  skin.setStatus("loading", "正在切换章节");
  assert.equal(skin.root.getAttribute("data-fqmail-state"), "loading");
  assert.equal(skin.refs.status.textContent, "正在切换章节");
  skin.setStatus("unexpected", "错误状态");
  assert.equal(skin.root.getAttribute("data-fqmail-state"), "error");
});
