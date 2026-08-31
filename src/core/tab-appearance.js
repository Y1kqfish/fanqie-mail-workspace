(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const FIXED_TITLE = "收件箱 - Outlook";
  const OWN_ICON_ATTR = "data-fqmail-tab-icon";
  const favicon = globalThis.Fqmail.outlookFavicon || {};
  const instancesByDocument = new WeakMap();

  function create({documentLike = globalThis.document, windowLike = globalThis.window} = {}) {
    let enabled = false;
    let disposed = false;
    let nativeTitle = "";
    let hasNativeTitle = false;
    let ownIcon = null;
    let observer = null;

    function getTitleNode() {
      return documentLike?.querySelector?.("title") || null;
    }

    function readTitle() {
      const titleNode = getTitleNode();
      if (typeof titleNode?.textContent === "string") return titleNode.textContent;
      return String(documentLike?.title || "");
    }

    function writeTitle(value) {
      const next = String(value || "");
      const titleNode = getTitleNode();
      if (titleNode && typeof titleNode.textContent === "string") titleNode.textContent = next;
      try { documentLike.title = next; } catch { /* Some document fixtures expose a read-only title. */ }
    }

    function isOwnIcon(node) {
      return node?.getAttribute?.(OWN_ICON_ATTR) === "true";
    }

    function ensureOwnIcon() {
      const head = documentLike?.head;
      if (!enabled || !head || !documentLike?.createElement || !favicon.DATA_URL) return false;
      if (!ownIcon) {
        ownIcon = documentLike.createElement("link");
        ownIcon.setAttribute?.("rel", "icon");
        ownIcon.setAttribute?.("type", "image/svg+xml");
        ownIcon.setAttribute?.(OWN_ICON_ATTR, "true");
        ownIcon.href = favicon.DATA_URL;
        ownIcon.setAttribute?.("href", favicon.DATA_URL);
      }
      if (ownIcon.parentNode !== head || head.lastChild !== ownIcon) head.append(ownIcon);
      return true;
    }

    function removeOwnIcon() {
      ownIcon?.remove?.();
      ownIcon?.parentNode?.removeChild?.(ownIcon);
      ownIcon = null;
    }

    function syncNativeTitle() {
      if (!enabled) return;
      const current = readTitle();
      if (current !== FIXED_TITLE) {
        nativeTitle = current;
        hasNativeTitle = true;
        writeTitle(FIXED_TITLE);
      }
    }

    function observe() {
      const Observer = windowLike?.MutationObserver || globalThis.MutationObserver;
      const head = documentLike?.head;
      if (!Observer || !head) return;
      try {
        observer = new Observer(() => {
          syncNativeTitle();
          ensureOwnIcon();
        });
        observer.observe(head, {childList: true, subtree: true, characterData: true, attributes: true});
      } catch {
        observer = null;
      }
    }

    function stopObserve() {
      observer?.disconnect?.();
      observer = null;
    }

    function enable() {
      if (disposed || enabled) return false;
      nativeTitle = readTitle();
      hasNativeTitle = true;
      enabled = true;
      writeTitle(FIXED_TITLE);
      ensureOwnIcon();
      observe();
      return true;
    }

    function restore() {
      if (!enabled) return false;
      syncNativeTitle();
      enabled = false;
      stopObserve();
      removeOwnIcon();
      writeTitle(nativeTitle);
      return true;
    }

    function getNativeTitle() {
      if (enabled) syncNativeTitle();
      return hasNativeTitle ? nativeTitle : undefined;
    }

    function dispose() {
      if (disposed) return false;
      disposed = true;
      const restored = restore();
      if (instancesByDocument.get(documentLike) === instance) instancesByDocument.delete(documentLike);
      return restored;
    }

    const instance = {
      enable,
      restore,
      dispose,
      getNativeTitle,
      isEnabled: () => enabled,
      FIXED_TITLE,
    };
    instancesByDocument.set(documentLike, instance);
    return instance;
  }

  globalThis.Fqmail.tabAppearance = {
    create,
    getNativeTitle(documentLike) {
      return instancesByDocument.get(documentLike)?.getNativeTitle?.();
    },
    FIXED_TITLE,
    OWN_ICON_ATTR,
  };
})();
