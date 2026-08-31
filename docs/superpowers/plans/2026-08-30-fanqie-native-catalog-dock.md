# Fanqie Native Catalog Dock Implementation Plan（已废弃）

> 本文是 M1 历史计划，已由 `2026-08-30-fanqie-native-catalog-sync.md` 替代；不作为当前运行时实现依据。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the failed cross-region directory bridge with a reliable side dock that leaves the React-owned native Fanqie directory control in its original geometry and click path.

**Architecture:** A new `nativeCatalogDock` reads the native control's existing viewport rectangle, determines whether it belongs to the left or right side of the viewport, and offsets the whole mail shell away from that side. The native control is never moved, fixed, cloned, hidden, or clicked by script. The Outlook skin no longer owns a directory button or slot; the existing catalog controller starts from one trusted click listener on the native node.

**Tech Stack:** Chrome/Edge Manifest V3, classic content scripts, native JavaScript, DOM/CSS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-30-fanqie-native-catalog-dock-design.md`

## Global Constraints

- Work only in `D:\番茄`; this directory is not a Git repository, so replace commit steps with explicit verification checkpoints.
- Do not enter M2, M3, or M4.
- Never use Computer Use; real browser verification uses Browser/Chrome only after the user manually reloads the extension.
- Keep Manifest V3 permissions exactly `["storage"]`, matches exactly `["https://fanqienovel.com/reader/*"]`, and omit `host_permissions`.
- Do not add dependencies, network calls, hidden APIs, React internals,正文 extraction/copy/cache, synthetic `.click()`, or cloned directory controls.
- Preserve dynamic font rendering, reader transfer, progress, previous/next navigation, Alt+Shift+M, and reversible restore.

---

### Task 1: Define and test side-dock geometry

**Files:**
- Create: `src/core/native-catalog-dock.js`
- Create: `tests/native-catalog-dock.test.js`
- Delete after GREEN: `src/core/native-control-bridge.js`
- Delete after GREEN: `tests/native-control-bridge.test.js`

**Interfaces:**
- Produces: `Fqmail.nativeCatalogDock.resolveLayout(rect, viewportWidth, gap?) -> {side: "left" | "right", reserve: number}`.
- Produces: `Fqmail.nativeCatalogDock.mount({nativeNode, shell, windowLike, onTrustedClick}) -> {sync(), isConnected(), restore()}`.
- `mount` must keep `nativeNode.parentNode`, DOM order, and native geometry unchanged.

- [ ] **Step 1: Write RED tests for geometry and original-node preservation**

Add real-code assertions equivalent to:

```js
test("dock reserves the nearest viewport side without moving the native node", () => {
  const app = new Node();
  const toolbar = new Node(app);
  const nativeNode = new Node(toolbar);
  nativeNode.rect = {left: 24, top: 180, width: 64, height: 36, right: 88, bottom: 216};
  const shell = new Node();
  const originalParent = nativeNode.parentNode;
  const originalStyle = nativeNode.style.cssText;

  const dock = globalThis.Fqmail.nativeCatalogDock.mount({
    nativeNode,
    shell,
    windowLike: makeWindow({innerWidth: 1440}),
    onTrustedClick() {},
  });

  assert.equal(nativeNode.parentNode, originalParent);
  assert.equal(nativeNode.style.cssText, originalStyle);
  assert.equal(shell.style.left, "96px");
  assert.equal(shell.style.right, "0px");
  assert.equal(shell.getAttribute("data-fqmail-native-dock-side"), "left");
  dock.restore();
});

test("dock uses the right side for a right-edge native control", () => {
  const layout = globalThis.Fqmail.nativeCatalogDock.resolveLayout(
    {left: 1348, right: 1412, width: 64},
    1440,
    8,
  );
  assert.deepEqual(layout, {side: "right", reserve: 100});
});
```

- [ ] **Step 2: Run the focused test and verify the expected RED**

Run: `node --test tests/native-catalog-dock.test.js`

Expected: FAIL because `Fqmail.nativeCatalogDock` is undefined. A syntax/setup error is not an acceptable RED.

- [ ] **Step 3: Implement the minimal dock geometry**

Implement `resolveLayout` from the actual rectangle edges:

```js
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
```

`mount` must:

- save the shell's original `style`, `data-fqmail-native-dock-side`, and the native node's original class;
- add only `fqmail-native-catalog-control` to the native node;
- never write the native node's `style`, position, ARIA, role, or tabindex;
- write `shell.style.left/right` so the shell does not overlap the reserved side;
- observe the native node with `ResizeObserver` when available and listen for window resize;
- attach one capture-phase click listener that ignores only `event.isTrusted === false` and does not suppress propagation;
- restore all shell/class/listener/observer state idempotently.

- [ ] **Step 4: Add RED then GREEN tests for trusted click, resize, and restore**

The tests must prove:

```js
nativeNode.dispatch({type: "click", isTrusted: true});
nativeNode.dispatch({type: "click", isTrusted: false});
assert.equal(trustedClicks, 1);
assert.equal(nativeNode.parentNode, originalParent);
assert.equal(nativeNode.style.cssText, originalNativeStyle);

nativeNode.rect = {left: 1320, right: 1380, width: 60};
dock.sync();
assert.equal(shell.getAttribute("data-fqmail-native-dock-side"), "right");

assert.equal(dock.restore(), true);
assert.equal(shell.getAttribute("style"), originalShellStyle);
assert.equal(nativeNode.className, originalNativeClass);
```

Run after each RED/GREEN cycle: `node --test tests/native-catalog-dock.test.js`

- [ ] **Step 5: Remove the obsolete bridge files and checkpoint**

Delete `src/core/native-control-bridge.js` and `tests/native-control-bridge.test.js` only after the new focused test is GREEN.

Checkpoint command:

```powershell
rg -n "nativeControlBridge|native-control-bridge|position:fixed|opacity:0|catalogSlot" src tests manifest.json
```

Expected at this checkpoint: old bridge references may remain only in controller/manifest/skin files scheduled for Tasks 2–3; the deleted bridge implementation and tests must be absent.

---

### Task 2: Remove the fake directory slot from the Outlook skin

**Files:**
- Modify: `src/skins/outlook/index.js`
- Modify: `src/skins/outlook/styles.css`
- Modify: `tests/skin.test.js`
- Modify: `tests/catalog-style.test.js`

**Interfaces:**
- Consumes: native directory remains outside `.fqmail-shell` and is styled only through `.fqmail-native-catalog-control`.
- Produces: `skin.root`; no `skin.refs.catalogSlot`, no skin-owned “目录” element.

- [ ] **Step 1: Write RED skin structure tests**

Add assertions:

```js
const skin = globalThis.Fqmail.outlook.create({documentLike});
assert.equal(skin.refs.catalogSlot, undefined);
assert.equal(skin.root.textContent.includes("目录"), false);
assert.equal(skin.root.querySelector?.(".fqmail-catalog-slot"), null);
```

Add a CSS contract test that requires `.fqmail-native-catalog-control` to contain only appearance properties and rejects geometry/visibility manipulation:

```js
assert.doesNotMatch(css, /\.fqmail-native-catalog-control[^}]*position\s*:/s);
assert.doesNotMatch(css, /\.fqmail-native-catalog-control[^}]*(opacity|pointer-events|z-index)\s*:/s);
assert.doesNotMatch(css, /\.fqmail-catalog-slot/);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/skin.test.js tests/catalog-style.test.js`

Expected: FAIL because `catalogSlot` and `.fqmail-catalog-slot` still exist.

- [ ] **Step 3: Implement the minimal skin/CSS change**

- Remove `catalogSlot` creation, toolbar append, and refs exposure from `index.js`.
- Remove `.fqmail-catalog-slot` CSS.
- Keep `.fqmail-native-catalog-control` appearance-only: border, radius, colors, font, cursor, hover, and focus. Do not set display, position, dimensions, padding, margin, opacity, pointer-events, z-index, overflow, transform, contain, or clip-path.
- Keep status, previous/next, restore, and toggle controls unchanged.
- The shell remains `position: fixed; inset: 0`; inline `left/right` values supplied by the dock override the reserved side.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/skin.test.js tests/catalog-style.test.js`

Expected: PASS with no console warnings.

- [ ] **Step 5: Checkpoint the skin contract**

Run:

```powershell
rg -n "catalogSlot|fqmail-catalog-slot|目录" src/skins/outlook
```

Expected: no matches. The skin must not own a second directory label or element.

---

### Task 3: Integrate the dock into controller lifecycle and Manifest

**Files:**
- Modify: `src/core/controller.js`
- Modify: `manifest.json`
- Modify: `tests/native-catalog.test.js`
- Modify: `tests/controller.test.js`
- Modify: `tests/controller-reliability.test.js`
- Modify: `tests/manifest.test.js`
- Modify: `tests/content-script-scope.test.js`

**Interfaces:**
- Consumes: `Fqmail.nativeCatalogDock.mount({nativeNode, shell, windowLike, onTrustedClick})`.
- Preserves: `Fqmail.catalog.create(...)`, `loadCatalog()`, navigation, progress, restore, and SPA refresh contracts.

- [ ] **Step 1: Write RED controller integration tests**

Update the real native-catalog fixture to inject `nativeCatalogDock`, then assert:

```js
assert.equal(await controller.start(), true);
assert.equal(page.nativeItem.parentNode, page.toolbar);
assert.equal(skin.refs.catalogSlot, undefined);
assert.equal(page.nativeItem.style.cssText, originalNativeStyle);
assert.equal(skin.root.style.left, expectedReservedLeft);

page.nativeLabel.dispatchUserClick();
await flushPromises();
assert.equal(siteCatalogOpened, 1);
assert.equal(catalogLoads, 1);
assert.equal(skin.root.getAttribute("data-fqmail-state"), "success");
```

Update SPA tests to prove the first node's listener is removed and only the replacement node can start catalog loading. Update restore tests to prove shell offsets and native classes are restored before shell destruction.

- [ ] **Step 2: Run controller/native tests and verify RED**

Run:

```powershell
node --test tests/native-catalog.test.js tests/controller.test.js tests/controller-reliability.test.js
```

Expected: FAIL because controller still consumes `nativeControlBridge` and `catalogSlot`.

- [ ] **Step 3: Implement minimal controller integration**

Make these exact lifecycle changes:

```js
nativeCatalogDock = globalThis.Fqmail.nativeCatalogDock
```

- Rename `catalogBridge` to `catalogDock` and update cleanup variables consistently.
- Mount only when `catalogItem`, `nextSkin.root`, and `nativeCatalogDock.mount` exist.
- Call:

```js
nextCatalogDock = nativeCatalogDock.mount({
  nativeNode: catalogItem,
  shell: nextSkin.root,
  windowLike,
  onTrustedClick: () => {
    setStatus("loading", "正在读取章节");
    loadCatalog().catch(() => {});
  },
});
```

- Do not call `preventDefault`, `stopPropagation`, `.click()`, or any adapter catalog-open helper.
- On unmount, restore `catalogDock` before destroying the skin; combine its boolean restore result with reader restoration exactly as before.
- Keep missing-node status `未找到番茄原生目录按钮`.
- Keep `catalogController` creation and wait/parse flow unchanged.

- [ ] **Step 4: Replace the Manifest script and update scope tests**

Replace only:

```json
"src/core/native-control-bridge.js"
```

with:

```json
"src/core/native-catalog-dock.js"
```

Keep its position before `reader-transfer.js`, `catalog-controller.js`, skin, controller, and content scripts. Update Manifest and same-scope tests to require `Fqmail.nativeCatalogDock` and reject the old script/API.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
node --test tests/native-catalog-dock.test.js tests/native-catalog.test.js tests/controller.test.js tests/controller-reliability.test.js tests/manifest.test.js tests/content-script-scope.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 6: Checkpoint the integration contract**

Run:

```powershell
rg -n "nativeControlBridge|native-control-bridge|catalogSlot|fqmail-catalog-slot|openNativeCatalog|\.click\(\)" src tests manifest.json
```

Expected: no old bridge, slot, synthetic catalog helper, or zero-argument script click remains in the directory flow. Existing user-triggered chapter element handling may use references but must not reintroduce catalog synthetic click.

---

### Task 4: Full verification and handoff

**Files:**
- Modify if needed for accurate documentation only: `README.md`
- Verify: all `src/**/*.js`, `tests/**/*.test.js`, `manifest.json`

**Interfaces:**
- Produces: a locally verified M1 build ready for user reload; it does not produce real-browser success evidence.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: exit code 0, zero failed/cancelled tests. Report the exact pass count from this fresh run.

- [ ] **Step 2: Run JavaScript syntax checks**

```powershell
$files = Get-ChildItem -Recurse -File src -Filter *.js
foreach ($file in $files) {
  node --check $file.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Output ("node --check passed: " + $files.Count)
```

Expected: every file passes.

- [ ] **Step 3: Verify Manifest and security constraints**

```powershell
$m = Get-Content -Raw manifest.json | ConvertFrom-Json
if ($m.manifest_version -ne 3) { throw "manifest_version" }
if ($m.permissions.Count -ne 1 -or $m.permissions[0] -ne "storage") { throw "permissions" }
if ($null -ne $m.host_permissions) { throw "host_permissions" }
if ($m.content_scripts[0].matches[0] -ne "https://fanqienovel.com/reader/*") { throw "matches" }
rg -n -i "fetch\s*\(|XMLHttpRequest|WebSocket|cloneNode|muye-reader-content.*textContent|nativeControlBridge|native-control-bridge|catalogSlot|fqmail-catalog-slot" src manifest.json
```

Expected: Manifest assertions pass and `rg` returns no matches.

- [ ] **Step 4: Review the spec line by line**

Confirm in the final report:

- native node parent/order/geometry unchanged;
- shell reserves the nearest side instead of covering the native control;
- exactly one visible directory control and one trusted listener;
- no synthetic click, fixed projection, transparent hit target, clone, network, hidden API, or正文 cache;
- catalog wait/parser unchanged;
- SPA and restore tests pass;
- M2 was not started.

- [ ] **Step 5: Handoff for real Chrome verification**

Report “可重新加载扩展复验” and instruct the source task to have the user manually reload `D:\番茄`. The first real test is directory only:

1. Confirm the native directory entry remains visible in the exposed side rail.
2. Hover it and confirm the pointer/hover state.
3. Click once and confirm status changes from `正文已连接` to `正在读取章节`.
4. Confirm the native directory opens and the mail chapter list shows the actual count.

On the first failure, stop without editing code and return browser, URL, step, visible status, native-node visibility, and failure category. Do not claim Chrome or Edge passed from automated evidence.
