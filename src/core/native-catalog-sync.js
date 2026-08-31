(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const DEFAULT_TIMEOUT_MS = 30000;
  const DEFAULT_MASK_STABLE_MS = 500;
  const MAX_TITLE_LENGTH = 200;
  const CATALOG_SELECTOR = ".reader-catalog .chapter[data-item-id]";
  const CATALOG_MASK_SELECTOR = ".catalog-mask";

  function makeError(kind, message) {
    const error = new Error(message);
    error.kind = kind;
    return error;
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
  }

  function isLocked(node) {
    return Boolean(node?.classList?.contains?.("locked")
      || node?.classList?.contains?.("is-locked")
      || node?.getAttribute?.("aria-disabled") === "true"
      || node?.getAttribute?.("data-locked") === "true");
  }

  function readerHref(chapterId, locationLike) {
    try {
      const base = locationLike?.href || locationLike || "https://fanqienovel.com/reader/" + chapterId;
      const url = new URL("/reader/" + chapterId, base);
      if (url.origin !== "https://fanqienovel.com" || !/^\/reader\/\d+$/.test(url.pathname)) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function parseNativeCatalog(documentLike, locationLike, currentChapterId) {
    const currentId = String(currentChapterId || "");
    const nodes = Array.from(documentLike?.querySelectorAll?.(CATALOG_SELECTOR) || []);
    if (!nodes.length) throw makeError("not-open", "番茄原生目录未打开");
    const seen = new Set();
    const entries = nodes.map((node, index) => {
      const chapterId = String(node.dataset?.itemId || node.getAttribute?.("data-item-id") || "").trim();
      if (!/^\d+$/.test(chapterId)) throw makeError("invalid", "目录包含无效章节");
      if (seen.has(chapterId)) throw makeError("duplicate", "目录包含重复章节");
      seen.add(chapterId);
      const title = cleanText(node.querySelector?.(".chapter-text")?.textContent);
      if (!title) throw makeError("incomplete", "目录章节标题不完整");
      const entry = {
        chapterId,
        title,
        order: index,
        active: Boolean(node.classList?.contains?.("active")) || chapterId === currentId,
        visited: Boolean(node.classList?.contains?.("visited")),
        locked: isLocked(node),
        href: readerHref(chapterId, locationLike),
      };
      Object.defineProperty(entry, "element", {value: node, enumerable: false});
      return entry;
    });
    if (!entries.every((entry) => entry.href)) throw makeError("invalid", "目录链接无效");
    if (!seen.has(currentId)) throw makeError("current", "目录缺少当前章节");
    return entries;
  }

  function catalogNodes(documentLike) {
    return Array.from(documentLike?.querySelectorAll?.(CATALOG_SELECTOR) || []);
  }

  function catalogIsVisible(documentLike) {
    const roots = Array.from(documentLike?.querySelectorAll?.(".reader-catalog") || []);
    if (!roots.length) return true;
    return roots.some((root) => !root.hidden
      && root.getAttribute?.("aria-hidden") !== "true"
      && root.style?.display !== "none"
      && root.style?.visibility !== "hidden");
  }

  function create({
    documentLike = globalThis.document,
    windowLike = globalThis.window,
    locationLike = globalThis.location,
    adapter = globalThis.Fqmail.fanqie,
    skin = null,
    currentChapterId = "",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maskStableMs = DEFAULT_MASK_STABLE_MS,
    onCancel = null,
    onFallback = null,
    onSuccess = () => {},
    onError = () => {},
  } = {}) {
    let state = "idle";
    let disposed = false;
    let nativeNode = null;
    let entries = null;
    let timer = null;
    let deferredCheck = null;
    let maskTimer = null;
    let observer = null;
    let initialChapterId = String(currentChapterId || "");

    const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout;
    const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;

    function reportStage(nextState, message) {
      state = nextState;
      skin?.updateNativeCatalogSync?.({state: nextState, message});
    }

    function clearResources() {
      if (timer !== null) clearTimer(timer);
      if (deferredCheck !== null) clearTimer(deferredCheck);
      if (maskTimer !== null) clearTimer(maskTimer);
      timer = null;
      deferredCheck = null;
      maskTimer = null;
      observer?.disconnect?.();
      observer = null;
      nativeNode?.removeEventListener?.("click", onNativeClick, true);
      nativeNode = null;
    }

    function fail(kind, message) {
      if (disposed || state === "error") return false;
      clearResources();
      state = "error";
      skin?.updateNativeCatalogSync?.({state, message});
      onError(makeError(kind, message));
      return false;
    }

    function currentIdChanged() {
      try {
        const next = adapter?.getCurrentChapterId?.(locationLike);
        return Boolean(next && String(next) !== initialChapterId);
      } catch {
        return false;
      }
    }

    function capture() {
      if (disposed || (state !== "awaiting-open" && state !== "captured" && state !== "awaiting-close")) return false;
      if (nativeNode && !nativeNode.parentNode && !hasOpenCatalog()) return fail("native-control-lost", "番茄目录控件已失联");
      if (currentIdChanged()) return fail("spa", "章节已切换，请重新同步邮件");
      if (!hasOpenCatalog()) return false;
      let parsed;
      try {
        parsed = parseNativeCatalog(documentLike, locationLike, initialChapterId);
      } catch (error) {
        if (state === "awaiting-open" && ["not-open", "current", "incomplete"].includes(error?.kind)) return false;
        return fail(error?.kind || "parse", error?.message || "目录数据无效");
      }
      entries = parsed;
      reportStage("awaiting-close", "已读取 " + entries.length + " 章，请关闭番茄目录返回邮箱");
      return true;
    }

    function hasOpenCatalog() {
      return catalogNodes(documentLike).length > 0 && catalogIsVisible(documentLike);
    }

    function hasCatalogMask() {
      return Array.from(documentLike?.querySelectorAll?.(CATALOG_MASK_SELECTOR) || []).some((node) => !node.hidden
        && node.getAttribute?.("aria-hidden") !== "true"
        && node.style?.display !== "none"
        && node.style?.visibility !== "hidden");
    }

    function scheduleMaskCheck() {
      if (maskTimer !== null || !hasCatalogMask()) return;
      maskTimer = setTimer(() => {
        maskTimer = null;
        if (state === "awaiting-open" && hasCatalogMask() && !catalogNodes(documentLike).length) {
          fail("incomplete", "目录面板未完整生成；请先用原生遮罩/目录按钮关闭");
        }
      }, Math.max(1, Number(maskStableMs) || DEFAULT_MASK_STABLE_MS));
    }

    function check() {
      if (disposed || state === "idle" || state === "error") return;
      if (nativeNode && !nativeNode.parentNode && !hasOpenCatalog()) {
        fail(state === "awaiting-close" ? "catalog-node-lost" : "native-control-lost", "番茄目录控件已失联");
        return;
      }
      if (state === "awaiting-open") {
        capture();
        if (state === "awaiting-open") {
          if (catalogNodes(documentLike).length) {
            if (maskTimer !== null) clearTimer(maskTimer);
            maskTimer = null;
          } else if (hasCatalogMask()) {
            scheduleMaskCheck();
          }
        }
      } else if (state === "awaiting-close" && !hasOpenCatalog()) {
        const result = entries || [];
        clearResources();
        state = "captured";
        Promise.resolve(onSuccess(result)).catch(() => {});
      }
    }

    function scheduleCheck() {
      if (deferredCheck !== null) return;
      deferredCheck = setTimer(() => {
        deferredCheck = null;
        check();
      }, 0);
    }

    function onNativeClick(event) {
      if (event?.isTrusted === false || state !== "awaiting-open") return;
      reportStage("awaiting-open", "正在读取章节");
      scheduleCheck();
    }

    function start() {
      if (disposed || state !== "idle") return false;
      initialChapterId = String(currentChapterId || adapter?.getCurrentChapterId?.(locationLike) || "");
      const catalogAlreadyOpen = hasOpenCatalog();
      nativeNode = adapter?.findNativeCatalogItem?.(documentLike) || null;
      if (!nativeNode && !catalogAlreadyOpen) {
        state = "error";
        onError(makeError("native-control", "未找到番茄原生目录按钮"));
        return false;
      }
      skin?.enterNativeCatalogSync?.({
        state: "awaiting-open",
        message: catalogAlreadyOpen ? "正在读取已打开的番茄目录" : "请点击番茄原生目录",
        onCancel: onCancel || cancel,
        onFallback,
      });
      reportStage("awaiting-open", catalogAlreadyOpen ? "正在读取已打开的番茄目录" : "请点击番茄原生目录");
      nativeNode?.addEventListener?.("click", onNativeClick, true);
      const app = documentLike?.querySelector?.("#app");
      const Observer = windowLike?.MutationObserver || globalThis.MutationObserver;
      if (Observer && app) {
        try {
          observer = new Observer(check);
          observer.observe(app, {childList: true, subtree: true});
        } catch {
          observer = null;
        }
      }
      check();
      timer = setTimer(() => {
        if (state === "awaiting-open") {
          check();
          if (state === "awaiting-open") {
            if (hasCatalogMask() && !catalogNodes(documentLike).length) scheduleMaskCheck();
            else fail("timeout", "番茄原生目录未打开");
          }
        }
        else if (state === "awaiting-close") fail("catalog-not-closed", "请关闭番茄目录后再返回邮箱");
      }, Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
      return true;
    }

    function cancel() {
      if (disposed) return false;
      clearResources();
      entries = null;
      state = "idle";
      return true;
    }

    return {
      start,
      cancel,
      dispose() {
        if (disposed) return;
        disposed = true;
        clearResources();
        entries = null;
      },
      getState: () => state,
      parse: () => parseNativeCatalog(documentLike, locationLike, initialChapterId),
    };
  }

  globalThis.Fqmail.nativeCatalogSync = {create, parse: parseNativeCatalog, CATALOG_SELECTOR};
})();
