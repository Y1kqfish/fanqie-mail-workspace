# Fanqie Mail M2 Outlook Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the extension shell as a high-fidelity Outlook-style workspace while freezing the unresolved native directory feature and preserving the proven reader/navigation/recovery base.

**Architecture:** The Outlook skin becomes a five-zone UI composed from measured dimensions, a small immutable token module, and seven vendored Microsoft Fluent SVG paths. Runtime directory orchestration is disabled by default but its parser/controller modules remain unchanged for later work. The current reader snapshot supplies the only chapter row until the directory feature is deliberately resumed.

**Tech Stack:** Chrome/Edge Manifest V3, classic content scripts, native JavaScript and CSS, Node built-in test runner, Microsoft Fluent UI System Icons SVG under MIT.

**Spec:** `docs/superpowers/specs/2026-08-30-fanqie-outlook-m2-design.md`

## Global Constraints

- Work only in `D:\番茄`; it is not a Git repository, so use verification checkpoints instead of commits.
- Do not repair, tune, or claim success for the directory feature in M2.
- Do not modify `src/core/catalog-controller.js`, Fanqie catalog selectors/parser behavior, or native directory event behavior.
- Runtime M2 must show no directory button, slot, rail, count, or fake chapter entries.
- Preserve the same native `.muye-reader-box`, dynamic font, navigation, progress, Alt+Shift+M, disable, and restore/reload fallback.
- Keep Manifest permissions exactly `["storage"]`, match exactly `https://fanqienovel.com/reader/*`, and omit `host_permissions`.
- No CDN, network call, hidden API,正文 extraction/copy/cache, `innerHTML`, runtime dependency, or unprefixed global CSS selector.
- Real browser work uses Browser/Chrome only after the user manually reloads; never use Computer Use.

---

### Task 1: Vendor Fluent SVG paths and license

**Files:**
- Create: `src/skins/outlook/fluent-icons.js`
- Create: `tests/fluent-icons.test.js`
- Create: `third_party/fluentui-system-icons/LICENSE`
- Create: `third_party/fluentui-system-icons/NOTICE.md`
- Modify: `manifest.json`
- Modify: `tests/manifest.test.js`
- Modify: `tests/content-script-scope.test.js`

**Interfaces:**
- Produces: `Fqmail.fluentIcons.create(documentLike, name, options?) -> SVGElement`.
- Supported names: `apps`, `mail`, `bookOpen`, `arrowPrevious`, `arrowNext`, `arrowReset`, `search`.
- Options: `{size?: number, title?: string}`; default size is 20.

- [ ] **Step 1: Write RED tests for the icon API and attribution**

Create `tests/fluent-icons.test.js` with assertions equivalent to:

```js
test("Fluent icons create accessible currentColor SVG without innerHTML", () => {
  const documentLike = makeSvgDocument();
  const icon = globalThis.Fqmail.fluentIcons.create(documentLike, "mail");
  assert.equal(icon.namespaceURI, "http://www.w3.org/2000/svg");
  assert.equal(icon.getAttribute("viewBox"), "0 0 20 20");
  assert.equal(icon.getAttribute("width"), "20");
  assert.equal(icon.getAttribute("height"), "20");
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  assert.equal(icon.children[0].getAttribute("fill"), "currentColor");
  assert.ok(icon.children[0].getAttribute("d").length > 20);
});

test("named icon uses a title instead of aria-hidden", () => {
  const icon = globalThis.Fqmail.fluentIcons.create(makeSvgDocument(), "search", {title: "搜索"});
  assert.equal(icon.getAttribute("role"), "img");
  assert.equal(icon.getAttribute("aria-label"), "搜索");
  assert.equal(icon.getAttribute("aria-hidden"), null);
});

test("unsupported Fluent icon fails closed", () => {
  assert.throws(() => globalThis.Fqmail.fluentIcons.create(makeSvgDocument(), "unknown"), /Unknown Fluent icon/);
});
```

Add tests that require the exact pinned commit and MIT text in `NOTICE.md`/`LICENSE`, and require `fluent-icons.js` to load before the Outlook skin in the Manifest.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
node --test tests/fluent-icons.test.js tests/manifest.test.js tests/content-script-scope.test.js
```

Expected: FAIL because `Fqmail.fluentIcons` and the attribution files do not exist.

- [ ] **Step 3: Create the exact icon map from the pinned Microsoft sources**

Use commit `4d685f77b2cb8f3f412a74ec8d920c8c91149528` and copy the single `<path d>` value verbatim from these files:

```text
apps          assets/Apps/SVG/ic_fluent_apps_20_regular.svg
mail          assets/Mail/SVG/ic_fluent_mail_20_filled.svg
bookOpen      assets/Book Open/SVG/ic_fluent_book_open_20_regular.svg
arrowPrevious assets/Arrow Previous/SVG/ic_fluent_arrow_previous_20_regular.svg
arrowNext     assets/Arrow Next/SVG/ic_fluent_arrow_next_20_regular.svg
arrowReset    assets/Arrow Reset/SVG/ic_fluent_arrow_reset_20_regular.svg
search        assets/Search/SVG/ic_fluent_search_20_regular.svg
```

Read them with this pinned command; do not depend on `main` after the files have been copied:

```powershell
$paths = @(
  "assets/Apps/SVG/ic_fluent_apps_20_regular.svg",
  "assets/Mail/SVG/ic_fluent_mail_20_filled.svg",
  "assets/Book Open/SVG/ic_fluent_book_open_20_regular.svg",
  "assets/Arrow Previous/SVG/ic_fluent_arrow_previous_20_regular.svg",
  "assets/Arrow Next/SVG/ic_fluent_arrow_next_20_regular.svg",
  "assets/Arrow Reset/SVG/ic_fluent_arrow_reset_20_regular.svg",
  "assets/Search/SVG/ic_fluent_search_20_regular.svg"
)
foreach ($path in $paths) {
  $encoded = [uri]::EscapeDataString($path).Replace("%2F", "/")
  gh api ("repos/microsoft/fluentui-system-icons/contents/" + $encoded + "?ref=4d685f77b2cb8f3f412a74ec8d920c8c91149528") `
    -H "Accept: application/vnd.github.raw+json"
}
```

Implement the module without `innerHTML`:

```js
(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};
  const SVG_NS = "http://www.w3.org/2000/svg";
  const PATHS = Object.freeze({
    apps: "M4.5 17.0009C3.7203 17.0009 3.07955 16.406 3.00687 15.6454L3 15.5009V4.50092C3 3.72122 3.59489 3.08047 4.35554 3.00778L4.5 3.00092H9C9.7797 3.00092 10.4204 3.5958 10.4931 4.35646L10.5 4.50092V4.75534L12.6886 2.48609C13.2276 1.92691 14.0959 1.8766 14.6956 2.34798L14.8118 2.44922L17.5694 5.17386C18.1219 5.71976 18.1614 6.5886 17.68 7.18505L17.5767 7.30053L15.266 9.50034L15.5 9.50092C16.2797 9.50092 16.9204 10.0958 16.9931 10.8565L17 11.0009V15.5009C17 16.2806 16.4051 16.9214 15.6445 16.994L15.5 17.0009H4.5ZM9.5 10.5009H4V15.5009C4 15.7157 4.13542 15.8988 4.32553 15.9696L4.41012 15.9929L4.5 16.0009H9.5V10.5009ZM15.5 10.5009H10.5V16.0009H15.5C15.7455 16.0009 15.9496 15.824 15.9919 15.5908L16 15.5009V11.0009C16 10.7555 15.8231 10.5513 15.5899 10.509L15.5 10.5009ZM10.5 7.71034V9.50034H12.29L10.5 7.71034ZM9 4.00092H4.5C4.25454 4.00092 4.05039 4.17779 4.00806 4.41104L4 4.50092V9.50092H9.5V4.50092C9.5 4.28614 9.36458 4.10299 9.17447 4.0322L9.08988 4.00897L9 4.00092ZM14.1222 3.17357C13.9396 2.99744 13.6692 2.98247 13.4768 3.12096L13.4086 3.18007L10.7926 5.89421C10.6271 6.06592 10.6086 6.32593 10.7356 6.51736L10.799 6.59475L13.4147 9.21046C13.5826 9.37838 13.8409 9.40226 14.0345 9.28022L14.1131 9.21898L16.8708 6.59231C17.0433 6.4177 17.061 6.14817 16.9248 5.95411L16.8665 5.88521L14.1222 3.17357Z",
    mail: "M18 7.373V14.5C18 15.8807 16.8807 17 15.5 17H4.5C3.11929 17 1.99992 15.8807 1.99992 14.5V7.373L9.74649 11.931C9.90297 12.023 10.097 12.023 10.2535 11.931L18 7.373ZM15.5 4C16.7871 4 17.847 4.9726 17.9848 6.22293L10 10.9199L2.01518 6.22293C2.15304 4.9726 3.21294 4 4.5 4H15.5Z",
    bookOpen: "M10 16.0002C9.54389 16.6073 8.8178 17 8 17H3.5C2.67157 17 2 16.3284 2 15.5V4.5C2 3.67157 2.67157 3 3.5 3H8C8.8178 3 9.54389 3.39267 10 3.99976C10.4561 3.39267 11.1822 3 12 3H16.5C17.3284 3 18 3.67157 18 4.5L18 15.5C18 16.3284 17.3284 17 16.5 17L12 17C11.1822 17 10.4561 16.6073 10 16.0002ZM3 4.5V15.5C3 15.7761 3.22386 16 3.5 16H8C8.82843 16 9.5 15.3284 9.5 14.5V5.5C9.5 4.67157 8.82843 4 8 4H3.5C3.22386 4 3 4.22386 3 4.5ZM10.5 14.5C10.5 15.3284 11.1716 16 12 16L16.5 16C16.7761 16 17 15.7761 17 15.5L17 4.5C17 4.22386 16.7761 4 16.5 4L12 4C11.1716 4 10.5 4.67157 10.5 5.5V14.5Z",
    arrowPrevious: "M6 5C5.75454 5 5.55039 5.17688 5.50806 5.41012L5.5 5.5V14.5C5.5 14.7761 5.72386 15 6 15C6.24546 15 6.44961 14.8231 6.49194 14.5899L6.5 14.5V5.5C6.5 5.22386 6.27614 5 6 5ZM13.8536 5.14645C13.68 4.97288 13.4106 4.9536 13.2157 5.08859L13.1464 5.14645L8.64645 9.64645C8.47288 9.82001 8.4536 10.0894 8.58859 10.2843L8.64645 10.3536L13.1464 14.8536C13.3417 15.0488 13.6583 15.0488 13.8536 14.8536C14.0271 14.68 14.0464 14.4106 13.9114 14.2157L13.8536 14.1464L9.70711 10L13.8536 5.85355C14.0488 5.65829 14.0488 5.34171 13.8536 5.14645Z",
    arrowNext: "M13.5 5C13.7455 5 13.9496 5.17688 13.9919 5.41012L14 5.5V14.5C14 14.7761 13.7761 15 13.5 15C13.2545 15 13.0504 14.8231 13.0081 14.5899L13 14.5V5.5C13 5.22386 13.2239 5 13.5 5ZM5.64645 5.14645C5.82001 4.97288 6.08944 4.9536 6.28431 5.08859L6.35355 5.14645L10.8536 9.64645C11.0271 9.82001 11.0464 10.0894 10.9114 10.2843L10.8536 10.3536L6.35355 14.8536C6.15829 15.0488 5.84171 15.0488 5.64645 14.8536C5.47288 14.68 5.4536 14.4106 5.58859 14.2157L5.64645 14.1464L9.79289 10L5.64645 5.85355C5.45118 5.65829 5.45118 5.34171 5.64645 5.14645Z",
    arrowReset: "M5.85355 2.64645C6.04882 2.84171 6.04882 3.15829 5.85355 3.35355L4.20711 5H11C14.3137 5 17 7.68629 17 11C17 14.3137 14.3137 17 11 17C7.68629 17 5 14.3137 5 11C5 10.7239 5.22386 10.5 5.5 10.5C5.77614 10.5 6 10.7239 6 11C6 13.7614 8.23858 16 11 16C13.7614 16 16 13.7614 16 11C16 8.23858 13.7614 6 11 6H4.20711L5.85355 7.64645C6.04882 7.84171 6.04882 8.15829 5.85355 8.35355C5.65829 8.54882 5.34171 8.54882 5.14645 8.35355L2.64645 5.85355C2.45118 5.65829 2.45118 5.34171 2.64645 5.14645L5.14645 2.64645C5.34171 2.45118 5.65829 2.45118 5.85355 2.64645Z",
    search: "M13.7291 14.4362C12.5924 15.411 11.115 16 9.5 16C5.91015 16 3 13.0899 3 9.5C3 5.91015 5.91015 3 9.5 3C13.0899 3 16 5.91015 16 9.5C16 11.115 15.411 12.5924 14.4361 13.7292L17.8535 17.1465C18.0487 17.3417 18.0487 17.6583 17.8535 17.8536C17.6799 18.0271 17.4105 18.0464 17.2156 17.9114L17.1464 17.8536L13.7291 14.4362ZM13.0196 13.7266C13.276 13.5128 13.5127 13.2761 13.7265 13.0197C14.5216 12.0659 15 10.8388 15 9.5C15 6.46243 12.5376 4 9.5 4C6.46243 4 4 6.46243 4 9.5C4 12.5376 6.46243 15 9.5 15C10.8388 15 12.0658 14.5217 13.0196 13.7266Z",
  });

  function create(documentLike, name, {size = 20, title = ""} = {}) {
    const pathData = PATHS[name];
    if (!pathData) throw new Error("Unknown Fluent icon: " + name);
    const svg = documentLike.createElementNS(SVG_NS, "svg");
    const path = documentLike.createElementNS(SVG_NS, "path");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("focusable", "false");
    svg.classList?.add?.("fqmail-icon");
    if (title) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", title);
    } else {
      svg.setAttribute("aria-hidden", "true");
    }
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "currentColor");
    svg.append(path);
    return svg;
  }

  globalThis.Fqmail.fluentIcons = {create};
})();
```

- [ ] **Step 4: Add exact MIT attribution**

Copy the pinned repository `LICENSE` verbatim to `third_party/fluentui-system-icons/LICENSE`. Write `NOTICE.md` with:

```markdown
# Microsoft Fluent UI System Icons

- Upstream: https://github.com/microsoft/fluentui-system-icons
- Pinned commit: 4d685f77b2cb8f3f412a74ec8d920c8c91149528
- License: MIT
- Vendored assets: seven 20px SVG path definitions used by the Outlook skin.

The SVG path data in `src/skins/outlook/fluent-icons.js` is derived from the pinned upstream files listed in the M2 design specification. See `LICENSE` in this directory.
```

- [ ] **Step 5: Load the icon module and verify GREEN**

Insert `src/skins/outlook/fluent-icons.js` in the Manifest after platform/core prerequisites and before `src/skins/outlook/index.js`. Update same-scope tests to require `Fqmail.fluentIcons.create` before the skin executes.

Run the focused command from Step 2. Expected: all focused tests PASS.

---

### Task 2: Add immutable Outlook visual tokens

**Files:**
- Create: `src/skins/outlook/tokens.js`
- Create: `tests/outlook-tokens.test.js`
- Modify: `manifest.json`
- Modify: `tests/manifest.test.js`
- Modify: `tests/content-script-scope.test.js`

**Interfaces:**
- Produces: frozen `Fqmail.outlookTokens` containing the exact names and values in the M2 spec.

- [ ] **Step 1: Write RED token tests**

```js
test("Outlook tokens expose the measured Fluent baseline and are frozen", () => {
  const t = globalThis.Fqmail.outlookTokens;
  assert.equal(t.colorBrand, "#0f6cbd");
  assert.equal(t.colorNeutralForeground1, "#242424");
  assert.equal(t.colorNeutralStroke1, "#d1d1d1");
  assert.equal(t.radiusSmall, "4px");
  assert.equal(t.commandHeight, "32px");
  assert.equal(Object.isFrozen(t), true);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/outlook-tokens.test.js tests/manifest.test.js`

Expected: FAIL because `Fqmail.outlookTokens` is undefined.

- [ ] **Step 3: Implement exact tokens and Manifest order**

Create an IIFE that assigns `Object.freeze({...})` with every token from the spec. Load `tokens.js` after `fluent-icons.js` and before `outlook/index.js`.

- [ ] **Step 4: Run and verify GREEN**

Run the Step 2 command. Expected: PASS.

---

### Task 3: Rebuild the Outlook skin as a five-zone workspace

**Files:**
- Modify: `src/skins/outlook/index.js`
- Modify: `tests/skin.test.js`
- Create: `tests/outlook-layout.test.js`

**Interfaces:**
- Consumes: `Fqmail.fluentIcons.create` and `Fqmail.outlookTokens`.
- Preserves: `create({documentLike,onToggle,onRestore,onPrev,onNext,onChapterSelect})`.
- Produces refs: `topbar`, `appRail`, `ribbon`, `commandBar`, `navigationPane`, `chapterListPane`, `chapterList`, `readerPane`, `readerMeta`, `prevButton`, `nextButton`, `restoreButton`, `toggleButton`, `status`, `searchInput`.
- Produces methods: `renderSnapshot`, `renderCatalog`, `renderMessage`, `setStatus`, `destroy`.

- [ ] **Step 1: Write RED semantic-structure tests**

Require one instance of each zone and no directory UI:

```js
const skin = globalThis.Fqmail.outlook.create({documentLike});
assert.equal(skin.root.querySelectorAll(".fqmail-topbar").length, 1);
assert.equal(skin.root.querySelectorAll(".fqmail-app-rail").length, 1);
assert.equal(skin.root.querySelectorAll(".fqmail-ribbon").length, 1);
assert.equal(skin.root.querySelectorAll(".fqmail-navigation-pane").length, 1);
assert.equal(skin.root.querySelectorAll(".fqmail-chapter-list-pane").length, 1);
assert.equal(skin.root.querySelectorAll(".fqmail-reader-pane").length, 1);
assert.equal(skin.root.textContent.includes("目录"), false);
assert.equal(skin.refs.searchInput.disabled, true);
assert.equal(skin.refs.searchInput.getAttribute("aria-disabled"), "true");
```

Verify application items are non-button state markers with `aria-current`, not fake controls. Verify real toolbar controls remain native buttons with visible text and one Fluent SVG child.

- [ ] **Step 2: Write RED current-chapter rendering tests**

```js
skin.renderSnapshot({
  bookTitle: "时停起手",
  chapterId: "chapter-5",
  chapterTitle: "第5章 之前你叫我小白",
  previousButton: {},
  nextButton: {},
}, true);

const rows = skin.refs.chapterList.querySelectorAll(".fqmail-chapter-item");
assert.equal(rows.length, 1);
assert.equal(rows[0].getAttribute("data-chapter-id"), "chapter-5");
assert.equal(rows[0].getAttribute("aria-selected"), "true");
assert.match(rows[0].textContent, /第5章 之前你叫我小白/);
assert.match(rows[0].textContent, /正在阅读/);
assert.match(skin.refs.navigationPane.textContent, /目录功能暂停/);
```

Call `renderSnapshot` with chapter 6 and prove the list still contains exactly one replaced row.

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test tests/skin.test.js tests/outlook-layout.test.js`

Expected: FAIL because the existing skin has only the old three-column shell and does not render the measured zones/current row.

- [ ] **Step 4: Implement semantic nodes and reusable icon buttons**

Use `makeNode` and a `makeIconButton` helper that prepends `Fqmail.fluentIcons.create` and appends a text span. Do not use `innerHTML`.

Required hierarchy:

```text
section.fqmail-shell
  header.fqmail-topbar
    div.fqmail-app-launcher-state
    div.fqmail-brand
    label.fqmail-search-shell
      Search icon
      input.fqmail-search-input[disabled]
    div.fqmail-local-status
  div.fqmail-workspace
    nav.fqmail-app-rail
    section.fqmail-main-surface
      section.fqmail-ribbon
        div.fqmail-context-row
        div.fqmail-command-bar
      div.fqmail-content-grid
        nav.fqmail-navigation-pane
        section.fqmail-chapter-list-pane
        main.fqmail-reader-pane
```

The app rail contains state elements, not clickable buttons. The command bar includes exactly previous, next, restore, toggle, and status.

- [ ] **Step 5: Implement current-only chapter rendering**

`renderSnapshot` must:

- update book title in context row and navigation pane;
- update reader title and current-navigation summary;
- clear and replace `chapterList` with exactly one `.fqmail-chapter-item` for `snapshot.chapterId/chapterTitle`;
- append visible “正在阅读” and “已读” text state;
- set `aria-selected=true` and `data-chapter-id`;
- keep previous/next disabled states tied to native button availability.

Keep `renderCatalog(entries)` for future compatibility but do not call it from runtime M2; if called in tests it may render supplied real entries and must never invent data.

- [ ] **Step 6: Run and verify GREEN**

Run the Step 3 command. Expected: PASS.

---

### Task 4: Freeze runtime directory orchestration without deleting its modules

**Files:**
- Modify: `src/core/controller.js`
- Modify: `tests/controller.test.js`
- Modify: `tests/controller-reliability.test.js`
- Modify: `tests/native-catalog.test.js`

**Interfaces:**
- Add controller option: `catalogEnabled = false`.
- Existing directory integration tests may explicitly pass `catalogEnabled: true` to preserve unit coverage.
- Runtime `content.js` passes no override, so M2 defaults to frozen directory behavior.

- [ ] **Step 1: Write RED tests for the frozen runtime default**

```js
const controller = createController({
  documentLike,
  adapter,
  skinFactory,
  nativeCatalogDock,
  catalogFactory,
  store,
});

assert.equal(await controller.start(), true);
assert.equal(nativeCatalogDock.mountCalls, 0);
assert.equal(catalogFactory.createCalls, 0);
assert.equal(skin.root.textContent.includes("目录"), false);
assert.equal(skin.refs.chapterList.children.length, 1);
assert.equal(skin.refs.status.textContent, "正文已连接");
```

Prove a click on the still-native Fanqie toolbar does not change M2 skin status or call the catalog controller. Preserve a separate test with `catalogEnabled: true` for the frozen underlying integration; do not change catalog wait/parser expectations.

- [ ] **Step 2: Run and verify RED**

Run:

```powershell
node --test tests/controller.test.js tests/controller-reliability.test.js tests/native-catalog.test.js
```

Expected: FAIL because the current controller always discovers/mounts the native directory dock.

- [ ] **Step 3: Add the minimal capability gate**

Add `catalogEnabled = false` to `createController` arguments. Guard only these operations:

- native catalog discovery;
- catalog controller creation;
- native catalog dock mount;
- directory loading callbacks and directory-specific missing-button error state.

When false, normal mount must finish with `setStatus("ready", "正文已连接")` and render the current snapshot. Do not edit `catalog-controller.js`, adapter catalog parsing, wait logic, storage batch reads, or directory selectors.

When true, keep current behavior for unit coverage. Do not expose a runtime UI control that toggles the flag.

- [ ] **Step 4: Run and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Static checkpoint**

Run:

```powershell
rg -n "目录" src/skins/outlook src/content.js
```

Expected: the only M2 UI occurrence is the explicit disabled-search explanation “目录功能暂停”; no directory button, slot, dock region, count, or action label exists.

---

### Task 5: Implement measured Outlook CSS and responsive contracts

**Files:**
- Replace focused sections in: `src/skins/outlook/styles.css`
- Create: `tests/outlook-responsive.test.js`
- Modify: `tests/catalog-style.test.js`

**Interfaces:**
- Consumes the exact class hierarchy from Task 3.
- Produces measured desktop rules and two media-query ranges.

- [ ] **Step 1: Write RED CSS contract tests**

Tests must parse the CSS text and require these exact contracts:

```js
assert.match(css, /\.fqmail-topbar\s*\{[^}]*height:\s*48px/s);
assert.match(css, /\.fqmail-app-rail\s*\{[^}]*width:\s*40px/s);
assert.match(css, /\.fqmail-ribbon\s*\{[^}]*grid-template-rows:\s*37px\s+40px/s);
assert.match(css, /\.fqmail-content-grid\s*\{[^}]*grid-template-columns:\s*188px\s+351px\s+minmax\(0,\s*1fr\)/s);
assert.match(css, /\.fqmail-search-shell\s*\{[^}]*width:\s*350px[^}]*height:\s*32px[^}]*border-radius:\s*4px/s);
assert.match(css, /\.fqmail-chapter-list-pane\s*\{[^}]*box-shadow:/s);
assert.match(css, /@media\s*\(max-width:\s*1279px\)/);
assert.match(css, /@media\s*\(max-width:\s*719px\)/);
```

Reject global selectors and reject `.fqmail-catalog-slot`, `.fqmail-native-catalog-control`, or a directory-specific dock rule in the M2 skin CSS.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/outlook-responsive.test.js tests/catalog-style.test.js`

Expected: FAIL because the old CSS uses 56/44px rows and 220/310px columns.

- [ ] **Step 3: Implement desktop visual baseline**

Use exact dimensions and tokens:

- shell: fixed inset, Segoe UI / Microsoft YaHei UI, 14px, `#242424`;
- topbar 48px and `#0f6cbd`;
- workspace columns `40px minmax(0,1fr)`;
- main surface rows `77px minmax(0,1fr)`;
- ribbon rows `37px 40px`;
- content columns `188px 351px minmax(0,1fr)`;
- command buttons 32px high, 4px radius, clear hover/focus/disabled;
- search 350×32px and visibly disabled;
- chapter list 4px top radius and Outlook-measured shadow `rgba(0,0,0,.133) 0 1.6px 3.6px, rgba(0,0,0,.11) 0 .3px .9px`;
- reader pane retains scrolling and native reader box.

- [ ] **Step 4: Implement responsive rules**

At `max-width:1279px`:

- hide `.fqmail-app-rail` and change workspace to one column;
- set content columns to `160px 300px minmax(0,1fr)`;
- at `max-width:959px`, use `160px 260px minmax(0,1fr)`;
- preserve command labels and ellipsize only status/context text.

At `max-width:719px`:

- hide disabled search and app rail;
- keep topbar 48px;
- make command bar horizontally scrollable with `white-space:nowrap`;
- use content rows `auto minmax(180px,34vh) minmax(50vh,1fr)` and one column;
- keep restore button reachable and status non-zero-width.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: PASS.

---

### Task 6: Documentation, full verification, and real-browser handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/product/fanqie-mail-prd.md`
- Verify: all `src/**/*.js`, tests, `manifest.json`, and third-party notice.

**Interfaces:**
- Produces a locally verified M2 build; does not produce Chrome/Edge success evidence.

- [ ] **Step 1: Update documentation without rewriting product history**

Record:

- M2 five-zone Outlook layout and breakpoints;
- Fluent icon source, pinned commit, and MIT attribution path;
- directory is paused and absent from M2 UI;
- only current chapter appears until directory work resumes;
- supported real actions remain previous, next, restore, disable, progress, and shortcut.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Expected: exit 0 and zero failed/cancelled tests. Report the exact pass count from this fresh run.

- [ ] **Step 3: Run all source syntax checks**

```powershell
$files = Get-ChildItem -Recurse -File src -Filter *.js
foreach ($file in $files) {
  node --check $file.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Write-Output ("node --check passed: " + $files.Count)
```

- [ ] **Step 4: Run Manifest and security scans**

```powershell
$m = Get-Content -Raw manifest.json | ConvertFrom-Json
if ($m.manifest_version -ne 3) { throw "manifest_version" }
if ($m.permissions.Count -ne 1 -or $m.permissions[0] -ne "storage") { throw "permissions" }
if ($null -ne $m.host_permissions) { throw "host_permissions" }
if ($m.content_scripts[0].matches[0] -ne "https://fanqienovel.com/reader/*") { throw "matches" }
rg -n -i "fetch\s*\(|XMLHttpRequest|WebSocket|innerHTML|cloneNode|muye-reader-content.*textContent|https?://.*\.svg" src manifest.json
rg -n "(^|\})\s*(button|input|p|h1|h2|h3|body|html)(\s|\{|,)" src --glob "*.css"
```

Expected: Manifest assertions pass and both scans return no matches.

- [ ] **Step 5: Review M2 scope against the spec**

Final report must explicitly confirm:

- 48/40/77/188/351 desktop structure;
- disabled 350×32 search with visible reason;
- exactly one real current-chapter row;
- no directory button/action/count and runtime catalog default frozen;
- seven pinned Fluent icon paths plus MIT attribution;
- 1279/959/719 responsive rules;
- navigation, progress, shortcut, restore, and native font regressions pass;
- M3/M4 were not started.

- [ ] **Step 6: Handoff for manual reload and Browser/Chrome verification**

Report “可重新加载扩展复验”. Ask the user to reload `D:\番茄`, refresh the real reader page, and verify one width at a time in this order: 2560, 1440, 1280, 960, 720.

For each width capture only non-sensitive layout evidence: zone rectangles, button labels/states, current chapter title, shell count, and reader font continuity. Do not capture Cookie, account data, mail data,正文 text, storage values, or hidden APIs. On the first failure, stop without code changes and submit a structured layout/state report. Automated tests are not real-browser evidence.
