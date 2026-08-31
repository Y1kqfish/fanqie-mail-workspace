(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

const STATUS_STATES = new Set(["ready", "loading", "success", "error", "disabled"]);

function createController({
  documentLike = globalThis.document,
  locationLike = globalThis.location,
  windowLike = globalThis.window,
  adapter = globalThis.Fqmail.fanqie,
  skinFactory = globalThis.Fqmail.outlook,
  transferApi = globalThis.Fqmail.transfer,
  nativeCatalogDock = globalThis.Fqmail.nativeCatalogDock,
  nativeCatalogSync = globalThis.Fqmail.nativeCatalogSync,
  catalogFactory = globalThis.Fqmail.catalog,
  catalogPageParser = globalThis.Fqmail.catalogPageParser,
  catalogPageSource = globalThis.Fqmail.catalogPageSource,
  catalogPageWorkflow = globalThis.Fqmail.catalogPageWorkflow,
  catalogTransfer = globalThis.Fqmail.catalogTransfer,
  catalogSession = globalThis.Fqmail.catalogSession,
  tabAppearance = null,
  earlyTransition = globalThis.Fqmail.earlyTransition?.instance || null,
  storageArea = globalThis.Fqmail.platform?.getStorageArea?.(),
  store = globalThis.Fqmail.storage?.createStore?.(),
  navigationTimeoutMs = 1500,
  catalogEnabled = true,
} = {}) {
  let started = false;
  let enabled = false;
  let mountedBox = null;
  let transfer = null;
  let scrollElement = null;
  let scrollHandler = null;
  let skin = null;
  let catalogDock = null;
  let nativeCatalogSession = null;
  let catalogController = null;
  let mountedCatalogItem = null;
  let catalogGeneration = 0;
  let snapshot = null;
  let bookId = "";
  let chapterId = "";
  let sessionCatalogBookId = "";
  let sessionCatalogEntries = [];
  let refreshTimer = null;
  let catalogPromise = null;
  let pageCatalogWorkflow = null;
  let pageCatalogUrl = "";
  let pageCatalogFallbackReady = false;
  let pageCatalogFallbackPending = false;
  let mutationObserver = null;
  let listenersInstalled = false;
  let mountingPromise = null;
  let nativeLayoutActive = false;
  const catalogSessionStore = catalogSession?.create?.() || null;

  function setStatus(state, message) {
    const nextState = STATUS_STATES.has(state) ? state : "error";
    if (skin?.setStatus) {
      skin.setStatus(nextState, message);
      return;
    }
    documentLike?.documentElement?.setAttribute?.("data-fqmail-state", nextState);
  }

  function reportError(message) {
    console.error("[Fqmail] " + message);
    setStatus("error", message);
  }

  function readerRootFor(box) {
    return box?.closest?.(".muye-reader")
      || documentLike?.querySelector?.(".muye-reader")
      || null;
  }

  function persistProgress() {
    if (!transfer || !store || !bookId || !chapterId) return Promise.resolve();
    let progress = 0;
    try {
      progress = transfer.getProgress?.() ?? 0;
    } catch (error) {
      reportError("阅读进度读取失败", error);
      return Promise.resolve();
    }
    return Promise.resolve(store.setProgress?.(bookId, chapterId, progress)).catch((error) => {
      reportError("阅读进度保存失败", error);
    });
  }

  function bindScroll() {
    if (!transfer || scrollHandler) return;
    scrollElement = transfer.scrollElement || skin?.refs?.readerPane;
    if (!scrollElement?.addEventListener) return;
    scrollHandler = () => {
      persistProgress();
    };
    scrollElement.addEventListener("scroll", scrollHandler, {passive: true});
  }

  function unbindScroll() {
    if (scrollElement?.removeEventListener && scrollHandler) {
      scrollElement.removeEventListener("scroll", scrollHandler, {passive: true});
    }
    scrollElement = null;
    scrollHandler = null;
  }

  function cancelScheduledRefresh() {
    if (refreshTimer === null) return;
    const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;
    clearTimer(refreshTimer);
    refreshTimer = null;
  }

  function pauseLifecycleObserver() {
    mutationObserver?.disconnect?.();
  }

  function resumeLifecycleObserver() {
    if (!nativeLayoutActive) observeDomTargets();
  }

  async function restoreNativeReaderLayout({rebind = true, reconnect = true} = {}) {
    if (!nativeLayoutActive) return true;
    const restoredToPane = transfer?.showPane?.() === true;
    skin?.exitNativeCatalogSync?.();
    nativeLayoutActive = false;
    if (!restoredToPane) return false;
    if (reconnect) resumeLifecycleObserver();
    if (rebind) {
      bindScroll();
      if (bookId && chapterId) {
        const savedProgress = await store?.getProgress?.(bookId, chapterId);
        transfer?.setProgress?.(savedProgress);
      }
    }
    return true;
  }

  function adoptSnapshot(nextSnapshot) {
    snapshot = nextSnapshot;
    bookId = nextSnapshot.bookId || "";
    chapterId = nextSnapshot.chapterId || "";
    skin?.renderSnapshot?.(nextSnapshot, enabled);
  }

  async function clearSessionCatalog() {
    sessionCatalogBookId = "";
    sessionCatalogEntries = [];
    try { await catalogSessionStore?.clear?.(); } catch { /* session cleanup is best effort */ }
  }

  function renderSessionCatalog(performanceMeasure = null) {
    const currentBookId = String(bookId || "");
    const matchesKnownBook = sessionCatalogBookId === currentBookId;
    const matchesUnknownBookByMembership = !currentBookId
      && sessionCatalogEntries.some((entry) => String(entry.chapterId) === String(chapterId));
    if (!skin || (!matchesKnownBook && !matchesUnknownBookByMembership) || !sessionCatalogEntries.length) return false;
    sessionCatalogEntries = sessionCatalogEntries.map((entry) => ({
      ...entry,
      active: String(entry.chapterId) === String(chapterId),
      visited: Boolean(entry.visited || String(entry.chapterId) === String(chapterId)),
    }));
    return skin.renderCatalog?.(sessionCatalogEntries, {currentChapterId: chapterId, performanceMeasure}) === true;
  }

  async function saveCatalogSession(entries) {
    if (!catalogSessionStore?.save) return true;
    try {
      const result = await catalogSessionStore.save({entries, sourceChapterId: chapterId, bookId});
      if (result?.ok === false) throw new Error("目录会话保存失败");
      return true;
    } catch {
      console.warn("[Fqmail] 目录会话保存失败");
      return false;
    }
  }

  async function restoreCatalogSession() {
    if (!catalogSessionStore?.restore || !chapterId) return false;
    let result;
    try {
      result = await catalogSessionStore.restore({currentChapterId: chapterId, bookId});
    } catch {
      return false;
    }
    const record = result?.record || result;
    if (!record?.entries?.length || !record.entries.some((entry) => String(entry.chapterId) === String(chapterId))) return false;
    if (!enabled || !skin) return false;
    const performanceMeasure = skin.beginCatalogMeasure?.(record.entries.length) || null;
    let merged = record.entries;
    if (store?.getReadMany) {
      try {
        const readState = await store.getReadMany(bookId, record.entries.map((entry) => entry.chapterId));
        merged = record.entries.map((entry) => ({...entry, visited: Boolean(entry.visited || readState?.[String(entry.chapterId)])}));
      } catch {
        // Keep the handoff metadata when local state is unavailable.
      }
    }
    if (!enabled || !skin) {
      performanceMeasure?.cancel?.();
      return false;
    }
    sessionCatalogBookId = String(record.bookId || bookId);
    sessionCatalogEntries = merged;
    try {
      const rendered = renderSessionCatalog(performanceMeasure);
      if (!rendered) performanceMeasure?.cancel?.();
      await store?.setRead?.(bookId, chapterId, true);
      skin.setCatalogState?.("ready", "已同步 " + sessionCatalogEntries.length + " 章");
      setStatus("success", "目录已加载 " + sessionCatalogEntries.length + " 章");
      return rendered;
    } catch (error) {
      performanceMeasure?.cancel?.();
      throw error;
    }
  }

  async function applySnapshot(nextSnapshot) {
    const identityChanged = Boolean(snapshot)
      && (bookId !== nextSnapshot.bookId || chapterId !== nextSnapshot.chapterId);
    if (snapshot && bookId && nextSnapshot.bookId && bookId !== nextSnapshot.bookId) {
      await clearSessionCatalog();
    }
    if (identityChanged) await persistProgress();

    adoptSnapshot(nextSnapshot);

    if (bookId && chapterId && transfer) {
      const savedProgress = await store?.getProgress?.(bookId, chapterId);
      transfer.setProgress?.(savedProgress);
      await store?.setRead?.(bookId, chapterId, true);
    }
  }

  async function unmount({clearSession = true} = {}) {
    if (refreshTimer !== null) {
      const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;
      clearTimer(refreshTimer);
      refreshTimer = null;
    }
    mutationObserver?.disconnect?.();
    catalogGeneration += 1;
    catalogController?.dispose?.();
    catalogController = null;
    nativeCatalogSession?.dispose?.();
    nativeCatalogSession = null;
    pageCatalogWorkflow?.dispose?.();
    pageCatalogWorkflow = null;
    pageCatalogUrl = "";
    pageCatalogFallbackReady = false;
    pageCatalogFallbackPending = false;
    catalogPromise = null;
    await persistProgress();
    unbindScroll();
    await restoreNativeReaderLayout({rebind: false, reconnect: false});
    const catalogRestored = catalogDock ? catalogDock.restore?.() !== false : true;
    const restored = transfer ? transfer.restore?.() !== false : true;
    catalogDock = null;
    mountedCatalogItem = null;
    transfer = null;
    mountedBox = null;
    scrollElement = null;
    skin?.destroy?.();
    skin = null;
    snapshot = null;
    bookId = "";
    chapterId = "";
    if (clearSession) await clearSessionCatalog();
    return catalogRestored && restored;
  }

  const nativeSyncEnabled = Boolean(nativeCatalogSync?.create);
  const pageSourceEnabled = !nativeSyncEnabled
    && Boolean(catalogPageSource?.load && catalogPageSource?.getPageUrl && catalogPageWorkflow?.create);
  const pageFallbackEnabled = Boolean(catalogPageParser?.findPageUrl && catalogPageWorkflow?.create && catalogTransfer?.createToken);
  const nativeCatalogRuntimeEnabled = Boolean(catalogEnabled && (nativeSyncEnabled || !pageFallbackEnabled));

  function pageCatalogError(error) {
    if (!enabled || !skin) return;
    const kind = error?.kind || "source";
    const phase = error?.phase || "silent";
    const silentStaticFailure = phase !== "fallback" && ["empty", "current", "parse", "source"].includes(kind);
    const silentEnvironmentFailure = phase !== "fallback" && ["timeout", "blocked", "environment"].includes(kind);
    if (silentStaticFailure) {
      console.warn("[Fqmail] catalog-page-static-empty " + kind);
      pageCatalogFallbackReady = true;
      pageCatalogFallbackPending = false;
      skin.setCatalogState?.("error", "静默同步受限，点击继续同步");
      setStatus("error", "静默同步受限，点击继续同步");
      console.warn("[Fqmail] catalog-page-fallback-ready");
      return;
    }
    if (silentEnvironmentFailure) {
      pageCatalogFallbackReady = true;
      pageCatalogFallbackPending = false;
      skin.setCatalogState?.("error", "静默同步受限，点击继续同步");
      setStatus("error", "静默同步受限，点击继续同步");
      console.warn("[Fqmail] catalog-page-fallback-ready");
      return;
    }
    pageCatalogFallbackReady = false;
    pageCatalogFallbackPending = false;
    const message = kind === "empty" || kind === "current" || kind === "page"
      ? "目录数据无效"
      : (error?.message || "目录同步失败");
    skin.setCatalogState?.("error", message);
    setStatus("error", message);
    reportError(message);
  }

  async function pageCatalogSuccess(result) {
    if (!enabled || !skin || !result?.entries?.length) {
      pageCatalogError({kind: "empty", message: "目录数据无效"});
      return;
    }
    if (result.bookId && bookId && String(result.bookId) !== String(bookId)) {
      pageCatalogError({kind: "page", message: "目录数据无效"});
      return;
    }
    const performanceMeasure = skin.beginCatalogMeasure?.(result.entries.length) || null;
    pageCatalogFallbackReady = false;
    pageCatalogFallbackPending = false;
    let entries = result.entries;
    if (store?.getReadMany && result.bookId) {
      try {
        const readState = await store.getReadMany(result.bookId, result.entries.map((entry) => entry.chapterId));
        entries = result.entries.map((entry) => ({...entry, visited: Boolean(readState?.[String(entry.chapterId)])}));
      } catch {
        // The page remains usable with the source-provided order when local state is unavailable.
      }
    }
    if (!enabled || !skin) {
      performanceMeasure?.cancel?.();
      return;
    }
    if (!await saveCatalogSession(entries)) {
      performanceMeasure?.cancel?.();
      pageCatalogError({kind: "session", message: "目录会话保存失败"});
      return;
    }
    sessionCatalogBookId = String(bookId || result.bookId || "");
    sessionCatalogEntries = entries;
    const rendered = skin.renderCatalog?.(entries, {currentChapterId: chapterId, performanceMeasure}) === true;
    if (!rendered) performanceMeasure?.cancel?.();
    const count = Number(result.actualCount || result.entries.length);
    skin.setCatalogState?.("ready", "已同步 " + count + " 章");
    setStatus("success", "目录已加载 " + count + " 章");
  }

  function requestPageCatalog() {
    if (!pageFallbackEnabled || !pageCatalogWorkflow || !skin) return false;
    if (nativeSyncEnabled) {
      nativeCatalogSession?.dispose?.();
      nativeCatalogSession = null;
      void restoreNativeReaderLayout();
    }
    if (!nativeSyncEnabled && pageSourceEnabled) {
      let currentPageUrl;
      try { currentPageUrl = catalogPageSource.getPageUrl(documentLike, locationLike); } catch { currentPageUrl = ""; }
      if (!currentPageUrl) { pageCatalogError({kind: "page", message: "未找到作品页链接"}); return false; }
      pageCatalogUrl = typeof currentPageUrl === "string" ? currentPageUrl : currentPageUrl.href;
      setStatus("loading", pageCatalogFallbackReady ? "正在打开作品页同步" : "正在读取章节");
      skin.setCatalogState?.("loading", pageCatalogFallbackReady ? "正在打开作品页同步" : "正在读取章节");
      const request = pageCatalogFallbackReady
        ? (pageCatalogFallbackPending ? true : pageCatalogWorkflow.startFallback({pageUrl: pageCatalogUrl, bookId, currentChapterId: chapterId}))
        : pageCatalogWorkflow.load({pageUrl: pageCatalogUrl, bookId, currentChapterId: chapterId});
      if (pageCatalogFallbackReady && request === true) pageCatalogFallbackPending = true;
      if (request === false && !pageCatalogFallbackPending) pageCatalogError({kind: "blocked", message: "无法打开作品页同步"});
      return request;
    }
    let currentPageUrl;
    try {
      currentPageUrl = catalogPageParser.findPageUrl(documentLike, locationLike);
    } catch {
      currentPageUrl = "";
    }
    if (!currentPageUrl) {
      pageCatalogError({kind: "page", message: "未找到作品页链接"});
      return false;
    }
    pageCatalogUrl = typeof currentPageUrl === "string" ? currentPageUrl : currentPageUrl.href;
    setStatus("loading", pageCatalogFallbackReady ? "正在打开作品页同步" : "正在读取章节");
    skin.setCatalogState?.("loading", pageCatalogFallbackReady ? "正在打开作品页同步" : "正在读取章节");
    if (pageCatalogFallbackReady && !pageCatalogFallbackPending) console.warn("[Fqmail] catalog-page-fallback-wait");
    const request = pageCatalogFallbackPending
      ? true
      : pageCatalogWorkflow.startFallback({pageUrl: pageCatalogUrl, bookId, currentChapterId: chapterId});
    if (pageCatalogFallbackReady && request === true) pageCatalogFallbackPending = true;
    if (request === false && !pageCatalogFallbackPending) pageCatalogError({kind: "blocked", message: "无法打开作品页同步"});
    return request;
  }

  async function nativeCatalogSuccess(entries) {
    const restored = await restoreNativeReaderLayout();
    if (!restored) {
      nativeCatalogError({kind: "restore", message: "无法恢复番茄原生阅读布局"});
      return;
    }
    if (!enabled || !skin || !entries?.length) return;
    const performanceMeasure = skin.beginCatalogMeasure?.(entries.length) || null;
    let merged = entries;
    if (store?.getReadMany && bookId) {
      try {
        const readState = await store.getReadMany(bookId, entries.map((entry) => entry.chapterId));
        merged = entries.map((entry) => ({...entry, visited: Boolean(entry.visited || readState?.[String(entry.chapterId)])}));
      } catch {
        // Keep the native visited flags when local state is unavailable.
      }
    }
    if (!enabled || !skin) {
      performanceMeasure?.cancel?.();
      return;
    }
    if (!await saveCatalogSession(merged)) {
      performanceMeasure?.cancel?.();
      skin.setCatalogState?.("error", "目录会话保存失败");
      setStatus("error", "目录会话保存失败");
      nativeCatalogSession?.dispose?.();
      nativeCatalogSession = null;
      return;
    }
    sessionCatalogBookId = String(bookId || "");
    sessionCatalogEntries = merged;
    const rendered = skin.renderCatalog?.(sessionCatalogEntries, {currentChapterId: chapterId, performanceMeasure}) === true;
    if (!rendered) performanceMeasure?.cancel?.();
    skin.setCatalogState?.("ready", "已同步 " + merged.length + " 章");
    setStatus("success", "目录已加载 " + merged.length + " 章");
    nativeCatalogSession?.dispose?.();
    nativeCatalogSession = null;
  }

  async function nativeCatalogError(error) {
    if (!enabled || !skin) return;
    let message = error?.message || "原生目录同步失败";
    skin.setCatalogState?.("error", message);
    setStatus("error", message);
    console.warn("[Fqmail] native-catalog-sync " + (error?.kind || "error"));
    nativeCatalogSession?.dispose?.();
    nativeCatalogSession = null;
    if (!await restoreNativeReaderLayout()) {
      message = "无法恢复番茄原生阅读布局";
      skin.setCatalogState?.("error", message);
      setStatus("error", message);
    }
  }

  async function cancelNativeCatalogSync() {
    const cancelled = nativeCatalogSession?.cancel?.() || false;
    if (cancelled) {
      nativeCatalogSession = null;
      await restoreNativeReaderLayout();
      setStatus("ready", "正文已连接");
      skin?.setCatalogState?.("idle", "请先同步邮件");
    }
    return cancelled;
  }

  async function requestNativeCatalogSync() {
    if (!nativeCatalogSync?.create || !skin || nativeCatalogSession) return false;
    cancelScheduledRefresh();
    pauseLifecycleObserver();
    nativeLayoutActive = true;
    await persistProgress();
    unbindScroll();
    if (transfer?.showNative?.() !== true) {
      nativeLayoutActive = false;
      resumeLifecycleObserver();
      bindScroll();
      const message = "无法恢复番茄原生阅读布局";
      skin.setCatalogState?.("error", message);
      setStatus("error", message);
      console.warn("[Fqmail] native-catalog-sync restore");
      return false;
    }
    setStatus("loading", "正在进入原生目录同步");
    try {
      skin.setCatalogState?.("loading", "请点击番茄原生目录");
      skin.enterNativeCatalogSync?.({
        state: "awaiting-open",
        message: "请点击番茄原生目录",
        onCancel: cancelNativeCatalogSync,
        onFallback: requestPageCatalog,
      });
      nativeCatalogSession = nativeCatalogSync.create({
        documentLike,
        windowLike,
        locationLike,
        adapter,
        skin,
        currentChapterId: chapterId,
        onCancel: cancelNativeCatalogSync,
        onFallback: requestPageCatalog,
        onSuccess: nativeCatalogSuccess,
        onError: nativeCatalogError,
      });
      const started = nativeCatalogSession.start?.() === true;
      if (!started && nativeCatalogSession.getState?.() !== "error") void nativeCatalogError({kind: "start", message: "原生目录同步无法启动"});
      return started;
    } catch {
      await nativeCatalogError({kind: "start", message: "原生目录同步无法启动"});
      return false;
    }
  }

  async function mountInternal() {
    if (!enabled || !adapter.matchesReaderPage(locationLike)) return false;
    const box = adapter.getReaderBox(documentLike);
    if (!box) return false;
    const nativeCatalogItem = nativeCatalogRuntimeEnabled
      ? adapter.findNativeCatalogItem?.(documentLike) || null
      : null;
    if (mountedBox === box && transfer && skin
      && (!nativeCatalogItem || nativeCatalogItem === mountedCatalogItem)) {
      await applySnapshot(adapter.parseReaderSnapshot(documentLike, locationLike));
      return true;
    }

    const initialSnapshot = adapter.parseReaderSnapshot(documentLike, locationLike);
    const initialBookId = String(initialSnapshot.bookId || "");
    const preserveSession = sessionCatalogEntries.length > 0
      && ((Boolean(initialBookId) && sessionCatalogBookId === initialBookId)
        || (!initialBookId && sessionCatalogEntries.some((entry) => String(entry.chapterId) === String(initialSnapshot.chapterId || ""))));
    const hadCurrentRuntime = Boolean(skin || mountedBox || sessionCatalogBookId);
    await unmount({clearSession: hadCurrentRuntime && !preserveSession});
    const catalogItem = nativeCatalogRuntimeEnabled
      ? nativeCatalogItem || adapter.findNativeCatalogItem?.(documentLike) || null
      : null;
    const nextSkin = skinFactory.create({
      onToggle: toggle,
      onRestore: disable,
      onPrev: () => proxyNative("上一章"),
      onNext: () => proxyNative("下一章"),
      onChapterSelect: selectChapter,
      onCatalogSync: nativeSyncEnabled ? requestNativeCatalogSync : requestPageCatalog,
    });
    if (nextSkin.refs?.catalogSyncSlot) {
      nextSkin.refs.catalogSyncSlot.hidden = false;
    }
    let nextTransfer = null;
    let nextCatalogDock = null;
    let nextCatalogController = null;
    let nextPageCatalogWorkflow = null;
    try {
      const shellHost = documentLike?.querySelector?.("#app") || documentLike?.body;
      shellHost?.append?.(nextSkin.root);
      const readerRoot = readerRootFor(box);
      nextTransfer = transferApi.mount({
        doc: documentLike,
        box,
        pane: nextSkin.refs.readerPane,
        readerRoot,
        windowLike,
      });
      skin = nextSkin;
      transfer = nextTransfer;
      mountedBox = box;
      nextCatalogController = catalogEnabled
        ? catalogFactory?.create?.({
          documentLike,
          adapter,
          store,
          windowLike,
        }) || null
        : null;
      nextPageCatalogWorkflow = pageFallbackEnabled
        ? catalogPageWorkflow.create({
          documentLike,
          locationLike,
          windowLike,
          source: catalogPageSource,
          parser: catalogPageParser,
          transferApi: catalogTransfer,
          storageArea,
          onSuccess: pageCatalogSuccess,
          onError: pageCatalogError,
        })
        : null;
      pageCatalogWorkflow = nextPageCatalogWorkflow;
      if (catalogItem && nextSkin.root && nativeCatalogDock?.mount) {
        nextCatalogDock = nativeCatalogDock.mount({
          nativeNode: catalogItem,
          shell: nextSkin.root,
          slot: nextSkin.refs?.catalogSyncSlot,
          windowLike,
          onTrustedClick: () => {
            setStatus("loading", "正在读取章节");
            loadCatalog().catch((error) => reportError("目录加载失败", error));
          },
        });
        catalogDock = nextCatalogDock;
        mountedCatalogItem = catalogItem;
        catalogController = nextCatalogController;
      } else {
        nextCatalogController?.dispose?.();
      }
      adoptSnapshot(initialSnapshot);
      await tabAppearance?.enable?.();
      await applySnapshot(adapter.parseReaderSnapshot(documentLike, locationLike));
      const sessionPerformanceMeasure = sessionCatalogEntries.length
        ? skin.beginCatalogMeasure?.(sessionCatalogEntries.length) || null
        : null;
      const sessionRendered = renderSessionCatalog(sessionPerformanceMeasure);
      if (!sessionRendered) sessionPerformanceMeasure?.cancel?.();
      if (!hadCurrentRuntime && !preserveSession) await restoreCatalogSession();
      observeDomTargets();
      bindScroll();
      setStatus(
        nativeCatalogRuntimeEnabled && !catalogItem ? "error" : "ready",
        nativeCatalogRuntimeEnabled && !catalogItem ? "未找到番茄原生目录按钮" : "正文已连接",
      );
      if (nativeCatalogRuntimeEnabled && !catalogItem) skin.setCatalogState?.("error", "未找到番茄原生目录按钮");
      return true;
    } catch (error) {
      nextCatalogDock?.restore?.();
      nextCatalogController?.dispose?.();
      nextPageCatalogWorkflow?.dispose?.();
      nextTransfer?.restore?.();
      nextSkin.setStatus?.("error", "正文挂载失败");
      nextSkin.destroy?.();
      tabAppearance?.restore?.();
      earlyTransition?.release?.();
      reportError("正文挂载失败", error);
      skin = null;
      catalogDock = null;
      catalogController = null;
      mountedCatalogItem = null;
      catalogPromise = null;
      transfer = null;
      mountedBox = null;
      return false;
    }
  }

  function mount() {
    if (mountingPromise) return mountingPromise;
    mountingPromise = mountInternal().finally(() => {
      mountingPromise = null;
    });
    return mountingPromise;
  }

  function scheduleRefresh() {
    if (nativeLayoutActive) return;
    if (refreshTimer !== null) return;
    const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout;
    refreshTimer = setTimer(() => {
      refreshTimer = null;
      refresh().catch((error) => reportError("页面刷新失败", error));
    }, 120);
  }

  async function refresh() {
    if (!enabled || nativeLayoutActive) return false;
    const box = adapter.getReaderBox(documentLike);
    if (!box) {
      await clearSessionCatalog();
      return false;
    }
    const nativeCatalogItem = nativeCatalogRuntimeEnabled
      ? adapter.findNativeCatalogItem?.(documentLike) || null
      : null;
    const catalogLost = nativeCatalogRuntimeEnabled && mountedCatalogItem
      && (!mountedCatalogItem.parentNode || catalogDock?.isConnected?.() === false);
    if (box !== mountedBox || (nativeCatalogItem && nativeCatalogItem !== mountedCatalogItem) || catalogLost) return mount();
    await applySnapshot(adapter.parseReaderSnapshot(documentLike, locationLike));
    return true;
  }

  async function waitForNavigation(previousBookId, previousChapterId) {
    const timeout = Math.max(0, Number(navigationTimeoutMs));
    const startedAt = Date.now();
    const parseChanged = () => {
      try {
        const nextSnapshot = adapter.parseReaderSnapshot(documentLike, locationLike);
        return Boolean(nextSnapshot)
          && (nextSnapshot.bookId !== previousBookId || nextSnapshot.chapterId !== previousChapterId);
      } catch {
        return false;
      }
    };
    if (parseChanged()) return true;
    if (!timeout) return false;

    const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout;
    return new Promise((resolve) => {
      const poll = () => {
        if (parseChanged()) {
          resolve(true);
          return;
        }
        const elapsed = Date.now() - startedAt;
        if (elapsed >= timeout) {
          resolve(false);
          return;
        }
        setTimer(poll, Math.min(50, timeout - elapsed));
      };
      setTimer(poll, Math.min(50, timeout));
    });
  }

  async function proxyNative(label) {
    const snapshotButton = label === "上一章" ? snapshot?.previousButton : snapshot?.nextButton;
    const button = snapshotButton || adapter.findNativeButton(documentLike, label);
    if (!button?.click) {
      reportError("未找到原生章节按钮");
      return false;
    }
    const previousBookId = bookId;
    const previousChapterId = chapterId;
    setStatus("loading", "正在切换章节");
    const persisted = persistProgress();
    button.click();
    scheduleRefresh();
    await persisted;
    if (!await waitForNavigation(previousBookId, previousChapterId)) {
      setStatus("error", "章节切换未生效");
      return false;
    }
    await refresh();
    setStatus("ready", "正文已连接");
    return true;
  }

  async function loadCatalogOnce() {
    if (pageFallbackEnabled && catalogEnabled === false) return requestNativeCatalogSync();
    if (!catalogEnabled) return [];
    if (!skin || !mountedCatalogItem || !catalogController) {
      skin?.setCatalogState?.("error", "未找到番茄原生目录按钮");
      reportError("未找到番茄原生目录按钮");
      return [];
    }
    setStatus("loading", "正在读取章节");
    skin.setCatalogState?.("loading", "正在读取章节");
    const generation = catalogGeneration;
    try {
      const entries = await catalogController.load(bookId);
      if (generation !== catalogGeneration || !enabled || !skin) return [];
      const performanceMeasure = skin.beginCatalogMeasure?.(entries.length) || null;
      if (!await saveCatalogSession(entries)) {
        performanceMeasure?.cancel?.();
        skin.setCatalogState?.("error", "目录会话保存失败");
        setStatus("error", "目录会话保存失败");
        return [];
      }
      sessionCatalogBookId = String(bookId || "");
      sessionCatalogEntries = entries;
      const rendered = skin.renderCatalog?.(entries, {currentChapterId: chapterId, performanceMeasure}) === true;
      if (!rendered) performanceMeasure?.cancel?.();
      skin.setCatalogState?.("ready", "已同步 " + entries.length + " 章");
      setStatus("success", "目录已加载 " + entries.length + " 章");
      if (bookId && chapterId) await store?.setRead?.(bookId, chapterId, true);
      return entries;
    } catch (error) {
      if (generation !== catalogGeneration || error?.kind === "disposed") return [];
      skin.setCatalogState?.("error", error?.message || "目录加载失败");
      reportError(error?.message || "目录加载失败");
      return [];
    }
  }

  function loadCatalog() {
    if (catalogPromise) return catalogPromise;
    catalogPromise = loadCatalogOnce().finally(() => {
      catalogPromise = null;
    });
    return catalogPromise;
  }

  async function selectChapter(entry) {
    if (entry?.locked) {
      reportError("该章节已锁定");
      return false;
    }
    const element = entry?.element;
    const detached = element?.isConnected === false || (element && "parentNode" in element && !element.parentNode);
    const href = entry?.href ? String(entry.href) : "";
    let readerHref = "";
    if (href) {
      try {
        const url = new URL(href, locationLike?.href || String(locationLike));
        if (url.origin === "https://fanqienovel.com" && /^\/reader\/\d+$/.test(url.pathname)) readerHref = url.href;
      } catch {
        readerHref = "";
      }
    }
    if (!readerHref && (!element?.click || detached)) {
      reportError("章节条目不可用");
      return false;
    }
    setStatus("loading", "正在切换章节");
    const persisted = persistProgress();
    const markedRead = bookId && entry.chapterId
      ? Promise.resolve(store?.setRead?.(bookId, entry.chapterId, true))
      : Promise.resolve();
    await Promise.all([persisted, markedRead]);
    if (readerHref) {
      if (typeof locationLike?.assign === "function") locationLike.assign(readerHref);
      else locationLike.href = readerHref;
    } else {
      entry.element.click();
      scheduleRefresh();
    }
    return true;
  }

  async function enable() {
    enabled = true;
    await store?.setEnabled?.(true);
    return mount();
  }

  async function disable() {
    enabled = false;
    await store?.setEnabled?.(false);
    if (skin) setStatus("disabled", "皮肤已停用");
    const restored = await unmount();
    tabAppearance?.restore?.();
    earlyTransition?.release?.();
    if (!restored) {
      try {
        if (typeof locationLike?.reload !== "function") throw new Error("reload unavailable");
        locationLike.reload();
      } catch {
        console.error("[Fqmail] 恢复失败");
      }
    }
    documentLike?.documentElement?.setAttribute?.("data-fqmail-state", "disabled");
    return restored;
  }

  async function toggle() {
    return enabled ? disable() : enable();
  }

  function scheduleFromNavigation() {
    scheduleRefresh();
  }

  function observeDomTargets() {
    if (!mutationObserver) return;
    mutationObserver.disconnect?.();
    const appTarget = documentLike?.querySelector?.("#app") || documentLike?.body;
    if (appTarget) mutationObserver.observe(appTarget, {childList: true, subtree: true});
    if (mountedBox) mutationObserver.observe(mountedBox, {childList: true, subtree: true});
  }

  function isWithin(node, ancestor) {
    let current = node;
    while (current) {
      if (current === ancestor) return true;
      current = current.parentNode;
    }
    return false;
  }

  function isOwnedByShell(node) {
    if (!node || !skin?.root) return false;
    return isWithin(node, skin.root) || node.closest?.(".fqmail-shell") === skin.root;
  }

  function hasPageMutation(records = []) {
    return records.some((record) => {
      if (isWithin(record.target, mountedBox)) return true;
      if (isOwnedByShell(record.target)) return false;
      const nodes = [
        ...(record.addedNodes ? Array.from(record.addedNodes) : []),
        ...(record.removedNodes ? Array.from(record.removedNodes) : []),
      ];
      return !nodes.length || nodes.some((node) => !isOwnedByShell(node));
    });
  }

  function installObservers() {
    if (listenersInstalled) return;
    listenersInstalled = true;
    windowLike?.addEventListener?.("popstate", scheduleFromNavigation);
    windowLike?.addEventListener?.("hashchange", scheduleFromNavigation);
    windowLike?.addEventListener?.("keydown", (event) => {
      if (event.altKey && event.shiftKey && String(event.key).toLowerCase() === "m") {
        event.preventDefault?.();
        toggle().catch((error) => reportError("快捷键切换失败", error));
      }
    });

    const Observer = windowLike?.MutationObserver || globalThis.MutationObserver;
    if (Observer && !mutationObserver) {
      mutationObserver = new Observer((records) => {
        if (nativeLayoutActive) return;
        if (hasPageMutation(records)) scheduleRefresh();
      });
    }
    observeDomTargets();
  }

  async function start() {
    if (started) return enabled && Boolean(mountedBox);
    started = true;
    const settings = await store?.getSettings?.() || {enabled: true};
    enabled = settings.enabled !== false;
    installObservers();
    if (!enabled) {
      setStatus("disabled", "皮肤已停用");
      return false;
    }
    return mount();
  }

  function reportStartupError(error) {
    reportError("启动失败", error);
  }

  return {
    start,
    enable,
    disable,
    toggle,
    restore: disable,
    loadCatalog,
    refresh,
    persistProgress,
    reportStartupError,
  };
}

globalThis.Fqmail.controller = {create: createController};
})();
