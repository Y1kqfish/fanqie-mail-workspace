import test from "node:test";
import assert from "node:assert/strict";
import "../src/skins/outlook/fluent-icons.js";
import "../src/skins/outlook/personas.js";
import "../src/skins/outlook/components.js";

class Node {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = "";
    this.textContent = "";
    this.disabled = false;
    this.style = {};
  }

  append(...children) { this.children.push(...children.filter(Boolean)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  click() { this.listeners.get("click")?.({type: "click"}); }
  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.children) {
        if ((selector === ".fqmail-command-main" && child.className.includes("fqmail-command-main"))
          || (selector === ".fqmail-command-dropdown" && child.className.includes("fqmail-command-dropdown"))
          || (selector === ".fqmail-command-label" && child.className.includes("fqmail-command-label"))) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const documentLike = {
  createElement: (tagName) => new Node(tagName),
  createElementNS: (namespaceURI, tagName) => new Node(tagName, namespaceURI),
};

test("component module exposes the split command and accessible icon button contract", () => {
  const components = globalThis.Fqmail.outlookComponents;
  assert.ok(components);
  const events = [];
  const command = components.createSplitCommand(documentLike, {
    label: "新邮件",
    icon: "mail",
    className: "fqmail-command fqmail-command--compose",
    onMain: () => events.push("main"),
    onDropdown: () => events.push("dropdown"),
  });
  command.mainButton.click();
  command.dropdownButton.click();
  assert.deepEqual(events, ["main", "dropdown"]);
  assert.equal(command.root.querySelectorAll(".fqmail-command-main").length, 1);
  assert.equal(command.root.querySelectorAll(".fqmail-command-dropdown").length, 1);

  const button = components.createIconButton(documentLike, {label: "撤消", icon: "mail", disabled: true});
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute("aria-label"), "撤消");
});

test("component module exposes menu, folder, and message semantics", () => {
  const components = globalThis.Fqmail.outlookComponents;
  assert.ok(components);
  const folder = components.createFolderRow(documentLike, {label: "收件箱", icon: "mail", selected: true});
  assert.equal(folder.root.tagName, "BUTTON");
  assert.equal(folder.root.getAttribute("aria-current"), "page");
  const message = components.createMessageRow(documentLike, {chapterId: "c1", sender: "番茄小说", subject: "第1章", preview: "书", selected: true});
  assert.equal(message.root.getAttribute("data-chapter-id"), "c1");
  assert.ok(message.checkbox && message.avatar && message.timeNode);
  const menu = components.createMenu(documentLike, {label: "更多", items: [{id: "more", label: "更多", icon: "mail", onClick() {}}]});
  assert.equal(menu.root.getAttribute("role"), "menu");
  assert.equal(menu.itemButtons[0].getAttribute("role"), "menuitem");
});

test("message row accepts a caller-owned persona avatar", () => {
  const row = globalThis.Fqmail.outlookComponents.createMessageRow(documentLike, {
    chapterId: "c-1", sender: "林然", subject: "第1章", preview: "书",
    avatarText: "林", avatarColor: "#0f6cbd", selected: true,
  });
  assert.equal(row.avatar.textContent, "林");
  assert.equal(row.avatar.getAttribute("data-fqmail-avatar-color"), "#0f6cbd");
  assert.equal(row.avatar.style.backgroundColor, "#0f6cbd");
});
