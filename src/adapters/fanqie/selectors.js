(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

globalThis.Fqmail.fanqieSelectors = Object.freeze({
  readerBox: ".muye-reader-box",
  readerTitle: ".muye-reader-title",
  readerBookName: [".muye-reader-bookname", ".book-name", "[data-book-name]"],
  nativeButtons: [
    ".muye-reader-box button",
    '.muye-reader-box [role="button"]',
    ".muye-reader button",
    '.muye-reader [role="button"]',
  ],
  catalogControl: ".reader-toolbar .reader-toolbar-item",
  catalogChapter: ".chapter[data-item-id]",
  chapterText: ".chapter-text",
});
})();
