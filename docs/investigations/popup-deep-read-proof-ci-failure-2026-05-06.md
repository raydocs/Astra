# Investigation: PR #198 popup deep-read proof CI failure

## Summary
The latest verified failing run (`25433885413`, `2026-05-06T11:59:12Z`) fails because the popup/background runtime is using default config instead of the scenario-seeded relay config. The immediate failure is `CONFIG_MISSING` before any local relay request; the save/review/source-context failures are downstream cascade symptoms, not independent regressions.

## Symptoms
- GitHub Actions run triggered by PR synchronize about 15 minutes before the request failed after 8m 4s.
- `quality` summary reports Vitest passed: 153 files, 1330 tests.
- `live-browser` failed with scenario `bench-live/popup-deep-read-proof`.
- Scenario notes show popup rendered, article excerpt visible, and sentence deck present.
- Scenario notes show `Explain worked: false`, `Save worked: false`, `Relay request count: 0`, and no console errors.
- Evaluation issues include missing popup explain completion, save completion, durable saved-sentences CTAs, vocabulary navigation, focused review, source context, and expected explain profile/retry/profile rendering.
- Quality annotations also include React hook dependency warnings in `web/src/app.tsx`, but those are warnings and the failing job is `live-browser`.

## Background / Prior Research

### CI artifact verification (explore agent)
- Latest verified failing run on `ui-redesign-warm-paper`: GitHub Actions run `25433885413`, workflow `CI`, URL: https://github.com/raydocs/Astra/actions/runs/25433885413.
- The user-facing PR number `#198` did not resolve via `gh` in the explore session; the branch is associated with `raydocs/Astra#27`.
- Failing job: `live-browser`; failing step: `Run live lane (learning-loop)`; first failing command in the chained lane was `pnpm bench:live:lane:popup-proof`, scenario `bench-live/popup-deep-read-proof`.
- Artifact evidence (`live-20260506T120640-zaan6h`) showed the popup rendered the warm-paper UI and displayed `Not connected · Local only`.
- Timeout screenshots reportedly showed the inline warning: `No API key or Astra access token configured. Open Astra popup to configure your provider.`
- Runtime artifacts had `explainTimedOut: true`, `relayRequests: []`, `consoleErrors: []`, and relay request count 0 across two explain attempts.
- Artifact ID reported by the explore agent: `6829776712`, expiring `2026-05-20T12:07:12Z`.
- Quality job warnings in `web/src/app.tsx` are non-blocking hook dependency warnings, not the failing status.

### Git archaeology (explore agent)
Branch-unique commits vs main that could affect this area:
- `cf7da7b` (`2026-05-05 11:41`) `feat(ui): continue warm paper redesign`: changed `src/entrypoints/popup/components/StudySection.tsx` structure and `src/entrypoints/deep-read/DeepReadApp.tsx` sticky-note/UI code.
- `63b4e82` (`2026-05-05 15:07`) `Stabilize popup deep-read live scenario`: changed `bench-live/scenarios/popup-deep-read-proof.ts`, including helperized explain/revisit flow and longer CI timeouts.
- `2bb3685` (`2026-05-05 15:22`) `Target popup sentence actions in live bench`: added `study-sentence-explain-0` / `study-sentence-save-0` test IDs in `StudySection.tsx` and made the scenario target them directly.
- `80aeb10` (`2026-05-05 15:43`) `Sync Safari extension resources`: likely iOS/Safari packaging only.
- `b0a3c8d` (`2026-05-06 05:59`) `Add Astra UI redesign preview and tokens`: changed UI tokens, `DeepReadApp` theme, and added `deepReadDisabled={!studyReady}` in `src/entrypoints/popup/App.tsx`.

Potential risk vectors from git archaeology to validate in workspace:
- Whether live popup explain should require an API key/Astra token, or whether bench should seed managed relay/auth credentials.
- Whether `StudySection` explain/save buttons render and are enabled under `Not connected · Local only`.
- Whether the scenario now assumes relay explain requests even when auth/provider config is absent.
- Whether downstream save/review failures are a cascade from explain failure rather than separate storage/navigation regressions.

## Investigator Findings
<!-- Pair investigator will append structured analysis here. -->

### Phase 2 - End-to-end trace and root-cause evidence

**Latest-run verification:** Verified with `gh run list --repo raydocs/Astra --branch ui-redesign-warm-paper --limit 5` that the latest completed run on this branch is `25433885413`, created `2026-05-06T11:59:12Z`, failed at head `b0a3c8df31b4071bc630f15ff1118e97bbe24df8`, URL `https://github.com/raydocs/Astra/actions/runs/25433885413`. `gh run view 25433885413 --log-failed` confirms the failing command was `xvfb-run -a pnpm bench:live:lane:learning-loop`, whose first subcommand was `pnpm bench:live -- --scenario bench-live/popup-deep-read-proof`; the run ID was `live-20260506T120640-zaan6h`.

**Storage seeding intent:** `bench-live/scenarios/popup-deep-read-proof.ts:66-140` starts an in-process relay server on `127.0.0.1` and records every POST `/translate` payload in `translateRequests`. The scenario seeds `liveConfig` with `connectionMode: "custom"`, `languageLevel: "beginner"`, `explainMode: "exam"`, provider `id: "openai"`, no `apiKey`, `accessToken: "bench-live-popup-proof-token"`, and `relayBaseURL: relayServer.origin` at `bench-live/scenarios/popup-deep-read-proof.ts:174-205`. It passes only `{ "astra.config.v1": liveConfig }` into `withExtensionBrowserPage` at `bench-live/scenarios/popup-deep-read-proof.ts:207-214`. This proves the scenario is designed to be self-contained: no GitHub/CI `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, or Astra account secret is required for the proof path.

**Storage seeding mechanics:** `withExtensionBrowserPage` launches a persistent extension context, navigates the initial page, resolves the extension id, and only then applies `options.storageState` via `seedExtensionStorageState` (`bench-live/driver.ts:882-912`). Seeding writes directly to extension `chrome.storage.local`: first through the extension service worker (`bench-live/driver.ts:263-296`), falling back to an extension HTML page that exposes `chrome.storage.local` (`bench-live/driver.ts:331-372`). The driver does not read back or assert that `astra.config.v1` equals the supplied state before opening the popup.

**Config hydration path:** The popup initializes both `configDraft` and `persistedConfig` to `DEFAULT_ASTRA_CONFIG` (`src/entrypoints/popup/App.tsx:429-431`) and later hydrates them from `readConfig()` in `refreshAll` (`src/entrypoints/popup/App.tsx:670-807`). `readConfig()` reads `browser.storage.local.get("astra.config.v1")`; if `AstraConfigSchema.safeParse` fails or the key is absent, it migrates legacy keys into a default config (`src/utils/storage/config.ts:64-80`, `src/utils/storage/config.ts:31-62`). The seeded object shape itself is valid: `AstraConfigSchema` accepts relay `accessToken`, `relayBaseURL`, and arbitrary non-empty OpenAI model strings (`src/types/config.ts:129-149`, `src/types/config.ts:163-190`), and the enum values `beginner`/`exam` are valid (`src/types/config.ts:12-13`). Therefore the observed default runtime state is not explained by schema rejection of the scenario config.

**Popup explain click flow:** The explicit scenario target is the first sentence card explain button (`bench-live/scenarios/popup-deep-read-proof.ts:319-329`). The button remains visible and enabled in the failed artifact's runtime logs, so the warm-paper button selector/disabled state is not the primary blocker. In app code, clicking `study-sentence-explain-0` calls `onExplainSentence(card.index)` (`src/entrypoints/popup/components/StudySection.tsx:884-892`), which invokes `handleExplainSentence` (`src/entrypoints/popup/App.tsx:1009-1088`). That function calls `translateExplanationWithQualityRetry` with `targetLang`, `languageLevel`, and `explainMode` from `configDraft` (`src/entrypoints/popup/App.tsx:1032-1047`). `translateExplanationWithQualityRetry` sends `task: "explain"` through `translateTexts` (`src/utils/translate/translate.ts:269-327`), and `translateTexts` sends `runtime/translate-batch` with explain profile fields (`src/utils/translate/translate.ts:178-209`; `src/utils/extension/messages.ts:179-217`).

**Background/provider path:** The background handler reads config/session, resolves the effective provider, and invokes `translateWithProviderDetailed` (`src/entrypoints/background/index.ts:969-995`, `src/entrypoints/background/index.ts:1037-1051`). Provider resolution preserves global relay credentials when no site provider override is active (`src/types/config.ts:750-777`). The router treats direct access as `apiKey.length > 0` and relay access as both `accessToken` and `relayBaseURL` present (`src/utils/providers/router.ts:92-98`). If neither is present, it throws `CONFIG_MISSING` with the exact text seen in the screenshots: `No API key or Astra access token configured. Open Astra popup to configure your provider.` (`src/utils/providers/router.ts:250-264`). If the seeded relay credentials had reached this point, the router would have attempted relay (`src/utils/providers/router.ts:226-233`) and the scenario's local relay request count would have incremented.

**Artifact evidence of missing hydration:** Downloaded artifact `live-bench-results` for run `25433885413`; in `live-20260506T120640-zaan6h/popup-deep-read-proof.explain-timeout-attempt-1.html` and `...attempt-2.html`, the selected sentence card rendered `Explain profile: Deep · Intermediate` immediately above `Warning: No API key or Astra access token configured. Open Astra popup to configure your provider.` The seeded scenario config was `Exam · Beginner`, so the popup was operating on defaults, not merely failing to reach the local relay. Runtime events in `result.json` show both attempts had `relayRequested: false`, `explainRequestsBefore: 0`, `explainRequestsAfter: 0`, and the buttons were enabled; notes show `Relay request count: 0` and `Console errors: 0`. This proves the failure happened before any relay fetch, inside config/session/provider resolution.

**Downstream cascade:** The scenario only executes save/revisit/vocabulary/deep-read-return assertions inside `if (explainWorked)` (`bench-live/scenarios/popup-deep-read-proof.ts:387-527`). When explain fails, it attaches only timeout artifacts (`bench-live/scenarios/popup-deep-read-proof.ts:528-534`) and returns `saveWorked: false`, review/navigation flags false, and relay count (`bench-live/scenarios/popup-deep-read-proof.ts:541-560`). The evaluator then emits one issue per false flag (`bench-live/scenarios/popup-deep-read-proof.ts:700-781`). Thus the save/review/source-context failures in this run are cascade-only from `explainWorked: false`, not independent evidence of vocabulary or review regressions.

**Warm-paper/UI assessment:** Warm-paper changes are not the primary cause for this failure. The popup rendered, article excerpt and sentence deck were present, and the scenario clicked an enabled `study-sentence-explain-0` button twice. The latest branch-unique UI commit did alter popup layout and added `deepReadDisabled={!studyReady}`, but the failing path is post-click provider config resolution; the artifact's default `Deep · Intermediate` profile and `CONFIG_MISSING` warning are stronger evidence of config hydration/bench seeding drift than CSS/layout selector breakage.

**Conclusion:** Missing CI secrets are not required and are not the root cause. The local relay credentials that should satisfy provider access are seeded by the scenario but are absent from the popup/background runtime by the time explain runs. The current best root cause is a bench-live storage seeding/hydration gap: `withExtensionBrowserPage` writes `astra.config.v1` but neither verifies the write from the extension runtime nor waits for popup config hydration to reflect the seeded provider/profile before clicking Explain. The extension then falls back to `DEFAULT_ASTRA_CONFIG`/legacy migration, causing `CONFIG_MISSING` before any local relay request.

**Recommended fix locations:**
1. In `bench-live/driver.ts`, add a read-after-write assertion helper for `storageState` after `seedExtensionStorageState`, using the same service worker/extension-page context, so scenarios fail fast if `chrome.storage.local` does not contain the expected keys (`bench-live/driver.ts:390-407`, call site `bench-live/driver.ts:902-912`).
2. In `bench-live/scenarios/popup-deep-read-proof.ts`, add a scenario-specific readiness assertion before clicking Explain: read `chrome.storage.local["astra.config.v1"]` and/or wait for popup DOM to show `Exam · Beginner`/provider-ready evidence. This would convert the current ambiguous timeout into a clear storage hydration failure (`bench-live/scenarios/popup-deep-read-proof.ts:207-214`, `bench-live/scenarios/popup-deep-read-proof.ts:319-329`).
3. Consider moving storage seeding before initial HTTP navigation, or reload/notify the extension after seeding, because the driver currently navigates and waits for content-script injection before applying seeded storage (`bench-live/driver.ts:882-912`) despite the scenario comment claiming it seeds before first navigation (`bench-live/scenarios/popup-deep-read-proof.ts:207`).
4. Optional app hardening: expose a small popup test id or status field for loaded explain profile/provider access so live benches can wait on the real hydrated config rather than inferring readiness from sentence-card rendering (`src/entrypoints/popup/App.tsx:670-807`, `src/entrypoints/popup/App.tsx:1009-1088`).

## Investigation Log

### Phase 1 - Initial assessment
**Hypothesis:** The live-browser failure is likely rooted in the popup deep-read explain flow not initiating or not reaching the relay, since relay request count is 0 and downstream save/review assertions cascade from the missing explain result.
**Findings:** The provided CI summary confirms the real extension popup renders enough UI to show article text and the sentence deck, but explain never completes and no relay request is observed.
**Evidence:** User-provided CI summary for run `live-20260506T120640-zaan6h`, scenario `bench-live/popup-deep-read-proof`.
**Conclusion:** Initial focus should be popup deep-read explain CTA/state wiring, live bench scenario expectations, relay routing instrumentation, and any recent warm-paper UI changes that affected button selectors, disabled states, or popup/deep-read storage contracts.

## Root Cause
`bench-live/popup-deep-read-proof` is designed to be self-contained: it starts a local relay (`bench-live/scenarios/popup-deep-read-proof.ts:66-140`) and seeds `astra.config.v1` with `languageLevel: "beginner"`, `explainMode: "exam"`, `provider.accessToken`, and `provider.relayBaseURL` (`bench-live/scenarios/popup-deep-read-proof.ts:174-214`). If that seeded config were effective, the provider router would classify relay access as available (`src/utils/providers/router.ts:92-98`) and call the local relay (`src/utils/providers/router.ts:226-233`).

In the failing CI artifact, however, the popup showed the default explain profile (`Deep · Intermediate`) and the exact `CONFIG_MISSING` warning from `src/utils/providers/router.ts:250-264`. `DEFAULT_ASTRA_CONFIG` is `languageLevel: "intermediate"`, `explainMode: "deep"`, and empty provider credentials (`src/types/config.ts:399-417`). That proves the popup/background runtime did not observe the seeded `Exam · Beginner` relay config before the explain flow ran.

The most precise current root cause is therefore a bench-live storage seeding/hydration gap: `withExtensionBrowserPage` writes `storageState` after initial navigation/content-script injection and extension-id resolution (`bench-live/driver.ts:882-912`), using service-worker/page storage writes (`bench-live/driver.ts:263-296`, `bench-live/driver.ts:331-407`), but it does not read back or wait for the popup/background to hydrate the seeded config. In CI, the runtime falls back to default/legacy config via `readConfig()` (`src/utils/storage/config.ts:19-80`), so the router throws `CONFIG_MISSING` before any relay request is made.

### Eliminated hypotheses
- Missing real CI provider secrets: eliminated. The scenario intentionally uses a local relay stub and seeded access token; no `OPENAI_API_KEY` or Astra account secret should be required.
- Local relay failure: eliminated for this run. Relay request count is 0, so the request never reached the local relay.
- Warm-paper UI/CSS as primary cause: eliminated. Popup, article excerpt, sentence deck, and the explicit explain button rendered and were clickable; failure occurs post-click in provider routing.
- Independent save/review/vocabulary/source-context regressions: eliminated for this run. Those checks only run inside `if (explainWorked)` (`bench-live/scenarios/popup-deep-read-proof.ts:387-527`), and the false flags emitted afterward (`bench-live/scenarios/popup-deep-read-proof.ts:541-560`, evaluator issues later in the file) are cascade symptoms.

### Remaining uncertainty
The evidence proves the runtime saw defaults, but not the exact mechanism: the write may fail, write to a different extension context/profile, occur after a default migration/overwrite, or succeed without the popup/background refreshing before explain. A read-after-write plus popup-visible readiness diagnostic would close this.

## Recommendations
1. Add driver-level read-after-write verification in `bench-live/driver.ts` immediately after `seedExtensionStorageState` (`bench-live/driver.ts:902-912`). Verify `astra.config.v1.provider.accessToken` is present, `relayBaseURL` matches the scenario relay origin, and profile fields match expected values.
2. Reorder live-bench setup so storage seeding happens before first HTTP fixture navigation when a scenario supplies `storageState`, or explicitly reload/notify after seeding. This aligns implementation with the scenario comment at `bench-live/scenarios/popup-deep-read-proof.ts:207`.
3. Add a scenario-specific precondition in `bench-live/scenarios/popup-deep-read-proof.ts` before clicking explain (`bench-live/scenarios/popup-deep-read-proof.ts:319-329`): fail fast if extension storage or popup DOM does not show `Exam · Beginner` and relay-ready config.
4. Add a stable popup diagnostic/test id for hydrated provider/profile readiness in `src/entrypoints/popup/App.tsx`, avoiding secret exposure. This lets live benches wait for real config readiness instead of inferring from card visibility.
5. De-cascade the evaluator output: when `explainWorked` is false and `relayRequestCount === 0`, report downstream save/review/source-context checks as dependent notes rather than separate primary issues.

## Fix Applied
- Updated `bench-live/driver.ts` so `withExtensionBrowserPage({ storageState })` now resolves the extension id, seeds `chrome.storage.local`, verifies seeded keys are readable, installs CI outbound guards, and only then performs the first fixture navigation.
- Exported `readExtensionStorageState()` from `bench-live/driver.ts` for scenario-level sanitized diagnostics.
- Updated `bench-live/scenarios/popup-deep-read-proof.ts` to assert its expected seeded relay config/profile is visible (`openai`, access token present, relay URL matches, `beginner`/`exam`) before continuing into popup explain/save/review.
- Reduced evaluator cascade noise: if explain never completes with zero relay requests, downstream save/review/source-context checks are not reported as independent primary issues; seeded-config precondition failures get a dedicated issue.
- Validation after the fix: `pnpm type-check` passed, `pnpm build` passed, and `pnpm bench:live -- --scenario bench-live/popup-deep-read-proof` passed locally with score 100 and relay request count 2.

## Preventive Measures
- Require storage seeding verification for all extension-loaded live scenarios that depend on `chrome.storage.local` preconditions.
- Capture sanitized config-readiness diagnostics in live artifacts: storage key present, provider id, relay URL host/port, credential presence booleans, language level, explain mode.
- Keep live scenario assertions staged: preconditions first, primary action second, downstream learning-loop assertions only after upstream success.
- Add a focused regression test or live smoke helper for `withExtensionBrowserPage({ storageState })` that proves a popup/background read sees the seeded config in CI.
