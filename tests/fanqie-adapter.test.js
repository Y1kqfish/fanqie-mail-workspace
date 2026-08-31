import test from "node:test";
import assert from "node:assert/strict";
import {FakeDocument, FakeElement, buildReaderFixture} from "./helpers/fake-dom.js";
import "../src/adapters/fanqie/selectors.js";
import "../src/skins/outlook/outlook-favicon.js";
import "../src/core/tab-appearance.js";
import "../src/adapters/fanqie/parser.js";
import "../src/adapters/fanqie/adapter.js";

test("Fanqie reader snapshot reads metadata without reading正文 text", () => {
  const fixture = buildReaderFixture();
  const snapshot = globalThis.Fqmail.fanqie.parseReaderSnapshot(fixture.document, {
    href: "https://fanqienovel.com/reader/book-42?chapter_id=c-2",
  });

  assert.deepEqual(snapshot, {
    bookId: "book-42",
    chapterId: "c-2",
    bookTitle: "测试书",
    chapterTitle: "第一章 雨夜",
    previousButton: fixture.previousButton,
    nextButton: fixture.nextButton,
  });
  assert.equal(snapshot.bodyText, undefined);
});

test("Fanqie identity uses reader path as chapter id when no query is present", () => {
  const {document} = buildReaderFixture();
  const identity = globalThis.Fqmail.fanqie.resolveReaderIdentity(
    document,
    new URL("https://fanqienovel.com/reader/chapter-9"),
  );
  assert.deepEqual(identity, {bookId: "book-42", chapterId: "chapter-9"});
});

test("Fanqie identity shares book id across chapters and falls back to normalized title", () => {
  const first = buildReaderFixture();
  const second = buildReaderFixture();
  const firstIdentity = globalThis.Fqmail.fanqie.resolveReaderIdentity(
    first.document,
    new URL("https://fanqienovel.com/reader/chapter-1?chapter_id=one"),
  );
  const secondIdentity = globalThis.Fqmail.fanqie.resolveReaderIdentity(
    second.document,
    new URL("https://fanqienovel.com/reader/chapter-2?chapterId=two"),
  );
  assert.equal(firstIdentity.bookId, secondIdentity.bookId);
  assert.equal(firstIdentity.chapterId, "one");
  assert.equal(secondIdentity.chapterId, "two");

  first.bookLink.href = "";
  first.bookLink.attributes.href = "";
  const fallback = globalThis.Fqmail.fanqie.resolveReaderIdentity(
    first.document,
    new URL("https://fanqienovel.com/reader/chapter-1"),
  );
  assert.equal(fallback.bookId, "title:%E6%B5%8B%E8%AF%95%E4%B9%A6");
});

test("Fanqie strips the current chapter from a document-title book fallback", () => {
  const fixture = buildReaderFixture();
  fixture.bookLink.href = "";
  fixture.bookLink.attributes.href = "";
  fixture.box.querySelector(".muye-reader-bookname").textContent = "";
  fixture.document.title = "惊鸿第63章 风雨将至_番茄小说官网";
  fixture.box.querySelector(".muye-reader-title").textContent = "第63章 风雨将至";

  const identity = globalThis.Fqmail.fanqie.resolveReaderIdentity(
    fixture.document,
    new URL("https://fanqienovel.com/reader/6892682262933045767"),
  );

  assert.equal(identity.bookId, "title:%E6%83%8A%E9%B8%BF");
  assert.equal(identity.chapterId, "6892682262933045767");
});

test("Fanqie leaves book identity unknown when the document title cannot yield an independent title", () => {
  const fixture = buildReaderFixture();
  fixture.bookLink.href = "";
  fixture.bookLink.attributes.href = "";
  fixture.box.querySelector(".muye-reader-bookname").textContent = "";
  fixture.box.querySelector(".muye-reader-title").textContent = "第63章";
  fixture.document.title = "番茄小说官网";

  const identity = globalThis.Fqmail.fanqie.resolveReaderIdentity(
    fixture.document,
    new URL("https://fanqienovel.com/reader/6892682262933045767"),
  );

  assert.equal(identity.bookId, "");
});

test("Fanqie identity reads the preserved native title while the tab has Outlook chrome", () => {
  const fixture = buildReaderFixture();
  fixture.bookLink.href = "";
  fixture.bookLink.attributes.href = "";
  fixture.box.querySelector(".muye-reader-bookname").textContent = "";
  fixture.document.title = "收件箱 - Outlook";
  fixture.box.querySelector(".muye-reader-title").textContent = "第63章 风雨将至";
  const previousAppearance = globalThis.Fqmail.tabAppearance;
  globalThis.Fqmail.tabAppearance = {getNativeTitle: () => "惊鸿第63章 风雨将至_番茄小说官网"};
  try {
    const identity = globalThis.Fqmail.fanqie.resolveReaderIdentity(
      fixture.document,
      new URL("https://fanqienovel.com/reader/6892682262933045767"),
    );
    assert.equal(identity.bookId, "title:%E6%83%8A%E9%B8%BF");
  } finally {
    globalThis.Fqmail.tabAppearance = previousAppearance;
  }
});

test("Fanqie parser uses the real tab appearance instance before and after native title updates", () => {
  class TitleNode {
    constructor(text) { this.tagName = "TITLE"; this.textContent = text; this.parentNode = null; }
  }
  class HeadNode {
    constructor(title) { this.children = [title]; title.parentNode = this; this.lastChild = title; }
    append(...nodes) {
      for (const node of nodes) {
        node.parentNode?.removeChild?.(node);
        node.parentNode = this;
        this.children.push(node);
        this.lastChild = node;
      }
    }
    removeChild(node) {
      this.children = this.children.filter((child) => child !== node);
      node.parentNode = null;
      this.lastChild = this.children.at(-1) || null;
    }
  }
  class IconNode {
    constructor() { this.attributes = {}; this.parentNode = null; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    remove() { this.parentNode?.removeChild?.(this); }
  }
  class Observer {
    static current = null;
    constructor(callback) { this.callback = callback; this.disconnected = false; Observer.current = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
    fire(records = []) { if (!this.disconnected) this.callback(records); }
  }

  const fixture = buildReaderFixture();
  fixture.bookLink.href = "";
  fixture.bookLink.attributes.href = "";
  fixture.box.querySelector(".muye-reader-bookname").textContent = "";
  fixture.box.querySelector(".muye-reader-title").textContent = "第63章 风雨将至";
  const title = new TitleNode("惊鸿第63章 风雨将至_番茄小说官网");
  const head = new HeadNode(title);
  const originalQuerySelector = fixture.document.querySelector.bind(fixture.document);
  fixture.document.head = head;
  fixture.document.title = title.textContent;
  fixture.document.createElement = () => new IconNode();
  fixture.document.querySelector = (selector) => selector === "title" ? title : originalQuerySelector(selector);

  const appearance = globalThis.Fqmail.tabAppearance.create({
    documentLike: fixture.document,
    windowLike: {MutationObserver: Observer},
  });
  const locationLike = new URL("https://fanqienovel.com/reader/6892682262933045767");
  const beforeEnable = globalThis.Fqmail.fanqie.resolveReaderIdentity(fixture.document, locationLike);
  appearance.enable();
  const afterEnable = globalThis.Fqmail.fanqie.resolveReaderIdentity(fixture.document, locationLike);
  assert.deepEqual(afterEnable, beforeEnable);

  title.textContent = "长夜第64章 雪落无声_番茄小说官网";
  fixture.document.title = title.textContent;
  fixture.box.querySelector(".muye-reader-title").textContent = "第64章 雪落无声";
  const beforeObserver = globalThis.Fqmail.fanqie.resolveReaderIdentity(fixture.document, locationLike);
  assert.equal(beforeObserver.bookId, "title:%E9%95%BF%E5%A4%9C");
  Observer.current.fire([{target: title}]);
  const afterObserver = globalThis.Fqmail.fanqie.resolveReaderIdentity(fixture.document, locationLike);
  assert.deepEqual(afterObserver, beforeObserver);

  appearance.restore();
  assert.equal(fixture.document.title, "长夜第64章 雪落无声_番茄小说官网");
});

test("Fanqie native buttons can be found in a reader sidebar", () => {
  const sidebarCatalog = new FakeElement({
    tagName: "button",
    text: "目录",
  });
  const sidebar = new FakeElement({
    classes: ["reader-sidebar"],
    children: [sidebarCatalog],
  });
  const root = new FakeElement({classes: ["muye-reader"], children: [sidebar]});
  assert.equal(globalThis.Fqmail.fanqie.findNativeButton(new FakeDocument([root]), "目录"), sidebarCatalog);
});

test("Fanqie finds the verified generic toolbar item for the native catalog", () => {
  const catalogLabel = new FakeElement({text: "目录"});
  const catalogItem = new FakeElement({
    classes: ["reader-toolbar-item"],
    text: "目录",
    children: [new FakeElement({tagName: "svg"}), catalogLabel],
  });
  const toolbar = new FakeElement({
    classes: ["reader-toolbar"],
    children: [catalogItem],
  });
  const root = new FakeElement({
    classes: ["muye-reader"],
    children: [new FakeElement({classes: ["muye-reader-inner"], children: [toolbar]})],
  });
  const extensionShell = new FakeElement({
    classes: ["fqmail-shell"],
    children: [new FakeElement({classes: ["reader-toolbar-item"], text: "目录"})],
  });
  const document = new FakeDocument([root, extensionShell]);

  assert.equal(globalThis.Fqmail.fanqie.findNativeButton(document, "目录"), null);
  assert.equal(globalThis.Fqmail.fanqie.findNativeCatalogItem(document), catalogItem);
  assert.equal(catalogLabel.clicked, false);
});

test("Fanqie finds a native toolbar outside the reader root without selecting the shell", () => {
  const nativeCatalog = new FakeElement({
    classes: ["reader-toolbar-item"],
    text: "目录",
  });
  const toolbar = new FakeElement({
    classes: ["reader-toolbar"],
    children: [nativeCatalog],
  });
  const readerRoot = new FakeElement({
    classes: ["muye-reader"],
  });
  const extensionCatalog = new FakeElement({
    classes: ["reader-toolbar-item"],
    text: "目录",
  });
  const extensionShell = new FakeElement({
    classes: ["fqmail-shell"],
    children: [extensionCatalog],
  });
  const app = new FakeElement({
    children: [readerRoot, toolbar, extensionShell],
  });
  const document = {
    querySelector(selector) {
      if (selector === "#app .muye-reader") return readerRoot;
      if (selector === ".muye-reader") return readerRoot;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".reader-toolbar .reader-toolbar-item") return [];
      if (selector === "#app .reader-toolbar .reader-toolbar-item") return [nativeCatalog, extensionCatalog];
      return [];
    },
  };

  assert.equal(globalThis.Fqmail.fanqie.findNativeCatalogItem(document), nativeCatalog);
  assert.equal(extensionCatalog.clicked, false);
  assert.equal(app.children.includes(toolbar), true);
});

test("Fanqie navigation survives moving the reader box out of its native root", () => {
  const fixture = buildReaderFixture();
  const rootCatalog = new FakeElement({tagName: "button", text: "目录"});
  fixture.root.append(rootCatalog);
  const pane = new FakeElement({classes: ["fqmail-reader-pane"]});
  fixture.root.children = fixture.root.children.filter((child) => child !== fixture.box);
  pane.append(fixture.box);
  fixture.document.append(pane);
  fixture.document.append(new FakeElement({
    classes: ["fqmail-shell"],
    children: [new FakeElement({tagName: "button", text: "下一章"})],
  }));

  const snapshot = globalThis.Fqmail.fanqie.parseReaderSnapshot(
    fixture.document,
    new URL("https://fanqienovel.com/reader/chapter-2"),
  );

  assert.equal(snapshot.nextButton, fixture.nextButton);
  assert.equal(snapshot.previousButton, fixture.previousButton);
  assert.equal(globalThis.Fqmail.fanqie.findNativeButton(fixture.document, "目录"), rootCatalog);
});

test("Fanqie catalog maps native chapter ids and state classes", () => {
  const {document} = buildReaderFixture();
  assert.deepEqual(globalThis.Fqmail.fanqie.parseCatalog(document), [
    {chapterId: "c-1", title: "第一章 雨夜", active: false, visited: true},
    {chapterId: "c-2", title: "第二章 清晨", active: true, visited: false},
  ]);
});

test("Fanqie page matching is limited to HTTPS reader URLs", () => {
  const {matchesReaderPage} = globalThis.Fqmail.fanqie;
  assert.equal(matchesReaderPage(new URL("https://fanqienovel.com/reader/book-42")), true);
  assert.equal(matchesReaderPage(new URL("https://fanqienovel.com/book/42")), false);
  assert.equal(matchesReaderPage(new URL("http://fanqienovel.com/reader/book-42")), false);
  assert.equal(matchesReaderPage(new URL("https://example.com/reader/book-42")), false);
});
