export class FakeClassList {
  constructor(values = []) {
    this.values = new Set(values);
  }

  contains(value) {
    return this.values.has(value);
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
  }

  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }

  toggle(value, force) {
    const shouldAdd = force === undefined ? !this.values.has(value) : force;
    if (shouldAdd) this.values.add(value);
    else this.values.delete(value);
    return shouldAdd;
  }
}

export class FakeElement {
  constructor({tagName = "div", text = "", classes = [], attrs = {}, children = []} = {}) {
    this.tagName = tagName.toUpperCase();
    this.textContent = text;
    this.classList = new FakeClassList(classes);
    this.attributes = {...attrs};
    this.href = attrs.href;
    this.dataset = {};
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith("data-")) {
        const datasetKey = key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[datasetKey] = value;
      }
    }
    this.children = [];
    this.parentNode = null;
    this.clicked = false;
    for (const child of children) this.append(child);
  }

  append(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  hasAttribute(name) {
    return Object.hasOwn(this.attributes, name);
  }

  matches(selector) {
    if (selector === "*") return true;
    if (selector === ".muye-reader") return this.classList.contains("muye-reader");
    if (selector === ".muye-reader-box") return this.classList.contains("muye-reader-box");
    if (selector === ".muye-reader-title") return this.classList.contains("muye-reader-title");
    if (selector === ".muye-reader-bookname") return this.classList.contains("muye-reader-bookname");
    if (selector === ".book-name") return this.classList.contains("book-name");
    if (selector === ".chapter-text") return this.classList.contains("chapter-text");
    if (selector === ".reader-toolbar") return this.classList.contains("reader-toolbar");
    if (selector === ".reader-toolbar .reader-toolbar-item") {
      return this.classList.contains("reader-toolbar-item")
        && this.closest(".reader-toolbar") !== null;
    }
    if (selector === ".chapter[data-item-id]") {
      return this.classList.contains("chapter") && this.hasAttribute("data-item-id");
    }
    if (selector === "[data-book-name]") return this.hasAttribute("data-book-name");
    if (selector === 'a[href^="/page/"]') return this.tagName === "A" && String(this.href || "").startsWith("/page/");
    if (selector === ".muye-reader-btns") return this.classList.contains("muye-reader-btns");
    if (selector === ".muye-reader button") {
      return this.tagName === "BUTTON" && this.closest(".muye-reader") !== null;
    }
    if (selector === '.muye-reader [role="button"]') {
      return this.getAttribute("role") === "button" && this.closest(".muye-reader") !== null;
    }
    if (selector === ".muye-reader-box button") {
      return this.tagName === "BUTTON" && this.closest(".muye-reader-box") !== null;
    }
    if (selector === '.muye-reader-box [role="button"]') {
      return this.getAttribute("role") === "button" && this.closest(".muye-reader-box") !== null;
    }
    if (selector === ".muye-reader-btns button") {
      return this.tagName === "BUTTON" && this.closest(".muye-reader-btns") !== null;
    }
    if (selector === '.muye-reader-btns [role="button"]') {
      return this.getAttribute("role") === "button" && this.closest(".muye-reader-btns") !== null;
    }
    return false;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const result = [];
    const visit = (node) => {
      for (const child of node.children ?? []) {
        if (child.matches(selector)) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  click() {
    this.clicked = true;
  }
}

export class FakeDocument extends FakeElement {
  constructor(children = []) {
    super({tagName: "document", children});
    this.title = "番茄书名 - 番茄小说";
  }
}

export function buildReaderFixture() {
  const previousButton = new FakeElement({tagName: "button", text: "上一章"});
  const nextButton = new FakeElement({tagName: "button", text: "下一章"});
  const buttons = new FakeElement({classes: ["muye-reader-btns"], children: [previousButton, nextButton]});
  const title = new FakeElement({classes: ["muye-reader-title"], text: "第一章 雨夜"});
  const bookName = new FakeElement({classes: ["muye-reader-bookname"], text: "测试书"});
  const readerContent = new FakeElement({classes: ["muye-reader-content"], text: "混淆正文不应被读取"});
  const box = new FakeElement({classes: ["muye-reader-box", "font-abc123"], children: [title, bookName, readerContent, buttons]});
  const chapters = [
    new FakeElement({classes: ["chapter", "visited"], attrs: {"data-item-id": "c-1"}, children: [new FakeElement({classes: ["chapter-text"], text: "第一章 雨夜"})]}),
    new FakeElement({classes: ["chapter", "active"], attrs: {"data-item-id": "c-2"}, children: [new FakeElement({classes: ["chapter-text"], text: "第二章 清晨"})]}),
  ];
  const bookLink = new FakeElement({tagName: "a", attrs: {href: "/page/book-42"}});
  const root = new FakeElement({classes: ["muye-reader"], children: [bookLink, box, ...chapters]});
  const document = new FakeDocument([root]);
  return {document, root, box, bookLink, previousButton, nextButton, chapters};
}
