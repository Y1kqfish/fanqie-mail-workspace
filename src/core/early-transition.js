(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const SETTINGS_KEY = "fqmail:settings";
  const SETTINGS_TIMEOUT_MS = 300;
  const MAX_COVER_MS = 5000;
  const READER_PATTERN = /^https:\/\/fanqienovel\.com\/reader\//;

  function matchesReaderPage(locationLike = globalThis.location) {
    try {
      const url = locationLike instanceof URL ? locationLike : new URL(locationLike?.href || locationLike);
      return READER_PATTERN.test(url.href);
    } catch {
      return false;
    }
  }

  function create({
    documentLike = globalThis.document,
    windowLike = globalThis.window,
    storageArea = globalThis.Fqmail.platform?.getStorageArea?.()
      || globalThis.browser?.storage?.local
      || globalThis.chrome?.storage?.local,
    settingsTimeoutMs = SETTINGS_TIMEOUT_MS,
    maxCoverMs = MAX_COVER_MS,
  } = {}) {
    let started = false;
    let active = false;
    let node = null;
    let settingsTimer = null;
    let coverTimer = null;
    let domReadyListener = null;
    let domObserver = null;

    const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout;
    const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;

    function clearResources() {
      if (settingsTimer !== null) clearTimer(settingsTimer);
      if (coverTimer !== null) clearTimer(coverTimer);
      settingsTimer = null;
      coverTimer = null;
      if (domReadyListener) documentLike?.removeEventListener?.("DOMContentLoaded", domReadyListener);
      domReadyListener = null;
      domObserver?.disconnect?.();
      domObserver = null;
    }

    function removeNode() {
      node?.remove?.();
      node?.parentNode?.removeChild?.(node);
      node = null;
    }

    function release() {
      const wasActive = active;
      active = false;
      clearResources();
      removeNode();
      return wasActive;
    }

    function mountNode() {
      if (!active || node || !documentLike?.body || !documentLike?.createElement) return Boolean(node);
      const existing = documentLike.querySelector?.("[data-fqmail-early-transition]");
      if (existing) {
        node = existing;
        domObserver?.disconnect?.();
        domObserver = null;
        return true;
      }
      node = documentLike.createElement("div");
      node.className = "fqmail-early-transition";
      node.setAttribute?.("data-fqmail-early-transition", "true");
      node.setAttribute?.("role", "status");
      node.setAttribute?.("aria-live", "polite");
      const topbar = documentLike.createElement("div");
      topbar.className = "fqmail-early-transition__topbar";
      topbar.textContent = "Outlook";
      const status = documentLike.createElement("div");
      status.className = "fqmail-early-transition__status";
      status.textContent = "正在加载邮件";
      node.append(topbar, status);
      documentLike.body.append(node);
      domObserver?.disconnect?.();
      domObserver = null;
      return true;
    }

    function observeBody() {
      if (domObserver || !documentLike || !active) return;
      const Observer = windowLike?.MutationObserver || globalThis.MutationObserver;
      const target = documentLike.documentElement || documentLike;
      if (!Observer || !target) return;
      try {
        domObserver = new Observer(() => mountNode());
        domObserver.observe(target, {childList: true, subtree: true});
      } catch {
        domObserver = null;
      }
    }

    function onDomReady() {
      domReadyListener = null;
      mountNode();
    }

    function start() {
      if (started) return false;
      started = true;
      if (!storageArea?.get) return false;
      active = true;
      mountNode();
      if (!node) {
        observeBody();
        if (documentLike?.addEventListener) {
          domReadyListener = onDomReady;
          documentLike.addEventListener("DOMContentLoaded", domReadyListener, {once: true});
        }
      }
      settingsTimer = setTimer(() => release(), Math.max(1, Number(settingsTimeoutMs) || SETTINGS_TIMEOUT_MS));
      coverTimer = setTimer(() => release(), Math.max(1, Number(maxCoverMs) || MAX_COVER_MS));
      Promise.resolve()
        .then(() => storageArea.get(SETTINGS_KEY))
        .then((result) => {
          if (!active) return;
          if (settingsTimer !== null) clearTimer(settingsTimer);
          settingsTimer = null;
          if (result?.[SETTINGS_KEY]?.enabled === false) release();
          else mountNode();
        })
        .catch(() => release());
      return true;
    }

    return {
      start,
      ready: release,
      release,
      isActive: () => active,
    };
  }

  const api = {create, matchesReaderPage, SETTINGS_KEY, SETTINGS_TIMEOUT_MS, MAX_COVER_MS};
  globalThis.Fqmail.earlyTransition = api;
  if (matchesReaderPage() && globalThis.document) {
    const instance = create();
    api.instance = instance;
    instance.start();
  }
})();
