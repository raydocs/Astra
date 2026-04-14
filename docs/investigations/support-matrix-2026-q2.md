# Astra Support Matrix — 2026 Q2 (Canonical)

_Last updated: 2026-04-14_

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

**Owned reading + subtitle file chain (2026-04-14):** The unified v1 item model and vocabulary **Reading** queue (`src/utils/storage/owned-reading.ts`, Reading tab in `VocabularyApp`) are real for **schema + resume hints**, not full parity across every host or reader. File-import continuity is documented in `subtitle-reader-learning-chain-2026-04-14.md` with live smoke ID `bench-live/subtitle-file-basic`; reader fixtures include `bench-live/pdf-reader-basic` and `bench-live/epub-reader-basic`; vocabulary reopen smoke is `bench-live/learning-loop-revisit-smoke` (see `month-3-closeout-inputs-2026-04-14.md`). **In-page** video and caption claims stay in `support-matrix-video-addendum-2026-04-15.md` (YouTube + Bilibili fixture depth vs other adapters).

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
| **iOS Safari shell** | **Experimental** | `ios/README.md` explicitly says this is host-shell + packaging skeleton and **not** completed device validation; lists pending runtime checks (MV3 module background compatibility, service worker lifecycle, messaging differences). Mobile Safari can also use the Astra Web portable front-door for sign-in/session plus account summary/export/delete/repair, but that remains separate from shell/runtime validation. | Astra includes an iOS Safari shell integration path for testing and iterative validation. | Do not claim “iOS fully supported,” “mobile product complete,” or parity with desktop platforms. Do not treat mobile web sign-in/control-plane coverage as native-shell parity. | Shell-only framing is explicit; iOS behavior differs from desktop Safari; MV3 `background.type: "module"` is a stated validation risk. Portable web auth/account flows do not close native runtime gaps. |

## Q2 Claim Boundaries (Canonical)

### Safe external statement (Q2)

> Astra is a desktop extension-first product. Chromium is the primary supported platform; Firefox and desktop Safari are available with narrower validation maturity. iOS currently uses a Safari Web Extension shell path under ongoing validation, while mobile web is limited to portable sign-in/session plus cloud/control-plane workflows rather than native-shell parity.

### Statements explicitly out of bounds in Q2

- “Astra already fully supports all major platforms with equal maturity.”
- “iOS/mobile support is complete.”
- “Cross-device continuity/sync is already done.”
- “Build success means production-level support parity.”

### Mobile claim cross-check (Month 5 plan ledger)

Plan Month 5 row **23–26** defers **「matrix 移动口径二次核对」** to this file: mobile / iOS rows above stay **Experimental** until device-backed evidence closes the gaps list. Execution checklist and evidence placeholders live in `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md` (manual); no change to support level implied until that doc is completed with attachments.

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
