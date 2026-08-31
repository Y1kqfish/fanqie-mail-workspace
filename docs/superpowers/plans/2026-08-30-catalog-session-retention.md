# Catalog Session Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development`, `superpowers:systematic-debugging`, and `superpowers:verification-before-completion`. This project is not a Git repository; do not initialize Git, create a worktree, or commit.

**Goal:** Preserve a verified chapter catalog across same-tab chapter navigation and reloads using tab-isolated `storage.session` metadata, without storing novel正文.

**Architecture:** Keep the current-page catalog in memory for SPA remounts and add a small background-owned session store keyed by `sender.tab.id`. Replace the old single-key local handoff as a runtime source, while retaining only best-effort cleanup of its deprecated key. Make identity resolution return an unknown book when no reliable book identity exists, and let verified catalog membership support recovery.

**Tech Stack:** MV3 classic content scripts, browser/chrome runtime messaging, `storage.session` with `storage.local` compatibility fallback only for capability detection, Node built-in test runner, fake DOM/runtime fixtures.

**Spec:** `docs/superpowers/plans/2026-08-30-catalog-session-retention-design.md`

## Global Constraints

- Only modify `D:\番茄`; preserve existing user changes.
- Do not use Computer Use or operate a real browser during implementation.
- Keep Manifest permission exactly `storage`, existing reader/page matches, and no `host_permissions`.
- Do not add fetch, XMLHttpRequest, WebSocket, hidden APIs, runtime dependencies, or正文 extraction/cache.
- Do not modify Outlook visual structure, native directory selector/parser/waiter, reader transfer, dynamic font handling, or chapter button semantics.
- All behavior changes use RED → expected failure → minimal GREEN → focused regression.
- The project is not a Git repository; use test checkpoints instead of commits.

## Task 1: Identity normalization

**Files:**
- Modify: `src/adapters/fanqie/parser.js`
- Test: `tests/fanqie-adapter.test.js`

- [x] Add RED fixtures for missing book selector and page link, changing `document.title`, relative/absolute `/page/<digits>` links, title suffixes, and current chapter title removal. Assert unknown book is empty rather than `title:unknown` or the chapter ID.
- [x] Run the focused adapter tests and confirm the failure is the old book-ID derivation.
- [x] Implement reliable title normalization and page-link parsing with strict numeric IDs.
- [x] Re-run focused adapter tests and preserve existing chapter/button/catalog tests.

## Task 2: Background tab session store

**Files:**
- Modify: `src/background.js`
- Modify: `src/platform/browser.js`
- Create: `src/core/catalog-session-client.js`
- Test: `tests/catalog-session.test.js`
- Test: `tests/background-session.test.js`

- [x] Add RED tests for two sender tabs, worker recreation over a shared `storage.session` substitute, top-frame/source validation, invalid metadata, 10000-entry and 4 MiB limits, and clear-on-tab removal.
- [x] Run the focused tests and confirm missing session API/message handlers fail.
- [x] Implement a background message handler that derives tab ID from `sender.tab.id`, validates reader URL/top frame, stores one record per tab, and registers `tabs.onRemoved` cleanup when available.
- [x] Implement the content-side client with `save`, repeatable `restore`, and `clear`; fail closed when the background session capability is absent, with shared storage substitutes used only by tests and never a process-global source of truth.
- [x] Re-run focused session tests.

## Task 3: Controller session integration

**Files:**
- Modify: `src/core/controller.js`
- Modify: `manifest.json`
- Test: `tests/controller-session.test.js`

- [x] Add RED tests using two document/controller harnesses sharing a background session substitute: successful native/page result restores after full navigation; same-book unknown-ID membership restores; wrong chapter/book does not destroy stored data; save failure preserves old list; restore is repeatable.
- [x] Run focused tests and confirm the current local handoff is single-key, one-shot, and cannot satisfy the new cases.
- [x] Replace runtime `catalogHandoffStore` use with `catalogSession` client calls. Save only after complete verified entries; restore before current one-row fallback can overwrite the skin; clear on book change, disable/restore, invalid page, or explicit clear.
- [x] Await progress/read persistence before validated href navigation. Keep current `nativeLayoutActive` observer guard and native sync lifecycle unchanged.
- [x] Re-run controller/session tests and existing navigation/recovery tests.

## Task 4: Session and catalog lifecycle regressions

**Files:**
- Modify: `src/core/catalog-controller.js` only if needed for explicit session handoff, otherwise leave unchanged.
- Modify: `tests/m3-chapter-workflow.test.js`
- Modify: `tests/catalog-handoff.test.js` only to assert deprecated runtime path is unused.

- [x] Add RED/GREEN coverage for same-tab repeat restore, SPA remount, refresh/history navigation, delayed callbacks, stale generation, locked chapters, 1087/1501/5000 ordering, and one `getReadMany` call.
- [x] Verify sync failure keeps old rows and session; success atomically replaces session; invalid current chapter does not delete a valid stored session.
- [x] Confirm old `fqmail:catalog-handoff` is not read for runtime recovery and cleanup never calls `storage.clear()`.

## Task 5: Documentation and final verification

**Files:**
- Modify: `README.md`
- Modify: `docs/product/fanqie-mail-prd.md`
- Modify: `docs/superpowers/specs/2026-08-30-fanqie-native-catalog-sync-design.md`

- [x] Document tab-isolated session metadata, immediate lifecycle cleanup, no正文 storage, and M4 browser boundaries.
- [x] Run focused tests, then fresh `npm test` and record the exact count.
- [x] Run `node --check` on every `src/**/*.js` and record the exact count.
- [x] Parse Manifest and assert only `storage`, exact reader/page matches, no `host_permissions`.
- [x] Scan for network APIs,正文 copy/cache, broad CSS, synthetic catalog clicks, deprecated runtime handoff reads, and accidental `storage.clear()`.
- [x] Confirm no project Node test process remains; do not stop unrelated processes.
- [x] Deliver local evidence and a manual reload checklist. Do not claim real Chrome/Edge success.
