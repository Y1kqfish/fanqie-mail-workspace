(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  function makeError(kind, message) {
    const error = new Error(message);
    error.kind = kind;
    return error;
  }

  function withPhase(error, phase) {
    const next = error?.kind ? error : makeError("source", "目录同步失败");
    next.phase = phase;
    return next;
  }

  function create({
    documentLike = globalThis.document,
    locationLike = globalThis.location,
    windowLike = globalThis.window,
    source = globalThis.Fqmail.catalogPageSource,
    parser = globalThis.Fqmail.catalogPageParser,
    transferApi = globalThis.Fqmail.catalogTransfer,
    storageArea = globalThis.Fqmail.platform?.getStorageArea?.(),
    timeoutMs = 5000,
    onSuccess = () => {},
    onError = () => {},
  } = {}) {
    let disposed = false;
    let inFlight = null;
    let fallback = null;
    const makeFallbackUrl = source?.makeFallbackUrl || (({pageUrl, currentChapterId, token} = {}) => {
      const page = parser?.pageUrl?.(pageUrl);
      if (!page || !token || !/^\d+$/.test(String(currentChapterId || ""))) throw makeError("request", "目录同步请求无效");
      const url = new URL(page.href);
      url.hash = new URLSearchParams({"fqmail-sync": String(token), chapterId: String(currentChapterId)}).toString();
      return url.href;
    });

    function clearFallbackListener() {
      if (!fallback?.listener) return;
      storageArea?.onChanged?.removeListener?.(fallback.listener);
      fallback.listener = null;
    }

    async function load({pageUrl, bookId, currentChapterId} = {}) {
      if (disposed) return null;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        try {
          const result = await source.load({documentLike, pageUrl, currentChapterId, timeoutMs, windowLike});
          if (disposed) return null;
          fallback = null;
          await onSuccess(result);
          return result;
        } catch (error) {
          if (!disposed) onError(withPhase(error, "silent"));
          return null;
        } finally {
          inFlight = null;
        }
      })();
      return inFlight;
    }

    function startFallback({pageUrl, bookId, currentChapterId} = {}) {
      if (disposed || fallback || !transferApi?.createToken || !transferApi?.create || !storageArea?.onChanged || !makeFallbackUrl) return false;
      let token;
      let href;
      try {
        token = transferApi.createToken();
        href = makeFallbackUrl({pageUrl, currentChapterId, token});
      } catch {
        onError(withPhase(makeError("request", "作品页同步请求无效"), "fallback"));
        return false;
      }
      const transfer = transferApi.create({storageArea});
      const key = transferApi.transferKey(token);
      fallback = {token, listener: null};
      fallback.listener = (changes) => {
        if (!changes?.[key] || !fallback) return;
        clearFallbackListener();
        fallback = null;
        Promise.resolve(transfer.consume(token, {bookId, currentChapterId})).then((record) => {
          if (disposed) return;
          if (!record) {
            onError(withPhase(makeError("transfer", "目录同步记录无效"), "fallback"));
          } else if (record.status === "success") {
            return onSuccess({bookId: record.bookId, entries: record.entries, actualCount: record.entries.length});
          } else {
            onError(withPhase(makeError(record.kind || "parse", "目录数据无效"), "fallback"));
          }
        }).catch(() => {
          if (!disposed) onError(withPhase(makeError("transfer", "目录同步记录无效"), "fallback"));
        });
      };
      storageArea.onChanged.addListener(fallback.listener);
      try {
        if (!windowLike?.open?.(href, "_blank")) throw new Error("popup blocked");
      } catch {
        clearFallbackListener();
        fallback = null;
        onError(withPhase(makeError("blocked", "无法打开作品页同步"), "fallback"));
        return false;
      }
      return true;
    }

    return {
      load,
      startFallback,
      dispose() {
        if (disposed) return;
        disposed = true;
        clearFallbackListener();
        fallback = null;
        inFlight = null;
      },
    };
  }

  globalThis.Fqmail.catalogPageWorkflow = {create};
})();
