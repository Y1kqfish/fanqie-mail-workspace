# 番茄邮箱式阅读工作区 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reversible Manifest V3 Chrome/Edge extension that presents a Fanqie reader page as a three-column Outlook-style workspace without extracting or caching novel正文.

**Architecture:** Load small classic scripts in manifest order through the `Fqmail` namespace. The Fanqie adapter owns selectors and DOM parsing, core owns storage/transfer/controller behavior, and the Outlook skin only renders the shell and emits callbacks.

**Tech Stack:** Manifest V3, vanilla JavaScript, CSS, Node 24 `node:test`, no runtime dependencies and no network calls.

**Spec:** `docs/superpowers/specs/2026-08-28-fanqie-mail-workspace-design.md`

## Global Constraints

- Match only `https://fanqienovel.com/reader/*`.
- Never extract, reconstruct, cache, or persist chapter正文; move the original `.muye-reader-box` node in light DOM.
- Use native visible “目录”, “上一章”, and “下一章” controls; do not call unpublished APIs.
- All extension-owned CSS selectors begin with `fqmail-`; do not add broad global element selectors.
- Restore the exact original node position, original root style, and captured scroll positions.
- Store only enabled state, chapter read state, chapter progress, and UI settings in `browser.storage.local`/`chrome.storage.local`.
- Declare only the minimum `storage` permission; no host permissions or third-party network requests.

---

### Task 1: Add failing adapter and state tests

**Files:**
- Create: `tests/helpers/fake-dom.js`
- Create: `tests/fanqie-adapter.test.js`
- Create: `tests/state-key.test.js`
- Create: `package.json`

**Interfaces:**
- Tests expect `globalThis.Fqmail.fanqie.parseReaderSnapshot(documentLike)`.
- Tests expect `globalThis.Fqmail.fanqie.parseCatalog(documentLike)` and `chapterStateKey(kind, bookId, chapterId)`.

- [ ] **Step 1: Write the failing tests**

Use a small fixture document implementing `querySelector`, `querySelectorAll`, `textContent`, `classList`, `dataset`, `href`, and `click`, then assert that the adapter returns a book id, book title, chapter title, native previous/next buttons, and catalog entries keyed by `data-item-id` with `active`/`visited` flags. Assert that state keys encode book/chapter ids and progress rejects non-finite/out-of-range values.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- --test-name-pattern="Fanqie|state key"`

Expected: FAIL because the adapter and state modules do not exist yet, not because of a fixture syntax error.

- [ ] **Step 3: Keep the fixture independent of production code**

Implement only the selectors needed by the production parser in `tests/helpers/fake-dom.js`; do not add a general-purpose DOM implementation or a production dependency.

- [ ] **Step 4: Run the focused tests again**

Run: `npm test -- --test-name-pattern="Fanqie|state key"`

Expected: still FAIL with missing `Fqmail` APIs, establishing the red phase before implementation.

### Task 2: Implement Fanqie parser and compatibility primitives

**Files:**
- Create: `src/platform/browser.js`
- Create: `src/adapters/fanqie/selectors.js`
- Create: `src/adapters/fanqie/parser.js`
- Create: `src/adapters/fanqie/adapter.js`

**Interfaces:**
- Produces `Fqmail.platform.getStorageArea()` and `Fqmail.platform.onMessage()`.
- Produces `Fqmail.fanqie.matchesReaderPage(location)`, `getBookId(location)`, `parseReaderSnapshot(doc)`, `parseCatalog(doc)`, `findNativeButton(doc, label)`, `openNativeCatalog(doc)`, and `getReaderBox(doc)`.

- [ ] **Step 1: Implement only the selectors and pure parser needed by the red tests**

Read `.muye-reader-title`, limited book-name candidates, `.muye-reader-btns` controls, and `.chapter[data-item-id]`/`.chapter-text`. Never query `.muye-reader-content` for text.

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- --test-name-pattern="Fanqie|state key"`

Expected: PASS for all adapter, catalog, URL-key, and state-boundary tests.

- [ ] **Step 3: Add native-control helpers without adding UI behavior**

Return actual button/element references and click them only through the adapter. Expose no fetch, XMLHttpRequest, WebSocket, or URL-construction helper.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: PASS with zero failures.

### Task 3: Add storage and reversible reader transfer

**Files:**
- Create: `src/core/storage.js`
- Create: `src/core/reader-transfer.js`
- Create: `tests/reader-transfer.test.js`

**Interfaces:**
- Produces `Fqmail.storage.createStore(storageArea)` with `getSettings`, `setEnabled`, `getRead`, `setRead`, `getProgress`, and `setProgress`.
- Produces `Fqmail.transfer.mount({doc, box, pane})`, `restore()`, and `getProgress()`.

- [ ] **Step 1: Write the failing transfer tests**

Assert that mounting inserts a comment immediately before the original box and moves the same node to the pane; restoring puts the same node after the comment, removes the shell-owned marker state, and returns the saved scroll coordinates. Assert that progress is clamped to `0..1` and no正文 text is passed to storage.

- [ ] **Step 2: Run the transfer tests to verify red**

Run: `npm test -- --test-name-pattern="transfer|progress"`

Expected: FAIL because transfer and storage modules are not present.

- [ ] **Step 3: Implement minimal storage and transfer**

Use separate keys for settings, read status, and chapter progress. Capture and restore the original reader root `style` attribute and window/box scrolling. Use an internal `Comment` marker and an idempotent mount guard.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: PASS with zero failures.

### Task 4: Build the Outlook skin

**Files:**
- Create: `src/skins/outlook/index.js`
- Create: `src/skins/outlook/styles.css`

**Interfaces:**
- Produces `Fqmail.outlook.create({onToggle, onRestore, onPrev, onNext, onLoadCatalog, onChapterSelect})` returning `{root, refs, renderSnapshot, renderCatalog, renderMessage}` and `destroy()`.

- [ ] **Step 1: Add the skin interaction test**

Assert that the skin creates only `fqmail-`-prefixed extension nodes/classes, exposes toolbar actions, and forwards click callbacks without inspecting or copying the moved reader content.

- [ ] **Step 2: Run the skin test to verify red**

Run: `npm test -- --test-name-pattern="skin"`

Expected: FAIL because the Outlook skin does not exist.

- [ ] **Step 3: Implement the three-column light-DOM shell**

Create a blue header/search row, toolbar, left navigation, middle chapter list, and right reading pane. Render chapter title/flags only from adapter data. Style only `.fqmail-*` selectors and narrowly scoped `.fqmail-reader-pane .muye-reader-box` rules.

- [ ] **Step 4: Run all tests**

Run: `npm test`

Expected: PASS with zero failures.

### Task 5: Wire controller, background command, and manifest

**Files:**
- Create: `manifest.json`
- Create: `src/background.js`
- Create: `src/core/controller.js`
- Create: `src/content.js`

**Interfaces:**
- Content startup calls `Fqmail.controller.start()` only on the exact Fanqie reader match.
- Background command `toggle-skin` sends `{type: "fqmail:toggle"}` to the active tab.

- [ ] **Step 1: Add controller integration tests**

Assert that enabling mounts once, disabling restores once, native previous/next are proxied, and catalog loading uses the native目录 click before parsing chapter elements.

- [ ] **Step 2: Run integration tests to verify red**

Run: `npm test -- --test-name-pattern="controller|native"`

Expected: FAIL because controller and manifest wiring do not exist.

- [ ] **Step 3: Implement controller and background**

Load settings, mount the original box into the skin pane, wire scroll progress/read state, support `Alt+Shift+M` and the background command, reinitialize after URL/reader-box mutations, and keep restoration idempotent. Never fetch or persist正文.

- [ ] **Step 4: Add exact MV3 manifest**

Declare `manifest_version: 3`, `permissions: ["storage"]`, one exact content-script match, ordered scripts, one background service worker, and a `toggle-skin` command with `Alt+Shift+M`. Do not add `host_permissions`.

- [ ] **Step 5: Run all tests and static checks**

Run: `npm test`; then inspect `manifest.json` and run `rg -n "fetch|XMLHttpRequest|WebSocket|innerHTML|muye-reader-content|host_permissions" src manifest.json`.

Expected: tests pass; no network API,正文 text extraction, or host permissions are present. Any `innerHTML` match must be absent from implementation.

### Task 6: Document installation and hand verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Document Chrome/Edge unpacked loading**

Explain opening `chrome://extensions` or `edge://extensions`, enabling Developer mode, choosing “Load unpacked”, selecting `D:\番茄`, and reloading after edits.

- [ ] **Step 2: Document supported page and restore controls**

Describe `https://fanqienovel.com/reader/*`, `Alt+Shift+M`, toolbar restore, native目录 behavior, and the fact that a disabled skin restores the original reader.

- [ ] **Step 3: Document manual acceptance steps and known risks**

Include checks for native dynamic font rendering, full directory count, chapter navigation, selected/visited markers, scroll restore, refresh persistence, exact permission review, and site DOM changes.

- [ ] **Step 4: Run the final verification suite**

Run: `npm test`; `Get-Content -Raw manifest.json`; `rg -n "fetch|XMLHttpRequest|WebSocket|innerHTML|localStorage|sessionStorage|muye-reader-content" src manifest.json`.

Expected: exit code 0 for tests, only `storage` permission, and no正文 caching/extraction patterns. Report any manual-only checks as manual rather than claiming automation.
