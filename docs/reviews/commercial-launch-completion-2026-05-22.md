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
| Last commit observed before Cloudflare deploy pass | `9b5d9f9` (`chore: harden store packaging`). |
| Working tree state observed | Dirty during this evidence update: Cloudflare deployment configuration and evidence docs are present in this pass. |
| Work Item 5 files added | `docs/runbooks/commercial-public-launch.md`, `docs/reviews/commercial-launch-completion-2026-05-22.md` |

Observed working tree changes record the Cloudflare free-beta deployment evidence. They do not certify browser-store submission, legal approval, or paid commercial availability.

## Work Item status summary

| Work item | Repo-side status | External/public status | Evidence |
|---|---:|---:|---|
| 1. Claim, legal, and store-copy freeze | Ready for repo copy freeze | Legal/privacy review and store questionnaire approval not evidenced | `docs/reviews/commercial-launch-claims-2026-05-22.md` |
| 2. Free public backend and web deployment runbook | Deployed and smoke-tested for free public beta | Relay-lite Worker and Astra Web Pages are live; store/legal/support gates remain separate | `docs/runbooks/free-public-launch-backend.md`, `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md` |
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

### Follow-up store packaging hardening — 2026-05-23

A follow-up hardening pass added WXT source-package excludes for ignored/generated benchmark and live-browser artifact roots in `wxt.config.ts`, including both legacy top-level result paths and canonical `data/bench-live-results/`. This specifically prevents local live-bench browser profile directories such as `_extension-profile-*` and their Unix sockets from being read during Firefox source packaging.

Targeted verification from `/Users/ruirui/Downloads/GitHub/Astra`:

| Command / check | Exit status | Evidence / notes |
|---|---:|---|
| `pnpm type-check` | 0 | WXT config and TypeScript checks passed. |
| Simulated sockets under `data/bench-live-results/_extension-profile-packaging-hardening/SingletonSocket` and `bench-live-results/_extension-profile-packaging-hardening/SingletonSocket`, then ran `pnpm zip` | 0 | Chrome zip succeeded with generated live-bench profile sockets present. |
| Same socket simulation, then ran `pnpm zip:firefox` | 0 | Firefox extension zip and WXT source zip succeeded with generated live-bench profile sockets present. |
| Same socket simulation, then ran `pnpm zip:safari` | 0 | Safari zip succeeded with generated live-bench profile sockets present. |
| Python zip inspection of `.output/astra-0.1.0-sources.zip` for bench result paths | 0 | Found `0` generated bench/live result entries in the source zip. |
| `pnpm check:repo-knowledge` | 0 | Repo-knowledge guardrail passed; Node emitted only the existing `module.register()` deprecation warning. |

## Artifact record

Launch artifacts were built locally for verification, and the Cloudflare web/relay-lite deployment was executed in this pass. No browser-store upload occurred in this pass.

| Artifact | Path | SHA-256 | Status |
|---|---|---:|---|
| Chrome MV3 zip | `.output/astra-0.1.0-chrome.zip` | `e8984ef6837ff8ad2b36202f215f828666ef0a3636b2f12c879e638e5925db35` | Built locally after packaging hardening; not uploaded. |
| Firefox MV3 zip | `.output/astra-0.1.0-firefox.zip` | `295c52200f0f141a380fcfc79c789ef9b55113f140b4d7ffb887fed1a3993b6e` | Built locally after packaging hardening with generated live-bench sockets present; not uploaded. |
| Safari MV3 zip | `.output/astra-0.1.0-safari.zip` | `2e05680bcf0f5a44d0b67e5eeedbb8f8945d6f0c65829b5e9b64ff50ce7e162b` | Built locally after packaging hardening; App Store artifact/upload not performed. |
| Web build/deploy output | `https://astra-web.pages.dev` / `https://55846464.astra-web.pages.dev` | `TBD` | `pnpm deploy:web:cloudflare` built and deployed 12 files. |
| Relay-lite Worker deployment | `https://astra-relay-lite.courseshare.workers.dev` | `35e5fd09-46fa-43a6-b188-ed9d1c0fe6b6` | `pnpm deploy:relay-lite:cloudflare` deployed with production CORS. |

## Deployment URLs and production configuration

| Field | Current value | Status |
|---|---|---:|
| Final public web origin | `https://astra-web.pages.dev` | Deployed and smoke-tested. |
| Final relay-lite API base URL ending `/v1` | `https://astra-relay-lite.courseshare.workers.dev/v1` | Deployed and smoke-tested. |
| Optional platform Worker API base URL | Relay-lite `/v1` for this free-beta deployment | Full platform Worker remains not launched. |
| Cloudflare relay-lite Worker URL | `https://astra-relay-lite.courseshare.workers.dev` | Worker version `35e5fd09-46fa-43a6-b188-ed9d1c0fe6b6`. |
| Cloudflare Pages web URL | `https://astra-web.pages.dev` / `https://55846464.astra-web.pages.dev` | Deployed via `pnpm deploy:web:cloudflare`. |
| `OPENROUTER_API_KEY` production secret | Functionally confirmed | `POST /v1/translate` returned a real translation; value not recorded. |
| `ASTRA_SESSION_SECRET` production secret | Functionally confirmed | Anonymous auth/session bearer flow passed; value not recorded. |
| Provider budget/spend controls | Not evidenced | Confirm in provider account before broad public traffic. |
| Relay-lite rollback reference | `35e5fd09-46fa-43a6-b188-ed9d1c0fe6b6` | Previous deployments visible via Wrangler deployment history. |
| Web rollback reference | `https://55846464.astra-web.pages.dev` | Cloudflare Pages deployment reference from this pass. |

## Backend production smoke

Status: **passed** for the free public beta Cloudflare deployment. See `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md`.

| Smoke check | Status | Evidence / notes |
|---|---:|---|
| Web production origin | Pass | `https://astra-web.pages.dev` returned `HTTP/2 200`. |
| Web bundle API configuration | Pass | Production JS contains `https://astra-relay-lite.courseshare.workers.dev/v1`. |
| CORS preflight from final web origin | Pass | `OPTIONS /v1/auth/anonymous` returned `204` and exact allow-origin `https://astra-web.pages.dev`. |
| `POST /v1/auth/anonymous` | Pass | Anonymous/free session token issued. |
| `GET /v1/auth/session` | Pass | Bearer session refresh works. |
| `GET /v1/account/summary` | Pass | Free quota summary returned. |
| `GET /v1/sync/bootstrap` | Pass | Endpoint returned successfully with default/empty bootstrap state. |
| `POST /v1/translate` | Pass | `Hello, world.` translated to `你好，世界。`. |

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
- Final public web origin is deployed: `https://astra-web.pages.dev`.
- Final relay-lite API base URL is deployed: `https://astra-relay-lite.courseshare.workers.dev/v1`.
- Cloudflare production deploy evidence is recorded for free public beta web + relay-lite.
- Production `OPENROUTER_API_KEY` and `ASTRA_SESSION_SECRET` are functionally confirmed by smoke, but provider budget-control evidence is still external.
- Production backend/web smoke has passed against final origins.
- No Chrome Web Store, AMO, or Apple submission is recorded.
- No store approval or public listing/live channel is recorded.
- No legal/privacy approval is recorded.
- No final support/incident owner is recorded.
- Launch artifact paths and local hashes are recorded for the packaging-hardening pass, but no artifacts have been uploaded to a public store.
- Firefox remains a beta follow-up, Desktop Safari remains beta, and iOS Safari shell remains experimental.
- Paid subscriptions, Pro upgrades, billing, durable paid entitlements, and paid quota reconciliation remain blocked by `docs/runbooks/billing-free-policy.md`.

## Rollback readiness

| Area | Status | Evidence / notes |
|---|---:|---|
| Relay-lite rollback | Deployment reference recorded | Current Worker version `35e5fd09-46fa-43a6-b188-ed9d1c0fe6b6`; previous deployments visible via Wrangler deployment history. |
| Web rollback | Deployment reference recorded | Current Pages deployment `https://55846464.astra-web.pages.dev`; rollback via Cloudflare Pages deployments. |
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

Repo-side launch documentation and the free public beta Cloudflare web/relay-lite deployment are complete. Astra is **not submitted, not approved, and not launched through browser stores** as of this evidence record. Legal/privacy approval, support ownership, store submission, store approval, and public store live-channel evidence are still required before any public commercial launch verdict can advance.
