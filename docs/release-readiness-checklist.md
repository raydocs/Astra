# Astra Release Readiness Checklist

_Last updated: 2026-04-14 (Month 6 release-gate and claim audit sync; earlier Month 1–5 evidence notes retained)_

This checklist defines the **blocking release decision**. A release candidate is ready only when:

1. **Gate 1–3 are green**,
2. **Gate 4 core docs are aligned**, and
3. **Every surface-conditional Gate 4 review that applies to the RC is either backed by concrete evidence or explicitly downgraded in the same PR/RC note**.

**Decision rule:**

- **Block** the RC if any required row below fails.
- **Block** the RC if a touched surface is marketed more strongly than its documented proof depth.
- **Do not** use optional live lanes as substitutes for required lanes.
- **Do not** promote a claim because “the code exists” when the proof/evidence bundle is still partial.

## Gate 1 — Deterministic quality gate (required)

| Check | How to verify | Artifact | Required |
|---|---|---|---|
| Lint is green | `pnpm lint:ci` | `CI / quality` job logs | Yes |
| Type check is green | `pnpm type-check` | `CI / quality` job logs | Yes |
| Unit/integration tests are green | `pnpm test` | `CI / quality` job logs | Yes |
| Deterministic bench is green | `pnpm bench` | `bench-results/latest.json` + CI logs | Yes |

**Block if:** any check fails.

## Gate 2 — Required live release-proof lanes (required)

Canonical lane names are defined in `docs/investigations/workstream-f-live-lane-conventions.md`.

| Lane | Command | Artifact | Required |
|---|---|---|---|
| `source-core` | `pnpm bench:live:lane:source-core` | `bench-live-results/<run-id>/` | Yes |
| `extension-core` | `pnpm bench:live:lane:extension-core` | `bench-live-results/<run-id>/` | Yes |
| `learning-loop` | `pnpm bench:live:lane:learning-loop` | `bench-live-results/<run-id>/` | Yes |

CI enforces these in `.github/workflows/ci.yml` (`live-browser` job).

**Block if:** any required lane fails.

## Gate 3 — Release-proof evidence clarity (required)

| Check | How to verify | Artifact | Required |
|---|---|---|---|
| Live artifacts uploaded by CI | `CI / live-browser` uploads `live-bench-results` | GitHub Actions artifact | Yes |
| Required lane inventory is documented | Confirm lane names and required scenarios | `docs/investigations/workstream-f-live-lane-conventions.md` | Yes |
| Flaky inventory exists and is current | Confirm open items or explicit `None` | `docs/investigations/workstream-f-live-flaky-inventory.md` | Yes |

**Block if:** evidence docs are missing or stale for the current RC.

## Gate 4 — Claims vs proof alignment (required)

### Gate 4A — Core docs that must align for every RC

| Check | How to verify | Artifact | Required |
|---|---|---|---|
| Live coverage matrix reflects current reality | Manual review against scenario registry + CI lanes | `docs/investigations/workstream-a-live-coverage-matrix.md` | Yes |
| Unsupported/unproven surfaces are marked as gaps | Manual review | Same matrix + RC notes | Yes |
| Platform support wording matches actual proof depth | Manual review against current support matrix and README | `docs/investigations/support-matrix-2026-q2.md`, `README.md` | Yes |
| Capability/status wording does not outrun proof | Manual review against capability matrix and task-specific evidence docs | `docs/capability-matrix-v2.md`, month evidence registries, `docs/investigations/month-6-release-claim-audit-2026-04-14.md` | Yes |

**Block if:** these docs disagree with each other or claim more than the attached proof supports.

### Gate 4B — Surface-conditional reviews that become blocking when the RC touches that area

| Conditional review | When it becomes blocking | How to verify | Artifact |
|---|---|---|---|
| Month 3 — reader / owned-reading evidence reviewed | RC touches Reading queue, PDF, EPUB, or subtitle-file reader claims | Read `docs/investigations/month-3-evidence-registry-2026-04-14.md`, `docs/investigations/month-3-closeout-inputs-2026-04-14.md`, and `docs/investigations/support-matrix-2026-q2.md` | Same docs + linked `bench-live-results/<run-id>/` artifacts |
| Video / subtitle claims reviewed | RC touches video or in-page subtitle claims | Read `docs/investigations/support-matrix-video-addendum-2026-04-15.md`, `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md`, and `docs/investigations/month-4-video-smoke-replay-2026-04-16.md` | Same docs + linked replay artifact paths |
| Control-plane / account evidence reviewed | RC touches billing, devices, sync, or account/control-plane wording | Read `docs/investigations/control-plane-surface-inventory-2026-04-15.md`, `docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`, and `docs/investigations/month-5-lifecycle-proof-2026-04-14.md` | Same docs + replayable lifecycle proof commands |
| Mobile web / iOS bridge wording and evidence reviewed | RC touches mobile wording, Safari shell, or portable control-plane claims | Read `docs/investigations/support-matrix-2026-q2.md`, `ios/README.md`, `docs/ios-safari-smoke-test.md`, `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md`, and `docs/investigations/control-plane-surface-inventory-2026-04-15.md` | Same docs + any attached manual evidence rows referenced from the Month 5 smoke notes |
| Month 6 — privacy / routing / glossary claims reviewed | RC touches privacy-mode claims, provider-routing wording, direct/relay ownership, or glossary/terminology guarantees | Read `docs/investigations/month-6-release-claim-audit-2026-04-14.md`, `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`, `docs/investigations/month-6-closeout-handoff-2026-04-14.md`, and `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md` | Same docs + Gate 1–3 artifacts; add fresh privacy replay artifacts if the RC wants to strengthen the privacy claim rather than keep it partial |

**Block if:** a conditional review applies to the RC and the claim is not backed by evidence or downgraded in the same change set.

## Month 6 — Privacy / routing / glossary policy (2026-04-14)

- **Required gates unchanged**: `source-core` + `extension-core` only. No Month 6-only live lane is required in Gate 2 today.
- **Current honest Month 6 / next-window classification**:
  - privacy mode: **background-owned request-context sanitization at the translation transport boundary; still partial as a broader privacy claim**
  - provider routing: **implemented and test-covered; one popup-backed local last-event support/operator path now exists for the most recent uncached request on the current device, but broader observability is still partial**
  - glossary / terminology contract: **canonical vocabulary-backed request-time contract exists; still narrower than release-grade guaranteed enforcement**
- **Month 6 status language must stay explicit**:
  - privacy assertions inventoried: **yes**
  - routing/fallback classes inventoried: **yes**
  - authoritative background privacy guardrail: **yes, for translation request context**
  - fresh privacy replay attached for the RC: **optional unless the RC strengthens privacy claims**
  - closeout framing: **privacy boundary narrowed and implemented; broader privacy guarantees still partial unless separately proved**
- **Claim boundary**:
  - privacy mode sanitizes translation request context at the **background transport boundary**; some caller surfaces also pre-sanitize earlier, but transport no longer relies on caller discipline alone
  - privacy mode does **not** mean translation stays local-only
  - direct transport, relay transport, and direct → relay fallback all exist in the runtime
  - glossary data now uses one canonical vocabulary-backed request-time contract via the background boundary; do **not** upgrade that into a blanket guarantee of model-enforced terminology correctness
  - do not claim stronger privacy or terminology guarantees than the current privacy decision and inventory documents support
- **Evidence bundle**: `docs/investigations/privacy-authority-decision-2026-04-14.md`, `docs/investigations/glossary-contract-2026-04-14.md`, `docs/investigations/translation-routing-observability-2026-04-14.md`, `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md`, `docs/investigations/month-6-release-claim-audit-2026-04-14.md`, `docs/investigations/month-6-final-evidence-pack-2026-04-14.md`, `docs/investigations/month-6-closeout-handoff-2026-04-14.md`, `docs/capability-matrix-v2.md`, `README.md`.

## Month 3 — Reader / owned-reading policy (2026-04-14)

- **Required gates unchanged**: `source-core` + `extension-core` only. No dedicated Month 3 reader / revisit lane is required in Gate 2 today.
- **Fresh optional proof exists** for the Month 3 reader / revisit baseline:
  - PDF reader: `CI=true pnpm bench:live -- --scenario bench-live/pdf-reader-basic` → `live-20260414T113547-e7a9ks`
  - EPUB reader: `CI=true pnpm bench:live -- --scenario bench-live/epub-reader-basic` → `live-20260414T113605-p0m6bj`
  - subtitle-file reader: `CI=true pnpm bench:live -- --scenario bench-live/subtitle-file-basic` → `live-20260414T113623-809nid`
  - article revisit: `CI=true pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke` → `live-20260414T113647-9f8kwi`
- **Month 3 status language must stay explicit**:
  - implemented: **yes**
  - proved: **yes**
  - gate-ready as a required release lane: **no**
  - closeout verdict: **`pass-with-carry`**
- **Claim boundary**: browser-backed proof is strongest for the PDF / EPUB / subtitle-file reader surfaces themselves and the article queue reopen path. Non-article queue reopen paths remain implemented/test-covered, but not separately proved end to end as dedicated browser-backed smokes.
- **Evidence bundle**: `docs/investigations/month-3-evidence-registry-2026-04-14.md`, `docs/investigations/month-3-closeout-inputs-2026-04-14.md`, `docs/investigations/month-3-pdf-reader-closeout-memo-2026-04-16.md`, `docs/investigations/month-3-epub-reader-closeout-memo-2026-04-16.md`, `docs/investigations/owned-reading-schema-v1-2026-04-14.md`, `docs/investigations/saved-reading-queue-spec-2026-04-15.md`, `docs/investigations/support-matrix-2026-q2.md`.

## Month 4 — Video / subtitle policy (2026-04-14)

- **Required gates unchanged**: `source-core` + `extension-core` only. No video/subtitle adapter lane is required in Gate 2 today.
- **Current honest Month 4 classification**:
  - YouTube: **supported** (best-effort within supported tier)
  - Bilibili: **best-effort / secondary adapter**
  - subtitle-file reader + learning chain: **experimental controlled surface**
  - Netflix / Prime Video / Disney+ / Udemy / Coursera: **code-only**
- **Month 4 status language must stay explicit**:
  - implemented: **yes**
  - proved: **yes**
  - gate-ready as a required release lane: **no**
  - closeout verdict: **`pass-with-carry`**
- **Current proof depth**:
  - `bench-live/youtube-subtitle-basic` and `bench-live/bilibili-subtitle-basic` are fixture-backed browser smokes
  - fresh `M4-D-02` replays: YouTube `live-20260414T115407-2i2tzo`, Bilibili `live-20260414T115722-y40ya0`
  - YouTube proof now covers duplicate suppression, pause/seek stability, and stale-track clearing after caption-track loss
  - Bilibili proof now covers DOM fallback, structured upgrade, alternate selector drift, and empty subtitle-state cleanup
  - `bench-live/subtitle-basic` proves the generic HTML5 subtitle-track contract only
  - subtitle-file controlled-path proof now includes:
    - `CI=true pnpm bench:live -- --scenario bench-live/subtitle-file-basic` → `live-20260414T121705-ndf283`
    - `CI=true pnpm bench:live -- --scenario bench-live/subtitle-learning-chain-smoke` → `live-20260414T121845-xe3mlf`
  - production watch-page regression remains manual / later-proof work, not covered by these fixture smokes
- **Claim boundary**: do not collapse fixture-backed smokes into a broad “supports video platforms” statement; only YouTube and Bilibili have live adapter proof at all, and only YouTube is in the supported tier.
- **Evidence bundle**: `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md`, `docs/investigations/support-matrix-video-addendum-2026-04-15.md`, `docs/investigations/month-4-video-smoke-replay-2026-04-16.md`, `docs/investigations/month-4-video-subtitle-evidence-sync-2026-04-14.md`, `docs/investigations/month-4-evidence-registry-2026-04-14.md`, `docs/investigations/month-4-closeout-inputs-2026-04-14.md`, `docs/investigations/subtitle-reader-learning-chain-2026-04-14.md`.

## Month 5 — Mobile web / iOS bridge policy (2026-04-14)

- **Required gates unchanged**: `source-core` + `extension-core` only. No mobile-web or iOS-shell lane is required in Gate 2 today.
- **Current honest Month 5 classification**:
  - mobile web: **portable control-plane surface only**
  - iOS Safari shell / bridge: **experimental**
  - desktop Safari build path: unchanged from the base support matrix
- **Month 5 mobile/iOS status language must stay explicit**:
  - wording/source-of-truth alignment: **yes**
  - lifecycle/operator guidance: **yes**
  - device-backed iOS shell parity proof: **no**
  - closeout framing: **`carry-but-acceptable`**
- **Claim boundary**:
  - portable mobile web proof does **not** imply native-shell parity
  - iOS shell evidence must stay in the shell / bridge / Safari-runtime bucket
  - no support-tier promotion without device-backed attachments for that bucket
- **Evidence bundle**: `docs/investigations/support-matrix-2026-q2.md`, `ios/README.md`, `docs/ios-safari-smoke-test.md`, `docs/investigations/month-5-mobile-ios-smoke-notes-2026-04-16.md`, `docs/investigations/control-plane-surface-inventory-2026-04-15.md`, `docs/investigations/month-5-account-wording-source-of-truth-2026-04-14.md`, `docs/investigations/month-5-lifecycle-proof-2026-04-14.md`, `docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`.

## Month 2 — Learning-loop policy (2026-04-15)

- **Required gates now include** `learning-loop` alongside `source-core` + `extension-core`.
- **Fresh required replay exists**: `CI=true pnpm bench:live:lane:learning-loop` reran green with popup proof `live-20260415T104021-y8rb0n`, vocabulary smoke `live-20260415T104027-zap15i`, and revisit smoke `live-20260415T104030-y9lm8o`.
- **Chained `learning-loop` lane** (`popup-proof` + `vocabulary-srs-smoke` + `learning-loop-revisit-smoke`) is now a required live-browser gate, not an optional confidence-only lane.
- **Month 2 status language must stay explicit**:
  - implemented: **yes**
  - proved: **yes**
  - gate-ready as a required release lane: **yes**
  - closeout verdict: **`pass`**
- **Evidence bundle**: `learning-loop-overview-2026-04-13.md`, `learning-metrics-2026-04-13.md`, `learning-loop-regression-checklist-2026-04-13.md`, `learning-loop-navigation-matrix-2026-04-14.md`, `learning-loop-claim-impact-2026-04-14.md`, `popup-deep-read-state-mapping.md`, `study-progress-counting-rules-2026-04-14.md`, `study-progress-ui-consistency-2026-04-14.md`, `month-2-closeout-2026-04-14.md`, `month-2-evidence-registry-2026-04-14.md`.

## Current Month 1 reality notes (not a pass override)

- Required release-proof lanes now cover: page-translation (source-backed), article-extraction (`bench-live/article-extraction-proof`), dynamic-content (source-contract), site-automation (extension-loaded), onboarding (extension-loaded), vocabulary (extension-loaded).
- Month 1 policy decision: hover and selection-explain remain **optional** (`pnpm bench:live:lane:hover-selection`) rather than required release gates. Rationale: current evidence is credible, but the lane is still modeled as a combined UX proof lane, does not yet have separate required-lane semantics in CI, and Month 1 release discipline should not over-promote non-core UX proof before that structure exists.
- Popup deep-read now has credible optional live proof via `bench-live/popup-deep-read-proof`, `pnpm bench:live:lane:popup-proof`, and `pnpm bench:live:lane:learning-loop`, but it remains outside required release-proof lanes for Month 1 and must stay explicit in matrix/close-out notes. **Replay note:** `docs/investigations/m1-bf-01-popup-learning-loop-replay-2026-04-14.md` now records fresh **green** reruns for standalone `popup-proof` (`live-20260414T095344-ol5adc`) and the optional learning-loop chain (`live-20260414T095422-yqripy` / `live-20260414T095427-992iaf` / `live-20260414T095429-kahn2o`), plus the earlier pre-fix baseline for archaeology.
- Month 1 gate close-out is recorded in `docs/investigations/month-1-closeout-2026-04-13.md`; the close-out verdict does not by itself override required lane failures.

## Pre-release execution order

1. `pnpm lint:ci`
2. `pnpm type-check`
3. `pnpm test`
4. `pnpm bench`
5. `pnpm bench:live:lane:release-proof`
6. `pnpm bench:live:lane:learning-loop`
7. Confirm CI `quality` + `live-browser` jobs are green
8. Review Gate 4 core docs:
   - `docs/investigations/workstream-a-live-coverage-matrix.md`
   - `docs/investigations/workstream-f-live-lane-conventions.md`
   - `docs/investigations/workstream-f-live-flaky-inventory.md`
   - `docs/investigations/support-matrix-2026-q2.md`
   - `docs/capability-matrix-v2.md`
   - `README.md`
9. If the RC touches a conditional surface, review the matching Month 3/4/5/6 evidence bundle before approving the RC
10. (Optional confidence boost) Run `pnpm bench:live:lane:hover-selection`
11. (Optional confidence boost) Run `pnpm bench:live:lane:popup-proof`
12. Only then tag the release candidate

## Escalation rule

If any required gate is overridden:

1. Document the exact override in the PR/RC note,
2. Get explicit owner approval,
3. Add a follow-up item with owner/date,
4. Do not silently override failing live lanes or unsupported claims.
