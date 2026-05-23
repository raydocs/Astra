# Commercial Public Launch Runbook

**Date:** 2026-05-22  
**Scope:** Work Item 5 from `docs/plans/commercial-public-launch-2026-05-22.md`.

This runbook makes the free public beta launch mechanical and auditable. It sequences the already-scoped launch work, records the evidence required to advance each public channel, and prevents `launched` from being used before a public distribution channel is actually approved and live.

## Launch posture

Astra may proceed only as a **Chrome-first free public beta** unless a newer review supersedes this runbook.

- **Allowed launch state:** free public beta with conservative Chrome/Chromium claims.
- **Beta follow-up:** Firefox Desktop and Desktop Safari only after their store/signing/smoke evidence is recorded.
- **Experimental:** iOS Safari shell.
- **Blocked:** paid launch, Pro/subscription claims, production billing, durable paid entitlements, broad cross-device continuity, local-only privacy claims, Netflix/all-video-platform claims, and image/comic translation claims.

Authoritative supporting docs:

- `docs/plans/commercial-public-launch-2026-05-22.md`
- `docs/reviews/release-gates-2026-05-18.md`
- `docs/reviews/commercial-launch-claims-2026-05-22.md`
- `docs/runbooks/free-public-launch-backend.md`
- `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md`
- `docs/runbooks/browser-store-submission.md`
- `docs/runbooks/billing-free-policy.md`

## Verdict vocabulary

The completion evidence must use exactly one of these launch verdicts:

| Verdict | Meaning |
|---|---|
| `ready` | Repo-side launch packet/runbooks are ready to execute, but one or more public deployment, store, legal, or support steps may still be pending. This is not public availability. |
| `submitted` | At least one intended public distribution channel has been submitted for external review, but is not yet approved/live. |
| `approved` | At least one intended public distribution channel has been approved externally, but launch/public rollout is not yet confirmed live. |
| `launched` | At least one intended public distribution channel is approved and publicly live, and production smoke/support/rollback evidence is recorded. |
| `rolled back` | A previously submitted/approved/launched channel or production deployment has been rolled back or unpublished. |

Hard rule: **do not mark `launched` unless at least one intended public distribution channel is both approved and live.** Repository readiness, local release gates, deployed backend/web services, or a store submission alone are not enough.

## Owners to assign before launch execution

Record named owners in `docs/reviews/commercial-launch-completion-2026-05-22.md` before any public rollout:

| Area | Owner responsibility |
|---|---|
| Release manager | Owns this runbook, go/no-go decisions, evidence completeness, and final verdict. |
| Backend/deploy owner | Deploys relay-lite/web, validates production secrets, and owns rollback. |
| Store owner | Uploads artifacts, metadata, screenshots, privacy answers, reviewer notes, and records store status. |
| Legal/privacy owner | Approves privacy policy, store questionnaires, data-use answers, terms/support commitments, and provider/subprocessor posture. |
| Support/incident owner | Monitors support inbox, triages launch incidents, and coordinates public communication/rollback. |
| Provider/budget owner | Confirms OpenRouter/upstream provider terms, spend limits, abuse controls, and key rotation path. |

## Phase 0 — Preflight invariants

1. Confirm this is a **free public beta** execution, not paid launch.
2. Confirm Work Items 1–4 have current repo records:
   - Claims freeze: `docs/reviews/commercial-launch-claims-2026-05-22.md`
   - Backend/web deploy runbook and smoke template: `docs/runbooks/free-public-launch-backend.md`, `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md`
   - Store submission runbook: `docs/runbooks/browser-store-submission.md`
   - Billing/free policy: `docs/runbooks/billing-free-policy.md`
3. Confirm public copy has not strengthened claims since the claims freeze. If it has, update the claims ledger or stop.
4. Record git SHA, branch, dirty/clean state, and launch owner names in the completion evidence.
5. Confirm no secrets are committed and no public artifact contains placeholders, private keys, or paid-launch claims.

## Phase 1 — RC gates

Run from repo root with Node 22 and pnpm 10.

```bash
pnpm install --frozen-lockfile
pnpm check:repo-knowledge
pnpm check:zod-entrypoints
pnpm lint:ci
pnpm type-check
pnpm test
pnpm bench
pnpm build
pnpm build:firefox
pnpm verify:firefox-lint -- .output/firefox-mv3
pnpm build:safari
pnpm ios:sync-extension
bash ios/scripts/verify-safari-build-sync.sh
pnpm build:web
CI=true pnpm bench:live:lane:release-proof
CI=true pnpm bench:live:lane:learning-loop
```

Record every command, exit status, timestamp, and relevant artifact/result path in the completion evidence. The 2026-05-18 green release-gate review is the baseline, but launch execution should re-run gates after launch-impacting changes when practical.

Conditional privacy proof if privacy claims are strengthened:

```bash
CI=true pnpm bench:live -- --scenario bench-live/privacy-mode-page-translation-source
CI=true pnpm bench:live -- --scenario bench-live/holdout/privacy-mode-should-not-leak
```

Do not continue if a required gate fails unless the release manager records an explicit non-launch decision or rollback.

## Phase 2 — Claim, legal, and store-copy freeze

1. Re-read `docs/reviews/commercial-launch-claims-2026-05-22.md`.
2. Confirm store/web/public copy still matches the allowed/disallowed claim ledger.
3. Confirm final public URLs are available for:
   - homepage/web companion
   - privacy policy
   - support URL or support inbox
   - relay/API base where disclosed
4. Obtain legal/privacy approval for:
   - `store/privacy-policy.md`
   - Chrome privacy questionnaire answers
   - AMO privacy/data answers if submitting Firefox
   - Apple privacy labels if submitting Safari/App Store
   - support/contact commitments
   - upstream provider/data-processing terms
5. Record approval owner, timestamp, scope, and any limitations in the completion evidence.

No legal/privacy approval means the public launch can remain `ready` at most; it cannot be `submitted`, `approved`, or `launched` for a channel that requires those answers.

## Phase 3 — Backend deploy

Use `docs/runbooks/free-public-launch-backend.md` as the authoritative backend/web deployment runbook.

1. Record final `ASTRA_WEB_ORIGIN` and `ASTRA_API_BASE_URL` ending in `/v1`.
2. Configure Cloudflare Worker non-secret vars for final origins, model, free quotas, rate limit, and session TTL.
3. Install secrets in Cloudflare only; never paste values into docs:

```bash
pnpm dlx wrangler secret put OPENROUTER_API_KEY --config src/platform/relay-lite/wrangler.jsonc
pnpm dlx wrangler secret put ASTRA_SESSION_SECRET --config src/platform/relay-lite/wrangler.jsonc
```

4. Deploy relay-lite:

```bash
pnpm deploy:relay-lite:cloudflare
```

5. Record Worker URL, API base URL, deploy timestamp, deployer, and rollback reference.

## Phase 4 — Backend production smoke

Run the smoke commands from `docs/runbooks/free-public-launch-backend.md` against final production origins and record results in both:

- `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md`
- `docs/reviews/commercial-launch-completion-2026-05-22.md`

Required checks:

- CORS preflight from final web origin
- `POST /v1/auth/anonymous`
- `GET /v1/auth/session`
- `GET /v1/account/summary`
- `GET /v1/sync/bootstrap`
- `POST /v1/translate`

Do not substitute mocks or local relay results for production launch evidence. Provider-key, budget, CORS, or final-domain failures are external blockers and must stop public launch advancement.

## Phase 5 — Web deploy

1. Create production env locally or in CI/deploy tooling from `src/web/.env.production.example`.
2. Ensure `VITE_ASTRA_API_BASE_URL` points to the final relay-lite `/v1` API base.
3. Set `VITE_ASTRA_PLATFORM_BASE_URL` intentionally. If the full platform Worker is not launched, point it to the approved fallback/API base or mark article import as not launched.
4. Build/deploy:

```bash
pnpm build:web
pnpm deploy:web:cloudflare
```

5. Record Cloudflare Pages URL/custom domain, build artifact, deploy timestamp, and rollback reference.
6. Re-run CORS and browser-origin smoke after the final web origin is known. If the final web origin changes, redeploy relay-lite with updated CORS before public launch.

## Phase 6 — Package builds and artifacts

Use `docs/runbooks/browser-store-submission.md` for platform-specific details.

Chrome primary packet:

```bash
pnpm build
pnpm zip
shasum -a 256 .output/*.zip
```

Firefox beta packet:

```bash
pnpm build:firefox
pnpm verify:firefox-lint -- .output/firefox-mv3
pnpm zip:firefox
shasum -a 256 .output/*.zip
```

Safari beta/experimental packet:

```bash
pnpm build:safari
pnpm ios:sync-extension
bash ios/scripts/verify-safari-build-sync.sh
pnpm zip:safari
shasum -a 256 .output/*.zip
```

Record artifact path, SHA-256, command exit status, generated manifest version, and any reviewer-relevant notes. Do not upload artifacts that contain placeholders, secrets, paid claims, or claim-inconsistent metadata.

## Phase 7 — Store submissions

Chrome is the primary launch channel. Firefox and Safari remain scoped follow-ups unless their external evidence is complete.

For each channel, record in the completion evidence:

- artifact path and SHA-256
- store item ID / URL
- store-console metadata source
- privacy/support/homepage URLs
- screenshot/asset paths uploaded
- reviewer notes submitted
- submitted timestamp
- review status
- approval/live timestamp if applicable
- external blockers

Status rules:

- Before upload: `not submitted`.
- After upload/review request: completion verdict may advance to `submitted`.
- After external approval but before public availability is confirmed: completion verdict may advance to `approved`.
- After public listing/package availability is confirmed and production smoke/support/rollback records exist: completion verdict may advance to `launched`.

## Phase 8 — Production smoke after approval/live

After any intended channel is approved or live, test the actual public package/listing path, not only local builds.

Minimum Chrome-first live smoke:

1. Install the public Chrome Web Store item or approved review package according to the channel state.
2. Confirm extension version and manifest match the recorded artifact.
3. Run page translation on a public article page.
4. Run selection toolbar translate/explain.
5. Open popup/study hub and confirm free-beta/non-paid language.
6. Open options and confirm provider/privacy controls and no secret leakage.
7. If managed relay is enabled, confirm anonymous/session-backed translation through final relay-lite API.
8. Confirm support/privacy links in store listing resolve publicly.

Record browser, OS, extension version, store URL, test account/session posture, and pass/fail notes.

## Phase 9 — Support and incident process

Before public launch, the support/incident owner must record:

- monitored support URL or inbox
- expected initial response window
- incident severity rules
- provider-budget abuse escalation path
- Cloudflare rollback owner and access path
- store unpublish/rollback owner and access path
- public status/update channel if used
- key rotation path for provider/API/session secrets

Launch incidents that should trigger rollback consideration:

- provider spend spike or abuse not controlled by existing limits
- translation requests failing broadly in production
- CORS/session failures from the final web origin
- privacy/support links broken in public listings
- approved listing contains unsupported paid/privacy/platform claims
- store reviewer or policy notice requiring material correction
- security/privacy incident involving session tokens, provider keys, or user text

## Phase 10 — Rollback

Backend/web rollback:

- Use Cloudflare Worker and Pages deployment rollback from `docs/runbooks/free-public-launch-backend.md`.
- If provider spend or abuse is the issue, lower quotas/model, revoke or rotate provider keys, and redeploy after owner approval.
- Re-run production smoke after rollback.

Store rollback:

- Chrome: use Chrome Developer Dashboard controls to pause rollout, publish a corrected package, unpublish if necessary, or update listing metadata according to policy impact.
- Firefox: use AMO version disable/delete/update controls as applicable.
- Safari/App Store: use App Store Connect/TestFlight phased release, version removal, or metadata correction as applicable.

Record rollback reason, owner, timestamp, prior/current artifact, user impact, verification, and final verdict `rolled back` if a public channel/deployment was reverted.

## Phase 11 — Completion record

Maintain `docs/reviews/commercial-launch-completion-2026-05-22.md` as the launch record. It must include:

- git SHA, branch, and dirty/clean status
- command list with exit status and timestamps
- artifact paths and SHA-256 hashes
- deployment URLs and final origins
- store IDs/URLs/statuses for every attempted channel
- legal/privacy approval state
- backend smoke and browser smoke results
- limitations and unresolved blockers
- rollback references and owners
- final verdict from the allowed vocabulary

The release manager should update the completion record whenever a launch state changes from `ready` → `submitted` → `approved` → `launched`, or to `rolled back`.

## Work Item 5 completion checklist

- [x] Runbook sequences RC gates, claim/legal freeze, backend deploy, web deploy, package builds, store submissions, production smoke, rollback, support/incident process, and completion record.
- [x] Completion evidence template is specified in `docs/reviews/commercial-launch-completion-2026-05-22.md`.
- [x] Verdict vocabulary is restricted to `ready`, `submitted`, `approved`, `launched`, and `rolled back`.
- [x] `launched` is blocked until at least one intended public distribution channel is approved and live.
