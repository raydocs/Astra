# Commercial Launch Completion Evidence — 2026-05-22

**Status:** Repo-side commercial launch packet and mechanical gates completed.  
**Current launch verdict:** `ready` — repo-side launch runbook/evidence packet and local verification gates are ready, but public launch is **not submitted, not approved, and not launched**.

This record intentionally distinguishes repository readiness from public commercial availability. External deploys, browser-store submissions, legal/privacy approvals, support operations, and store approvals are not complete unless explicitly evidenced below.

## Verdict rule

Allowed verdicts for this record are: `ready`, `submitted`, `approved`, `launched`, `rolled back`.

Current verdict: `ready`.

`ready` here means the repo-side launch procedure and evidence template exist. It does **not** mean Astra is publicly launched.

Do not change this record to `launched` until at least one intended public distribution channel is both:

1. externally approved, and
2. publicly live/available,

with production smoke, support/incident owner, and rollback evidence recorded.

## Repository snapshot

| Field | Value |
|---|---|
| Evidence date | 2026-05-22 |
| Repo path | `/Users/ruirui/Downloads/GitHub/Astra` |
| Branch | `main` tracking `origin/main` |
| Last commit observed | `9b9b1a5dc58dd2c873500a14db3c76dc2b08b025` (`chore: align release gates`) |
| Working tree state observed | Dirty: commercial launch readiness docs/copy/config-example changes are present and not yet committed in this record. |
| Work Item 5 files added | `docs/runbooks/commercial-public-launch.md`, `docs/reviews/commercial-launch-completion-2026-05-22.md` |

Observed working tree changes are repo-side launch-readiness work. They do not certify external deployment, store submission, legal approval, or public availability.

## Work Item status summary

| Work item | Repo-side status | External/public status | Evidence |
|---|---:|---:|---|
| 1. Claim, legal, and store-copy freeze | Ready for repo copy freeze | Legal/privacy review and store questionnaire approval not evidenced | `docs/reviews/commercial-launch-claims-2026-05-22.md` |
| 2. Free public backend and web deployment runbook | Runbook/template ready | Production relay-lite/web deploy and smoke not executed; final URLs/secrets external blockers | `docs/runbooks/free-public-launch-backend.md`, `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md` |
| 3. Store packaging, screenshots, and submission readiness | Runbook ready | Chrome/AMO/Safari submissions and approvals not evidenced | `docs/runbooks/browser-store-submission.md` |
| 4. Billing/free-policy decision and paid-launch blocker list | Free-beta policy and paid blocker list ready | Paid launch remains blocked | `docs/runbooks/billing-free-policy.md` |
| 5. Launch runbook and completion evidence | Complete in repo | Public launch not executed | `docs/runbooks/commercial-public-launch.md`, this file |

## Launch gate commands

These commands were run locally after Work Items 1–5, from `/Users/ruirui/Downloads/GitHub/Astra`, using the current working tree.

| Command | Exit status in this pass | Evidence / notes |
|---|---:|---|
| `pnpm install --frozen-lockfile` | 0 | Lockfile up to date; WXT prepare completed; ignored `esbuild` build-script warning only. |
| `pnpm check:repo-knowledge` | 0 | Repo-knowledge guardrail passed. |
| `pnpm check:zod-entrypoints` | 0 | Zod entrypoint guardrail passed for 14 bundles. |
| `pnpm lint:ci` | 0 | Release-scoped lint passed. |
| `pnpm type-check` | 0 | Extension and web TypeScript checks passed. |
| `pnpm test` | 0 | 161 test files / 1416 tests passed. |
| `pnpm bench` | 0 | 63 deterministic scenarios passed; average score 99; history `data/bench-results/history/2026-05-23T05-36-42-056Z.json`. |
| `pnpm build` | 0 | Chrome MV3 build passed; content-script bundle guardrail passed. |
| `pnpm build:firefox` | 0 | Firefox MV3 build passed; content-script bundle guardrail passed. |
| `pnpm verify:firefox-lint -- .output/firefox-mv3` | 0 | Firefox extension lint passed; 0 errors, 0 notices, 18 generated warnings ignored by verifier. |
| `pnpm build:safari` | 0 | Safari MV3 build passed; canonicalization and content-script guardrail passed. |
| `pnpm ios:sync-extension` | 0 | Safari build synced into committed iOS extension resources. |
| `bash ios/scripts/verify-safari-build-sync.sh` | 0 | Safari build output matches iOS extension resources. |
| `pnpm build:web` | 0 | Web build passed; Vite chunk-size warning only. |
| `pnpm zip` | 0 | Chrome store zip generated at `.output/astra-0.1.0-chrome.zip`. |
| `pnpm zip:firefox` | 0 after cleanup/retry | First attempt failed because WXT source packaging hit a local generated live-bench browser profile socket under `bench-live-results/_extension-profile-*`; those generated profiles were removed and retry passed. |
| `pnpm zip:safari` | 0 | Safari zip generated at `.output/astra-0.1.0-safari.zip`. |
| `CI=true pnpm bench:live:lane:release-proof` | 0 | Required live lane passed. Run IDs: `live-20260523T053751-zwpxan`, `live-20260523T053758-wtwo3x`, `live-20260523T053800-47t438`, `live-20260523T053802-e76gbv`, `live-20260523T053853-dkbg4w`, `live-20260523T053855-skvjjg`. |
| `CI=true pnpm bench:live:lane:learning-loop` | 0 | Required live lane passed. Run IDs: `live-20260523T053858-523w2m`, `live-20260523T053905-8ekbxb`, `live-20260523T053908-cihodl`. |

## Artifact record

Launch artifacts were built locally for verification, but no store upload occurred in this pass.

| Artifact | Path | SHA-256 | Status |
|---|---|---:|---|
| Chrome MV3 zip | `.output/astra-0.1.0-chrome.zip` | `b86334a198f3751fd9bc058627a98792ae9adb8f52f05e9945b51e183f1704f1` | Built locally; not uploaded. |
| Firefox MV3 zip | `.output/astra-0.1.0-firefox.zip` | `89d6bca4718da966c90db965dcbf539f0a05b2cc50344cf71046279d61dd58dc` | Built locally after generated live-bench profile cleanup; not uploaded. |
| Safari MV3 zip | `.output/astra-0.1.0-safari.zip` | `9f38a2f78ed5a6f75f5f7f73ff083fd63f526fde815ebfbbcae5185b890e2999` | Built locally; App Store artifact/upload not performed. |
| Web build/deploy output | Cloudflare Pages deployment URL | `TBD` | `pnpm build:web` passed; not deployed. |
| Relay-lite Worker deployment | Cloudflare Worker deployment URL | `TBD` | Not deployed. |

## Deployment URLs and production configuration

| Field | Current value | Status |
|---|---|---:|
| Final public web origin | `TBD` | External blocker. |
| Final relay-lite API base URL ending `/v1` | `TBD` | External blocker. |
| Optional platform Worker API base URL | `TBD / not launched` | External blocker if article import is included. |
| Cloudflare relay-lite Worker URL | `TBD` | Not deployed/evidenced. |
| Cloudflare Pages web URL | `TBD` | Not deployed/evidenced. |
| `OPENROUTER_API_KEY` production secret | Not recorded | Must be set in Cloudflare only; no value should be pasted here. |
| `ASTRA_SESSION_SECRET` production secret | Not recorded | Must be set in Cloudflare only; no value should be pasted here. |
| Provider budget/spend controls | Not evidenced | External blocker before managed relay launch. |
| Relay-lite rollback reference | `TBD` | Requires actual Cloudflare deployment. |
| Web rollback reference | `TBD` | Requires actual Cloudflare Pages deployment. |

## Backend production smoke

Status: **not executed** for Work Item 5. `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md` currently records the backend/web smoke as blocked by external launch prerequisites.

| Smoke check | Status | Evidence / notes |
|---|---:|---|
| CORS preflight from final web origin | Not run | Final web origin and API base not recorded. |
| `POST /v1/auth/anonymous` | Not run | Requires deployed relay-lite. |
| `GET /v1/auth/session` | Not run | Requires deployed relay-lite and session token. |
| `GET /v1/account/summary` | Not run | Requires deployed relay-lite. Free active semantics only. |
| `GET /v1/sync/bootstrap` | Not run | Requires deployed relay-lite. |
| `POST /v1/translate` | Not run | Requires deployed relay-lite, provider key, and budget controls. |
| Web-to-relay browser-origin smoke | Not run | Requires final web deployment and CORS configuration. |

## Browser/package live smoke

Status: **local required live lanes passed**. Public installed-store smoke is not executed because no external store channel is submitted/approved/live yet.

| Smoke check | Status | Evidence / notes |
|---|---:|---|
| Public Chrome install / approved package install | Not run | Chrome Web Store item not submitted/approved/live. |
| Extension version/manifest matches artifact | Local build passed | `.output/chrome-mv3`, `.output/firefox-mv3`, and `.output/safari-mv3` built successfully. |
| Public article page translation | Local live pass | Covered by `release-proof` source-core live runs. |
| Selection toolbar translate/explain | Not run as public-store smoke | Requires approved/installed launch artifact; deterministic benches remain green. |
| Popup/study/free-beta language check | Local live pass | Covered by `learning-loop` live runs. |
| Options provider/privacy controls | Local build/test pass | Public-store smoke still pending. |
| Managed relay translation through final production API | Not run | Requires deployed relay-lite and production smoke. |
| Public privacy/support links resolve | Not run | Final public URLs not recorded. |

## Store channel status

No external store submission or approval was evidenced during Work Item 5.

| Channel | Artifact path | SHA-256 | Store item ID / URL | Submission status | Submitted at | Approval/live status | External blockers |
|---|---|---:|---|---:|---:|---:|---|
| Chrome Web Store | `.output/<chrome-zip>` | `TBD` | `TBD` | Not submitted | `TBD` | Not approved/live | Developer account + 2SV, final URLs, final screenshots/assets, legal/privacy review, support owner, production backend/web evidence if managed relay is enabled. |
| Firefox AMO | `.output/<firefox-zip>` | `TBD` | `TBD` | Beta follow-up / not submitted | `TBD` | Not approved/live | AMO credentials, source package if required, final privacy/support URLs, beta approval, fresh Firefox evidence. |
| Desktop Safari App Store | `<Xcode/App Store artifact>` | `TBD` | `TBD` | Beta blocker / not submitted | `TBD` | Not approved/live | Apple Developer, signing/profiles, App Store Connect, privacy labels, device-backed smoke. |
| iOS Safari shell | `<Xcode/App Store artifact>` | `TBD` | `TBD` | Experimental / not submitted | `TBD` | Not approved/live | iOS device/TestFlight evidence, iOS privacy/screenshots/support, App Review readiness. |

## Legal, privacy, and support approvals

| Approval / operation | Status | Evidence / notes |
|---|---:|---|
| Legal review of `store/privacy-policy.md` | Not evidenced | Required before public store submission. |
| Chrome privacy questionnaire approval | Not evidenced | Must align with final deployment and copy. |
| AMO data/privacy approval | Not evidenced | Required before Firefox beta submission. |
| Apple privacy labels approval | Not evidenced | Required before Safari/App Store path. |
| Provider/subprocessor/data-processing review | Not evidenced | Required before public managed relay launch. |
| Final support URL or monitored inbox | Not evidenced | Required before public launch. |
| Incident owner | Not assigned in this record | Must be named before public launch. |
| Provider/budget owner | Not assigned in this record | Must be named before managed relay launch. |
| Release manager | Not assigned in this record | Must be named before launch execution. |
| Backend/deploy owner | Not assigned in this record | Must be named before deploy. |
| Store owner | Not assigned in this record | Must be named before store upload. |

## Known limitations and blockers

- Public launch is limited to a free public beta; paid launch remains blocked.
- No final public web origin is recorded.
- No final relay-lite API base URL is recorded.
- No Cloudflare production deploy evidence is recorded.
- No production `OPENROUTER_API_KEY`, `ASTRA_SESSION_SECRET`, or provider budget-control evidence is recorded.
- No production backend/web smoke has been run against final origins.
- No Chrome Web Store, AMO, or Apple submission is recorded.
- No store approval or public listing/live channel is recorded.
- No legal/privacy approval is recorded.
- No final support/incident owner is recorded.
- No launch artifact paths or hashes are recorded.
- Firefox remains a beta follow-up, Desktop Safari remains beta, and iOS Safari shell remains experimental.
- Paid subscriptions, Pro upgrades, billing, durable paid entitlements, and paid quota reconciliation remain blocked by `docs/runbooks/billing-free-policy.md`.

## Rollback readiness

| Area | Status | Evidence / notes |
|---|---:|---|
| Relay-lite rollback | Template only | See `docs/runbooks/free-public-launch-backend.md`; actual deployment reference pending. |
| Web rollback | Template only | See `docs/runbooks/free-public-launch-backend.md`; actual Pages deployment reference pending. |
| Store rollback | Template only | See `docs/runbooks/commercial-public-launch.md`; no submitted/approved/live channel exists yet. |
| Provider key rotation / abuse response | Not evidenced | Must be assigned before managed relay launch. |
| Support incident process | Not evidenced | Must be assigned before public launch. |

## Completion checklist for Work Item 5

- [x] Created `docs/runbooks/commercial-public-launch.md`.
- [x] Created `docs/reviews/commercial-launch-completion-2026-05-22.md`.
- [x] Completion evidence records git SHA/branch/worktree state observed.
- [x] Completion evidence records command list and current exit-status state.
- [x] Completion evidence records artifact/deployment/store/legal/smoke/support fields as pending where not evidenced.
- [x] Verdict uses one of the required values: `ready`.
- [x] `launched` is explicitly blocked until at least one intended public distribution channel is approved and live.

## Current launch verdict

`ready`

Repo-side launch documentation for Work Item 5 is complete. Astra is **not submitted, not approved, and not launched** as of this evidence record. External deployment, legal/privacy approval, support ownership, store submission, store approval, and public live-channel evidence are still required before any public launch verdict can advance.
