(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};
  const components = globalThis.Fqmail.outlookComponents;
  const personas = globalThis.Fqmail.outlookPersonas || {pick: () => ({name: "本地读者", initial: "读", color: "#0f6cbd", gender: ""})};
  const createNode = components.makeNode;

  function addLabeledButton(documentLike, parent, options) {
    const button = components.createIconButton(documentLike, options);
    button.append(createNode(documentLike, "span", "fqmail-command-label", options.label));
    parent.append(button);
    return button;
  }

  function clearChildren(node) {
    if (node.replaceChildren) node.replaceChildren();
    else while (node.firstChild) node.removeChild(node.firstChild);
  }

  function create({
    documentLike = globalThis.document,
    windowLike = globalThis.window,
    performanceMetrics = globalThis.Fqmail.performanceMetrics?.create?.({documentLike, windowLike}) || null,
    onToggle = () => {}, onRestore = () => {}, onPrev = () => {}, onNext = () => {}, onChapterSelect = () => {}, onCatalogSync = () => {},
  }) {
    const root = createNode(documentLike, "section", "fqmail-shell");
    root.setAttribute?.("aria-label", "番茄个人阅读工作区");
    performanceMetrics?.attach?.(root);

    const topbar = createNode(documentLike, "header", "fqmail-topbar");
    const launcher = components.createIconButton(documentLike, {label: "应用启动器", icon: "launcher", className: "fqmail-topbar-launcher fqmail-icon-only", onClick: () => showPresentationNotice()});
    const brand = createNode(documentLike, "div", "fqmail-brand", "Outlook");
    const searchShell = createNode(documentLike, "label", "fqmail-search-shell");
    components.addIcon(documentLike, searchShell, "search", {size: 20});
    const searchBox = createNode(documentLike, "input", "fqmail-search-box");
    searchBox.type = "search"; searchBox.readOnly = false; searchBox.tabIndex = 0;
    searchBox.setAttribute?.("placeholder", "搜索章节");
    searchShell.append(searchBox);
    const topbarActions = createNode(documentLike, "div", "fqmail-topbar-actions");
    for (const [label, icon, className] of [["设置", "settings", "fqmail-topbar-settings"], ["帮助", "help", "fqmail-topbar-help"], ["通知", "notification", "fqmail-topbar-notifications"]]) {
      topbarActions.append(components.createIconButton(documentLike, {label, icon, className: `fqmail-topbar-action ${className} fqmail-icon-only`, onClick: () => showPresentationNotice()}));
    }
    const account = createNode(documentLike, "div", "fqmail-account-avatar", "本地");
    account.setAttribute?.("aria-label", "本地占位账户"); account.setAttribute?.("title", "本地占位账户"); topbarActions.append(account);
    topbar.append(launcher, brand, searchShell, topbarActions);

    const appRail = createNode(documentLike, "nav", "fqmail-app-rail");
    for (const [label, icon, selected] of [["Mail", "mail", true], ["日历", "calendar", false], ["联系人", "people", false], ["待办", "task", false], ["应用", "appFolder", false], ["更多应用", "moreApps", false]]) {
      const item = components.createIconButton(documentLike, {label, icon, className: `fqmail-rail-item fqmail-icon-only${selected ? " fqmail-rail-item--selected" : ""}`, onClick: () => selected ? focusCurrentMessage() : showPresentationNotice()});
      item.setAttribute?.("aria-current", selected ? "page" : "false"); appRail.append(item);
    }

    const ribbon = createNode(documentLike, "section", "fqmail-ribbon");
    const ribbonTabs = createNode(documentLike, "div", "fqmail-ribbon-tabs");
    for (const label of ["文件", "主页", "查看", "帮助"]) {
      const tab = createNode(documentLike, "button", `fqmail-ribbon-tab${label === "主页" ? " fqmail-ribbon-tab--selected" : ""}`, label);
      tab.type = "button"; tab.setAttribute?.("aria-selected", String(label === "主页")); tab.addEventListener?.("click", () => showPresentationNotice()); ribbonTabs.append(tab);
    }
    const commandBar = createNode(documentLike, "div", "fqmail-command-bar");
    const presentation = (message = "此控件仅作界面展示") => () => showPresentationNotice(message);
    const commands = [["split", "新邮件", "compose"], ["split", "删除", "delete"], ["plain", "存档", "archive"], ["split", "报告", "shieldError"], ["plain", "移动", "folderMove"], ["split", "回复全部", "replyAll"], ["plain", "已读", "mailRead"], ["split", "标记", "flag"], ["plain", "文件夹", "appFolder"], ["plain", "社区", "community"], ["plain", "撤销", "undo"]];
    for (const [kind, label, icon] of commands) {
      if (kind === "split") {
        const split = components.createSplitCommand(documentLike, {label, icon, onMain: presentation(), onDropdown: presentation(`${label}选项`)}); commandBar.append(split.root);
      } else addLabeledButton(documentLike, commandBar, {label, icon, className: "fqmail-command-button", onClick: presentation()});
    }
    const moreButton = addLabeledButton(documentLike, commandBar, {label: "更多", icon: "more", className: "fqmail-command-button fqmail-more-button", onClick: () => openMoreMenu()});
    moreButton.setAttribute?.("aria-haspopup", "menu"); moreButton.setAttribute?.("aria-expanded", "false");
    const catalogSyncSlot = createNode(documentLike, "div", "fqmail-catalog-sync-slot");
    const catalogSyncButton = components.createIconButton(documentLike, {label: "同步邮件", icon: "mail", className: "fqmail-command-button fqmail-catalog-sync-button", onClick: onCatalogSync});
    catalogSyncSlot.append(catalogSyncButton);
    const status = createNode(documentLike, "div", "fqmail-status", "正文已连接"); commandBar.append(catalogSyncSlot, status); ribbon.append(ribbonTabs, commandBar);

    const folderPane = createNode(documentLike, "nav", "fqmail-folder-pane");
    const folderTree = createNode(documentLike, "div", "fqmail-folder-tree");
    const favorites = createNode(documentLike, "div", "fqmail-folder-group", "收藏夹"); favorites.setAttribute?.("role", "heading");
    const bookGroup = createNode(documentLike, "div", "fqmail-folder-group fqmail-folder-group--book");
    let inboxRow = null;
    for (const [label, icon, filterKey] of [["收件箱", "inbox", "all"], ["当前邮件", "mail", "current"], ["未读邮件", "mailRead", "unread"], ["已读邮件", "mailRead", "read"], ["已发送邮件", "send"], ["草稿", "draft"], ["垃圾邮件", "junk"], ["已删除邮件", "delete"], ["便笺", "note"], ["存档", "archive"], ["对话历史记录", "folderMove"], ["转到组", "community"]]) {
      const row = components.createFolderRow(documentLike, {label, icon, selected: label === "收件箱", onClick: filterKey ? () => { if (filterKey === "all") focusCurrentMessage(); else setFilter(filterKey); } : presentation()});
      if (filterKey) row.root.setAttribute?.("data-fqmail-filter", filterKey);
      if (label === "收件箱") inboxRow = row.root; bookGroup.append(row.root);
    }
    folderTree.append(favorites, bookGroup); folderPane.append(folderTree);

    const messageListPane = createNode(documentLike, "section", "fqmail-message-list-pane");
    const messageListHeader = createNode(documentLike, "div", "fqmail-message-list-header");
    const listTabs = createNode(documentLike, "div", "fqmail-list-tabs"); listTabs.append(createNode(documentLike, "button", "fqmail-list-tab fqmail-list-tab--selected", "重点"), createNode(documentLike, "button", "fqmail-list-tab", "其他"));
    const listActions = createNode(documentLike, "div", "fqmail-message-list-actions");
    const prevButton = addLabeledButton(documentLike, listActions, {label: "上一封", icon: "arrowPrevious", className: "fqmail-list-nav-button", onClick: onPrev, disabled: true});
    const nextButton = addLabeledButton(documentLike, listActions, {label: "下一封", icon: "arrowNext", className: "fqmail-list-nav-button", onClick: onNext, disabled: true});
    listActions.append(components.createIconButton(documentLike, {label: "筛选", icon: "filter", className: "fqmail-icon-only", onClick: presentation()}), components.createIconButton(documentLike, {label: "排序", icon: "sort", className: "fqmail-icon-only", onClick: presentation()}));
    messageListHeader.append(listTabs, listActions);
    const messageList = createNode(documentLike, "div", "fqmail-message-list"); messageList.setAttribute?.("role", "listbox"); messageListPane.append(messageListHeader, messageList);

    const readerRegion = createNode(documentLike, "section", "fqmail-reader-region");
    const readerSubject = createNode(documentLike, "h1", "fqmail-reader-subject", "当前章节");
    const messageCard = createNode(documentLike, "article", "fqmail-message-card");
    const readerMeta = createNode(documentLike, "div", "fqmail-reader-meta");
    const senderRow = createNode(documentLike, "div", "fqmail-reader-sender-row");
    const senderAvatar = createNode(documentLike, "span", "fqmail-reader-avatar", "读");
    const sender = createNode(documentLike, "div", "fqmail-reader-sender", "本地读者"); senderRow.append(senderAvatar, sender);
    const readerActions = createNode(documentLike, "div", "fqmail-reader-actions");
    for (const [label, icon] of [["回复", "reply"], ["回复全部", "replyAll"], ["转发", "forward"], ["文件夹", "appFolder"], ["更多", "more"]]) readerActions.append(components.createIconButton(documentLike, {label, icon, className: "fqmail-icon-only", onClick: presentation()}));
    readerMeta.append(senderRow, readerActions);
    const readerPane = createNode(documentLike, "main", "fqmail-reader-pane"); messageCard.append(readerMeta, readerPane); readerRegion.append(readerSubject, messageCard);

    const adRail = createNode(documentLike, "aside", "fqmail-ad-rail fqmail-utility-rail");
    adRail.append(components.createIconButton(documentLike, {label: "Outlook", icon: "outlookLogo", className: "fqmail-icon-only", onClick: presentation()}), createNode(documentLike, "div", "fqmail-ad-title", "Outlook"), createNode(documentLike, "div", "fqmail-ad-body", "个人阅读工作区"), createNode(documentLike, "div", "fqmail-ad-badge", "本地构图"));
    const contentGrid = createNode(documentLike, "div", "fqmail-content-grid"); contentGrid.append(folderPane, messageListPane, readerRegion, adRail);

    const menu = components.createMenu(documentLike, {label: "更多操作", items: [{id: "restore", label: "恢复番茄", icon: "arrowReset", onClick: () => {closeMoreMenu(); onRestore();}}, {id: "toggle", label: "停用皮肤", icon: "close", onClick: () => {closeMoreMenu(); onToggle();}}]});
    root.append(topbar, appRail, ribbon, contentGrid, menu.root);

    let noticeTimer = null; let statusRevision = 0; let baseState = "ready"; let baseStatus = "正文已连接"; let menuOpen = false; let currentBookId = "";
    let currentChapterId = ""; let catalogEntries = []; let catalogRows = new Map(); let catalogBuilt = false;
    let catalogFilter = "all"; let catalogQuery = ""; let catalogState = "idle";
    let nativeSyncPrompt = null; let nativeSyncState = "idle"; let nativeSyncCallbacks = null; let nativeSyncRootStyle = null;
    const setTimer = windowLike?.setTimeout?.bind(windowLike) || globalThis.setTimeout; const clearTimer = windowLike?.clearTimeout?.bind(windowLike) || globalThis.clearTimeout;
    const restoreButton = menu.itemButtons[0]; const toggleButton = menu.itemButtons[1];
    function setStatus(state, message) {
      const allowed = new Set(["ready", "loading", "success", "error", "disabled"]); baseState = allowed.has(state) ? state : "error"; baseStatus = String(message || ""); statusRevision += 1;
      root.setAttribute?.("data-fqmail-state", baseState); status.setAttribute?.("data-fqmail-state", baseState); status.textContent = baseStatus;
    }
    function showPresentationNotice(message = "此控件仅作界面展示") {
      const revision = statusRevision; if (noticeTimer !== null) clearTimer(noticeTimer); status.textContent = message;
      noticeTimer = setTimer(() => { noticeTimer = null; if (revision !== statusRevision) return; root.setAttribute?.("data-fqmail-state", baseState); status.setAttribute?.("data-fqmail-state", baseState); status.textContent = baseStatus; }, 1200);
    }
    function normalizeChapterTitle(value) { return String(value || "").replace(/\s+/g, "").trim(); }
    function focusCurrentMessage() {
      catalogFilter = "all";
      const row = catalogRows.get(currentChapterId) || messageList.querySelector?.(".fqmail-message-row");
      row?.scrollIntoView?.({block: "nearest"}); row?.setAttribute?.("aria-selected", "true"); inboxRow?.setAttribute?.("aria-current", "page");
      applyCatalogView();
    }
    function setFilter(nextFilter) {
      if (!["all", "current", "unread", "read"].includes(nextFilter)) return;
      catalogFilter = nextFilter;
      const measure = catalogState === "ready" ? performanceMetrics?.begin?.("catalog-filter", catalogEntries.length) : null;
      applyCatalogView();
      measure?.finish?.();
    }
    function setCatalogState(nextState, message = "") {
      catalogState = ["idle", "loading", "ready", "error"].includes(nextState) ? nextState : "error";
      root.setAttribute?.("data-fqmail-catalog-state", catalogState);
      catalogSyncSlot.setAttribute?.("data-fqmail-catalog-state", catalogState);
      if (message) status.textContent = String(message);
    }
    function enterNativeCatalogSync({state = "awaiting-open", message = "请点击番茄原生目录", onCancel = () => {}, onFallback = null} = {}) {
      if (nativeSyncPrompt) return false;
      nativeSyncState = state; nativeSyncCallbacks = {onCancel, onFallback};
      nativeSyncRootStyle = {visibility: root.style?.visibility || "", pointerEvents: root.style?.pointerEvents || ""};
      if (root.style) { root.style.visibility = "hidden"; root.style.pointerEvents = "none"; }
      const host = documentLike?.body || documentLike?.documentElement;
      if (!host?.append || !documentLike?.createElement) return true;
      const prompt = createNode(documentLike, "aside", "fqmail-native-catalog-sync-prompt");
      prompt.setAttribute?.("role", "status");
      prompt.setAttribute?.("aria-live", "polite");
      const promptMessage = createNode(documentLike, "span", "fqmail-native-catalog-sync-message", message);
      const cancelButton = components.createIconButton(documentLike, {label: "取消同步", icon: "close", className: "fqmail-native-catalog-sync-cancel", onClick: () => nativeSyncCallbacks?.onCancel?.()});
      const fallbackButton = components.createIconButton(documentLike, {label: "打开作品页同步", icon: "mail", className: "fqmail-native-catalog-sync-fallback", onClick: () => nativeSyncCallbacks?.onFallback?.()});
      fallbackButton.hidden = true;
      prompt.append(promptMessage, cancelButton, fallbackButton); host.append(prompt);
      nativeSyncPrompt = {root: prompt, message: promptMessage, cancelButton, fallbackButton};
      updateNativeCatalogSync({state, message});
      return true;
    }
    function updateNativeCatalogSync({state = "error", message = ""} = {}) {
      nativeSyncState = ["idle", "awaiting-open", "captured", "awaiting-close", "error"].includes(state) ? state : "error";
      nativeSyncPrompt?.root?.setAttribute?.("data-fqmail-sync-state", nativeSyncState);
      if (message && nativeSyncPrompt?.message) nativeSyncPrompt.message.textContent = String(message);
      if (nativeSyncPrompt?.fallbackButton) nativeSyncPrompt.fallbackButton.hidden = nativeSyncState !== "error" || typeof nativeSyncCallbacks?.onFallback !== "function";
    }
    function exitNativeCatalogSync() {
      if (nativeSyncPrompt) {
        nativeSyncPrompt.root.remove?.();
        nativeSyncPrompt.root.parentNode?.removeChild?.(nativeSyncPrompt.root);
      }
      nativeSyncPrompt = null; nativeSyncCallbacks = null; nativeSyncState = "idle";
      if (root.style && nativeSyncRootStyle) { root.style.visibility = nativeSyncRootStyle.visibility; root.style.pointerEvents = nativeSyncRootStyle.pointerEvents; }
      nativeSyncRootStyle = null;
      return true;
    }
    function entryVisible(entry) {
      const isCurrent = String(entry?.chapterId || "") === currentChapterId || Boolean(entry?.active);
      const isRead = Boolean(entry?.visited);
      const filterMatches = catalogFilter === "all"
        || (catalogFilter === "current" && isCurrent)
        || (catalogFilter === "read" && isRead)
        || (catalogFilter === "unread" && !isRead);
      const queryMatches = !catalogQuery || normalizeChapterTitle(entry?.title).includes(catalogQuery);
      return filterMatches && queryMatches;
    }
    function updateCatalogRow(row, entry) {
      const isCurrent = String(entry?.chapterId || "") === currentChapterId || Boolean(entry?.active);
      const isRead = Boolean(entry?.visited);
      const state = isCurrent ? "current" : isRead ? "read" : "unread";
      row.hidden = !entryVisible(entry);
      row.setAttribute?.("aria-hidden", String(Boolean(row.hidden)));
      row.setAttribute?.("aria-disabled", String(Boolean(entry?.locked)));
      row.setAttribute?.("data-fqmail-chapter-state", state);
      row.setAttribute?.("aria-selected", String(isCurrent));
      row.classList?.toggle?.("fqmail-message-row--locked", Boolean(entry?.locked));
    }
    function applyCatalogView() {
      for (const entry of catalogEntries) {
        const row = catalogRows.get(String(entry.chapterId));
        if (row) updateCatalogRow(row, entry);
      }
    }
    function onSearchInput() {
      if (catalogState !== "ready") {
        catalogQuery = "";
        setCatalogState("idle", "请先同步邮件");
        return;
      }
      const measure = performanceMetrics?.begin?.("catalog-search", catalogEntries.length);
      catalogQuery = normalizeChapterTitle(searchBox.value);
      applyCatalogView();
      measure?.finish?.();
    }
    function openMoreMenu() { menuOpen = true; menu.root.hidden = false; moreButton.setAttribute?.("aria-expanded", "true"); moreButton.setAttribute?.("aria-haspopup", "menu"); }
    function closeMoreMenu() { const wasOpen = menuOpen; menuOpen = false; menu.root.hidden = true; moreButton.setAttribute?.("aria-expanded", "false"); if (wasOpen) moreButton.focus?.(); }
    function onKeydown(event) { if (event?.key === "Escape" && menuOpen) closeMoreMenu(); }
    function onPointerdown(event) {
      if (!menuOpen) return;
      const insideMenu = menu.root.contains?.(event?.target) || event?.target === menu.root;
      if (!insideMenu && event?.target !== moreButton) closeMoreMenu();
    }
    documentLike?.addEventListener?.("keydown", onKeydown);
    documentLike?.addEventListener?.("pointerdown", onPointerdown);
    searchShell.addEventListener?.("click", () => { if (catalogState !== "ready") setCatalogState("idle", "请先同步邮件"); });
    searchBox.addEventListener?.("input", onSearchInput); setStatus("ready", "正文已连接");

    function beginCatalogMeasure(count) {
      const operation = catalogBuilt ? "catalog-resync" : "catalog-first";
      return performanceMetrics?.begin?.(operation, count) || null;
    }

    function renderSnapshot(snapshot, enabled = true) {
      currentBookId = snapshot?.bookId || snapshot?.bookTitle || "";
      currentChapterId = String(snapshot?.chapterId || "");
      const persona = personas.pick(currentBookId, snapshot?.chapterId || "");
      if (!catalogBuilt) {
        clearChildren(messageList);
        const current = components.createMessageRow(documentLike, {chapterId: snapshot?.chapterId, sender: persona.name, subject: snapshot?.chapterTitle || "当前章节", preview: snapshot?.bookTitle || "当前书籍", avatarText: persona.initial, avatarColor: persona.color, selected: true});
        current.root.addEventListener?.("click", () => onChapterSelect({chapterId: snapshot?.chapterId, title: snapshot?.chapterTitle, element: current.root})); messageList.append(current.root);
      }
      for (const entry of catalogEntries) {
        if (String(entry.chapterId) === currentChapterId) {
          entry.active = true;
          entry.visited = true;
        } else entry.active = false;
      }
      readerSubject.textContent = snapshot?.chapterTitle || "当前章节"; sender.textContent = persona.name; senderAvatar.textContent = persona.initial; senderAvatar.setAttribute?.("data-fqmail-avatar-color", persona.color); if (senderAvatar.style) senderAvatar.style.backgroundColor = persona.color; prevButton.disabled = !snapshot?.previousButton; nextButton.disabled = !snapshot?.nextButton; toggleButton.setAttribute?.("aria-label", enabled ? "停用皮肤" : "启用皮肤");
      applyCatalogView();
    }
    return {
      root, refs: {topbar, searchBox, appRail, ribbon, commandBar, catalogSyncSlot, catalogSyncButton, folderPane, messageListPane, messageList, chapterList: messageList, readerRegion, readerPane, readerMeta, utilityRail: adRail, adRail, prevButton, nextButton, restoreButton, toggleButton, moreButton, moreMenu: menu.root, status},
      showPresentationNotice, setStatus, setCatalogState, enterNativeCatalogSync, updateNativeCatalogSync, exitNativeCatalogSync, openMoreMenu, closeMoreMenu, focusCurrentMessage, renderSnapshot,
      beginCatalogMeasure,
      renderCatalog(entries = [], options = {}) {
        const nextEntries = Array.from(entries);
        if (!nextEntries.length) return false;
        currentChapterId = String(options.currentChapterId || currentChapterId || "");
        catalogEntries = nextEntries;
        const orderedRows = [];
        const fragment = !catalogBuilt ? documentLike.createDocumentFragment?.() : null;
        if (!catalogBuilt) clearChildren(messageList);
        for (const entry of nextEntries) {
          const id = String(entry.chapterId || "");
          let row = catalogRows.get(id);
          if (!row) {
            const persona = personas.pick(currentBookId, id);
            const created = components.createMessageRow(documentLike, {chapterId: id, sender: persona.name, subject: entry.title, preview: entry.active ? "当前章节" : entry.visited ? "已读" : "未读", avatarText: persona.initial, avatarColor: persona.color, selected: Boolean(entry.active)});
            row = created.root;
            row.addEventListener?.("click", () => {
              const liveEntry = catalogEntries.find((candidate) => String(candidate.chapterId) === id);
              if (liveEntry && !liveEntry.locked) onChapterSelect(liveEntry);
            });
            catalogRows.set(id, row);
          }
          updateCatalogRow(row, entry); orderedRows.push(row);
        }
        if (!catalogBuilt && fragment) {
          for (const row of orderedRows) fragment.append(row);
          messageList.append(fragment);
        } else if (!catalogBuilt) {
          for (const row of orderedRows) messageList.append(row);
        } else {
          messageList.replaceChildren?.(...orderedRows);
        }
        catalogBuilt = true;
        applyCatalogView();
        options.performanceMeasure?.finish?.();
        return true;
      },
      renderMessage(message) { sender.textContent = String(message || ""); },
      destroy() { exitNativeCatalogSync(); if (noticeTimer !== null) clearTimer(noticeTimer); documentLike?.removeEventListener?.("keydown", onKeydown); documentLike?.removeEventListener?.("pointerdown", onPointerdown); closeMoreMenu(); performanceMetrics?.dispose?.(); root.remove?.(); root.parentNode?.removeChild?.(root); },
    };
  }
  globalThis.Fqmail.outlook = {create};
})();
