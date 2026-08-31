(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const KEY = "fqmail:catalog-handoff";
  const VERSION = 1;
  const DEFAULT_TTL_MS = 15000;
  const DEFAULT_MAX_ENTRIES = 1500;
  const MAX_TITLE_LENGTH = 200;

  function cleanTitle(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
  }

  function validReaderHref(value) {
    try {
      const url = new URL(String(value || ""));
      return url.origin === "https://fanqienovel.com" && /^\/reader\/\d+$/.test(url.pathname) ? url.href : "";
    } catch {
      return "";
    }
  }

  function normalizeEntry(entry, index) {
    const chapterId = String(entry?.chapterId || "").trim();
    const title = cleanTitle(entry?.title);
    const href = validReaderHref(entry?.href);
    if (!/^\d+$/.test(chapterId) || !title || !href) throw new Error("目录交接条目无效");
    return {
      chapterId,
      title,
      order: Number.isInteger(entry?.order) && entry.order >= 0 ? entry.order : index,
      href,
      locked: Boolean(entry?.locked),
      visited: Boolean(entry?.visited),
      active: Boolean(entry?.active),
    };
  }

  function normalizeRecord(record, now, maxEntries, ttlMs) {
    if (!record || record.version !== VERSION || !String(record.bookId || "") || !/^\d+$/.test(String(record.targetChapterId || ""))) return null;
    const createdAt = Number(record.createdAt);
    const expiresAt = Number(record.expiresAt);
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || expiresAt <= Number(now) || expiresAt - createdAt > ttlMs) return null;
    const rawEntries = Array.isArray(record.entries) && record.entries.length <= maxEntries ? record.entries : null;
    if (!rawEntries?.length) return null;
    const seen = new Set();
    let entries;
    try {
      entries = rawEntries.map((entry, index) => {
        const normalized = normalizeEntry(entry, index);
        if (seen.has(normalized.chapterId)) throw new Error("目录交接条目重复");
        seen.add(normalized.chapterId);
        return normalized;
      });
    } catch {
      return null;
    }
    if (!seen.has(String(record.targetChapterId))) return null;
    return {
      version: VERSION,
      bookId: String(record.bookId),
      targetChapterId: String(record.targetChapterId),
      createdAt,
      expiresAt,
      entries,
    };
  }

  function create({
    storageArea = globalThis.Fqmail.platform?.getStorageArea?.()
      || globalThis.browser?.storage?.local
      || globalThis.chrome?.storage?.local
      || null,
    now = () => Date.now(),
    ttlMs = DEFAULT_TTL_MS,
    maxEntries = DEFAULT_MAX_ENTRIES,
  } = {}) {
    const memory = {record: null};
    const ttl = Math.max(1, Number(ttlMs) || DEFAULT_TTL_MS);
    const limit = Math.max(1, Number(maxEntries) || DEFAULT_MAX_ENTRIES);

    async function read() {
      if (!storageArea?.get) return memory.record;
      try {
        const result = await storageArea.get(KEY);
        return result?.[KEY] || memory.record;
      } catch {
        return memory.record;
      }
    }

    async function write(record) {
      memory.record = record;
      if (!storageArea?.set) return;
      await storageArea.set({[KEY]: record});
    }

    async function remove() {
      memory.record = null;
      try { await storageArea?.remove?.(KEY); } catch { /* one-shot cleanup is best effort */ }
    }

    return {
      async put({bookId, targetChapterId, entries = []} = {}) {
        const normalizedEntries = Array.from(entries).map(normalizeEntry);
        if (!bookId || !/^\d+$/.test(String(targetChapterId || "")) || !normalizedEntries.length || normalizedEntries.length > limit) throw new Error("目录交接数据数量或身份无效");
        const seen = new Set();
        for (const entry of normalizedEntries) {
          if (seen.has(entry.chapterId)) throw new Error("目录交接条目重复");
          seen.add(entry.chapterId);
        }
        if (!seen.has(String(targetChapterId))) throw new Error("目录交接目标不存在");
        const createdAt = Number(now());
        const record = {version: VERSION, bookId: String(bookId), targetChapterId: String(targetChapterId), createdAt, expiresAt: createdAt + ttl, entries: normalizedEntries};
        await write(record);
        return record;
      },
      async consume({bookId, targetChapterId} = {}) {
        const record = await read();
        await remove();
        const normalized = normalizeRecord(record, now(), limit, ttl);
        if (!normalized || normalized.bookId !== String(bookId || "") || normalized.targetChapterId !== String(targetChapterId || "")) return null;
        return normalized;
      },
      async clear() { await remove(); },
    };
  }

  globalThis.Fqmail.catalogHandoff = {KEY, VERSION, DEFAULT_TTL_MS, create, normalizeEntry, normalizeRecord};
})();
