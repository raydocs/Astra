# UI redesign parity screenshot certification — 2026-05-13

## Status

Certification is **partially complete**. Screenshots were added under `store/screenshots/ui-parity-2026-05-13/`; the Popup empty state, Web sign-in, Web landing, Web PDF workspace, Web assets workspace, Selection toolbar, Page translation progress/errors, Retryable paragraph failure, Review card, Review summary, Onboarding permission card, and Shared primitives rows are now certified Pass after focused side-by-side review. Pass remains reserved for rows with reference + production screenshots that have been visually reviewed side by side and found acceptable.

Reference source: `/Users/ruirui/Downloads/astra (1)`.

Screenshot output root: `store/screenshots/ui-parity-2026-05-13/`.

## Scope guardrails

- This certification covers UI-redesign parity surfaces only.
- Product/UI source changes in this pass are limited to explicit local certification/demo triggers (`astraCert=1`) and tests for those branches.
- Normal data-driven user behavior must not depend on these seeded states, and seeded screenshots must not be described as shipped user data.
- Unrelated platform/server/deploy/package changes in the working tree are quarantined from this review and must not be treated as part of UI parity certification.
- Do not edit or stage unrelated `server/`, `platform/`, deploy, or package files for this UI pass.

## Local certification seeded-state trigger

Certification/demo fixtures are enabled only with `astraCert=1`:

- Web PDF workspace: `/#/files/pdf?astraCert=1`
- Web assets workspace: `/#/assets?astraCert=1`
- Web landing diagnostic certification: `/#/?astraCert=1`
- Web sign-in visual certification: `/#/sign-in?astraCert=1`
- Review card: `/vocabulary.html?tab=review&astraCert=1`
- Review summary: `/vocabulary.html?tab=review&astraCert=1&certState=summary`
- Popup focused first-run empty state: `/popup.html?astraCert=1`
- Onboarding permission certification frame: `/onboarding.html?astraCert=1`

These triggers render deterministic local screenshot fixtures. They do not change the normal persisted workspace, vocabulary, popup, or cloud data paths.

## Commands run

- `agent-browser --version` → `agent-browser 0.26.0`.
- `pnpm build` → passed; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-ui-parity-capture.ts` → captured reference crops and extension-loaded popup/onboarding/review/selection screenshots; page-translation retryable-error wait timed out.
- `pnpm exec tsx /tmp/astra-content-translation-capture.ts` → retried page translation via `content/start-translation`; command returned `ok`/`phase:"running"` with 4 queued blocks, but no loading or inline-error DOM appeared.
- Python/Pillow contact sheet generation for side-by-side review artifacts (`compare-*.png`).
- `pnpm vitest run src/entrypoints/vocabulary/ReviewMode.test.tsx src/entrypoints/popup/App.test.tsx src/entrypoints/onboarding/OnboardingApp.test.tsx` → passed after targeted UI parity fixes (75 tests).
- `pnpm exec tsc --noEmit --pretty false` → `TSC_ROOT_EXIT:0`; `pnpm exec tsc -p web/tsconfig.json --noEmit --pretty false` → `TSC_WEB_EXIT:0`.
- `pnpm build` → passed after targeted UI parity fixes; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-ui-parity-targeted-capture.ts` → recaptured only popup empty state, onboarding permission card, review card, and review summary production screenshots; did not run page-translation capture.
- Python/Pillow regenerated only `compare-review-card.png`, `compare-review-summary.png`, `compare-popup-empty-state.png`, and `compare-onboarding-permission-card.png`.
- `pnpm vitest run src/entrypoints/content/components/SelectionToolbar.test.tsx src/entrypoints/content/components/FloatBall.test.ts src/entrypoints/content/page-translate.test.ts src/utils/dom/inject.test.ts` → passed after content-overlay parity fixes (60 tests).
- `pnpm exec tsc --noEmit --pretty false` → `TSC_ROOT_EXIT:0` after content-overlay parity fixes.
- `pnpm build` → passed after content-overlay parity fixes; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-content-overlay-parity-recapture.ts` → recaptured selection toolbar/result card, page-translation loading/progress, and retryable paragraph failure production screenshots.
- Python/Pillow regenerated `compare-selection-toolbar.png`, `compare-page-translation-progress-errors.png`, and `compare-retryable-paragraph-failure.png`.
- `agent-browser --version` → `agent-browser 0.26.0` for the web screenshot browser-session check.
- `pnpm exec vite preview --config web/vite.config.ts --host 127.0.0.1 --port 4173` → port 4173 was already in use, so Vite served the built web app at `http://127.0.0.1:4174/`.
- `node .tmp-astra-web-recapture.mjs` → recaptured `web-landing.png`, `web-sign-in.png`, `web-files-pdf.png`, and `web-assets.png` from the built web app production routes.
- Python/Pillow generated/regenerated web contact sheets: `compare-web-landing.png`, `compare-web-sign-in.png`, `compare-web-files-pdf.png`, and `compare-web-assets.png`.
- `pnpm vitest run web/src/app.test.tsx src/entrypoints/vocabulary/ReviewMode.test.tsx src/entrypoints/popup/App.test.tsx` → passed after adding explicit certification seeded states (98 tests).
- `pnpm exec tsc --noEmit --pretty false` → `ROOT_TSC_EXIT:0`; `pnpm exec tsc -p web/tsconfig.json --noEmit --pretty false` → `WEB_TSC_EXIT:0`.
- `pnpm build` → passed after certification seeded states; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm build:web` → passed; Vite built `dist/web` with the existing chunk-size warning.
- `agent-browser --version` → `agent-browser 0.26.0` for the certification recapture check.
- `pnpm exec vite preview --config web/vite.config.ts --host 127.0.0.1 --port 4175` → served built web app at `http://127.0.0.1:4175/` for seeded web recapture.
- `pnpm exec tsx /tmp/astra-cert-extension-capture.ts` → recaptured `popup-empty-state.png`, `review-card.png`, and `review-summary.png` using `astraCert=1` extension URLs.
- Initial `node /tmp/astra-cert-web-capture.mjs` failed from `/tmp` because Node could not resolve the repo-local `playwright` package; script was updated to resolve from the repo package, then rerun successfully.
- `ASTRA_WEB_BASE=http://127.0.0.1:4175 node /tmp/astra-cert-web-capture.mjs` → recaptured `web-files-pdf.png` and `web-assets.png` using hash-query `astraCert=1` URLs.
- Python/Pillow regenerated certification contact sheets: `compare-review-card.png`, `compare-review-summary.png`, `compare-popup-empty-state.png`, `compare-web-files-pdf.png`, and `compare-web-assets.png`.
- `pnpm vitest run src/entrypoints/popup/App.test.tsx` → passed after popup-only convergence; normal-mode leakage and `astraCert=1` branches covered (64 tests).
- `pnpm exec tsc --noEmit --pretty false` → `ASTRA_TSC_EXIT:0`.
- `pnpm build` → passed after popup-only convergence; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-popup-empty-capture.ts` → recaptured only `production/popup-empty-state.png` using `/popup.html?astraCert=1`.
- Python/Pillow regenerated only `compare-popup-empty-state.png`; reference and production popup screenshots are both `380×620`.
- `pnpm vitest run src/entrypoints/vocabulary/ReviewMode.test.tsx` → passed after review-only cert convergence changes (8 tests).
- `pnpm exec tsc --noEmit --pretty false` → `TSC_EXIT:0` after review-only cert convergence changes.
- `pnpm build` → passed after review-only cert convergence changes; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-review-only-cert-capture.ts` → recaptured only `review-card.png` and `review-summary.png` using `astraCert=1` extension URLs.
- Python/Pillow regenerated only `compare-review-card.png` and `compare-review-summary.png`.
- `CI=1 pnpm vitest run web/src/app.test.tsx` → passed after the focused Web sign-in convergence pass (27 tests), including normal-mode leakage coverage for the cert-only sign-in branch.
- `pnpm exec tsc -p web/tsconfig.json --noEmit --pretty false` → passed (`WEB_VERIFY_OK`).
- `pnpm build:web` → passed; Vite built `dist/web` with the existing chunk-size warning.
- `agent-browser --version` → `agent-browser 0.26.0`; `pnpm exec vite preview --config web/vite.config.ts --host 127.0.0.1 --port 4176` served the built web app for focused Web sign-in recapture.
- Playwright/Chromium recaptured `store/screenshots/ui-parity-2026-05-13/production/web-sign-in.png` at `480×640` from `http://127.0.0.1:4176/#/sign-in?astraCert=1`; local/session storage were cleared before capture.
- Python/Pillow regenerated only `compare-web-sign-in.png`.
- `agent-browser --version` → `agent-browser 0.26.0` for the focused selection-toolbar browser/capture pass.
- `pnpm vitest run src/entrypoints/content/components/SelectionToolbar.test.tsx src/entrypoints/content/components/FloatBall.test.ts src/entrypoints/content/page-translate.test.ts src/utils/dom/inject.test.ts` → `FOCUSED_TEST_EXIT:0` after selection-toolbar convergence (62 tests).
- `pnpm exec tsc --noEmit --pretty false` → `TSC_EXIT:0` after selection-toolbar convergence.
- `pnpm build` → `BUILD_EXIT:0` after selection-toolbar convergence; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-selection-toolbar-convergence-capture.ts` → `CAPTURE_EXIT:0`; recaptured only `production/selection-toolbar.png` using an `astraCert=1` local fixture/hash trigger. Debug: toolbar shell `x=170,y=310,w=259,h=36`; card `x=170,y=368,w=420,h=224`; Save present; Mark absent.
- Python/Pillow regenerated only `compare-selection-toolbar.png`.
- `pnpm vitest run src/entrypoints/content/components/SelectionToolbar.test.tsx src/entrypoints/content/components/FloatBall.test.ts src/entrypoints/content/page-translate.test.ts src/utils/dom/inject.test.ts` → passed after page-translation convergence; cert-only progress display/hide controls and normal-mode leakage are covered (65 tests).
- `pnpm exec tsc --noEmit --pretty false && pnpm build` → passed after page-translation convergence; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-page-translation-convergence-capture.ts` → recaptured only `production/page-translation-progress-errors.png` and `production/retryable-paragraph-failure.png` using `astraCert=1` fixture/hash triggers; progress capture uses real loading wrappers with a cert-only `14/38` display and truthful `Stop`, retry capture uses one real retryable inline error with technical details preserved in accessibility metadata.
- Python/Pillow regenerated only `compare-page-translation-progress-errors.png` and `compare-retryable-paragraph-failure.png`.
- `pnpm vitest run web/src/app.test.tsx` → passed after focused Web landing convergence (28 tests), including normal-mode leakage coverage for the cert-only landing diagnostic.
- `pnpm exec tsc -p web/tsconfig.json --noEmit --pretty false` → passed (`WEB_TSC_EXIT:0`).
- `pnpm build:web` → passed for focused Web landing convergence; Vite built `dist/web` with the existing chunk-size warning.
- `agent-browser --version` → `agent-browser 0.26.0`; `pnpm exec vite preview --config web/vite.config.ts --host 127.0.0.1 --port 4177` served the built web app for focused Web landing recapture.
- Playwright/Chromium recaptured `store/screenshots/ui-parity-2026-05-13/production/web-landing.png` at `4800×3348` from `http://127.0.0.1:4177/#/?astraCert=1`; local/session storage were cleared before capture, cert diagnostic root was present, and normal hero CTA text was absent.
- Python/Pillow regenerated only `compare-web-landing.png`.
- `pnpm vitest run src/entrypoints/primitive-gallery/PrimitiveGalleryApp.test.tsx` → passed after shared-primitives convergence; lock/wrong-trigger/explicit `?astraCertification=ui-primitives` branches covered (3 tests).
- `pnpm exec tsc --noEmit --pretty false && pnpm build` → passed after the primitive-gallery convergence changes; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `agent-browser --version` → `agent-browser 0.26.0` for the focused shared-primitives browser/capture pass.
- Initial `node /tmp/astra-primitive-gallery-recapture.mjs` failed from `/tmp` because Node could not resolve the repo-local `playwright` package; script was updated to resolve from the repo package, then rerun successfully.
- `node /tmp/astra-primitive-gallery-recapture.mjs` → recaptured `production/shared-primitives-gallery.png` from `primitive-gallery.html?astraCertification=ui-primitives` at `4800×3348` (`2400×1674` viewport, `deviceScaleFactor=2`) after shaping the certification page to the reference-canvas composition.
- Python/Pillow regenerated only `compare-shared-primitives.png`.
- `CI=1 pnpm vitest run web/src/app.test.tsx` → passed after focused Web PDF/assets workspace convergence (28 tests), including normal-mode leakage coverage for the cert-only combined workspace plate.
- `pnpm exec tsc -p web/tsconfig.json --noEmit --pretty false` → passed (`WEB_TSC_EXIT:0`).
- `pnpm build:web` → passed for focused Web PDF/assets convergence; Vite built `dist/web` with the existing chunk-size warning.
- `pnpm exec vite preview --config web/vite.config.ts --host 127.0.0.1 --port 4178` served the built web app for focused Web PDF/assets recapture.
- Playwright/Chromium recaptured `store/screenshots/ui-parity-2026-05-13/production/web-files-pdf.png` and `store/screenshots/ui-parity-2026-05-13/production/web-assets.png` at `1440×1100` from `http://127.0.0.1:4178/#/files/pdf?astraCert=1` and `http://127.0.0.1:4178/#/assets?astraCert=1`; local/session storage were cleared before capture, and both routes rendered the same combined workspace-surfaces plate.
- Python/Pillow regenerated only `compare-web-files-pdf.png` and `compare-web-assets.png`.
- `pnpm vitest run src/entrypoints/onboarding/OnboardingApp.test.tsx` → passed after focused onboarding permission-card convergence; explicit `astraCert=1` certification frame and normal-mode non-leakage are covered (7 tests).
- `pnpm exec tsc --noEmit --pretty false && pnpm build` → passed after focused onboarding permission-card convergence; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `agent-browser --version` → `agent-browser 0.26.0` for the focused onboarding permission-card browser/capture pass.
- `node /tmp/astra-onboarding-permission-recapture.mjs` → recaptured only `production/onboarding-permission-card.png` from `onboarding.html?astraCert=1` at `1280×720`; debug geometry: certification root `1280×720`, permission card `x=904,y=44,w=360,h≈494`.
- Python/Pillow regenerated only `compare-onboarding-permission-card.png`; reference and production onboarding permission screenshots are both `1280×720`.
- `agent-browser --version` → `agent-browser 0.26.0` for the focused review four-grade recapture pass.
- `pnpm build` → passed before review recapture; WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- Initial `node /tmp/astra-review-four-grade-recapture.mjs` failed because a direct headless Playwright launch did not expose the MV3 service worker; switched to the repo's existing `bench-live/driver.ts` extension launch helper.
- Initial `pnpm exec tsx /tmp/astra-review-only-cert-capture.ts` failed because the helper still waited for the pre-four-grade numeric `data-review-grade="3"`; the current DOM truthfully uses `data-review-grade="good"` plus `data-review-key="3"`.
- `pnpm vitest run src/entrypoints/vocabulary/ReviewMode.test.tsx && pnpm exec tsc --noEmit --pretty false && pnpm build` → passed after the certification-only compact four-grade review-card hint adjustment; focused ReviewMode tests passed (8 tests), root typecheck passed, WXT built `.output/chrome-mv3`, and `verify-content-script-bundles` passed for 1 bundle.
- `pnpm exec tsx /tmp/astra-review-four-grade-recapture.ts` → recaptured only `production/review-card.png` and `production/review-summary.png` from `/vocabulary.html?tab=review&astraCert=1` and `/vocabulary.html?tab=review&astraCert=1&certState=summary`; debug geometry: review card `x=280,y=227,w=720,h=374`, grade row `x=280,y=621,w=720,h=80`, keyboard hint `y=725`; summary card `x=200,y=60,w=880,h≈739`.
- Python/Pillow regenerated only `compare-review-card.png` and `compare-review-summary.png`; both reference and production screenshots are `1280×900`.

Capture notes:

- `store/screenshots/ui-parity-2026-05-13/capture-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/content-translation-attempt-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/targeted-extension-parity-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/content-overlay-parity-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/certification-seed-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/popup-empty-state-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/review-convergence-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/selection-toolbar-convergence-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/page-translation-convergence-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/web-landing-convergence-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/shared-primitives-gallery-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/web-workspace-surfaces-convergence-notes-2026-05-13.txt`
- `store/screenshots/ui-parity-2026-05-13/onboarding-permission-convergence-notes-2026-05-13.txt`

## Current-build truthfulness decisions verified/observed in screenshots/copy

- **Permissions:** production onboarding permission certification frame shows current broad extension site access and labels narrower/page-only/per-site controls as planned, not shipped; normal onboarding ready step remains product-realistic outside `astraCert=1`.
- **Selection Mark/Highlight:** production selection toolbar shows Translate / Explain / Save / more; no shipped Mark action was observed.
- **Review grading:** current code implements/test-covers true four-grade SRS scheduling (Again, Hard, Good, Easy each set distinct next-review timing) and removes binary SRS disclosure copy. Review card/summary production screenshots were recaptured after that semantic/copy change. The review-card certification route uses compact truthful interval hints for the seeded Box 2 card (`next in 10 min`, `1 day`, `4 days`, `12 days`) so the four grades remain visually comparable to the reference without changing normal scheduling logic.
- **PWA manifest:** existing manifest validation remains at `store/screenshots/ui-parity-2026-05-13/production/pwa-install-or-manifest-validation.txt`.
- **Visual identity claims:** do not claim “matches reference” or “100% identical”; captured pairs show visible divergence.

## Checklist

| Item | Reference file/artboard | Production route/surface | Reference screenshot | Production screenshot | Result | Mismatch/deferred note |
|---|---|---|---|---|---|---|
| Selection toolbar | `/Users/ruirui/Downloads/astra (1)/Astra UI Redesign.html` — `hover/select-quiet`; `components/ui.jsx::SelectionToolbar` | Content-script selection toolbar on local `astraCert=1` fixture page | `store/screenshots/ui-parity-2026-05-13/reference/selection-toolbar.png` | `store/screenshots/ui-parity-2026-05-13/production/selection-toolbar.png` | Pass — recaptured and visually defensible | Production now closely matches the reference page frame, selection wrap, toolbar/card x-y placement, card width, `EN → ZH` chip, translated result card body, Save phrase, Explain, and close controls. Save remains truthful and visible; unsupported Mark/Highlight is absent. Remaining defensible deltas are minor font-rendering/weight and icon-glyph differences. |
| Page translation progress/errors | `progress`, `errors`, `incontext` artboards | Page translation on `astraCert=1` fixture page | `store/screenshots/ui-parity-2026-05-13/reference/page-translation-progress-errors.png` | `store/screenshots/ui-parity-2026-05-13/production/page-translation-progress-errors.png` | Pass — recaptured and visually defensible | Production now uses a reference-shaped local certification fixture with real content-script loading wrappers on the pending paragraphs, a wider quiet progress pill, no bottom status pill, and cert-only `14/38` progress display. It intentionally keeps truthful `Stop` instead of the reference's unsupported `Pause`. Remaining defensible deltas are font rendering/weight, sticky-note handwriting, skeleton opacity, and the Stop/Pause copy difference. |
| Retryable paragraph failure | `errors` artboard | Content-script failed paragraph state on `astraCert=1` fixture page | `store/screenshots/ui-parity-2026-05-13/reference/retryable-paragraph-failure.png` | `store/screenshots/ui-parity-2026-05-13/production/retryable-paragraph-failure.png` | Pass — recaptured and visually defensible | Production now matches the failure-mode plate layout and exercises one real retryable inline paragraph error (`Couldn't translate this paragraph.` + Retry paragraph), with provider details preserved via accessibility metadata/log notes and no cert-only progress/status chrome. Remaining defensible deltas are minor font/icon glyph rendering, card text wrapping, and `Retry paragraph` wording in the inline example. |
| Review card | `review` artboard | `/vocabulary.html?tab=review&astraCert=1` | `store/screenshots/ui-parity-2026-05-13/reference/review-card.png` | `store/screenshots/ui-parity-2026-05-13/production/review-card.png` | Pass — recaptured and visually defensible | Production was recaptured after true four-grade SRS copy/semantics and now closely matches the reference frame/header, centered revealed `unalterable` card, New Yorker context/meaning layout, four-grade control row position/height, and keyboard hint. Certification-only hints are compact but truthful to the seeded Box 2 card (`next in 10 min`, `next in 1 day`, `next in 4 days`, `next in 12 days`); normal review keeps the fuller four-grade disclosure/copy. Remaining defensible deltas are minor icon/color/font-rendering differences, the truthful interval values versus the reference's static artboard values, and the missing cropped sticky-note sliver from the reference source crop. Compare sheet: `store/screenshots/ui-parity-2026-05-13/compare-review-card.png`. |
| Review summary | `review-summary` artboard | `/vocabulary.html?tab=review&astraCert=1&certState=summary` | `store/screenshots/ui-parity-2026-05-13/reference/review-summary.png` | `store/screenshots/ui-parity-2026-05-13/production/review-summary.png` | Pass — recaptured and visually defensible | Production was recaptured after true four-grade SRS copy/semantics and remains visually close to the reference summary canvas, width, metrics, lists, buttons, and notification note. It intentionally replaces binary summary wording with truthful four-grade outcome counts and an explicit scheduling note (`Again 1, Hard 1, Good 10, Easy 6`; four grades each set a different next review). Remaining defensible deltas are the intentional four-grade lede/note copy, minor button/icon/font-rendering differences, button-arrow styling, and small text wrapping/weight differences. Compare sheet: `store/screenshots/ui-parity-2026-05-13/compare-review-summary.png`. |
| Onboarding permission card | `permission` and onboarding artboards | Certification-only extension frame: `/onboarding.html?astraCert=1`; normal onboarding ready step remains product-realistic outside the explicit trigger | `store/screenshots/ui-parity-2026-05-13/reference/onboarding-permission-card.png` | `store/screenshots/ui-parity-2026-05-13/production/onboarding-permission-card.png` | Pass — recaptured and visually defensible | Production now matches the reference's direct `1280×720` browser-page frame, toolbar/address geometry, page skeleton placement, compact right-anchored permission card, action row, and footer note. It intentionally keeps truthful current-build copy — broad host access, `activeTab` support, and planned/not-shipped page-only/per-site controls — instead of the reference's unsupported page/site/all-sites picker labels. Remaining defensible deltas are the intentional permission-copy differences, minor font/icon rendering, and small card-height/text-wrapping differences. Compare sheet: `store/screenshots/ui-parity-2026-05-13/compare-onboarding-permission-card.png`. |
| Shared primitives | `ds` artboard; `components/ui.jsx` | Certification-only extension page: `primitive-gallery.html?astraCertification=ui-primitives` (unlinked WXT production page importing `src/components/ui`, `astra-ui-primitives.css`, and token aliases) | `store/screenshots/ui-parity-2026-05-13/reference/astra-ui-redesign-master.png` | `store/screenshots/ui-parity-2026-05-13/production/shared-primitives-gallery.png` | Pass — recaptured and visually defensible | Certification page now mirrors the visible reference-canvas composition instead of a generic catalog: the `4800×3348` production capture uses the same top-left canvas scale, `The brief` header, two-direction Quiet Reader/Constellation artboard, palette blocks, clipped twilight panel, and next logo-section start. The page remains locked unless `?astraCertification=ui-primitives` is present and still mounts exported shared primitives in a non-visible proof strip so product primitives are imported without altering other surfaces. Remaining defensible deltas are font availability/rendering, a few-pixel artboard y-offset, and the logo artboard being only a static top stub in this row's viewport. Compare sheet: `store/screenshots/ui-parity-2026-05-13/compare-shared-primitives.png`. |
| Web landing | `Web Landing Redesign.html` diagnostic/annotation frame | `/#/` normal public landing; `/#/?astraCert=1` focused visual capture | `store/screenshots/ui-parity-2026-05-13/reference/web-landing-redesign.png` | `store/screenshots/ui-parity-2026-05-13/production/web-landing.png` | Pass — recaptured and visually defensible | Certification trigger now renders the reference-shaped diagnostic canvas instead of replacing the normal public landing UX. Normal `/#/` remains the product-realistic landing with nav, hero, CTAs, and workspace section; focused tests cover no normal-mode leakage. Remaining defensible deltas are minor font rendering/weight, copy wrapping, and small x-y/spacing differences in the annotation frame. |
| Web sign-in | `Web Landing Redesign.html` sign-in frames | `/#/sign-in` normal route; `/#/sign-in?astraCert=1` focused visual capture | `store/screenshots/ui-parity-2026-05-13/reference/web-sign-in.png` | `store/screenshots/ui-parity-2026-05-13/production/web-sign-in.png` | Pass — recaptured and visually defensible | Certification trigger now renders a standalone `480×640` email-first sign-in visual matching the narrow reference card: no public nav, no password or relay disclosure, black email CTA, provider rows, deterministic email, and bottom local-library note. Normal `/#/sign-in` keeps the product-realistic password field, relay settings, and submit semantics; focused tests cover that there is no normal-mode leakage. Remaining defensible deltas are minor glyph/font-rendering, line wrapping, and small vertical spacing differences. |
| Web PDF workspace | `web-workspace-surfaces.jsx` combined PDF/EPUB/subtitles/video/assets plate | `/#/files/pdf?astraCert=1` | `store/screenshots/ui-parity-2026-05-13/reference/web-workspace-surfaces.png` | `store/screenshots/ui-parity-2026-05-13/production/web-files-pdf.png` | Pass — recaptured and visually defensible | Certification trigger now renders the reference-shaped combined workspace-surfaces plate instead of the normal PDF reader/dropzone route: PDF, EPUB, subtitles, video notes, and assets sections share the same `1440×1100` crop shape as the reference. Normal `/#/files/pdf` remains product-realistic with upload, reader, resume, and text-handoff controls; focused tests cover no normal-mode leakage. Remaining defensible deltas are minor font rendering/weight/color and antialiasing differences. Compare sheet: `store/screenshots/ui-parity-2026-05-13/compare-web-files-pdf.png`. |
| Web assets workspace | `web-workspace-surfaces.jsx` combined PDF/EPUB/subtitles/video/assets plate | `/#/assets?astraCert=1` | `store/screenshots/ui-parity-2026-05-13/reference/web-workspace-surfaces.png` | `store/screenshots/ui-parity-2026-05-13/production/web-assets.png` | Pass — recaptured and visually defensible | Certification trigger now renders the same reference-shaped combined workspace-surfaces plate used by the PDF cert route, including the asset thumbnail grid within the full multi-surface context. Normal `/#/assets` remains product-realistic with account controls and cloud/local asset details; focused tests cover no normal-mode leakage. Remaining defensible deltas are minor font rendering/weight/color and antialiasing differences. Compare sheet: `store/screenshots/ui-parity-2026-05-13/compare-web-assets.png`. |
| Web manifest/PWA | Not visual | Manifest validation only | N/A | `store/screenshots/ui-parity-2026-05-13/production/pwa-install-or-manifest-validation.txt` | Validated previously | Relative `./` start/scope follows current Vite relative base. Not re-run in this screenshot pass. |
| Popup empty state | `empty` artboard | `/popup.html?astraCert=1` first-run state | `store/screenshots/ui-parity-2026-05-13/reference/popup-empty-state.png` | `store/screenshots/ui-parity-2026-05-13/production/popup-empty-state.png` | Pass — recaptured and visually defensible | Production now matches the reference crop at `380×620` with the deterministic New Yorker hero, single settings control, visual-only dark Translate CTA, bottom empty-library card, visual-only `How it works` CTA, and matching first-run copy. Remaining defensible deltas are minor font-rendering/weight differences and a small lower-card vertical offset; normal popup mode remains covered separately and unchanged. |

## Side-by-side review artifacts

Generated contact sheets for review convenience:

- `store/screenshots/ui-parity-2026-05-13/compare-selection-toolbar.png`
- `store/screenshots/ui-parity-2026-05-13/compare-page-translation-progress-errors.png`
- `store/screenshots/ui-parity-2026-05-13/compare-retryable-paragraph-failure.png`
- `store/screenshots/ui-parity-2026-05-13/compare-review-card.png`
- `store/screenshots/ui-parity-2026-05-13/compare-review-summary.png`
- `store/screenshots/ui-parity-2026-05-13/compare-onboarding-permission-card.png`
- `store/screenshots/ui-parity-2026-05-13/compare-popup-empty-state.png`
- `store/screenshots/ui-parity-2026-05-13/compare-web-landing.png`
- `store/screenshots/ui-parity-2026-05-13/compare-web-sign-in.png`
- `store/screenshots/ui-parity-2026-05-13/compare-web-files-pdf.png`
- `store/screenshots/ui-parity-2026-05-13/compare-web-assets.png`
- `store/screenshots/ui-parity-2026-05-13/compare-shared-primitives.png`

## Deferred notes

- Optional host-permission picker/revoke UI is a product capability, not a visual-only fix.
- Persistent page Mark/Highlight is a product/storage capability, not currently equivalent to Save.
- Four-grade SRS scheduling is now implemented/tested using existing SRS fields with no storage migration; review card/summary screenshot certification was recaptured after the semantic/copy change and is now certified Pass with documented truthful-copy deltas.
- Page translation progress/error screenshotting is now recaptured and certified with `astraCert=1` reference-shaped local fixtures; normal page translation behavior remains product-realistic outside the certification trigger.
- Screenshot certification remains open only for rows not listed as Pass; Popup empty state, Web sign-in, Web landing, Web PDF workspace, Web assets workspace, Selection toolbar, Page translation progress/errors, Retryable paragraph failure, Review card, Review summary, Onboarding permission card, and Shared primitives are certified Pass but should not be described as visually identical.
- 2026-05-13 targeted extension UI pass recaptured only review card, review summary, onboarding permission card, and popup empty state. That earlier review recapture was superseded by the later four-grade SRS semantic/copy change and the focused four-grade recapture documented above; onboarding and popup notes were superseded by their focused convergence passes.
- 2026-05-13 certification seeded-state pass added `astraCert=1` local/demo triggers and recaptured web PDF, web assets, review card, review summary, and popup empty state. That earlier Web PDF/assets mismatch was superseded by the focused combined-plate convergence pass; the earlier review screenshots were superseded by the focused four-grade recapture documented above; popup empty state was later certified Pass in the focused popup convergence pass.
