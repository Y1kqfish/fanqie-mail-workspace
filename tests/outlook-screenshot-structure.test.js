import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/tokens.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";
import "../src/skins/outlook/index.js";

class Node {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.className = "";
    this.textContent = "";
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.hidden = false;
    this.classList = {add: (...names) => {
      this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" ");
    }};
  }
  append(...children) { for (const child of children) { if (!child) continue; child.parentNode = this; this.children.push(child); } }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  click() { if (!this.disabled) this.listeners.get("click")?.({currentTarget: this, target: this}); }
  querySelectorAll(selector) {
    const wanted = selector.startsWith(".") ? selector.slice(1) : null;
    const result = [];
    const visit = (node) => { if (wanted && node.className.split(/\s+/).includes(wanted)) result.push(node); for (const child of node.children) visit(child); };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { let node = this; const wanted = selector.startsWith(".") ? selector.slice(1) : selector; while (node) { if (node.className.split(/\s+/).includes(wanted)) return node; node = node.parentNode; } return null; }
}

const documentLike = {createElement: (tag) => new Node(tag), createElementNS: (_ns, tag) => new Node(tag)};
const textOf = (node) => [node.textContent, ...node.children.map(textOf)].join("");

test("screenshot replica exposes exactly one ordered eight-zone shell", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike});
  const classes = skin.root.children.map((node) => node.className);
  assert.equal(skin.root.querySelectorAll(".fqmail-topbar").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-app-rail").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-ribbon").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-folder-pane").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-message-list-pane").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-reader-region").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-ad-rail").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-taskbar").length, 0);
  assert.equal(skin.root.querySelectorAll(".fqmail-task-tab").length, 0);
  assert.ok(classes.includes("fqmail-topbar"));
  assert.equal(textOf(skin.root).includes("番茄邮箱式阅读工作区"), false);
});

test("command bar uses the twelve semantic screenshot commands", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike});
  const labels = skin.refs.commandBar.querySelectorAll(".fqmail-command-label").map((node) => node.textContent);
  assert.deepEqual(labels, ["新邮件", "删除", "存档", "报告", "移动", "回复全部", "已读", "标记", "文件夹", "社区", "撤销", "更多"]);
  assert.equal(skin.refs.commandBar.querySelectorAll(".fqmail-split-command").length, 5);
  assert.equal(skin.refs.commandBar.querySelectorAll(".fqmail-real-command").length, 0);
});

test("message list header keeps only one horizontal tab strip without a duplicate title", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike});
  assert.equal(skin.refs.messageListPane.querySelectorAll(".fqmail-message-list-title").length, 0);
  const tabs = skin.refs.messageListPane.querySelectorAll(".fqmail-list-tab");
  assert.deepEqual(tabs.map((tab) => tab.textContent), ["重点", "其他"]);
});

test("folder pane omits the current book title while keeping chapter titles", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike});
  skin.renderSnapshot({bookTitle: "不应出现在左栏的书", chapterId: "c-8", chapterTitle: "第8章 留在邮件主题"}, true);
  assert.equal(skin.refs.folderPane.querySelectorAll(".fqmail-folder-title").length, 0);
  assert.equal(textOf(skin.refs.folderPane).includes("不应出现在左栏的书"), false);
  assert.match(textOf(skin.refs.messageList), /第8章 留在邮件主题/);
  assert.match(textOf(skin.refs.readerRegion), /第8章 留在邮件主题/);
});

test("renderSnapshot keeps one real current message and updates the reader", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike});
  skin.renderSnapshot({bookTitle: "测试书", chapterId: "c-7", chapterTitle: "第7章 夜行", previousButton: {}, nextButton: {}}, true);
  const rows = skin.refs.messageList.querySelectorAll(".fqmail-message-row");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].getAttribute("data-chapter-id"), "c-7");
  assert.match(textOf(rows[0]), /测试书/);
  assert.match(textOf(skin.refs.readerRegion), /第7章 夜行/);
  assert.equal(skin.root.querySelectorAll(".muye-reader-box").length, 0);
});

test("navigation belongs to the list header and folder inbox is the only real folder action", () => {
  const events = [];
  const skin = globalThis.Fqmail.outlook.create({documentLike, onPrev: () => events.push("prev"), onNext: () => events.push("next")});
  skin.renderSnapshot({bookTitle: "书", chapterId: "c", chapterTitle: "章", previousButton: {}, nextButton: {}}, true);
  assert.equal(skin.refs.prevButton.closest(".fqmail-message-list-header") !== null, true);
  assert.equal(skin.refs.nextButton.closest(".fqmail-message-list-header") !== null, true);
  skin.refs.prevButton.click(); skin.refs.nextButton.click();
  assert.deepEqual(events, ["prev", "next"]);
  const folderText = textOf(skin.refs.folderPane);
  assert.match(folderText, /收件箱/); assert.match(folderText, /垃圾邮件/); assert.match(folderText, /对话历史记录/);
  assert.equal(skin.refs.folderPane.querySelectorAll("[aria-current]").length, 0);
  assert.equal(skin.refs.folderPane.querySelectorAll(".fqmail-folder-row").length, 12);
});

test("reader card and local ad rail occupy the released lower area", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike});
  skin.renderSnapshot({bookTitle: "书", chapterId: "c", chapterTitle: "第1章"}, true);
  assert.equal(skin.refs.readerRegion.querySelectorAll(".fqmail-message-card").length, 1);
  assert.equal(skin.refs.readerRegion.querySelectorAll(".fqmail-reader-pane").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-utility-card").length, 0);
  assert.equal(skin.root.querySelectorAll(".fqmail-ad-rail").length, 1);
  assert.equal(skin.root.querySelectorAll(".fqmail-taskbar").length, 0);
  assert.equal(skin.refs.taskbar, undefined);
});

test("current snapshot uses one stable local persona for the list and reader", () => {
  const skin = globalThis.Fqmail.outlook.create({documentLike});
  skin.renderSnapshot({bookId: "book-7", chapterId: "chapter-7", bookTitle: "书", chapterTitle: "第7章"}, true);
  const row = skin.refs.messageList.querySelector(".fqmail-message-row");
  const listSender = row.querySelector(".fqmail-message-sender");
  const listAvatar = row.querySelector(".fqmail-message-avatar");
  const readerAvatar = skin.refs.readerRegion.querySelector(".fqmail-reader-avatar");
  const readerSender = skin.refs.readerRegion.querySelector(".fqmail-reader-sender");
  assert.notEqual(listSender.textContent, "番茄小说");
  assert.equal(listSender.textContent, readerSender.textContent);
  assert.equal(listAvatar.textContent, readerAvatar.textContent);
  assert.equal(listAvatar.getAttribute("data-fqmail-avatar-color"), readerAvatar.getAttribute("data-fqmail-avatar-color"));
});

test("More menu owns restore/toggle and presentation controls do not call controller callbacks", () => {
  const events = [];
  const skin = globalThis.Fqmail.outlook.create({documentLike, onRestore: () => events.push("restore"), onToggle: () => events.push("toggle")});
  skin.openMoreMenu();
  assert.equal(skin.refs.moreMenu.hidden, false);
  assert.equal(skin.refs.moreButton.getAttribute("aria-expanded"), "true");
  skin.refs.restoreButton.click(); skin.openMoreMenu(); skin.refs.toggleButton.click();
  assert.deepEqual(events, ["restore", "toggle"]);
  assert.equal(skin.refs.moreMenu.hidden, true);
  skin.refs.folderPane.querySelector(".fqmail-folder-row")?.click();
  assert.deepEqual(events, ["restore", "toggle"]);
});
