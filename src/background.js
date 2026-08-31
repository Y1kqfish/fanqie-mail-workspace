(function () {
  const extensionBrowser = globalThis.browser || globalThis.chrome;
  const SESSION_PREFIX = "fqmail:catalog-session:";
  const LEGACY_HANDOFF_KEY = "fqmail:catalog-handoff";
  const VERSION = 1;
  const MAX_ENTRIES = 10000;
  const MAX_TITLE_LENGTH = 200;
  const MAX_RECORD_BYTES = 4 * 1024 * 1024;

  function tabKey(tabId) {
    return SESSION_PREFIX + String(tabId);
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function validChapterId(value) {
    return /^\d+$/.test(String(value || ""));
  }

  function validReaderHref(value, chapterId) {
    try {
      const url = new URL(String(value || ""));
      return url.origin === "https://fanqienovel.com"
        && url.search === ""
        && url.hash === ""
        && url.pathname === "/reader/" + String(chapterId);
    } catch {
      return false;
    }
  }

  function normalizeEntries(rawEntries) {
    if (!Array.isArray(rawEntries) || !rawEntries.length || rawEntries.length > MAX_ENTRIES) return null;
    const seen = new Set();
    const entries = [];
    for (let index = 0; index < rawEntries.length; index += 1) {
      const raw = rawEntries[index] || {};
      const chapterId = String(raw.chapterId || "").trim();
      const title = cleanText(raw.title);
      if (!validChapterId(chapterId) || !title || title.length > MAX_TITLE_LENGTH || seen.has(chapterId)) return null;
      if (!validReaderHref(raw.href, chapterId)) return null;
      const order = Number.isInteger(raw.order) && raw.order >= 0 ? raw.order : index;
      entries.push({chapterId, title, order, href: "https://fanqienovel.com/reader/" + chapterId, locked: Boolean(raw.locked), visited: Boolean(raw.visited)});
      seen.add(chapterId);
    }
    return entries;
  }

  function validBookId(value) {
    const bookId = String(value || "");
    return bookId.length <= 200 && (bookId === "" || /^\d+$/.test(bookId) || /^title:[^\s]+$/.test(bookId) || /^[\w:-]+$/.test(bookId));
  }

  function validSender(sender) {
    const tabId = sender?.tab?.id;
    const frameId = sender?.frameId;
    const rawUrl = sender?.tab?.url || sender?.url || "";
    let url;
    try { url = new URL(rawUrl); } catch { return null; }
    if (!Number.isInteger(tabId) || frameId !== 0 || url.origin !== "https://fanqienovel.com" || !/^\/reader\/[^/]+$/.test(url.pathname)) return null;
    return {tabId};
  }

  function isReliableNumericBookId(value) {
    return /^\d+$/.test(String(value || ""));
  }

  function fitsRecord(record) {
    try {
      const serialized = JSON.stringify(record);
      const bytes = typeof TextEncoder === "function" ? new TextEncoder().encode(serialized).byteLength : serialized.length * 2;
      return bytes <= MAX_RECORD_BYTES;
    } catch {
      return false;
    }
  }

  function installSessionHandlers() {
    const session = extensionBrowser?.storage?.session;
    const runtime = extensionBrowser?.runtime;
    if (!runtime?.onMessage?.addListener) return;

    async function clearLegacy() {
      try { await extensionBrowser?.storage?.local?.remove?.(LEGACY_HANDOFF_KEY); } catch { /* deprecated cleanup is best effort */ }
    }

    async function handle(message, sender) {
      if (!message?.type?.startsWith?.("fqmail:catalog-session-")) return undefined;
      const identity = validSender(sender);
      if (!identity || !session?.get || !session?.set || !session?.remove) return {ok: false, kind: "invalid-source"};
      await clearLegacy();
      const key = tabKey(identity.tabId);
      if (message.type.endsWith("-clear")) {
        await session.remove(key);
        return {ok: true};
      }
      if (message.type.endsWith("-save")) {
        const sourceChapterId = String(message.sourceChapterId || "");
        const bookId = String(message.bookId || "");
        const entries = normalizeEntries(message.entries);
        if (!validBookId(bookId) || !validChapterId(sourceChapterId) || !entries?.some((entry) => entry.chapterId === sourceChapterId)) return {ok: false, kind: "invalid-record"};
        const record = {version: VERSION, bookId, sourceChapterId, entries};
        if (!fitsRecord(record)) return {ok: false, kind: "quota"};
        try { await session.set({[key]: record}); } catch { return {ok: false, kind: "quota"}; }
        return {ok: true};
      }
      if (message.type.endsWith("-restore")) {
        const currentChapterId = String(message.currentChapterId || "");
        const requestedBookId = String(message.bookId || "");
        if (!validChapterId(currentChapterId) || !validBookId(requestedBookId)) return {ok: false, kind: "invalid-request"};
        let result;
        try { result = await session.get(key); } catch { return {ok: false, kind: "storage"}; }
        const record = result?.[key];
        const entries = normalizeEntries(record?.entries);
        if (record?.version !== VERSION || !validBookId(record.bookId) || !validChapterId(record.sourceChapterId) || !entries || !fitsRecord({...record, entries})) {
          try { await session.remove(key); } catch { /* malformed session cleanup is best effort */ }
          return {ok: true, record: null};
        }
        if (isReliableNumericBookId(record.bookId) && isReliableNumericBookId(requestedBookId) && record.bookId !== requestedBookId) return {ok: true, record: null};
        if (!entries.some((entry) => entry.chapterId === currentChapterId)) return {ok: true, record: null};
        return {ok: true, record: JSON.parse(JSON.stringify({...record, entries}))};
      }
      return undefined;
    }

    runtime.onMessage.addListener(handle);
    extensionBrowser?.tabs?.onRemoved?.addListener?.((tabId) => {
      if (session?.remove) void session.remove(tabKey(tabId)).catch?.(() => {});
    });
  }

  extensionBrowser?.commands?.onCommand?.addListener(async (command) => {
    if (command !== "toggle-skin") return;
    const tabs = await extensionBrowser.tabs?.query?.({active: true, lastFocusedWindow: true});
    const tabId = tabs?.[0]?.id;
    if (tabId === undefined) return;
    try { await extensionBrowser.tabs.sendMessage(tabId, {type: "fqmail:toggle"}); } catch { /* unsupported page or unloaded tab */ }
  });

  installSessionHandlers();
})();
