(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

function normalizeProgress(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function createProgress(scrollable) {
  return () => {
    const maxScroll = Math.max(0, Number(scrollable?.scrollHeight || 0) - Number(scrollable?.clientHeight || 0));
    if (!maxScroll) return 0;
    return normalizeProgress(Number(scrollable?.scrollTop || 0) / maxScroll);
  };
}

function setProgress(scrollable, value) {
  const maxScroll = Math.max(0, Number(scrollable?.scrollHeight || 0) - Number(scrollable?.clientHeight || 0));
  if (maxScroll) scrollable.scrollTop = normalizeProgress(value) * maxScroll;
}

function getNextSibling(node) {
  if (node?.nextSibling !== undefined) return node.nextSibling;
  const parent = node?.parentNode;
  const index = parent?.children ? Array.from(parent.children).indexOf(node) : -1;
  return index >= 0 ? parent.children[index + 1] || null : null;
}

function isConnected(node) {
  if (!node) return false;
  if (typeof node.isConnected === "boolean") return node.isConnected;
  return Boolean(node.parentNode);
}

function mount({doc, box, pane, windowLike = globalThis.window, readerRoot = null}) {
  if (!doc || !box?.parentNode || !pane) throw new Error("Cannot mount reader box without its parent and target pane");
  const parent = box.parentNode;
  const marker = doc.createComment("fqmail-reader-placeholder");
  const originalWindowScroll = [Number(windowLike?.scrollX || 0), Number(windowLike?.scrollY || 0)];
  const originalBoxScrollTop = Number(box.scrollTop || 0);
  const originalRootStyle = readerRoot?.getAttribute
    ? readerRoot.getAttribute("style")
    : readerRoot?.style?.cssText ?? null;
  const scrollElement = pane;
  const progress = createProgress(scrollElement);
  let restored = false;
  let restoreResult = true;

  parent.insertBefore(marker, box);
  parent.removeChild?.(box);
  pane.append(box);

  function removeFromCurrentParent() {
    const currentParent = box.parentNode;
    if (currentParent?.removeChild) currentParent.removeChild(box);
    else if (currentParent) box.parentNode = null;
  }

  function markerReference() {
    return getNextSibling(marker);
  }

  function showNative() {
    if (restored || !isConnected(marker)) return false;
    const nativeParent = marker.parentNode;
    const children = nativeParent?.children ? Array.from(nativeParent.children) : [];
    if (box.parentNode === nativeParent && children.indexOf(box) === children.indexOf(marker) + 1) return true;
    removeFromCurrentParent();
    nativeParent.insertBefore(box, markerReference());
    return true;
  }

  function showPane() {
    if (restored) return false;
    if (box.parentNode === pane) return true;
    removeFromCurrentParent();
    pane.append(box);
    return true;
  }

  return {
    marker,
    box,
    scrollElement,
    getProgress: progress,
    setProgress: (value) => setProgress(scrollElement, value),
    showNative,
    showPane,
    restore() {
      if (restored) return restoreResult;
      restored = true;
      const markerConnected = isConnected(marker);
      removeFromCurrentParent();
      if (markerConnected) {
        marker.parentNode?.insertBefore?.(box, markerReference());
      }
      if (readerRoot?.removeAttribute && originalRootStyle === null) readerRoot.removeAttribute("style");
      else if (readerRoot?.setAttribute) readerRoot.setAttribute("style", originalRootStyle ?? "");
      else if (readerRoot?.style) readerRoot.style.cssText = originalRootStyle || "";
      box.scrollTop = originalBoxScrollTop;
      windowLike?.scrollTo?.(originalWindowScroll[0], originalWindowScroll[1]);
      marker.parentNode?.removeChild?.(marker);
      restoreResult = markerConnected;
      return restoreResult;
    },
  };
}

globalThis.Fqmail.transfer = {normalizeProgress, createProgress, mount};
})();
