# Commercial Public Launch Plan — 2026-05-22

## Goal

Move Astra from release-candidate green to a truthful commercial public launch. The pragmatic launch path is **free public beta first**: deploy the web companion and relay-lite with real production secrets, publish browser-store packages with conservative claims, and explicitly block paid launch until billing, durable account state, entitlement enforcement, webhooks, and support/legal operations are implemented.

`docs/reviews/release-gates-2026-05-18.md` remains the RC quality baseline. It is not commercial launch approval.

## External Policy Anchors

- Chrome Web Store policies apply to the whole extension experience, including marketing materials and landing pages, and require safe, honest, privacy-forward behavior plus accurate metadata and support details: https://developer.chrome.com/docs/webstore/program-policies/
- Chrome policy details require current metadata, user-data disclosure/consent discipline, crash/bug testing, correct contact info, meaningful support, and ongoing policy compliance: https://developer.chrome.com/docs/webstore/program-policies/policies/
- Mozilla AMO policies require technical, privacy, transparency, and related standards for add-ons: https://www.mozilla.org/en-US/about/legal/amo-policies/
- Apple App Store privacy details require App Store Connect privacy disclosures for data collected by the app and third-party code: https://developer.apple.com/app-store/app-privacy-details/

## Launch Strategy

- **Allowed now:** Chrome-first free public beta if store copy, privacy policy, deployment, and evidence are aligned.
- **Beta-scoped:** Firefox and desktop Safari unless store approval and fresh platform evidence are recorded.
- **Experimental:** iOS Safari shell.
- **Blocked:** paid/commercial subscription launch, full cross-device continuity, local-only privacy claims, broad all-video-platform claims, image/comic translation claims.

## Work Items

### 1. Claim, legal, and store-copy freeze

**Goal:** Make public claims match current proof and free-beta architecture.

**Key files:** `store/listing-copy.md`, `store/amo-listing.md`, `store/description.md`, `store/privacy-policy.md`, `store/screenshots/README.md`, `README.md`, `docs/china-browser-compat.md`, new `docs/reviews/commercial-launch-claims-2026-05-22.md`.

**Done when:**

- [x] Store copy removes/qualifies Netflix, all-platform parity, local-only/privacy, paid, and no-account overclaims.
- [x] Privacy policy reflects direct provider + Astra relay/relay-lite data paths, local storage, optional sync/account surfaces, and privacy-mode request-context sanitization.
- [x] China/mobile compatibility matches canonical support matrix.
- [x] Screenshot requirements prioritize launch-safe surfaces and Chrome's practical 1–5 screenshot limit.
- [x] Claim ledger lists allowed/disallowed wording, evidence, and launch status.

**External dependency:** legal/privacy review and browser-store privacy questionnaires.

### 2. Free public production backend and web deployment runbook

**Goal:** Define and verify the free production path without pretending the Node relay is production paid infrastructure.

**Key files:** `src/web/.env.production.example`, `src/platform/relay-lite/wrangler.jsonc`, `src/platform/cloudflare/README.md`, new `docs/runbooks/free-public-launch-backend.md`, new `docs/reviews/commercial-launch-backend-smoke-2026-05-22.md`.

**Done when:**

- [x] Relay-lite is documented as the free public front door; Node relay and Cloudflare full platform remain non-authoritative for paid launch.
- [x] Required secrets/vars are documented: `OPENROUTER_API_KEY`, `ASTRA_SESSION_SECRET`, CORS origins, model, free quotas, TTL.
- [x] Smoke routes are specified: anonymous auth, session refresh, account summary, translate, sync bootstrap, CORS from final web origin.
- [x] Production deploy commands and rollback steps are documented without committing secrets.
- [x] Any unknown final domain/default relay URL is recorded as a blocker, not assumed.

**External dependency:** Cloudflare account, DNS/domain, Worker/Pages secrets, provider budget controls.

### 3. Store packaging, screenshots, and submission readiness

**Goal:** Produce a store-submission packet for Chrome-first launch and scoped Firefox/Safari follow-up.

**Key files:** new `docs/runbooks/browser-store-submission.md`, `store/screenshots/README.md`, `.github/workflows/firefox-release.yml`, package build scripts.

**Done when:**

- [x] Runbook lists artifact paths, manifest version, store title/descriptions, privacy URL, support URL, screenshots, permissions rationale, data-use answers, reviewer notes, submission status fields.
- [x] Chrome, Firefox, Safari build and zip commands are documented with expected outputs.
- [x] Firefox AMO workflow requirements are documented.
- [x] Safari/App Store path is explicitly beta/experimental unless signing, privacy labels, and device-backed smoke evidence are recorded.

**External dependency:** Chrome Web Store developer account + 2SV, AMO credentials, Apple Developer/App Store Connect, final screenshots.

### 4. Billing/free-policy decision and paid-launch blocker list

**Goal:** Launch free public beta truthfully and prevent mock billing from being presented as real paid launch.

**Key files:** new `docs/runbooks/billing-free-policy.md`, store/web copy, relevant web/account/billing docs.

**Done when:**

- [x] Free beta policy defines anonymous/session-backed managed translation, limited quotas, no paid upgrades, and no subscription claims.
- [x] Paid launch blockers are explicit: pricing, checkout success/cancel, webhook receiver, subscription persistence, entitlement enforcement, quota reconciliation, support/refund/cancel policy, account deletion/export production workflow, legal terms/privacy review.
- [x] Store/web copy avoids active `Pro`, `paid`, `upgrade`, or real billing claims unless disabled/marked unavailable.
- [x] Relay-lite `GET /v1/account/summary` free/active semantics are documented as free beta, not durable paid account quota.

**External dependency:** provider spend limits, support inbox/incident owner; later Stripe/Paddle/LemonSqueezy or equivalent.

### 5. Launch runbook and completion evidence

**Goal:** Make launch completion mechanical and auditable.

**Key files:** new `docs/runbooks/commercial-public-launch.md`, new `docs/reviews/commercial-launch-completion-2026-05-22.md`.

**Done when:**

- [x] Runbook sequences RC gates, claim/legal freeze, backend deploy, web deploy, package builds, store submissions, production smoke, rollback, support/incident process, and completion record.
- [x] Completion template records git SHA, commands, exit status, artifact paths, deployment URLs, store IDs/statuses, privacy/legal approval, backend/browser smoke, limitations, rollback, owners, verdict.
- [x] Verdict states one of: `ready`, `submitted`, `approved`, `launched`, `rolled back`.
- [x] It is impossible to mark `launched` before at least one intended public distribution channel is approved/live.

## Verification Baseline

Run before launch submission and again after launch-impacting changes:

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

Conditional privacy proof if privacy claims are strengthened:

```bash
CI=true pnpm bench:live -- --scenario bench-live/privacy-mode-page-translation-source
CI=true pnpm bench:live -- --scenario bench-live/holdout/privacy-mode-should-not-leak
```

## Execution Order

1. Claim/legal/store-copy freeze.
2. Free backend and deploy runbook.
3. Billing/free-policy guardrails.
4. Store submission runbook and screenshot packet.
5. Launch runbook/completion evidence.
6. Run mechanical gates and deploy/submission steps that are possible with available external credentials.
