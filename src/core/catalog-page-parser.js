(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const FANQIE_ORIGIN = "https://fanqienovel.com";
  const MAX_TITLE_LENGTH = 200;
  const MAX_ENTRIES = 5000;

  function makeError(kind, message) {
    const error = new Error(message);
    error.kind = kind;
    return error;
  }

  function asUrl(value, base = FANQIE_ORIGIN) {
    try {
      return value instanceof URL ? value : new URL(value?.href || value, base);
    } catch {
      return null;
    }
  }

  function normalizeTitle(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function pageUrl(value, base = FANQIE_ORIGIN) {
    const url = asUrl(value, base);
    const match = url && url.origin === FANQIE_ORIGIN
      ? url.pathname.match(/^\/page\/(\d+)$/)
      : null;
    if (!match) throw makeError("page", "作品页链接无效");
    return {bookId: match[1], href: url.href};
  }

  function readerUrl(value, base = FANQIE_ORIGIN) {
    const url = asUrl(value, base);
    const match = url && url.origin === FANQIE_ORIGIN
      ? url.pathname.match(/^\/reader\/(\d+)$/)
      : null;
    if (!match) return null;
    return {chapterId: match[1], href: url.href};
  }

  function linkHref(link, base) {
    return link?.href || link?.getAttribute?.("href") || base;
  }

  function parse(documentLike, pageHref, currentChapterId) {
    const page = pageUrl(pageHref);
    const currentId = String(currentChapterId || "");
    if (!currentId) throw makeError("current", "当前章节不匹配");

    const entries = [];
    const seen = new Set();
    for (const link of documentLike?.querySelectorAll?.('a[href*="/reader/"]') || []) {
      const parsed = readerUrl(linkHref(link, page.href), page.href);
      if (!parsed || seen.has(parsed.chapterId)) continue;
      const title = normalizeTitle(link.textContent);
      if (!title || title.length > MAX_TITLE_LENGTH) continue;
      if (entries.length >= MAX_ENTRIES) throw makeError("limit", "目录条目过多");
      seen.add(parsed.chapterId);
      entries.push({
        chapterId: parsed.chapterId,
        title,
        href: parsed.href,
        order: entries.length,
      });
    }
    if (!entries.length) throw makeError("empty", "作品页没有有效章节");
    if (!seen.has(currentId)) throw makeError("current", "作品页缺少当前章节");
    return {bookId: page.bookId, entries, actualCount: entries.length};
  }

  function findPageUrl(documentLike, locationLike = globalThis.location) {
    const base = asUrl(locationLike)?.href || FANQIE_ORIGIN;
    for (const link of documentLike?.querySelectorAll?.('a[href^="/page/"]') || []) {
      try {
        return pageUrl(linkHref(link, base), base).href;
      } catch {
        // Continue until a real same-origin numeric work link is found.
      }
    }
    return "";
  }

  globalThis.Fqmail.catalogPageParser = {
    FANQIE_ORIGIN,
    MAX_TITLE_LENGTH,
    MAX_ENTRIES,
    normalizeTitle,
    pageUrl,
    readerUrl,
    findPageUrl,
    parse,
  };
})();
