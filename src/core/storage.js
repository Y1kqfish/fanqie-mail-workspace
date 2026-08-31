(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

const SETTINGS_KEY = "fqmail:settings";

function encodePart(value) {
  return encodeURIComponent(String(value));
}

function chapterReadKey(bookId, chapterId) {
  return `fqmail:read:${encodePart(bookId)}:${encodePart(chapterId)}`;
}

function chapterProgressKey(bookId, chapterId) {
  return `fqmail:progress:${encodePart(bookId)}:${encodePart(chapterId)}`;
}

function normalizeProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function createStore(storageArea = globalThis.Fqmail.platform?.getStorageArea?.()) {
  const memory = new Map();

  async function read(key, fallback) {
    if (!storageArea?.get) return memory.has(key) ? memory.get(key) : fallback;
    try {
      const result = await storageArea.get(key);
      return result?.[key] ?? fallback;
    } catch {
      return memory.has(key) ? memory.get(key) : fallback;
    }
  }

  async function write(key, value) {
    memory.set(key, value);
    if (!storageArea?.set) return;
    try {
      await storageArea.set({[key]: value});
    } catch {
      // The in-memory value keeps the current page usable when storage is unavailable.
    }
  }

  return {
    async getSettings() {
      return read(SETTINGS_KEY, {enabled: true, density: "comfortable"});
    },
    async setSettings(settings) {
      const next = {
        enabled: Boolean(settings?.enabled),
        density: settings?.density === "compact" ? "compact" : "comfortable",
      };
      await write(SETTINGS_KEY, next);
      return next;
    },
    async setEnabled(enabled) {
      const current = await this.getSettings();
      return this.setSettings({...current, enabled});
    },
    async getRead(bookId, chapterId) {
      return Boolean(await read(chapterReadKey(bookId, chapterId), false));
    },
    async getReadMany(bookId, chapterIds = []) {
      const ids = Array.from(chapterIds, (chapterId) => String(chapterId));
      const keys = ids.map((chapterId) => chapterReadKey(bookId, chapterId));
      let values = {};
      if (!storageArea?.get) {
        values = Object.fromEntries(keys.map((key, index) => [ids[index], Boolean(memory.get(key) || false)]));
      } else {
        try {
          values = await storageArea.get(keys) || {};
        } catch {
          values = Object.fromEntries(keys.map((key, index) => [ids[index], Boolean(memory.get(key) || false)]));
        }
      }
      return Object.fromEntries(keys.map((key, index) => [ids[index], Boolean(values[key])]));
    },
    async setRead(bookId, chapterId, value = true) {
      const next = Boolean(value);
      await write(chapterReadKey(bookId, chapterId), next);
      return next;
    },
    async getProgress(bookId, chapterId) {
      return normalizeProgress(await read(chapterProgressKey(bookId, chapterId), 0));
    },
    async setProgress(bookId, chapterId, value) {
      const next = normalizeProgress(value);
      await write(chapterProgressKey(bookId, chapterId), next);
      return next;
    },
  };
}

globalThis.Fqmail.storage = {
  SETTINGS_KEY,
  chapterReadKey,
  chapterProgressKey,
  normalizeProgress,
  createStore,
};
})();
