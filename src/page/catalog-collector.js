(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  function makeError(kind, message) {
    const error = new Error(message);
    error.kind = kind;
    return error;
  }

  function readRequest(locationLike) {
    const hash = String(locationLike?.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const token = params.get("fqmail-sync") || "";
    const currentChapterId = params.get("chapterId") || "";
    return /^[A-Za-z0-9_-]{8,200}$/.test(token) && /^\d+$/.test(currentChapterId)
      ? {token, currentChapterId}
      : null;
  }

  function showNotice(documentLike, message) {
    const notice = documentLike?.createElement?.("div");
    if (!notice) return;
    notice.className = "fqmail-page-sync-notice";
    notice.textContent = message;
    if (notice.style) {
      notice.style.position = "fixed";
      notice.style.left = "16px";
      notice.style.bottom = "16px";
      notice.style.zIndex = "2147483647";
      notice.style.padding = "8px 12px";
      notice.style.background = "#242424";
      notice.style.color = "#fff";
    }
    documentLike.body?.append?.(notice);
  }

  function logStage(stage, detail = "") {
    const suffix = detail ? " " + String(detail) : "";
    console.warn("[Fqmail] " + stage + suffix);
  }

  function waitForCatalog({documentLike, pageHref, currentChapterId, parser, windowLike, timeoutMs, pollIntervalMs}) {
    const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout;
    const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;
    const Observer = windowLike?.MutationObserver || globalThis.MutationObserver;
    const target = documentLike?.body || documentLike?.documentElement;
    let observer = null;
    let timeoutTimer = null;
    let pollTimer = null;
    let settled = false;
    let lastError = null;
    let resolvePromise;
    let rejectPromise;

    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const cleanup = () => {
      if (timeoutTimer !== null) clearTimer(timeoutTimer);
      if (pollTimer !== null) clearTimer(pollTimer);
      timeoutTimer = null;
      pollTimer = null;
      observer?.disconnect?.();
      observer = null;
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) rejectPromise(error);
      else resolvePromise(value);
    };
    const attempt = () => {
      if (settled) return;
      try {
        finish(null, parser.parse(documentLike, pageHref, currentChapterId));
      } catch (error) {
        lastError = error?.kind ? error : makeError("parse", "目录数据无效");
      }
    };
    const poll = () => {
      if (settled) return;
      attempt();
      if (!settled) pollTimer = setTimer(poll, Math.max(1, Number(pollIntervalMs) || 100));
    };

    if (Observer && target) {
      try {
        observer = new Observer(attempt);
        observer.observe(target, {childList: true, subtree: true});
      } catch {
        observer = null;
      }
    }
    attempt();
    if (!settled) {
      pollTimer = setTimer(poll, Math.max(1, Number(pollIntervalMs) || 100));
      timeoutTimer = setTimer(() => {
        attempt();
        if (!settled) finish(makeError("timeout", lastError?.message || "作品页目录等待超时"));
      }, Math.max(1, Number(timeoutMs) || 10000));
    }

    return {
      promise,
      dispose() {
        if (settled) return;
        finish(makeError("disposed", "目录采集已取消"));
      },
    };
  }

  function create({
    documentLike = globalThis.document,
    locationLike = globalThis.location,
    windowLike = globalThis.window,
    parser = globalThis.Fqmail.catalogPageParser,
    transfer = globalThis.Fqmail.catalogTransfer?.create?.(),
    timeoutMs = 10000,
    pollIntervalMs = 100,
  } = {}) {
    let consumed = false;
    let disposed = false;
    let waitControl = null;

    async function run() {
      const request = readRequest(locationLike);
      if (!request || consumed || disposed) return false;
      consumed = true;
      let page;
      try {
        page = parser.pageUrl(locationLike);
        logStage("catalog-page-fallback-wait");
        waitControl = waitForCatalog({documentLike, pageHref: page.href, currentChapterId: request.currentChapterId, parser, windowLike, timeoutMs, pollIntervalMs});
        const result = await waitControl.promise;
        waitControl = null;
        if (disposed) return false;
        await transfer.put({
          token: request.token,
          bookId: result.bookId,
          currentChapterId: request.currentChapterId,
          entries: result.entries,
          status: "success",
        });
        logStage("catalog-page-fallback-ready", result.actualCount);
        const closed = windowLike?.close?.();
        if (!closed) showNotice(documentLike, "同步完成，可以返回阅读页");
        return true;
      } catch (error) {
        waitControl = null;
        if (disposed || error?.kind === "disposed") return false;
        if (!page) return false;
        await transfer.put({
          token: request.token,
          bookId: page.bookId,
          currentChapterId: request.currentChapterId,
          entries: [],
          status: "error",
          kind: error?.kind || "parse",
        });
        if (error?.kind === "timeout") logStage("catalog-page-fallback-timeout");
        showNotice(documentLike, "目录数据无效，请返回阅读页");
        return false;
      }
    }

    return {
      run,
      readRequest: () => readRequest(locationLike),
      dispose() {
        disposed = true;
        waitControl?.dispose?.();
        waitControl = null;
      },
    };
  }

  globalThis.Fqmail.catalogPageCollector = {create, readRequest};
  if (globalThis.Fqmail.catalogPageParser && globalThis.Fqmail.catalogTransfer) {
    create().run().catch(() => {});
  }
})();
