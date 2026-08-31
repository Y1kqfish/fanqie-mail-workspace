(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

const DEFAULT_TIMEOUT_MS = 5000;

function makeCatalogError(kind, message) {
  const error = new Error(message);
  error.kind = kind;
  return error;
}

function getChapterIds(entries) {
  return entries.map((entry) => String(entry?.chapterId || ""));
}

function mergeReadState(entries, readState) {
  return entries.map((entry) => {
    const next = {...entry, visited: Boolean(entry.visited || readState[entry.chapterId])};
    Object.defineProperty(next, "element", {value: entry.element, enumerable: false});
    return next;
  });
}

function defaultWaitForCatalog(
  documentLike,
  adapter,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
  windowLike = globalThis.window,
) {
  const hasCatalog = () => {
    try {
      return adapter.parseCatalog(documentLike).length > 0;
    } catch {
      return false;
    }
  };
  if (hasCatalog()) return Promise.resolve(true);
  if (signal?.aborted) return Promise.reject(makeCatalogError("disposed", "目录加载已取消"));

  const app = documentLike?.querySelector?.("#app");
  const body = documentLike?.body || documentLike?.querySelector?.("body");
  const targets = [app, body].filter((target, index, all) => target && all.indexOf(target) === index);
  const Observer = windowLike?.MutationObserver || globalThis.MutationObserver;
  const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout;
  const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;

  if (Observer && targets.length) {
    return new Promise((resolve, reject) => {
      let finished = false;
      let timer = null;
      const observers = [];
      const finish = (result, error) => {
        if (finished) return;
        finished = true;
        if (timer !== null) clearTimer(timer);
        observers.forEach((observer) => observer.disconnect?.());
        signal?.removeEventListener?.("abort", onAbort);
        if (error) reject(error);
        else resolve(result);
      };
      const check = () => {
        if (signal?.aborted) {
          finish(null, makeCatalogError("disposed", "目录加载已取消"));
          return true;
        }
        if (hasCatalog()) {
          finish(true);
          return true;
        }
        return false;
      };
      const onAbort = () => finish(null, makeCatalogError("disposed", "目录加载已取消"));
      signal?.addEventListener?.("abort", onAbort, {once: true});
      targets.forEach((target) => {
        const observer = new Observer(check);
        observers.push(observer);
        observer.observe(target, {childList: true, subtree: true});
      });
      if (check()) return;
      timer = setTimer(() => {
        if (check()) return;
        finish(false);
      }, timeoutMs);
    });
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let timer = null;
    let finished = false;
    const finish = (result, error) => {
      if (finished) return;
      finished = true;
      if (timer !== null) clearTimer(timer);
      signal?.removeEventListener?.("abort", onAbort);
      if (error) reject(error);
      else resolve(result);
    };
    const onAbort = () => finish(null, makeCatalogError("disposed", "目录加载已取消"));
    const poll = () => {
      if (signal?.aborted) return onAbort();
      if (hasCatalog()) return finish(true);
      if (Date.now() - startedAt >= timeoutMs) return finish(false);
      timer = setTimer(poll, 100);
    };
    signal?.addEventListener?.("abort", onAbort, {once: true});
    poll();
  });
}

function create({
  documentLike = globalThis.document,
  adapter = globalThis.Fqmail.fanqie,
  store = globalThis.Fqmail.storage?.createStore?.(),
  waitForCatalog = defaultWaitForCatalog,
  windowLike = globalThis.window,
} = {}) {
  let disposed = false;
  let inFlight = null;
  let sessionBookId = "";
  let sessionEntries = [];
  const abortController = globalThis.AbortController ? new AbortController() : null;

  function load(bookId) {
    if (disposed) return Promise.reject(makeCatalogError("disposed", "目录加载已取消"));
    if (inFlight) return inFlight;
    const requestedBookId = String(bookId || "");
    if (sessionBookId && sessionBookId !== requestedBookId) {
      sessionBookId = "";
      sessionEntries = [];
    }
    const run = (async () => {
      let waited;
      try {
        waited = await waitForCatalog(
          documentLike,
          adapter,
          DEFAULT_TIMEOUT_MS,
          abortController?.signal,
          windowLike,
        );
      } catch (error) {
        if (disposed || error?.kind === "disposed") throw makeCatalogError("disposed", "目录加载已取消");
        throw makeCatalogError("wait", "目录等待失败");
      }
      if (disposed || abortController?.signal.aborted) throw makeCatalogError("disposed", "目录加载已取消");
      if (waited === false) throw makeCatalogError("timeout", "目录点击成功但目录未出现");

      let parsed;
      try {
        parsed = adapter.parseCatalog(documentLike) || [];
      } catch {
        throw makeCatalogError("parse", "目录解析失败");
      }
      if (!parsed.length) throw makeCatalogError("empty", "目录点击成功但目录未出现");

      let readState = {};
      const chapterIds = getChapterIds(parsed);
      if (store?.getReadMany) {
        try {
          readState = await store.getReadMany(bookId, chapterIds) || {};
        } catch {
          readState = {};
        }
      }
      if (disposed || abortController?.signal.aborted) throw makeCatalogError("disposed", "目录加载已取消");
      const merged = mergeReadState(parsed, readState);
      sessionBookId = requestedBookId;
      sessionEntries = merged;
      return merged;
    })();
    inFlight = run;
    run.finally(() => {
      if (inFlight === run) inFlight = null;
    }).catch(() => {});
    return run;
  }

  return {
    load,
    getSession(bookId) {
      return !disposed && String(bookId || "") === sessionBookId ? sessionEntries : [];
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      sessionBookId = "";
      sessionEntries = [];
      abortController?.abort();
    },
  };
}

globalThis.Fqmail.catalog = {create, defaultWaitForCatalog};
})();
