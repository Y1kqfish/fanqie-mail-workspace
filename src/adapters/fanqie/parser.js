(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

const selectors = globalThis.Fqmail.fanqieSelectors;

function cleanText(node) {
  return typeof node?.textContent === "string"
    ? node.textContent.trim().replace(/\s+/g, " ")
    : "";
}

function asUrl(locationLike) {
  if (!locationLike) return null;
  if (locationLike instanceof URL) return locationLike;
  try {
    return new URL(locationLike.href || locationLike);
  } catch {
    return null;
  }
}

function getDocumentTitle(documentLike) {
  const managedTitle = globalThis.Fqmail.tabAppearance?.getNativeTitle?.(documentLike);
  return cleanText({textContent: managedTitle !== undefined ? managedTitle : documentLike?.title || ""});
}

function getBookId(locationLike) {
  const url = asUrl(locationLike);
  const match = url?.pathname.match(/^\/reader\/([^/]+)/);
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function getChapterId(locationLike) {
  const url = asUrl(locationLike);
  if (!url) return "";
  return url.searchParams.get("chapter_id")
    || url.searchParams.get("chapterId")
    || getBookId(locationLike);
}

function findFirstText(documentLike, candidates) {
  for (const selector of candidates) {
    const text = cleanText(documentLike?.querySelector?.(selector));
    if (text) return text;
  }
  const documentTitle = getDocumentTitle(documentLike);
  return documentTitle.replace(/\s*[-|｜].*$/, "").trim();
}

function findVisibleBookTitle(documentLike) {
  for (const selector of selectors.readerBookName) {
    const text = cleanText(documentLike?.querySelector?.(selector));
    if (text) return text;
  }
  return "";
}

function deriveTitleBookTitle(documentLike, chapterTitle) {
  let title = getDocumentTitle(documentLike);
  if (!title || !chapterTitle || !title.includes(chapterTitle)) return "";
  title = title
    .replace(/\s*(?:[_|｜]|[-—])\s*番茄小说(?:官网)?(?:.*)$/i, "")
    .trim();
  title = title.replace(chapterTitle, "").replace(/[\s\-—_:：|｜]+$/g, "").trim();
  return title;
}

function getPageBookId(documentLike, locationLike) {
  const baseUrl = asUrl(locationLike)?.origin || "https://fanqienovel.com";
  const links = [
    ...(documentLike?.querySelectorAll?.('a[href^="/page/"]') || []),
    ...(documentLike?.querySelectorAll?.('a[href^="https://fanqienovel.com/page/"]') || []),
  ];
  for (const link of links) {
    try {
      const url = new URL(link.href || link.getAttribute?.("href") || "", baseUrl);
      if (url.origin !== baseUrl) continue;
      const match = url.pathname.match(/^\/page\/([^/]+)$/);
      if (match) return decodeURIComponent(match[1]);
    } catch {
      // Ignore malformed links and continue looking for a valid native book link.
    }
  }
  return "";
}

function resolveReaderIdentity(documentLike, locationLike = globalThis.location) {
  const chapterId = getChapterId(locationLike);
  const chapterTitle = cleanText(documentLike?.querySelector?.(selectors.readerTitle));
  const visibleBookTitle = findVisibleBookTitle(documentLike);
  const independentTitle = visibleBookTitle || deriveTitleBookTitle(documentLike, chapterTitle);
  const pageBookId = getPageBookId(documentLike, locationLike);
  const bookId = pageBookId || (independentTitle ? "title:" + encodeURIComponent(independentTitle) : "");
  return {bookId, chapterId};
}

function normalizeLabel(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function isVisible(node) {
  if (!node || node.hidden || node.getAttribute?.("aria-hidden") === "true") return false;
  const style = node.style;
  if (style?.display === "none" || style?.visibility === "hidden") return false;
  if (typeof node.getClientRects === "function" && node.getClientRects().length === 0) return false;
  return true;
}

function findNativeButton(documentLike, label) {
  const wanted = normalizeLabel(label);
  for (const selector of selectors.nativeButtons) {
    for (const node of documentLike?.querySelectorAll?.(selector) || []) {
      if (isVisible(node) && normalizeLabel(node.textContent).includes(wanted)) return node;
    }
  }
  return null;
}

function findNativeCatalogItem(documentLike) {
  const appControls = documentLike?.querySelectorAll?.("#app .reader-toolbar .reader-toolbar-item") || [];
  for (const control of appControls) {
    if (control.closest?.(".fqmail-shell")) continue;
    if (normalizeLabel(control.textContent) === "目录") return control;
  }

  const roots = [
    documentLike?.querySelector?.("#app .muye-reader"),
    documentLike?.querySelector?.(".muye-reader"),
  ].filter(Boolean);
  for (const root of roots) {
    for (const control of root.querySelectorAll?.(selectors.catalogControl) || []) {
      if (control.closest?.(".fqmail-shell")) continue;
      if (normalizeLabel(control.textContent) === "目录") return control;
    }
  }
  return null;
}

function parseReaderSnapshot(documentLike, locationLike = globalThis.location) {
  const identity = resolveReaderIdentity(documentLike, locationLike);
  return {
    ...identity,
    bookTitle: findFirstText(documentLike, selectors.readerBookName),
    chapterTitle: cleanText(documentLike?.querySelector?.(selectors.readerTitle)),
    previousButton: findNativeButton(documentLike, "上一章"),
    nextButton: findNativeButton(documentLike, "下一章"),
  };
}

function parseCatalog(documentLike) {
  return Array.from(documentLike?.querySelectorAll?.(selectors.catalogChapter) || [])
    .map((chapter) => {
      const entry = {
        chapterId: String(chapter.dataset?.itemId || chapter.getAttribute?.("data-item-id") || ""),
        title: cleanText(chapter.querySelector?.(selectors.chapterText)),
        active: Boolean(chapter.classList?.contains?.("active")),
        visited: Boolean(chapter.classList?.contains?.("visited")),
      };
      Object.defineProperty(entry, "element", {value: chapter, enumerable: false});
      return entry;
    })
    .filter((entry) => entry.chapterId && entry.title);
}

globalThis.Fqmail.fanqie = Object.assign(globalThis.Fqmail.fanqie || {}, {
  cleanText,
  getBookId,
  getChapterId,
  resolveReaderIdentity,
  findNativeButton,
  findNativeCatalogItem,
  parseReaderSnapshot,
  parseCatalog,
});
})();
