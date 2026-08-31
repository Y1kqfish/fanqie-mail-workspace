(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const KEY_PREFIX = "fqmail:catalog-transfer:";
  const DEFAULT_TTL_MS = 15000;
  let tokenSequence = 0;

  function transferKey(token) {
    return KEY_PREFIX + encodeURIComponent(String(token || ""));
  }

  function createToken(cryptoLike = globalThis.crypto) {
    if (typeof cryptoLike?.randomUUID === "function") return cryptoLike.randomUUID();
    if (typeof cryptoLike?.getRandomValues === "function") {
      const values = cryptoLike.getRandomValues(new Uint32Array(4));
      return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
    }
    tokenSequence += 1;
    return `${Date.now().toString(36)}-${tokenSequence.toString(36)}`;
  }

  function create({
    storageArea = globalThis.Fqmail.platform?.getStorageArea?.()
      || globalThis.browser?.storage?.local
      || globalThis.chrome?.storage?.local
      || null,
    now = () => Date.now(),
    ttlMs = DEFAULT_TTL_MS,
  } = {}) {
    const memory = new Map();
    const ttl = Math.max(1, Number(ttlMs) || DEFAULT_TTL_MS);

    async function read(token) {
      const key = transferKey(token);
      if (!storageArea?.get) return memory.get(key) || null;
      try {
        const result = await storageArea.get(key);
        return result?.[key] || null;
      } catch {
        return memory.get(key) || null;
      }
    }

    async function write(record) {
      const key = transferKey(record.token);
      memory.set(key, record);
      if (!storageArea?.set) return;
      try {
        await storageArea.set({[key]: record});
      } catch {
        // Memory fallback keeps the current context usable if storage is unavailable.
      }
    }

    async function remove(token) {
      const key = transferKey(token);
      memory.delete(key);
      try {
        await storageArea?.remove?.(key);
      } catch {
        // Expiry and one-shot cleanup remain enforced by the local copy.
      }
    }

    return {
      async put({token, bookId, currentChapterId, entries = [], status = "success", kind = ""} = {}) {
        if (!token || !bookId || !currentChapterId) throw new Error("目录传输记录缺少身份");
        const createdAt = Number(now());
        const record = {
          token: String(token),
          bookId: String(bookId),
          currentChapterId: String(currentChapterId),
          entries: Array.from(entries),
          status: String(status),
          kind: String(kind),
          createdAt,
          expiresAt: createdAt + ttl,
        };
        await write(record);
        return record;
      },
      async consume(token, expected = {}) {
        const record = await read(token);
        if (!record) return null;
        const valid = record.token === String(token || "")
          && (!expected.bookId || record.bookId === String(expected.bookId))
          && (!expected.currentChapterId || record.currentChapterId === String(expected.currentChapterId))
          && Number(record.expiresAt) > Number(now());
        await remove(token);
        return valid ? record : null;
      },
      remove,
    };
  }

  globalThis.Fqmail.catalogTransfer = {KEY_PREFIX, DEFAULT_TTL_MS, transferKey, createToken, create};
})();
