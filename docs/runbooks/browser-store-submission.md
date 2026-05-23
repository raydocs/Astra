# Browser Store Submission Runbook — 2026-05-22

## Scope and authority

This runbook covers **Work Item 3 only** from `docs/plans/commercial-public-launch-2026-05-22.md`: browser-store packaging, screenshots, and submission readiness.

Launch posture:

- **Chrome / Chromium:** primary free public beta submission target.
- **Firefox Desktop:** beta follow-up. Do not claim Chrome parity.
- **Desktop Safari:** beta packaging path only until signed, reviewed, and device-backed smoke evidence is recorded.
- **iOS Safari shell:** experimental only unless newer external/device evidence supersedes this runbook.

Do not use this document to change backend deployment, billing policy, privacy/listing copy, or app code. Store copy remains governed by `store/listing-copy.md`, `store/amo-listing.md`, `store/description.md`, `store/privacy-policy.md`, and `docs/reviews/commercial-launch-claims-2026-05-22.md`.

## External policy references checked

- Chrome upload/listing flow: zip upload in the Chrome Developer Dashboard, then Package / Store Listing / Privacy / Distribution tabs before review submission. Chrome documents a 2 GB package cap and requires the Store Listing, Privacy, and Distribution fields before submission: <https://developer.chrome.com/docs/webstore/publish/>
- Chrome listing assets: store listing requires a 128x128 icon, at least one and up to five 1280x800 screenshots, a 440x280 small promo tile, optional 1400x560 marquee tile, and localization consistency: <https://developer.chrome.com/docs/webstore/cws-dashboard-listing/>
- Chrome screenshot image guidance: screenshots should be actual product experience, full-bleed/square-corner, 1280x800 or 640x400, with 1280x800 preferred: <https://developer.chrome.com/docs/webstore/images>
- Chrome privacy fields: single purpose, permission justifications, remote-code declaration, data-use disclosures, and privacy-policy URL must be accurate and consistent: <https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>
- Chrome developer-account 2-Step Verification is required before publishing or updating: <https://developer.chrome.com/docs/webstore/program-policies/policies/>
- Firefox AMO submission requires upload validation, source-code disclosure when generated/minified code is present, listing metadata, support contact, privacy policy when data leaves the device, and reviewer notes: <https://extensionworkshop.com/documentation/publish/submitting-an-add-on/>
- Firefox signing/distribution: listed AMO and self-distributed add-ons must be signed by Mozilla; `web-ext sign` is supported for listed initial submissions/updates in modern `web-ext`, but all submissions remain subject to AMO review: <https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/>
- Safari distribution: Safari web extensions are distributed through App Store Connect/App Store; Apple supports Xcode conversion and an App Store Connect Safari Web Extension Packager/TestFlight flow: <https://developer.apple.com/safari/extensions/>
- Apple privacy labels: App Store Connect privacy details must cover data collected by the app and third-party partners and stay accurate over time: <https://developer.apple.com/app-store/app-privacy-details/>

## Version and manifest facts to record per submission

| Field | Current repo value / source | Submission note |
|---|---|---|
| Package version | `0.1.0` in `package.json` | Must match generated manifest/package artifact for every uploaded build. |
| Manifest version | MV3 via `manifestVersion: 3` in `wxt.config.ts` | Chrome-first MV3 submission. |
| Extension name | `Astra` from `public/_locales/*/messages.json` `extName` | Chrome item title should stay `Astra` unless a later copy-freeze changes it. |
| Manifest description | `AI language learning assistant` / `AI 语言学习助手` | Store short/detailed copy comes from `store/listing-copy.md` and may be more specific than manifest description. |
| Default locale | `zh_CN` in `wxt.config.ts` | Chrome localized listing should include English and zh-CN copy/screenshots where practical. |
| Firefox ID | `astra@nicepkg.cn` in `wxt.config.ts` | Required for AMO/update continuity. |
| Firefox minimum version | `142.0` in `wxt.config.ts` | Firefox path remains beta and should be disclosed as such. |
| Safari minimum version | `16.4` in `wxt.config.ts` | Desktop Safari beta only; iOS shell experimental. |
| Chrome primary output | `.output/chrome-mv3/` and `.output/*.zip` after zip | Upload zip to Chrome; retain unpacked output for smoke/debug. |
| Firefox primary output | `.output/firefox-mv3/` and `.output/*.zip` after zip | Lint before AMO submission. |
| Safari primary output | `.output/safari-mv3/`, committed/synced `ios/AstraShell Extension/Resources/`, and `.output/*.zip` after zip | Not App Store-ready without signing/App Store Connect evidence. |

## Chrome-first submission packet

### Store metadata

| Store-console field | Launch-safe value / source | Status to record |
|---|---|---|
| Title / item name | `Astra` | `pending external console entry` |
| Short description | English and zh-CN blocks in `store/listing-copy.md` | `repo copy frozen; console upload pending` |
| Detailed description | English and zh-CN blocks in `store/listing-copy.md` | `repo copy frozen; console upload pending` |
| Category | Primary: `Productivity`; secondary `Education` only if available | `pending console selection` |
| Tags / keywords | Use `store/listing-copy.md`; avoid adding unsupported platform/video/paid keywords | `pending console entry` |
| Homepage / official URL | Prefer final public web companion URL once deployed; fallback repo URL `https://github.com/nicepkg/astra` only if accepted for launch | **External blocker:** final public URL/domain not recorded in repo. |
| Privacy policy URL | Publicly hosted copy of `store/privacy-policy.md` | **External blocker:** final public URL/domain and legal/privacy approval. |
| Support URL/contact | Monitored support URL or inbox; repo issues URL is acceptable only if launch owner commits to monitoring it | **External blocker:** final support owner/channel. |
| Visibility | Public only after Chrome approval decision; private/unlisted may be used for testing but still follows policy review | `pending developer account decision` |
| In-app purchases / paid distribution | None; free public beta only | Must not imply paid launch. |

### Graphic assets and screenshots

Chrome requires at least one and up to five screenshots; this repo's launch-safe packet is already defined in `store/screenshots/README.md`.

Primary screenshot filenames to upload, in order, when captured:

1. `store/screenshots/01-page-translation.png`
2. `store/screenshots/02-selection-toolbar.png`
3. `store/screenshots/03-popup-control-center.png`
4. `store/screenshots/04-options-settings.png`
5. `store/screenshots/05-pdf-reader.png`

Rules:

- Use 1280x800 PNG/JPEG, full-bleed, square corners, default Astra light theme.
- Capture current product UI only; do not use reference/mock/design images from `store/screenshots/ui-parity-2026-05-13/reference/` as store screenshots.
- Do not include screenshots implying Netflix, broad video-platform support, image/comic translation, paid/Pro subscriptions, production billing, full cross-device continuity, private accounts, API keys, unreleased domains, or sensitive browsing data.
- Existing historical parity captures under `store/screenshots/ui-parity-2026-05-13/` are reference/evidence artifacts, not final Chrome upload assets unless manually recaptured/renamed and audited against the launch-safe list.
- Also prepare required Chrome promotional images outside the screenshot packet: 128x128 icon and 440x280 small promo tile; optional 1400x560 marquee tile. Final paths are an external asset blocker unless already uploaded in the store console.

### Permissions rationale

Current manifest permissions from `wxt.config.ts`:

| Permission / host access | Launch-safe reviewer rationale |
|---|---|
| `storage` | Stores settings, target language/provider choices, site rules, vocabulary/review state, reading history, translation cache, and local usage/routing counters in the browser profile. |
| `tabs` | Reads the active tab context so popup/actions can target the current page and show page/site state. |
| `activeTab` | Accesses current-page content when the user invokes translation/explanation actions. |
| `webNavigation` | Coordinates frame-aware content-script behavior for page translation in full Chromium builds. |
| `contextMenus` | Adds right-click translation/reader actions in full Chromium builds. |
| `alarms` | Schedules background maintenance/review/refresh behavior in full Chromium builds. |
| `host_permissions: *://*/*` | Needed because Astra is a page translator/reading assistant that must read and annotate user-chosen pages across websites. Disclose broadly and explain that runtime/onboarding controls can disable or scope behavior per site. |
| `optional_host_permissions: http://*/*`, `https://*/*` | Supports runtime grant/revoke flows where browsers expose optional host access; broad declared access remains truthfully disclosed. |
| `omnibox` keyword `astra` | Lets users trigger translation/search-like Astra actions from the address bar in full Chromium builds. |
| `commands` | Provides keyboard shortcuts for translate/toggle behaviors in full Chromium builds. |

Remote-code answer: **No remote executable code.** Astra sends text to configured AI provider/relay endpoints for requested translation/explanation, but packaged extension code should be bundled locally. Do not describe provider API calls as remotely hosted executable extension code.

### Chrome data-use answers

The Chrome console labels may evolve, so fill the dashboard from the final UI. Conservative launch answers should align with `store/privacy-policy.md` and not under-disclose:

| Data area | Launch-safe answer |
|---|---|
| Website content / page text | Yes. User-selected/page/PDF/EPUB/subtitle text can be processed for translation/explanation via direct provider or Astra relay paths. |
| Web browsing activity / URLs | Yes/limited. Astra may use hostname/page URL/title/context for translation routing, site rules, reading history, and Privacy Mode-sanitized context. |
| User-provided content | Yes. Saved vocabulary, notes, imported/reader content, and text submitted for translation/explanation may be handled locally and, for AI features, transmitted. |
| Authentication / identifiers | Yes if managed beta relay or optional account is enabled. Anonymous session/device IDs, session tokens, and optional account email may be processed by the relay path. |
| Usage/diagnostics | Yes/limited. Local usage counters, routing/failure metadata, and operational server metadata may be processed for service operation and abuse/rate limiting. |
| Financial/payment data | No for this free public beta. No paid subscription, checkout, billing portal, or payment collection is launched. |
| Advertising/tracking | No product analytics SDKs or advertising tracking in the extension per `store/privacy-policy.md`; do not certify any broader tracking use. |

Use the dashboard's limited-use certification only if legal/privacy review confirms the public policy, store answers, and actual production deployment are consistent.

### Reviewer notes template

```text
Astra is submitted as a free public beta language-learning browser extension. Chrome/Chromium is the primary validated desktop path. Firefox/Desktop Safari are beta follow-ups; iOS Safari shell is experimental and not claimed in Chrome listing copy.

Primary purpose: translate and explain user-requested webpage/document text for bilingual reading and language study, with vocabulary/review workflows.

Key flows to test:
1. Open a public article page, click Astra, run page translation in bilingual mode.
2. Select a sentence and use the selection toolbar Translate/Explain action.
3. Open popup to view Study Hub and local usage/routing status.
4. Open Options to inspect provider, Privacy Mode, and diagnostics settings without entering real keys.
5. Optional: open a public PDF in Astra reader and run beta reader translation.

Data/privacy notes: translation text can leave the device through either direct provider mode or Astra managed beta relay where deployed. Privacy Mode minimizes request context; it is not a local-only AI guarantee. No paid subscription or production billing flow is launched.

No test credentials are required for direct BYOK mode. If managed beta relay is enabled in the submitted build, provide a reviewer-safe anonymous/session path or test account here: <fill before submission>.
```

### Chrome submission checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm check:repo-knowledge`
- [ ] `pnpm check:zod-entrypoints`
- [ ] `pnpm lint:ci`
- [ ] `pnpm type-check`
- [ ] `pnpm test`
- [ ] `pnpm bench`
- [ ] `pnpm build`
- [ ] `pnpm zip`
- [ ] Confirm `.output/chrome-mv3/manifest.json` has MV3, version `0.1.0`, expected permissions, no unintended hosts, no secrets, and no paid/billing claims.
- [ ] Upload `.output/*.zip` generated by `pnpm zip` to Chrome Developer Dashboard.
- [ ] Fill Store Listing from `store/listing-copy.md`.
- [ ] Upload launch-safe screenshots from `store/screenshots/README.md` plus required icon/promo tile assets.
- [ ] Fill Privacy fields from this runbook and `store/privacy-policy.md`.
- [ ] Set Distribution as free; choose public/unlisted/private per launch decision.
- [ ] Confirm developer account, publisher verification/contact details, and 2-Step Verification.
- [ ] Submit for review.

## Build and zip commands by platform

Run from repo root with Node 22 and pnpm 10.

| Platform | Build command | Zip command | Expected outputs | Launch status |
|---|---|---|---|---|
| Chrome / Chromium | `pnpm build` | `pnpm zip` | `.output/chrome-mv3/`; `.output/*.zip` | Primary free public beta. |
| Chromium compat | `pnpm build:compat` | `pnpm zip:compat` | `.output/chrome-mv3/`; `.output/*.zip` from compat env | Not primary Chrome Web Store packet unless separately approved. |
| Firefox Desktop | `pnpm build:firefox` then `pnpm verify:firefox-lint -- .output/firefox-mv3` | `pnpm zip:firefox` | `.output/firefox-mv3/`; `.output/*.zip` | Beta AMO follow-up. |
| Safari MV3 | `pnpm build:safari` | `pnpm zip:safari` | `.output/safari-mv3/`; `.output/*.zip` | Desktop Safari beta packaging artifact only. |
| Safari shell sync | `pnpm ios:sync-extension` after `pnpm build:safari`; verify with `bash ios/scripts/verify-safari-build-sync.sh` | N/A for App Store; Xcode/App Store Connect packaging required | `ios/AstraShell Extension/Resources/` synced from `.output/safari-mv3` | iOS shell experimental without device/App Store evidence. |

Record the exact zip filename, SHA-256, git SHA, and command exit status in the later launch completion evidence before upload.

## Firefox AMO beta follow-up

### Repo workflow

`.github/workflows/firefox-release.yml` provides a beta release lane:

- Manual `workflow_dispatch` input `sign` defaults to `false`.
- Tag pushes matching `v*` also run the workflow.
- Workflow installs with Node 22 / pnpm 10, then runs `pnpm lint:ci`, `pnpm type-check`, `pnpm test`, `pnpm build:firefox`, `npx web-ext lint --source-dir .output/firefox-mv3`, and `pnpm zip:firefox`.
- It uploads `.output/*.zip` as artifact `astra-firefox-xpi` for 30 days.
- If `sign=true` or a `v*` tag triggers the workflow, it attempts `npx web-ext sign --source-dir .output/firefox-mv3 --channel listed` using `AMO_API_KEY` and `AMO_API_SECRET`; missing secrets skip submission.

### AMO submission fields

Use `store/amo-listing.md` for AMO-specific name, summary, descriptions, categories, tags, homepage, and support URL. Mark Firefox as beta/narrower than Chrome in the listing.

AMO readiness checklist:

- [ ] `AMO_API_KEY` and `AMO_API_SECRET` configured in GitHub secrets only if automated signing/submission is approved.
- [ ] AMO developer account and ownership ready.
- [ ] `pnpm build:firefox` and `pnpm verify:firefox-lint -- .output/firefox-mv3` pass locally/CI.
- [ ] AMO-compatible zip artifact retained with SHA-256.
- [ ] Source-code submission package/instructions prepared if AMO flags generated/minified code review needs.
- [ ] Privacy policy URL is public and matches Firefox beta data paths.
- [ ] Support email/website is monitored.
- [ ] Reviewer notes include beta scope, data transmission paths, and any reviewer test account/session needed.
- [ ] Do not mark Firefox as full parity with Chrome unless new release evidence supersedes this runbook.

## Safari / App Store beta path

Safari is **not** part of the Chrome-first public launch unless external Apple distribution prerequisites are satisfied.

Desktop Safari beta readiness checklist:

- [ ] `pnpm build:safari` passes.
- [ ] `pnpm ios:sync-extension` completes.
- [ ] `bash ios/scripts/verify-safari-build-sync.sh` passes.
- [ ] Xcode signing team, bundle IDs, profiles, and App Store Connect app record are configured externally.
- [ ] Desktop Safari device-backed smoke evidence exists for install, enable extension, page translation, selection toolbar, popup/options, and reader surface if claimed.
- [ ] Store copy says desktop Safari beta only and does not imply Chrome parity.

App Store / iOS experimental blocker checklist:

- [ ] Apple Developer Program access and App Store Connect role.
- [ ] App privacy labels completed for all data collected/transmitted by app/extension and third-party partners.
- [ ] TestFlight or device-backed iOS Safari shell smoke evidence for install, enable extension, permission prompt, page translation, selection toolbar, managed relay/direct provider behavior, and failure handling.
- [ ] iOS-specific screenshots and App Store metadata captured on real/simulator devices as required by App Store Connect.
- [ ] No public copy says iOS/mobile is supported until the above evidence exists and a newer review approves it.

Until all Safari/iOS items above are checked, Safari remains beta and iOS shell remains experimental.

## Submission status fields to record

Use this template in the later launch completion/review evidence; do not mark `launched` here.

| Channel | Artifact path | SHA-256 | Store item ID / URL | Submission status | Submitted at | Reviewer notes | External blockers |
|---|---|---|---|---|---|---|---|
| Chrome Web Store | `.output/<chrome-zip>` | `<pending>` | `<pending>` | `not submitted` | `<pending>` | `<pending>` | Developer account + 2SV, final URLs, final screenshots/assets, legal/privacy review, support owner. |
| Firefox AMO | `.output/<firefox-zip>` | `<pending>` | `<pending>` | `beta follow-up / not submitted` | `<pending>` | `<pending>` | AMO credentials, source package if needed, final privacy/support URLs, beta approval. |
| Desktop Safari App Store | `<Xcode/App Store artifact>` | `<pending>` | `<pending>` | `beta blocker / not submitted` | `<pending>` | `<pending>` | Apple Developer, signing, App Store Connect, privacy labels, device smoke. |
| iOS Safari shell | `<Xcode/App Store artifact>` | `<pending>` | `<pending>` | `experimental / not submitted` | `<pending>` | `<pending>` | Device evidence, TestFlight/App Review readiness, iOS-specific privacy/screenshots/support. |

## External blockers before Work Item 3 can be operationally submitted

1. Chrome Web Store developer account access, publisher/contact verification, and 2-Step Verification.
2. Final public privacy-policy URL hosting `store/privacy-policy.md` after legal/privacy review.
3. Final support URL or monitored support inbox/owner.
4. Final public homepage/web companion URL if used in the listing.
5. Final Chrome screenshot files in `store/screenshots/01-*.png` through `05-*.png`, plus required icon/small promo tile assets uploaded in the console.
6. Chrome privacy questionnaire/legal sign-off for data-use answers and limited-use certification.
7. AMO account/API credentials and source-code review package if Firefox beta is submitted.
8. Apple Developer/App Store Connect access, signing/profiles, privacy labels, TestFlight/device smoke evidence, and App Store screenshots before Safari/iOS submission.
9. Store approval itself; this runbook only prepares the packet and cannot mark any channel approved or launched.

## Work Item 3 completion checklist

- [x] Runbook lists artifact paths, manifest version, store title/descriptions, privacy URL, support URL, screenshots, permissions rationale, data-use answers, reviewer notes, and submission status fields.
- [x] Chrome, Firefox, Safari build and zip commands are documented with expected outputs.
- [x] Firefox AMO workflow requirements are documented.
- [x] Safari/App Store path is explicitly beta/experimental unless signing, privacy labels, and device-backed smoke evidence are recorded.
- [x] `store/screenshots/README.md` reviewed; no change needed because it already defines the launch-safe 1–5 screenshot packet.
