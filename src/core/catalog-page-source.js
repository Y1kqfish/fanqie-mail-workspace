(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const DEFAULT_TIMEOUT_MS = 5000;

  function makeError(kind, message) {
    const error = new Error(message);
    error.kind = kind;
    return error;
  }

  function create({parser = globalThis.Fqmail.catalogPageParser} = {}) {
    function getPageUrl(documentLike, locationLike = globalThis.location) {
      return parser?.findPageUrl?.(documentLike, locationLike) || "";
    }

    function makeFallbackUrl({pageUrl, currentChapterId, token} = {}) {
      const page = parser.pageUrl(pageUrl);
      if (!token || !/^\d+$/.test(String(currentChapterId || ""))) throw makeError("request", "目录同步请求无效");
      const url = new URL(page.href);
      url.hash = new URLSearchParams({"fqmail-sync": String(token), chapterId: String(currentChapterId)}).toString();
      return url.href;
    }

    function load({
      documentLike = globalThis.document,
      pageUrl,
      currentChapterId,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      windowLike = globalThis.window,
    } = {}) {
      let page;
      try {
        page = parser.pageUrl(pageUrl);
      } catch (error) {
        return Promise.reject(error);
      }
      const body = documentLike?.body;
      const createElement = documentLike?.createElement;
      if (!body?.append || !createElement) return Promise.reject(makeError("environment", "静默同步环境不可用"));

      const iframe = createElement.call(documentLike, "iframe");
      iframe.setAttribute?.("sandbox", "allow-same-origin");
      iframe.sandbox?.add?.("allow-same-origin");
      iframe.setAttribute?.("aria-hidden", "true");
      if (iframe.style) {
        iframe.style.position = "absolute";
        iframe.style.width = "1px";
        iframe.style.height = "1px";
        iframe.style.border = "0";
        iframe.style.visibility = "hidden";
      }

      const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout;
      const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;
      const timeout = Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS);

      return new Promise((resolve, reject) => {
        let settled = false;
        let timer = null;
        const cleanup = () => {
          if (timer !== null) clearTimer(timer);
          iframe.removeEventListener?.("load", onLoad);
          iframe.removeEventListener?.("error", onError);
          try { body.removeChild?.(iframe); } catch { /* Cleanup must not mask the source result. */ }
        };
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          cleanup();
          if (error) reject(error);
          else resolve(value);
        };
        const onLoad = () => {
          try {
            const contentDocument = iframe.contentDocument;
            if (!contentDocument) throw makeError("blocked", "静默同步受限");
            finish(null, parser.parse(contentDocument, page.href, currentChapterId));
          } catch (error) {
            finish(error?.kind ? error : makeError("parse", "目录数据无效"));
          }
        };
        const onError = () => finish(makeError("blocked", "静默同步受限"));
        iframe.addEventListener?.("load", onLoad);
        iframe.addEventListener?.("error", onError);
        timer = setTimer(() => finish(makeError("timeout", "静默同步超时")), timeout);
        try {
          iframe.src = page.href;
          body.append(iframe);
        } catch {
          finish(makeError("blocked", "静默同步受限"));
        }
      });
    }

    return {load, getPageUrl, makeFallbackUrl};
  }

  globalThis.Fqmail.catalogPageSource = Object.assign({DEFAULT_TIMEOUT_MS, create}, create());
})();
