# Astra Six-Month Master Plan

**Date:** 2026-04-12  
**Planning window:** 2026-04-12 → 2026-10-12  
**Start point:** treat all work through `docs/investigations/full-auth-and-mobile-next-master-plan-2026-04-12.md` as complete baseline.

## 1. Summary

The next six months should **not** be another broad platform expansion wave.

The correct move is:

1. **Stabilize and prove the new Cloudflare auth/session front door in production discipline**.
2. **Migrate the remaining account/usage/plan control surfaces only as far as they are needed for a coherent business/control plane**.
3. **Do not migrate `translate` authority in this window unless the first four months prove the business and operational boundary is ready**.
4. **Shift the main product investment to learning-loop completion and owned reading/video surfaces**.
5. **Make Web/PWA the portable mobile entry and keep iOS bridge-first; do not start Android or heavier native mobile in this same window**.
6. **Raise the validation bar materially**: browser-backed CI, reader/video/onboarding/vocabulary coverage, and release proof gates.

This plan assumes the repo is already past the continuity/auth foundation phase. The main risk now is not missing scaffold; it is drifting into too many new surfaces before the existing front door, control plane, and product surfaces are operationally credible.

---

## 2. Starting baseline on 2026-04-12

### Already done
- Cloudflare Worker/D1 front door for selected import/auth/device/sync seams
- Worker-native:
  - `GET /v1/auth/session`
  - `DELETE /v1/auth/session`
  - `POST /v1/auth/anonymous`
  - `POST /v1/auth/session`
  - `GET /v1/devices`
  - `POST /v1/devices/:deviceId/revoke`
  - `GET /v1/sync/bootstrap`
  - `POST /v1/sync/pull`
  - `POST /v1/sync/push`
  - `POST /v1/sync/repair`
- account summary, export/delete lifecycle, sync compaction/materialized state
- Web cloud/control-plane surfaces
- iOS shell/bridge history/replay/open-in-app path
- support matrix and bridge-first mobile claim boundary

### Still materially Node-owned
- broader account surface:
  - `GET /v1/account`
  - `PATCH /v1/account/plan`
  - `GET /v1/account/usage`
- billing:
  - `/v1/billing/*`
- translate execution and quota-enforced hot path:
  - `POST /v1/translate`
- primary persistence compatibility layer:
  - `server/user-store.ts`

### Product reality
- learning assets exist but are unevenly productized:
  - vocabulary/SRS is the strongest asset surface
  - reading history and study progress exist, but user-facing integration is still thinner than the backend continuity work
- owned surfaces exist but are not yet fully validated:
  - PDF / EPUB / subtitle-file / video subtitle support exists
  - validation coverage and release confidence are behind the core page-translation path

---

## 3. Decisions for this six-month window

## 3.1 Cloudflare / backend authority

### Continue
- Continue Cloudflare migration only for:
  - auth/session rollout hardening
  - account/usage/plan control-plane maturity
  - billing substrate and entitlement alignment
  - continuity lifecycle maturity

### Do not continue blindly
- **Do not** migrate `translate` authority by default in this window.
- **Do not** widen Cloudflare route ownership just because the scaffold exists.
- **Do not** introduce Durable Objects unless measured contention proves D1 + retries is insufficient.

### Why
`translate` is the highest-risk hot path because it couples:
- provider routing
- quota enforcement
- usage accounting
- billing implications
- product-visible latency and failure behavior

The repo evidence says the bigger gap in the next six months is **business/control-plane maturity plus product validation**, not more route count on Cloudflare.

## 3.2 Mobile

### Continue
- Web/PWA as the portable mobile entry
- iOS shell/bridge as experimental bridge-first path

### Do not start
- Android app
- heavier native mobile workstream
- native auth/session materialization beyond current bridge boundary

### Why
The support matrix still marks iOS shell as experimental and Android as unsupported. The next six months should prove the portable entry and bridge path, not create a second platform program.

## 3.3 Product

The mainline product work for the next six months should be:
- finish the learning loop
- make owned reading/video surfaces credible and validated
- connect those surfaces to continuity lifecycle and release proof

That is a better use of time than adding new beta surfaces like image/comic/native-mobile.

---

## 4. Explicit non-goals

These are out of scope for this six-month plan:

1. full Android product path
2. full native iOS product path
3. Durable Objects rollout
4. auth modernization:
   - passkeys
   - MFA
   - SSO
   - password-reset rearchitecture
5. broad Cloudflare migration of every route family
6. translation execution migration to Worker by default
7. image translation / comic translation as a mainline program
8. “app complete” external claim before validation gates are materially stronger

---

## 5. Six-month success criteria

At the end of this window, Astra should be able to say the following with evidence:

1. **Auth/session front door is stable**
   - Worker-issued sessions are the normal path
   - rollback and observability are proven
   - Node mirror compatibility is boring, not a daily risk

2. **Account/control plane is coherent**
   - plan/usage/account state is operator-visible and product-visible through a consistent surface
   - export/delete/repair/retention flows are production-grade

3. **Learning loop is real**
   - vocabulary, reading history, study progress, and review are connected as one system

4. **Owned surfaces are credible**
   - PDF, EPUB, subtitle-file, and video subtitle flows have meaningful automated coverage and clearer support expectations

5. **Portable mobile entry is proven**
   - mobile web/PWA auth + control plane work reliably on narrow viewports
   - iOS shell/bridge has real-device validation evidence

6. **Validation and release quality are materially higher**
   - browser-backed CI exists
   - the most visible unvalidated surfaces are no longer unvalidated
   - promotion/release gates are closer to evidence than aspiration

---

## 6. Phase plan

## Phase 1 — Auth authority stabilization and operator proof
**Window:** 2026-04-12 → 2026-05-15

### Goal
Turn the newly completed auth/session authority work into a proven, boring production boundary.

### Scope
- canary and rollback discipline for:
  - `POST /v1/auth/anonymous`
  - `POST /v1/auth/session`
  - `GET/DELETE /v1/auth/session`
- eliminate remaining fixture/type gaps that prevent clean repo-wide confidence
- front-door consistency checks:
  - `sessionPublicBaseURL`
  - Worker-issued `relayBaseURL`
  - first-party retry semantics with `Idempotency-Key`
- strengthen observability for:
  - issuance success/failure
  - mirror-back pending/failed
  - auth issue request backlog
  - rollback causes
- verify Node compatibility for Worker-issued sessions across still-Node-owned routes

### Key files/modules
- `platform/cloudflare/src/handlers/auth-session.ts`
- `platform/cloudflare/src/handlers/auth-anonymous.ts`
- `platform/cloudflare/src/handlers/platform-observability.ts`
- `platform/cloudflare/src/repositories/*`
- `server/index.ts`
- `server/user-store.ts`
- `server/auth.ts`
- `src/utils/astra/auth.ts`
- `src/utils/storage/auth.ts`
- `web/src/lib/astra-web.ts`
- `docs/cloudflare-platform-ops-runbook.md`

### Done when
- repo-wide type/test baseline is clean enough that auth rollout is not hidden behind unrelated fixture debt
- Worker auth issuance can be canaried with explicit rollback procedure and observed mirror-back state
- Node-owned `/account`, `/billing`, `/translate` accept Worker-issued sessions without special-case breakage
- on-call/operator can explain any auth issuance failure from observability data without reading raw logs

### Risks
- mirror-back ambiguity causing stuck client retries
- hidden `PlatformConfig` or fixture debt masking actual auth regressions
- front-door base URL mismatch keeping clients on Node unintentionally

---

## Phase 2 — Account, usage, and billing substrate
**Window:** 2026-05-16 → 2026-06-30

### Goal
Close the remaining business/control-plane gaps before touching translation authority.

### Scope
#### A. Account and usage authority
- decide and implement the next control-plane boundary for:
  - `GET /v1/account`
  - `GET /v1/account/usage`
  - `PATCH /v1/account/plan`
- make plan/usage/account state consistent with the already-completed `GET /v1/account/summary`
- reduce duplicated fanout/state assembly between Node and Worker surfaces

#### B. Billing substrate
- keep billing product scope narrow
- build the minimum missing backend substrate, likely:
  - billing state persistence or ledger
  - entitlement reconciliation source
  - webhook-ready shape if external billing provider requires it
  - operator-visible billing/account state link

#### C. Translate decision prep
- do **not** migrate `POST /v1/translate` yet
- instead, instrument and document:
  - quota decision path
  - usage accounting path
  - provider routing dependencies
  - exact reasons translate should stay Node-owned or be reconsidered later

### Key files/modules
- `server/index.ts`
- `server/user-store.ts`
- `server/billing.ts`
- `server/types.ts`
- `platform/cloudflare/src/handlers/account-summary.ts`
- `platform/cloudflare/src/handlers/account-lifecycle.ts`
- `src/utils/astra/account.ts`
- `web/src/lib/astra-web.ts`
- `docs/specs/cloudflare-platform.md`

### Done when
- there is one coherent account/control-plane shape for web and extension use
- plan/usage/account state no longer feels bolted onto the continuity surface
- billing has a defined backend source of truth instead of just link generation
- a written decision exists for `translate` authority in this window: either defer with reasons, or schedule preparatory work only

### Risks
- coupling account migration too tightly to billing provider specifics
- trying to move billing and translate at once
- widening Cloudflare scope before business state is explicit

---

## Phase 3 — Learning loop completion
**Window:** 2026-07-01 → 2026-08-10

### Goal
Turn vocabulary, reading history, study progress, and review into one visible, usable learning loop.

### Scope
- unify user-visible flow across:
  - save word / sentence
  - review queue / due count
  - reading history
  - page study progress
  - account/cloud continuity surfaces
- close the gap between storage-level maturity and product-level coherence
- ensure export/delete/repair lifecycle clearly covers the learning assets users actually care about
- improve onboarding and popup/options flow to point users into the learning loop intentionally

### Key files/modules
- `src/utils/storage/vocabulary.ts`
- `src/utils/storage/vocabulary-core.ts`
- `src/utils/storage/reading-history.ts`
- `src/utils/storage/reading-history-core.ts`
- `src/utils/storage/study-progress.ts`
- `src/utils/storage/study-progress-core.ts`
- `src/utils/srs/leitner.ts`
- `src/entrypoints/vocabulary/*`
- `src/entrypoints/popup/App.tsx`
- `src/entrypoints/options/OptionsApp.tsx`
- `src/entrypoints/onboarding/OnboardingApp.tsx`
- `web/src/app.tsx`
- `docs/product-roadmap.md`

### Done when
- a user can move from translation → save → review → revisit history/progress without the flow feeling disconnected
- due counts, review state, and study progress are visible in the right surfaces
- onboarding and popup/options direct users into the actual learning system, not just settings and translation toggles
- export/delete/repair copy and behavior match the learning assets users see

### Risks
- backend continuity maturity outpacing user-visible usefulness
- overbuilding SRS complexity before the basic loop feels coherent
- hiding the learning loop behind too many surfaces instead of one clear path

---

## Phase 4 — Owned reading and video surfaces + validation
**Window:** 2026-08-11 → 2026-09-15

### Goal
Make PDF, EPUB, subtitle-file, and video subtitle surfaces credible enough to be treated as first-class owned surfaces.

### Scope
#### A. Product completion
- unify owned-entry model across:
  - PDF
  - EPUB
  - subtitle file
  - article import / reading queue
  - video subtitle learning surfaces where applicable
- make the import library and cloud asset views map to real reading/review workflows

#### B. Validation
- add automated smoke/integration coverage for:
  - PDF reader
  - EPUB reader
  - subtitle file reader
  - onboarding
  - vocabulary/review flow
  - at least one video platform subtitle path
- add browser-backed CI for existing live scenarios and start extending it to the highest-risk user surfaces

#### C. Release proof
- tighten promotion/readiness logic so these surfaces are not “code exists only” features

### Key files/modules
- `src/entrypoints/pdf-reader/*`
- `src/entrypoints/epub-reader/*`
- `src/entrypoints/subtitle-reader/*`
- `src/entrypoints/content/subtitle-translate.ts`
- `src/entrypoints/content/video-platforms/*`
- `bench-live/*`
- `.github/workflows/ci.yml`
- `docs/investigations/workstream-b-app-completion-audit.md`
- `docs/investigations/workstream-a-live-coverage-matrix.md`

### Done when
- PDF/EPUB/subtitle/video are no longer “present but under-validated” in the audit sense
- CI includes meaningful browser-backed validation, not only JSDOM/unit coverage
- support/claim language for these owned surfaces is based on current validation evidence

### Risks
- platform-specific subtitle selectors breaking faster than coverage is added
- reader surfaces remaining technically present but still not releasable
- spending on new surfaces before the first owned surfaces are credible

---

## Phase 5 — Portable mobile entry hardening
**Window:** 2026-09-16 → 2026-10-12

### Goal
Prove the bridge-first mobile story without opening a second product/platform program.

### Scope
- mobile viewport hardening for Web/PWA auth + account + lifecycle + learning loop
- install/update/offline strategy review for the PWA shell
- real-device iOS Safari shell/bridge validation:
  - popup/content/background/storage/messaging stability
  - open-in-app / replay / handoff behavior
  - front-door auth behavior after full auth authority changes
- optional Android Chrome/PWA smoke only
  - no Android app/module
  - no support-matrix upgrade unless evidence is real

### Key files/modules
- `web/src/app.tsx`
- `web/src/styles.css`
- `web/public/manifest.webmanifest`
- `web/public/sw.js`
- `src/utils/ui/useViewportProfile.ts`
- `src/utils/extension/ios-host-bridge.ts`
- `ios/README.md`
- `docs/ios-safari-smoke-test.md`
- `docs/investigations/support-matrix-2026-q2.md`

### Done when
- mobile web/PWA is proven as the portable control-plane and learning entry on real narrow viewports
- iOS shell remains experimental, but with current evidence instead of assumption
- documentation and claims stay honest and precise

### Risks
- conflating portable web success with native-shell parity
- turning optional Android smoke into an unbounded platform effort
- ignoring service-worker/update/offline behavior until too late

---

## 7. Cross-cutting workstreams

## 7.1 Validation and CI
This is not optional supporting work. It is a release blocker.

### Must happen across the window
- add browser-backed CI for extension/live scenarios
- raise automated coverage for:
  - onboarding
  - vocabulary/review
  - readers
  - subtitle/video surfaces
- add stronger holdout/release gating where practical
- reduce the number of user-visible features that are only unit-tested or untested

### Why
The app-completion audit is clear: too many visible surfaces still have weak automation.

## 7.2 Privacy, quota, and operator proof
- keep privacy-mode and request-sanitization behavior as release-blocking properties
- add runtime validation where quota/account/billing surfaces matter
- ensure operator surfaces explain:
  - usage
  - lifecycle jobs
  - sync repair/compaction
  - auth issuance state

## 7.3 Distribution and claims
- keep `support-matrix-2026-q2.md` canonical
- only widen claims when there is real validation evidence
- do not let buildability become support language

---

## 8. Monthly execution view

| Window | Primary theme | Secondary theme | What should be true at the end |
|---|---|---|---|
| Apr 12 – May 15 | Auth/front-door stabilization | Observability + cleanup | Worker auth issuance is canary-safe and operationally explainable |
| May 16 – Jun 30 | Account/usage/plan + billing substrate | Translate decision prep | Control-plane and business state are coherent enough to support growth work |
| Jul 1 – Aug 10 | Learning loop completion | Onboarding/popup/options integration | Users can actually accumulate and revisit learning assets coherently |
| Aug 11 – Sep 15 | Owned readers/video + validation | Browser-backed CI | Reader/video surfaces are no longer “implemented but unproven” |
| Sep 16 – Oct 12 | Mobile/PWA/iOS proof | Claim and release boundary cleanup | Portable mobile entry is validated without opening Android/native scope |

---

## 9. Work items by size

## Item 1 — Stabilize auth/session authority
- **Goal:** prove the completed auth front door under real rollout conditions.
- **Done when:** canary/rollback/observability and Node compatibility are solid.
- **Dependencies:** none; start immediately.
- **Size:** Large.

## Item 2 — Account/usage/plan and billing substrate
- **Goal:** close the remaining business/control-plane authority gaps without touching translation hot path.
- **Done when:** coherent account surface and explicit billing state strategy exist.
- **Dependencies:** Item 1.
- **Size:** Large.

## Item 3 — Finish the learning loop
- **Goal:** connect vocabulary, history, progress, and review into a real product loop.
- **Done when:** the loop is visible, usable, and backed by continuity lifecycle controls.
- **Dependencies:** light dependency on Item 2 for cleaner control-plane state.
- **Size:** Large.

## Item 4 — Validate owned surfaces and release gates
- **Goal:** bring readers/video/onboarding/vocabulary under real browser-backed and integration validation.
- **Done when:** high-visibility surfaces are no longer audit liabilities.
- **Dependencies:** Items 1 and 3.
- **Size:** Large.

## Item 5 — Prove portable mobile entry
- **Goal:** keep mobile bridge-first and validate it honestly.
- **Done when:** mobile web/PWA and iOS bridge have real-device or narrow-viewport evidence; Android remains optional smoke only.
- **Dependencies:** Items 1, 2, 3.
- **Size:** Medium.

---

## 10. What should not be started during this window

If any of the following appears during execution, treat it as scope creep unless there is a separate plan and explicit reason:

- full `translate` authority migration to Worker
- full billing/platform migration beyond the substrate needed for account coherence
- Android application work
- heavier native mobile shells
- Durable Objects rollout
- image/comic translation program
- auth modernization unrelated to current issuance/validation stability

---

## 11. Decision gates for the end of the window

At the end of six months, Astra should make four explicit decisions:

1. **Translate authority**
   - keep Node-owned for another phase, or begin a dedicated migration plan

2. **Billing/account ownership**
   - whether the control-plane work is enough, or whether broader account/billing authority migration is justified

3. **Mobile**
   - whether iOS shell evidence is strong enough to keep investing
   - whether Android deserves anything beyond PWA smoke

4. **Release claims**
   - whether owned readers/video/learning loop are validated enough to change public positioning

---

## 12. Short version

The next six months should not be “more Cloudflare for its own sake.”

It should be:
- stabilize the auth front door,
- finish account/control-plane coherence,
- complete the learning loop,
- validate the owned reading/video surfaces,
- prove the mobile web + iOS bridge path,
- and keep the support/claim boundary honest.

That is the highest-leverage path from the current completed baseline.
