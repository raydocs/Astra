# Astra Support Matrix — 2026 Q2 (Canonical)

_Last updated: 2026-04-14 (Month 6 claim-boundary and release-audit sync)_

## Purpose

This is the canonical Q2 support matrix for platform claims and validation boundaries. It follows the strategy pack requirement to distinguish **supported / beta / experimental / not supported** and to avoid treating “buildable” as “fully supported.”

## Scope

Platforms covered in this matrix:

- Chrome / Chromium extension
- Firefox extension
- Safari (desktop) extension
- iOS Safari shell (Safari Web Extension host app)

## Evidence Sources

- `docs/investigations/astra-cross-device-translation-strategy-pack-2026-04-09.md`
- `README.md`
- `docs/product-roadmap.md`
- `ios/README.md`
- `wxt.config.ts`
- `.github/workflows/ci.yml`
- `.github/workflows/firefox-release.yml`
- `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`

**Owned reading + reader surfaces (2026-04-14):** The unified v1 item model and vocabulary **Reading** queue (`src/utils/storage/owned-reading.ts`, Reading tab in `VocabularyApp`) are real for **schema + supported reopen guidance** across article / PDF / EPUB / subtitle-file items. Fresh browser-backed Month 3 proof exists for **PDF reader** (`bench-live/pdf-reader-basic` → `live-20260414T113547-e7a9ks`), **EPUB reader** (`bench-live/epub-reader-basic` → `live-20260414T113605-p0m6bj`), **subtitle-file ingest/preview/export** (`bench-live/subtitle-file-basic` → `live-20260414T113623-809nid`), and **article revisit from the Reading queue** (`bench-live/learning-loop-revisit-smoke` → `live-20260414T113647-9f8kwi`); see `month-3-evidence-registry-2026-04-14.md`. Do **not** claim full multi-reader parity or universal browser-backed queue reopen for every source type yet. **In-page** video/caption claims stay in `support-matrix-video-addendum-2026-04-15.md`: today **YouTube** is the only supported in-page tier, **Bilibili** is best-effort, **subtitle-file** is a separate experimental controlled surface, and the remaining repo adapters stay code-only.

## Month 4 video / subtitle claim cross-check

The platform matrix above is still canonical for browser/platform support. For Month 4 surface claims, read it together with the video addendum and use this narrower classification:

| Surface class | Current status | Exact evidence anchor | Honest boundary |
|---|---|---|---|
| YouTube in-page subtitles | **Supported** (best-effort within supported tier) | `bench-live/youtube-subtitle-basic` → `live-20260414T115407-2i2tzo` | Primary in-page video path only; fixture-backed, not broad production-watch-page proof. |
| Bilibili in-page subtitles | **Best-effort** | `bench-live/bilibili-subtitle-basic` → `live-20260414T115722-y40ya0` | Secondary adapter only; do not claim parity with YouTube. |
| Subtitle-file reader / learning chain | **Experimental controlled surface** | `bench-live/subtitle-file-basic` → `live-20260414T121705-ndf283`; `bench-live/subtitle-learning-chain-smoke` → `live-20260414T121845-xe3mlf` | Separate from in-page video support; do not merge these claims. |
| Other repo adapters | **Code-only** | `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md` | Do not claim external support. |

## Validation State Legend

- **Supported**: Primary product surface with routine build/test validation and acceptable claim confidence.
- **Beta**: Usable path exists, but maturity/coverage is behind primary platform; claims must be scoped.
- **Experimental**: Skeleton/build path exists; runtime/device validation is still incomplete.
- **Not supported**: No committed product path for this phase.

## Canonical Matrix (2026 Q2)

| Platform | Support level (Q2) | Validation state (current evidence) | Allowed external claim | Claim boundary (do **not** claim) | Known caveats |
|---|---|---|---|---|---|
| **Chrome / Chromium** | **Supported (primary)** | CI builds Chrome artifact via `pnpm build` (`.github/workflows/ci.yml`); README positions extension-first with Chromium install path. WXT also has compat channel behavior (`ASTRA_BROWSER_CHANNEL=compat`). | Astra is supported on Chromium-family browsers, with Chrome as the main validated desktop path. | Do not claim full parity across every Chromium fork/device profile. Do not claim cross-device continuity is complete. | Compat channel intentionally drops some APIs (`webNavigation/contextMenus/alarms`, commands, omnibox) in `wxt.config.ts`; compatibility breadth beyond standard Chrome path is not fully proven in this matrix. |
| **Firefox** | **Beta (shipping path present)** | CI builds Firefox artifact and runs lint step; dedicated release workflow builds, lints, packages, and can sign/submit to AMO (`firefox-release.yml`). | Astra has a Firefox build/release pipeline and is available as a supported-beta desktop path. | Do not claim same maturity as primary Chromium path. Do not claim every feature has identical behavior/perf parity. | Firefox is clearly distributable, but strategy pack marks Firefox/Safari desktop as not yet same maturity as Chromium primary. |
| **Safari (desktop)** | **Beta** | CI builds Safari artifact (`pnpm build:safari`) and runs `ios/scripts/verify-safari-build-sync.sh`; Safari min version is set in WXT (`16.4`). | Astra provides a desktop Safari extension path with active build validation. | Do not claim full parity with Chrome primary path. Do not imply iOS runtime validation from desktop Safari build success. | Validation today is more build/sync centric than end-to-end desktop Safari runtime proof in this source set. |
| **iOS Safari shell** | **Experimental** | `ios/README.md` and `docs/ios-safari-smoke-test.md` explicitly scope this to host-shell / bridge / packaging validation and **not** completed device validation. `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md` further splits evidence into two buckets: (1) shell / bridge / Safari-runtime checks and (2) mobile web portable control-plane checks. Only the first bucket can improve confidence in the iOS shell itself. | Astra includes an iOS Safari shell integration path for testing and iterative validation. Mobile web remains a separate portable control-plane surface. | Do not claim “iOS fully supported,” “mobile product complete,” or parity with desktop platforms. Do not treat mobile web sign-in/session/account/export/delete/repair coverage as native-shell parity. | Shell-only framing is explicit; iOS behavior differs from desktop Safari; MV3 `background.type: "module"` remains a stated validation risk. Mobile web evidence can support Month 5 carry language, but it does not close native runtime gaps or change the shell support tier by itself. |

## Q2 Claim Boundaries (Canonical)

### Safe external statement (Q2)

> Astra is a desktop extension-first product. Chromium is the primary supported platform; Firefox and desktop Safari are available with narrower validation maturity. iOS currently uses an experimental Safari Web Extension shell and bridge path under ongoing validation, while mobile web is limited to portable sign-in/session/account/control-plane workflows and does not prove native-shell or runtime parity.

### Statements explicitly out of bounds in Q2

- “Astra already fully supports all major platforms with equal maturity.”
- “iOS/mobile support is complete.”
- “Cross-device continuity/sync is already done.”
- “Build success means production-level support parity.”
- “All translation stays local/on-device.”
- “Privacy mode guarantees end-to-end secrecy across every surface.”
- “Glossary/terminology enforcement is fully wired and guaranteed.”

### Mobile claim cross-check (Month 5 plan ledger)

Plan Month 5 row **23–26** defers **「matrix 移动口径二次核对」** to this file: the iOS row above stays **Experimental** until device-backed shell/runtime evidence closes the gaps list. Execution checklist and evidence placeholders live in `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md` (manual), with supporting scope language in `ios/README.md`, `docs/ios-safari-smoke-test.md`, and `docs/investigations/control-plane-surface-inventory-2026-04-15.md`. Mobile web control-plane evidence can justify a Month 5 “carry-but-acceptable” closeout note, but no support-level change is implied unless the shell/runtime bucket is completed with attachments.

### Privacy / routing / glossary cross-check (Month 6 claim audit)

Read this matrix together with `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md` before making any privacy or routing claim:

- translation requests can leave the device on both **direct provider** and **relay** paths
- privacy mode sanitizes translation request context at the background transport boundary; it is **not** a claim of local-only translation
- direct → relay fallback exists and can change which backend handles a request after a direct failure
- glossary data now uses a canonical vocabulary-backed request-time contract, but that is still **not** the same as fully guaranteed terminology enforcement across all model behavior

## Open Validation Gaps to Close

1. iOS Safari real-device validation pass (popup/content/background/storage/messaging stability).
2. Desktop Safari runtime verification depth beyond build/sync checks.
3. Explicit Chromium-compat channel validation matrix (for reduced-permission/API profile).
4. Ongoing cross-browser parity checks aligned to roadmap principle: **Protocol before claims**.

## Change Control

Update this file when any of the following changes:

- Browser support level changes (Supported/Beta/Experimental/Not supported)
- New release/distribution workflow appears for Safari/Chrome
- iOS validation status materially changes
- Claim language in README/roadmap is revised
