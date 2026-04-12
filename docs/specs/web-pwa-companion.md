# Web/PWA Companion MVP

## Goal

Define the minimum Web/PWA companion that moves Astra toward **“usable on any device”** without pretending that a browser tab can replace extension-only page injection.

The Web/PWA companion should give users a real Astra entrypoint on any modern device for **text, imported content, account access, and synced assets**, while the extension remains the product surface for **live webpage mutation and browser-integrated workflows**.

## Product Positioning

**What this is:**
- A cross-device Astra workspace that runs in any supported browser.
- A companion for translation tasks that do **not** require extension APIs or content-script DOM control.
- The fastest path to a credible mobile and non-extension Astra experience.

**What this is not:**
- A replacement for the extension’s live webpage translation model.
- A claim that Astra can inject translations into arbitrary pages on iPhone/Android browsers.
- A shortcut around the support-matrix and sync/device workstreams.

## MVP Outcome

A signed-in user should be able to open Astra on desktop or mobile web and do the following without installing the extension:
- translate pasted text
- translate imported files
- access Astra account/session/quota state
- view synced language assets once sync-backed endpoints exist

The extension should remain the required surface for:
- live page translation
- hover translation
- selection toolbar actions
- input-box translation/mutation
- live subtitle overlays on third-party sites
- browser-integrated commands, menus, badges, and frame coordination

## Supported Inputs

### P0 inputs for first usable release

1. **Text workspace**
   - paste or type text
   - choose target language
   - run `translate`, `explain`, or `custom` tasks
   - copy/export result

2. **PDF upload**
   - upload local PDF
   - extract text blocks and render a read-only bilingual reader
   - reuse the current PDF reader pattern, but without extension runtime messaging

3. **EPUB upload**
   - upload local EPUB
   - translate chapter paragraphs in a reader-style view

4. **Subtitle/document upload**
   - support current subtitle/document file set already handled by `src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx`
   - formats: `.srt`, `.vtt`, `.ass`, `.ssa`, `.md`, `.txt`, `.html`
   - export bilingual output where applicable

5. **Account workspace**
   - sign in / sign out
   - show plan, entitlements, quota, recent usage
   - prefer a single continuity/account summary read (`GET /v1/account/summary`) and keep legacy account/usage/device fanout only as rollout fallback
   - expose continuity cloud export + cloud-data-delete lifecycle controls/status for synced collections
   - expose manual continuity sync repair (`POST /v1/sync/repair`) for recovery after `CURSOR_EXPIRED` or drift
   - open billing flows

### Later-phase input after core stability

6. **URL import (read-only article mode)**
   - paste a URL into Astra
   - Astra fetches/imports readable content into its own workspace
   - Astra translates the imported content in a controlled reader view

Important boundary: **URL import is not live page injection.** It is an Astra-owned rendering path, not mutation of the original site DOM.

## Explicit Non-Supported Inputs for MVP

The Web/PWA companion must not claim support for:
- arbitrary in-page translation of the current browser tab
- DOM injection into third-party pages
- extension-equivalent selection/hover/input overlays
- live YouTube or streaming-site subtitle overlays
- meeting caption interception
- browser context menus, commands, omnibox, badges, or tab/frame orchestration
- OCR/image translation as a core MVP promise
- offline translation

## Reusable Layers From the Current Codebase

These layers are good reuse candidates because they are already domain-oriented and mostly independent of content-script page mutation.

| Layer | Current files | Reuse note |
| --- | --- | --- |
| Core product/config schemas | `src/types/config.ts`, `src/types/auth.ts`, `src/types/messages.ts`, `src/types/translation.ts` | Keep as the canonical shared contracts across extension, web, and server. |
| Astra auth/account clients | `src/utils/astra/auth.ts`, `src/utils/astra/account.ts` | Already speak the Astra session/account/billing APIs over HTTP; portable to web with minimal change. |
| Provider routing and relay transport | `src/utils/providers/router.ts`, `src/utils/providers/relay.ts`, `src/utils/providers/types.ts` | Keep the provider abstractions, but the PWA should prefer Astra-managed relay flows instead of extension messaging. |
| Translation batching/orchestration | `src/utils/translate/translate.ts` | Reuse the batching/concurrency/cache logic, but extract the extension-specific transport dependency. |
| Translation cache | `src/utils/cache/translation-cache.ts` | Already browser-friendly via Dexie/IndexedDB; strong candidate for direct reuse in the PWA. |
| Local asset schemas and store logic | `src/utils/storage/config.ts`, `src/utils/storage/reading-history.ts`, `src/utils/storage/study-progress.ts`, `src/utils/storage/translation-usage.ts`, `src/utils/storage/vocabulary.ts`, `src/utils/storage/page-digests.ts` | Reuse schemas/domain behavior, but replace `browser.storage.local` with a host storage adapter. |
| File-reader UX patterns | `src/entrypoints/pdf-reader/*`, `src/entrypoints/epub-reader/*`, `src/entrypoints/subtitle-reader/*` | Good MVP seeds because they already operate in Astra-owned readers rather than injected third-party DOM. |

## Extension-Bound Layers

These layers are fundamentally tied to extension APIs, live tab state, or DOM mutation inside third-party pages.

| Layer | Current files | Why it stays extension-bound |
| --- | --- | --- |
| Background runtime bridge | `src/entrypoints/background/index.ts`, `src/entrypoints/background/frame-coordinator.ts` | Depends on runtime messaging, tabs, frames, menus, commands, alarms, omnibox, badges. |
| Extension message transport | `src/utils/extension/messages.ts` | Wraps `browser.runtime.sendMessage` / `browser.tabs.sendMessage`; not portable to plain web. |
| Content-script entrypoint | `src/entrypoints/content/index.tsx` | Lives inside third-party pages and coordinates automation, storage listeners, and injected UI. |
| Page translation/injection | `src/entrypoints/content/page-translate.ts`, `src/utils/dom/inject.ts`, `src/utils/dom/extraction.ts`, `src/utils/dom/traversal.ts` | Assumes direct access to page DOM, block extraction, mutation observers, viewport observers, and injection markers. |
| Inline page UI | `src/entrypoints/content/components/FloatBall.tsx`, `HoverTranslate.tsx`, `InputTranslate.tsx`, `SelectionToolbar.tsx` | These are page overlays tied to selection state, editable fields, hover targets, and host DOM. |
| Site/video/meeting adapters | `src/entrypoints/content/video-platforms/*`, `subtitle-translate.ts`, `meeting-captions.ts` | Depend on site-specific DOM hooks and live playback/caption surfaces. |

## Architectural Direction

The MVP should not fork Astra into “extension logic” and “web logic” arbitrarily. It should instead split the codebase into:

1. **Shared domain/core**
   - types
   - auth/account API clients
   - provider contracts
   - translation batching
   - cache
   - vocabulary/history/progress domain logic

2. **Host adapters**
   - extension host implementation
   - web/PWA host implementation

3. **Host-specific surfaces**
   - extension page injection and browser integration
   - web/PWA text/file/url workspaces

## Required Host Adapters

The current repo already shows the right seams, but several modules still call extension APIs directly. The Web/PWA effort should introduce explicit adapters at those seams.

### 1. Translation transport adapter

**Why:** `src/utils/translate/translate.ts` currently routes translation through `requestTranslationBatch()` in `src/utils/extension/messages.ts`.

**Extension implementation:**
- send `runtime/translate-batch` to the background script

**Web/PWA implementation:**
- call Astra relay/account APIs directly over HTTP
- optionally reuse provider router logic, but MVP should default to Astra-managed relay usage

### 2. Session adapter

**Why:** the extension stores `AstraSession` in `src/utils/storage/auth.ts` via `browser.storage.local`.

**Extension implementation:**
- `browser.storage.local`
- background bootstrapping may create anonymous sessions on install

**Web/PWA implementation:**
- persistent web storage for session snapshot
- foreground refresh using `GET /v1/auth/session`
- explicit revoke on sign-out using `DELETE /v1/auth/session`

### 3. Config and local-asset storage adapter

**Why:** config, vocabulary, history, study progress, usage, and digests currently assume `browser.storage.local`.

**Extension implementation:**
- existing storage modules backed by `browser.storage.local`

**Web/PWA implementation:**
- IndexedDB/local storage-backed equivalents
- same schema shapes where practical
- no dependency on extension storage APIs

### 4. Capability adapter

**Why:** the UI must know whether the current host can do page injection, active-tab state, browser commands, or file import.

**Extension host capabilities:**
- active tab
- content commands
- page state
- site rules against live sites
- browser commands / menus / badges

**Web/PWA host capabilities:**
- text workspace
- local file import
- URL import into Astra-owned reader
- installable PWA shell
- no active-tab or live page control

### 5. Content-source adapters

The PWA should treat inputs as adapters rather than one giant feature:
- `TextInputAdapter`
- `PdfInputAdapter`
- `EpubInputAdapter`
- `SubtitleDocumentInputAdapter`
- `UrlImportAdapter`

This keeps the MVP additive and avoids mixing file-reader work with extension injection work.

## Auth and Session Model

The Web/PWA companion should reuse the **Astra-managed auth/relay model** already defined in `docs/adr/0002-astra-managed-auth-relay.md` and implemented in:
- `src/utils/astra/auth.ts`
- `src/utils/astra/account.ts`
- `server/index.ts`
- `server/auth.ts`

### MVP session rules

1. **Primary model: signed-in Astra session**
   - create session with `POST /v1/auth/session`
   - refresh/validate with `GET /v1/auth/session`
   - revoke with `DELETE /v1/auth/session`
   - preserve/reuse the same first-party `Idempotency-Key` when sign-in gets a guarded `503` with `x-astra-platform-fallback-reason: mirror_back_commit_unknown`
   - treat the returned `relayBaseURL` / front-door as authoritative instead of assuming direct Node ownership

2. **Server/Worker control-plane remains the source of truth for**
   - plan
   - provider entitlements
   - quota
   - usage snapshot
   - billing links
   - continuity export/delete job status

3. **Client stores a local session snapshot for resume**
   - same `AstraSession` shape as extension
   - refreshed on app boot and foreground resume
   - cleared locally if refresh fails or revoke succeeds

4. **Translation uses the Astra session token directly**
   - PWA sends the bearer token to the relay-backed translate path
   - no provider API keys should be required for normal consumer use

5. **Continuity lifecycle controls stay cloud-only**
   - export/download applies only to continuity cloud data (`config`, `vocabulary`, optional behavioral collections, study progress)
   - cloud delete schedules collection-scoped deletion and propagates through normal sync semantics rather than trying to mutate every device locally
   - provider secrets, raw import artifacts, and full account closure remain out of scope for the Web/PWA account console in this phase

6. **Anonymous/guest sessions are optional, not required for MVP acceptance**
   - the repo has `/v1/auth/anonymous` for extension bootstrapping
   - the PWA should not depend on anonymous mode to justify cross-device continuity
   - if enabled later, it should be clearly framed as trial access, not durable account continuity
   - mobile-web availability of auth/account routes must not be reinterpreted as full native mobile support or iOS-shell parity

## Persistence Expectations

This spec intentionally separates **local persistence** from **cross-device persistence**.

### Local persistence expected in the PWA

The PWA should persist locally:
- session snapshot
- local config/preferences
- translation cache
- recent drafts / last-used target language
- imported file working state when feasible
- local diagnostics/usage views needed for the current device session

### Cross-device persistence expected once sync endpoints exist

The PWA should consume cloud-backed collections for:
- config
- vocabulary
- reading history
- study progress

However:
- the detailed sync contract, merge rules, device registry, and privacy defaults belong to the separate sync/device specs
- this document only requires that the PWA be built to plug into those collections once available

### What should remain local-only in MVP

The PWA should **not** promise cross-device sync for:
- translation cache contents
- raw uploaded file contents
- temporary drafts
- transient reader state unless a later sync spec explicitly adds it
- local telemetry/debug logs

### Important current-code constraint

`src/utils/storage/config-sync.ts` is a **backup/import/export utility**, not the cloud sync model. The PWA may reuse its import/export ideas, but must not treat it as the sync architecture.

## MVP Surface Definition

### Included

- responsive web app shell that can be installed as a PWA
- authenticated account/session flow
- quota/usage/billing view
- text translation workspace
- PDF upload reader
- EPUB upload reader
- subtitle/document upload translator
- vocabulary/history/progress views once backed by sync-ready APIs
- clear desktop handoff to “open in extension” where extension-only capabilities are needed

### Excluded

- tab-aware popup replacement
- extension options replacement
- full parity with content-script automation
- browser-managed site rules that mutate live webpages
- background translation of the active tab
- true multi-device sync implementation details
- device-management UX beyond whatever the separate device spec defines

## Rollout Phases

### Phase 0 — Shared-layer extraction

Goal:
- isolate shared contracts from extension transport/storage assumptions

Deliverables:
- translation transport adapter seam
- session/config/storage adapter seams
- capability model for extension vs web hosts
- extracted reader-domain components where possible

### Phase 1 — PWA core launch

Goal:
- make Astra usable on any modern device for text + account workflows

Scope:
- sign in/out
- account/quota/billing
- text translation workspace
- installable PWA shell
- local session persistence

Success bar:
- a mobile or desktop web user can translate text and manage their Astra account without the extension

### Phase 2 — File-based companion

Goal:
- bring Astra’s strongest non-injection workflows to the web

Scope:
- PDF upload
- EPUB upload
- subtitle/document upload + export
- reuse current reader/translator flows through host adapters

Success bar:
- the PWA becomes a credible cross-device reading/translation entrypoint, not just a login shell

### Phase 3 — URL import and synced assets

Goal:
- connect the PWA to the broader Astra account system

Scope:
- read-only URL import
- vocabulary/history/progress views backed by sync-ready server collections
- extension handoff for tasks that exceed web capabilities

Success bar:
- users can resume Astra on another device for supported input types without installing the extension first

### Phase 5 Web cloud-console completion snapshot (2026-04-11)

Web now includes the control-plane surfaces that were previously tracked as roadmap gaps:

- **Asset detail pages** (`/assets`)
  - local import library detail views
  - cloud reading-history / study-progress / vocabulary detail views
  - queue failure detail rows for import operations
- **Queue-driven status surfaces** (account + assets)
  - Cloudflare import backlog (`queued`, `failed`, `dead-lettered`, `oldestQueuedAgeMs`)
  - recent failure visibility with route/error/attempt metadata
  - operator replay controls (token-gated, dry-run + replay)
- **Richer sync-health control surfaces** (account)
  - optional collection controls for `reading_history` and `study_progress`
  - deeper sync-health status table retained for cursor/mutation/active counts
  - manual cloud sync repair action for `CURSOR_EXPIRED` / compaction-floor recovery without dropping into extension-only UI
- **IndexedDB lifecycle management + corruption recovery**
  - storage integrity audit (IndexedDB + localStorage fallback)
  - corruption repair action (invalid record cleanup)
  - lifecycle reset action (workspace persistence reset for recovery)
- **Mobile viewport readiness for portable control-plane flows**
  - account summary, export, delete, and manual repair remain operable in narrow mobile/PWA layouts
  - bridge-first boundary stays explicit: mobile web owns portable cloud control-plane only, not native launch/handoff or live page mutation

Boundary remains unchanged:

- extension-only live page mutation, overlays, and browser-command surfaces are still explicitly out of web scope
- iOS bridge remains bridge-first; web exposes cloud/control-plane status rather than taking over native host responsibilities

## Non-Goals

This spec does **not** attempt to define:
- the full cross-device sync contract
- the device registry model
- the support matrix / claim language per browser
- iOS/Android native shell strategy
- OCR/image translation productization
- a browser-vendor workaround for extensionless page injection

## Implementation Guidance for Future Work

When implementation starts, prefer these moves:

1. Keep `src/types/*` as the shared source of truth.
2. Extract the extension dependency out of `src/utils/translate/translate.ts` rather than rewriting translation orchestration from scratch.
3. Reuse `src/utils/cache/translation-cache.ts` for the PWA where IndexedDB is available.
4. Reuse reader logic from:
   - `src/entrypoints/pdf-reader/*`
   - `src/entrypoints/epub-reader/*`
   - `src/entrypoints/subtitle-reader/*`
5. Do **not** port `src/entrypoints/content/*` and `src/utils/dom/*` into the PWA except for narrowly-scoped read-only import/extraction utilities.
6. Make “extension-only” visible in product copy wherever a user is likely to expect live webpage injection.

## Final Boundary Statement

The Web/PWA companion should make Astra credibly usable on more devices by expanding **portable translation surfaces**.

It should not blur the line between:
- **Astra-owned workspaces**: text, imported files, imported URLs, account, synced assets
- **Extension-owned workspaces**: live pages, overlays, browser automation, page mutation, tab/frame coordination

That boundary is the difference between a believable cross-device strategy and an overclaimed one.
