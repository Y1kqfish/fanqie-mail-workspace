(function () {
globalThis.Fqmail = globalThis.Fqmail || {};

const CONTROL_CLASS = "fqmail-native-catalog-control";
const DOCK_CLASS = "fqmail-native-catalog-dock";
const LABEL_CLASS = "fqmail-native-catalog-label";
const BOUNDARY_CLASS = "fqmail-native-catalog-boundary";
const DOCK_SIDE_ATTRIBUTE = "data-fqmail-native-dock-side";
const LABEL_ATTRIBUTE = "data-fqmail-label";
const STYLE_FIELDS = ["position", "left", "top", "width", "height", "zIndex", "visibility", "pointerEvents"];

function isConnected(node) {
  if (!node) return false;
  if (typeof node.isConnected === "boolean") return node.isConnected;
  return Boolean(node.parentNode);
}

function readAttribute(node, name) {
  return node?.getAttribute?.(name) ?? null;
}

function restoreAttribute(node, name, value) {
  if (value === null) node.removeAttribute?.(name);
  else node.setAttribute?.(name, value);
}

function hasClass(node, className) {
  return String(node?.className || "").split(/\s+/).includes(className);
}

function belongsToApp(node) {
  if (node?.closest?.("#app")) return true;
  let current = node;
  while (current) {
    if (current.id === "app") return true;
    current = current.parentNode;
  }
  return false;
}

function belongsToShell(node) {
  if (node?.closest?.(".fqmail-shell")) return true;
  let current = node;
  while (current) {
    if (hasClass(current, "fqmail-shell")) return true;
    current = current.parentNode;
  }
  return false;
}

function normalizeLabel(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function descendants(node) {
  const result = [];
  const visit = (current, depth) => {
    for (const child of current?.children || []) {
      result.push({node: child, depth});
      visit(child, depth + 1);
    }
  };
  visit(node, 1);
  return result;
}

function findLabelTarget(nativeNode) {
  const candidates = descendants(nativeNode)
    .filter(({node}) => normalizeLabel(node.textContent) === "目录")
    .sort((left, right) => right.depth - left.depth);
  return candidates[0]?.node || (normalizeLabel(nativeNode.textContent) === "目录" ? nativeNode : null);
}

function captureAttributes(node, names) {
  return Object.fromEntries(names.map((name) => [name, readAttribute(node, name)]));
}

function restoreAttributes(node, attributes) {
  for (const [name, value] of Object.entries(attributes)) restoreAttribute(node, name, value);
}

function captureStyle(node, properties = STYLE_FIELDS) {
  return {
    attribute: readAttribute(node, "style"),
    values: Object.fromEntries(properties.map((property) => [property, node?.style?.[property] ?? ""])),
  };
}

function restoreStyle(node, snapshot) {
  if (!node || !snapshot) return;
  for (const property of Object.keys(snapshot.values || {})) {
    if (node.style) node.style[property] = "";
  }
  restoreAttribute(node, "style", snapshot.attribute);
  for (const [property, value] of Object.entries(snapshot.values || {})) {
    if (node.style) node.style[property] = value;
  }
}

function computedStyle(windowLike, node) {
  const getComputedStyle = windowLike?.getComputedStyle || globalThis.getComputedStyle;
  try {
    return getComputedStyle?.call(windowLike, node) || null;
  } catch {
    return null;
  }
}

function styleValue(windowLike, node, property) {
  return String(computedStyle(windowLike, node)?.[property] || node?.style?.[property] || "").toLowerCase();
}

function findStackingBoundary(nativeNode, windowLike) {
  let current = nativeNode?.parentNode || null;
  while (current) {
    if (hasClass(current, "reader-toolbar")) {
      const position = styleValue(windowLike, current, "position");
      if (["fixed", "sticky", "relative", "absolute"].includes(position)) return current;
    }
    if (current.id === "app") break;
    current = current.parentNode;
  }
  return null;
}

function numericStyleValue(windowLike, node, property) {
  const value = Number.parseInt(styleValue(windowLike, node, property), 10);
  return Number.isFinite(value) ? value : 0;
}

function readRect(rect) {
  const left = Number(rect?.left);
  const top = Number(rect?.top);
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return {left, top, width, height};
}

function resolveLayout(rect, viewportWidth, gap = 8) {
  const width = Math.max(1, Number(viewportWidth) || 1);
  const left = Math.max(0, Number(rect?.left) || 0);
  const right = Math.min(width, Math.max(left, Number(rect?.right) || left + Number(rect?.width || 0)));
  const leftReserve = Math.ceil(right + gap);
  const rightReserve = Math.ceil(width - left + gap);
  return leftReserve <= rightReserve
    ? {side: "left", reserve: leftReserve}
    : {side: "right", reserve: rightReserve};
}

function create({
  nativeNode,
  shell,
  slot = null,
  windowLike = globalThis.window,
  onTrustedClick = () => {},
}) {
  if (!nativeNode?.parentNode || !shell || !belongsToApp(nativeNode) || belongsToShell(nativeNode)) {
    throw new Error("Cannot dock a native catalog control outside the app tree");
  }

  const labelTarget = slot ? findLabelTarget(nativeNode) : null;
  const boundary = slot ? findStackingBoundary(nativeNode, windowLike) : null;
  const initialRect = slot ? readRect(slot.getBoundingClientRect?.()) : null;
  if (slot && (!labelTarget || !boundary || !initialRect)) {
    throw new Error("Cannot dock a native catalog control without a verified label and slot");
  }

  const originalClassName = nativeNode.className;
  const originalNativeAttributes = {
    style: readAttribute(nativeNode, "style"),
    role: readAttribute(nativeNode, "role"),
    tabindex: readAttribute(nativeNode, "tabindex"),
    "aria-label": readAttribute(nativeNode, "aria-label"),
    "aria-hidden": readAttribute(nativeNode, "aria-hidden"),
  };
  const originalNativeStyle = captureStyle(nativeNode);
  const originalBoundaryClass = boundary?.className;
  const originalBoundaryStyle = captureStyle(boundary, ["zIndex", "visibility", "pointerEvents"]);
  const originalShellStyle = readAttribute(shell, "style")
    ?? shell.style?.cssText
    ?? null;
  const originalShellLeft = shell.style?.left || "";
  const originalShellRight = shell.style?.right || "";
  const originalDockSide = readAttribute(shell, DOCK_SIDE_ATTRIBUTE);
  const originalLabelClassName = labelTarget?.className;
  const originalLabelAttributes = labelTarget
    ? captureAttributes(labelTarget, ["style", "role", "tabindex", "aria-label", "aria-hidden", LABEL_ATTRIBUTE])
    : null;
  const originalLabelStyle = captureStyle(labelTarget, ["visibility", "pointerEvents", "fontSize"]);
  let restored = false;
  let resizeObserver = null;
  let listeningToWindow = false;

  const clickHandler = (event) => {
    if (event?.isTrusted === false) return;
    onTrustedClick(event);
  };

  function sync() {
    if (restored || !isConnected(nativeNode)) return;
    if (slot) {
      const rect = readRect(slot.getBoundingClientRect?.());
      if (!rect) return;
      if (nativeNode.style) {
        nativeNode.style.position = "fixed";
        nativeNode.style.left = rect.left + "px";
        nativeNode.style.top = rect.top + "px";
        nativeNode.style.width = rect.width + "px";
        nativeNode.style.height = rect.height + "px";
        nativeNode.style.zIndex = String(Math.max(2147483004, numericStyleValue(windowLike, shell, "zIndex") + 1));
      }
      return;
    }
    const viewportWidth = Number(windowLike?.innerWidth)
      || Number(windowLike?.document?.documentElement?.clientWidth)
      || 1;
    const layout = resolveLayout(nativeNode.getBoundingClientRect?.(), viewportWidth);
    if (shell.style) {
      shell.style.left = layout.side === "left" ? layout.reserve + "px" : "0px";
      shell.style.right = layout.side === "right" ? layout.reserve + "px" : "0px";
    }
    shell.setAttribute?.(DOCK_SIDE_ATTRIBUTE, layout.side);
  }

  nativeNode.className = String(originalClassName || "")
    .split(/\s+/)
    .filter(Boolean)
    .concat(slot
      ? (hasClass(nativeNode, DOCK_CLASS) ? [] : [DOCK_CLASS])
      : (hasClass(nativeNode, CONTROL_CLASS) ? [] : [CONTROL_CLASS]))
    .join(" ");
  if (boundary) {
    boundary.className = String(originalBoundaryClass || "")
      .split(/\s+/)
      .filter(Boolean)
      .concat(hasClass(boundary, BOUNDARY_CLASS) ? [] : [BOUNDARY_CLASS])
      .join(" ");
    if (boundary.style) {
      boundary.style.zIndex = String(Math.max(2147483003, numericStyleValue(windowLike, shell, "zIndex") + 1));
      boundary.style.visibility = "hidden";
      boundary.style.pointerEvents = "none";
    }
  }
  if (labelTarget) {
    labelTarget.className = String(originalLabelClassName || "")
      .split(/\s+/)
      .filter(Boolean)
      .concat(hasClass(labelTarget, LABEL_CLASS) ? [] : [LABEL_CLASS])
      .join(" ");
    labelTarget.setAttribute?.(LABEL_ATTRIBUTE, "同步邮件");
    if (labelTarget.style) {
      labelTarget.style.visibility = "visible";
      labelTarget.style.pointerEvents = "auto";
    }
  }
  if (slot?.style) {
    slot.style.pointerEvents = "none";
  }
  if (nativeNode.style && slot) {
    nativeNode.style.visibility = "visible";
    nativeNode.style.pointerEvents = "auto";
  }
  nativeNode.addEventListener?.("click", clickHandler, {capture: true});
  windowLike?.addEventListener?.("resize", sync);
  listeningToWindow = Boolean(windowLike?.removeEventListener);

  const Observer = windowLike?.ResizeObserver || globalThis.ResizeObserver;
  if (Observer) {
    resizeObserver = new Observer(sync);
    resizeObserver.observe?.(nativeNode);
  }
  sync();

  return {
    sync,
    isConnected: () => isConnected(nativeNode),
    isUsable: () => !restored && isConnected(nativeNode) && (!slot || Boolean(boundary)),
    lastError: null,
    restore() {
      if (restored) return isConnected(nativeNode);
      restored = true;
      nativeNode.removeEventListener?.("click", clickHandler, {capture: true});
      resizeObserver?.disconnect?.();
      if (listeningToWindow) windowLike?.removeEventListener?.("resize", sync);
      nativeNode.className = originalClassName;
      restoreStyle(nativeNode, originalNativeStyle);
      restoreAttribute(nativeNode, "role", originalNativeAttributes.role);
      restoreAttribute(nativeNode, "tabindex", originalNativeAttributes.tabindex);
      restoreAttribute(nativeNode, "aria-label", originalNativeAttributes["aria-label"]);
      restoreAttribute(nativeNode, "aria-hidden", originalNativeAttributes["aria-hidden"]);
      if (labelTarget) {
        labelTarget.className = originalLabelClassName;
        restoreStyle(labelTarget, originalLabelStyle);
        restoreAttributes(labelTarget, originalLabelAttributes);
      }
      if (slot?.style) slot.style.pointerEvents = "";
      if (boundary) {
        boundary.className = originalBoundaryClass;
        restoreStyle(boundary, originalBoundaryStyle);
      }
      if (shell.style) {
        shell.style.left = originalShellLeft;
        shell.style.right = originalShellRight;
      }
      restoreAttribute(shell, "style", originalShellStyle);
      restoreAttribute(shell, DOCK_SIDE_ATTRIBUTE, originalDockSide);
      return isConnected(nativeNode);
    },
  };
}

globalThis.Fqmail.nativeCatalogDock = {mount: create, resolveLayout, findStackingBoundary};
})();
