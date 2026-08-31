import test from "node:test";
import assert from "node:assert/strict";
import "../src/core/reader-transfer.js";

test("reader transfer mounts the same node and restores its exact position", () => {
  const originalParent = {
    children: [],
    insertBefore(node, reference) {
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
      node.parentNode = this;
    },
    removeChild(node) {
      this.children.splice(this.children.indexOf(node), 1);
      node.parentNode = null;
    },
  };
  const box = {parentNode: originalParent, scrollTop: 18, scrollHeight: 100, clientHeight: 50};
  const sibling = {parentNode: originalParent};
  originalParent.children.push(box, sibling);
  const pane = {scrollTop: 0, scrollHeight: 200, clientHeight: 100, children: [], append(node) { this.children.push(node); node.parentNode = this; }};
  const doc = {createComment(value) { return {nodeType: 8, value, parentNode: null}; }};
  const win = {scrollX: 4, scrollY: 9, scrollTo(x, y) { this.restored = [x, y]; }};
  const transfer = globalThis.Fqmail.transfer.mount({doc, box, pane, windowLike: win, readerRoot: {style: {cssText: "color:red"}}});

  assert.equal(pane.children[0], box);
  assert.equal(originalParent.children[0].nodeType, 8);
  assert.equal(transfer.scrollElement, pane);
  assert.equal(transfer.getProgress(), 0);
  transfer.setProgress(0.36);
  assert.equal(pane.scrollTop, 36);

  assert.equal(transfer.restore(), true);
  assert.equal(originalParent.children[0], box);
  assert.equal(originalParent.children[1], sibling);
  assert.deepEqual(win.restored, [4, 9]);
  assert.equal(box.scrollTop, 18);
});

test("reader transfer reports failure when its marker is detached after SPA replacement", () => {
  const originalParent = {
    children: [],
    insertBefore(node, reference) {
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
      node.parentNode = this;
    },
    removeChild(node) {
      this.children.splice(this.children.indexOf(node), 1);
      node.parentNode = null;
    },
  };
  const box = {parentNode: originalParent, scrollTop: 12};
  originalParent.children.push(box);
  const pane = {
    children: [],
    append(node) {
      this.children.push(node);
      node.parentNode = this;
    },
    removeChild(node) {
      this.children.splice(this.children.indexOf(node), 1);
      node.parentNode = null;
    },
  };
  const doc = {createComment: () => ({parentNode: null})};
  const transfer = globalThis.Fqmail.transfer.mount({doc, box, pane, windowLike: {scrollTo() {}}});

  transfer.marker.parentNode = null;
  originalParent.children = [];

  assert.equal(transfer.restore(), false);
  assert.equal(pane.children.includes(box), false);
  assert.equal(originalParent.children.includes(box), false);
  assert.equal(box.parentNode, null);
});

test("reader progress is normalized before being exposed", () => {
  const transfer = globalThis.Fqmail.transfer.createProgress({scrollTop: 20, scrollHeight: 100, clientHeight: 50});
  assert.equal(transfer(), 0.4);
  assert.equal(globalThis.Fqmail.transfer.createProgress({scrollTop: 90, scrollHeight: 100, clientHeight: 50})(), 1);
});

test("reader transfer removes a style attribute that was absent before mounting", () => {
  const parent = {
    children: [],
    insertBefore(node, reference) {
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
      node.parentNode = this;
    },
    removeChild(node) {
      this.children.splice(this.children.indexOf(node), 1);
      node.parentNode = null;
    },
  };
  const box = {parentNode: parent, scrollTop: 0};
  parent.children.push(box);
  const pane = {children: [], append(node) { this.children.push(node); node.parentNode = this; }, removeChild(node) { this.children.splice(this.children.indexOf(node), 1); }};
  const doc = {createComment: () => ({parentNode: null})};
  const readerRoot = {style: {cssText: "display:block"}, getAttribute: () => null, removeAttribute: (name) => {readerRoot.removed = name;}};
  const transfer = globalThis.Fqmail.transfer.mount({doc, box, pane, readerRoot, windowLike: {scrollTo() {}}});
  transfer.restore();
  assert.equal(readerRoot.removed, "style");
});

test("reader transfer can temporarily show the same box in its live native parent and return it to the pane", () => {
  const parent = {
    children: [],
    insertBefore(node, reference) {
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
      node.parentNode = this;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
    },
  };
  const before = {parentNode: parent};
  const box = {parentNode: parent, scrollTop: 7};
  const after = {parentNode: parent};
  parent.children.push(before, box, after);
  const pane = {
    children: [],
    append(node) { this.children.push(node); node.parentNode = this; },
    removeChild(node) { const index = this.children.indexOf(node); if (index >= 0) this.children.splice(index, 1); node.parentNode = null; },
  };
  const doc = {createComment: () => ({nodeType: 8, parentNode: null})};
  const readerRoot = {style: {cssText: "display:block"}};
  const win = {scrollX: 11, scrollY: 13, scrollTo(x, y) { this.restored = [x, y]; }};
  const transfer = globalThis.Fqmail.transfer.mount({doc, box, pane, readerRoot, windowLike: win});

  assert.equal(typeof transfer.showNative, "function");
  assert.equal(typeof transfer.showPane, "function");
  assert.equal(transfer.showNative(), true);
  assert.equal(box.parentNode, parent);
  assert.deepEqual(parent.children, [before, parent.children[1], box, after]);
  assert.equal(parent.children[1].nodeType, 8);
  assert.equal(transfer.showNative(), true);
  assert.equal(transfer.showPane(), true);
  assert.equal(box.parentNode, pane);
  assert.equal(pane.children.filter((node) => node === box).length, 1);
  assert.equal(transfer.showPane(), true);
  assert.equal(transfer.restore(), true);
  assert.equal(parent.children[1], box);
  assert.equal(parent.children.includes(box), true);
  assert.equal(box.scrollTop, 7);
  assert.deepEqual(win.restored, [11, 13]);
  assert.equal(readerRoot.style.cssText, "display:block");
});
