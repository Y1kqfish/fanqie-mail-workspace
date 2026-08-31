import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/native-catalog-dock.js";

class Node {
  constructor(parent = null) {
    this.parentNode = null;
    this.children = [];
    this.className = "reader-toolbar-item";
    this.style = {cssText: "color: red", left: "", right: ""};
    this.attributes = {style: "color: red", role: "button", tabindex: "0", "aria-label": "目录"};
    this.listeners = new Map();
    this.rect = {left: 20, top: 30, width: 58, height: 32, right: 78, bottom: 62};
    parent?.append(this);
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node.parentNode?.removeChild) node.parentNode.removeChild(node);
      this.children.push(node);
      node.parentNode = this;
    }
  }

  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentNode = null;
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) || [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter((item) => item !== listener));
  }

  dispatch(event) {
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    this.parentNode?.dispatch(event);
  }

  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "style") this.style.cssText = String(value);
  }
  removeAttribute(name) { delete this.attributes[name]; }
  getBoundingClientRect() { return this.rect; }
}

function makeWindow(innerWidth = 1440) {
  let observer;
  const listeners = new Map();
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      observer = this;
    }
    observe(node) { this.node = node; }
    disconnect() { this.disconnected = true; }
  }
  return {
    innerWidth,
    ResizeObserver,
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) {
      if (listeners.get(name) === listener) listeners.delete(name);
    },
    get listeners() { return listeners; },
    get observer() { return observer; },
  };
}

test("dock reserves the nearest viewport side without moving the native node", () => {
  assert.ok(globalThis.Fqmail?.nativeCatalogDock, "native catalog dock must be registered");
  const app = new Node();
  app.id = "app";
  const toolbar = new Node(app);
  const nativeNode = new Node(toolbar);
  nativeNode.rect = {left: 24, top: 180, width: 64, height: 36, right: 88, bottom: 216};
  const shell = new Node();
  shell.setAttribute("style", "background: white");
  const originalParent = nativeNode.parentNode;
  const originalStyle = nativeNode.style.cssText;

  const dock = globalThis.Fqmail.nativeCatalogDock.mount({
    nativeNode,
    shell,
    windowLike: makeWindow(),
    onTrustedClick() {},
  });

  assert.equal(nativeNode.parentNode, originalParent);
  assert.equal(nativeNode.style.cssText, originalStyle);
  assert.equal(shell.style.left, "96px");
  assert.equal(shell.style.right, "0px");
  assert.equal(shell.getAttribute("data-fqmail-native-dock-side"), "left");
  assert.equal(dock.restore(), true);
  assert.equal(nativeNode.parentNode, originalParent);
  assert.equal(nativeNode.style.cssText, originalStyle);
  assert.equal(shell.getAttribute("style"), "background: white");
});

test("dock uses the right side for a right-edge native control", () => {
  assert.deepEqual(
    globalThis.Fqmail?.nativeCatalogDock?.resolveLayout(
      {left: 1348, right: 1412, width: 64},
      1440,
      8,
    ),
    {side: "right", reserve: 100},
  );
});

test("dock forwards one trusted click, tracks resize, and restores idempotently", () => {
  const app = new Node();
  app.id = "app";
  const toolbar = new Node(app);
  const nativeNode = new Node(toolbar);
  nativeNode.rect = {left: 24, top: 180, width: 64, height: 36, right: 88, bottom: 216};
  const shell = new Node();
  const windowLike = makeWindow();
  const originalClassName = nativeNode.className;
  const originalNativeStyle = nativeNode.style.cssText;
  let trustedClicks = 0;
  const dock = globalThis.Fqmail.nativeCatalogDock.mount({
    nativeNode,
    shell,
    windowLike,
    onTrustedClick: () => { trustedClicks += 1; },
  });

  nativeNode.dispatch({type: "click", isTrusted: true});
  nativeNode.dispatch({type: "click", isTrusted: false});
  assert.equal(trustedClicks, 1);
  assert.equal(windowLike.listeners.has("resize"), true);
  assert.equal(windowLike.observer.node, nativeNode);

  nativeNode.rect = {left: 1348, top: 180, width: 64, height: 36, right: 1412, bottom: 216};
  windowLike.listeners.get("resize")();
  assert.equal(shell.getAttribute("data-fqmail-native-dock-side"), "right");
  assert.equal(nativeNode.style.cssText, originalNativeStyle);
  assert.match(nativeNode.className, /fqmail-native-catalog-control/);
  nativeNode.setAttribute("role", "presentation");
  nativeNode.setAttribute("tabindex", "-1");
  nativeNode.setAttribute("aria-label", "changed");
  nativeNode.setAttribute("aria-hidden", "true");

  assert.equal(dock.restore(), true);
  assert.equal(dock.restore(), true);
  assert.equal(nativeNode.className, originalClassName);
  assert.equal(nativeNode.style.cssText, originalNativeStyle);
  assert.equal(nativeNode.getAttribute("role"), "button");
  assert.equal(nativeNode.getAttribute("tabindex"), "0");
  assert.equal(nativeNode.getAttribute("aria-label"), "目录");
  assert.equal(nativeNode.getAttribute("aria-hidden"), null);
  assert.equal(windowLike.listeners.has("resize"), false);
  assert.equal(windowLike.observer.disconnected, true);
});

test("dock raises the fixed reader toolbar boundary instead of relying on the child z-index", () => {
  const app = new Node();
  app.id = "app";
  const reader = new Node(app);
  reader.className = "muye-reader";
  const toolbar = new Node(reader);
  toolbar.className = "reader-toolbar";
  toolbar.style.position = "fixed";
  toolbar.style.zIndex = "auto";
  toolbar.className += " original-toolbar";
  const nativeNode = new Node(toolbar);
  nativeNode.className = "reader-toolbar-item";
  const label = new Node(nativeNode);
  label.className = "native-label";
  label.textContent = "目录";
  const shell = new Node();
  shell.className = "fqmail-shell";
  shell.style.zIndex = "2147483000";
  const slot = new Node();
  slot.rect = {left: 158, top: 61, width: 70, height: 37, right: 228, bottom: 98};
  const windowLike = makeWindow();
  const originalToolbarClass = toolbar.className;
  const originalToolbarStyle = toolbar.style.cssText;
  const dock = globalThis.Fqmail.nativeCatalogDock.mount({
    nativeNode,
    shell,
    slot,
    windowLike,
    onTrustedClick() {},
  });

  assert.ok(Number(toolbar.style.zIndex) > Number(shell.style.zIndex));
  assert.equal(toolbar.style.visibility, "hidden");
  assert.equal(toolbar.style.pointerEvents, "none");
  assert.equal(nativeNode.style.visibility, "visible");
  assert.equal(nativeNode.style.pointerEvents, "auto");
  assert.equal(dock.isUsable(), true);
  assert.equal(dock.restore(), true);
  assert.equal(toolbar.className, originalToolbarClass);
  assert.equal(toolbar.style.cssText, originalToolbarStyle);
  assert.equal(toolbar.style.visibility || "", "");
  assert.equal(toolbar.style.pointerEvents || "", "");
});
