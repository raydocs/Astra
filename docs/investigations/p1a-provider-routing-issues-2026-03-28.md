# P1-A Provider Breadth / Routing Depth — First Issue Pack

_Last updated: 2026-03-28_

This issue pack breaks the first execution wave of `P1-A` into implementable units. The goal of the first wave is **not** to deliver the full multi-provider ecosystem. The goal is to make Astra’s current provider path materially more resilient and measurable.

---

## Execution update — 2026-03-28

### Overall status
Validated.

The provider-routing / site-automation hardening slice is now green across:
- deterministic provider-routing coverage
- deterministic site-automation restart coverage
- live source-backed background-routed coverage
- live source-backed active-session restart coverage

### What shipped
- direct → relay fallback is implemented and benchmark-visible
- routing metadata now exposes the effective transport and whether fallback occurred
- provider failure-class policy is covered by explicit tests
- active-session provider/site updates restart predictably and expose the restarted route
- provider fallback is promoted into both deterministic and live benchmark surfaces

### Additional hardening completed during validation
- bench/runtime listener dispatch now supports all three extension listener styles:
  - `sendResponse` callback
  - direct synchronous return
  - `Promise<response>` return
- deterministic and live active-session restart scenarios now track real session restarts via `sessionId`, not only request-count deltas
- source-backed provider-switch / combined update scenarios now route through the real background/router path rather than harness-authored routing metadata
- background error handling tests now distinguish:
  - `AstraError` preserving its real code such as `CONFIG_MISSING`
  - non-`AstraError` values mapping to `UNKNOWN`
  - error metadata propagation when routing metadata exists

### Deterministic verification

#### Provider-routing surface
Status: **pass**

- surface: `provider-routing`
- result: `10/10` scenarios passed
- score: `100`

Covered paths include:
- direct success
- direct failure with relay fallback
- relay-only routing
- fallback exhaustion
- parse/config/auth classification
- non-`AstraError` fail-fast handling

#### Site-automation surface
Status: **pass**

- surface: `site-automation`
- result: `7/7` scenarios passed
- score: `100`

Covered paths include:
- site-rule update restarts the active session exactly once
- provider switch restarts the active session exactly once
- combined provider + site update performs a single restart through the real background route

### Live source-backed verification

All critical holdouts in this slice are green.

#### Background-routed page translation
- `background-routed-direct-success-page-translation-source` — **pass**
  - runtime translate requests: `1`
  - relay fetch requests: `0`
  - final transport: `direct`
  - fallback used: `false`
- `background-routed-relay-only-page-translation-source` — **pass**
  - runtime translate requests: `1`
  - relay fetch requests: `1`
  - final transport: `relay`
  - fallback used: `false`
- `background-routed-direct-relay-fallback-page-translation-source` — **pass**
  - runtime translate requests: `1`
  - relay fetch requests: `1`
  - final transport: `relay`
  - fallback used: `true`

#### Active-session restart / recovery
- `site-rule-update-restarts-active-session-source` — **pass**
  - requests before update: `1`
  - requests after update: `2`
  - restart session count: `1`
  - restarted target language: `ja`
  - restarted presentation mode: `translation-only`
- `provider-switch-restarts-active-session-source` — **pass**
  - requests before update: `1`
  - requests after update: `2`
  - restart session count: `1`
  - initial transport: `direct`
  - restarted transport: `relay`
  - restarted fallback used: `false`
- `provider-and-site-rule-update-single-restart-source` — **pass**
  - requests before update: `1`
  - requests after update: `2`
  - restart session count: `1`
  - initial transport: `direct`
  - restarted transport: `relay`
  - restarted target language: `ja`
  - restarted presentation mode: `translation-only`

### Important live-only note: translation cache can mask restart evidence

During source-backed provider-switch validation, the second run initially reused cached translations and therefore produced no new runtime request. That made the restart scenario look under-triggered even though the session had restarted.

To make the restart observable in live source-backed runs, the harness now clears the `astra-translation-cache` IndexedDB database before the provider switch in that scenario.

This is a harness observability fix, not a production routing-policy change.

### Confidence / conclusion

This wave is ready to count as validated for the provider-routing issue pack:
- fallback behavior works
- routing metadata is visible
- failure policy is explicit
- active-session updates restart exactly once in the covered scenarios
- deterministic and live proof points now agree on the expected transport behavior

---

## Issue 1 — Provider transport fallback chain (direct → relay)

### Priority
P1

### Goal
If the configured provider has both:
- a direct API key, and
- Astra relay access

then Astra should attempt the direct transport first and automatically fall back to relay when the direct request fails.

### Scope
- `src/utils/providers/router.ts`
- `src/utils/providers/router.test.ts`
- `src/entrypoints/background/index.ts` only if route inputs need shaping
- deterministic benchmark coverage

### Non-goals
- no new provider IDs yet
- no multi-provider user config UI yet
- no fallback history UI yet

### Acceptance criteria
- direct-success path still works
- direct failure with relay available falls back cleanly
- fallback preserves request fields (`task`, `context`, `placeholderFormat`, `languageLevel`)
- no fallback when relay is unavailable
- deterministic bench proves fallback produces a successful page translation

### Status
Validated on 2026-03-28.

---

## Issue 2 — Routing policy / explicit fallback metadata

### Priority
P1

### Goal
Expose which transport path was used and whether fallback occurred.

### Scope
- provider router return metadata or side-channel telemetry
- background/runtime bridge if needed
- bench/live artifact visibility

### Acceptance criteria
- operator can tell whether a request used direct or relay
- operator can tell whether fallback happened
- fallback path is benchmark-visible

### Status
Validated on 2026-03-28.

---

## Issue 3 — Provider failure-class policy

### Priority
P1

### Goal
Define which provider failures should trigger fallback versus fail fast.

### Scope
- classify request vs parse vs config vs auth failures
- encode retry/fallback eligibility policy
- test the decision table

### Acceptance criteria
- fail-fast errors are explicit
- fallback-eligible errors are explicit
- no silent policy ambiguity remains in router code

### Status
Validated on 2026-03-28.

---

## Issue 4 — Active-session provider switch / recovery scenario

### Priority
P1

### Goal
If provider settings change while translation is active, Astra should recover predictably and measurably.

### Scope
- background/content integration
- deterministic automation scenario
- live scenario later

### Acceptance criteria
- settings update causes a clean restart or retry policy
- no stale provider state keeps running
- artifacts show the effective provider path after update

### Status
Validated on 2026-03-28.

---

## Issue 5 — Provider fallback benchmark surface

### Priority
P1

### Goal
Promote provider fallback into a first-class benchmark dimension rather than a one-off regression test.

### Scope
- deterministic bench scenario family
- evaluator notes / patch hints
- later live scenario family

### Acceptance criteria
- at least one deterministic green scenario for fallback success
- at least one deterministic failure scenario for fallback exhaustion
- routing/fallback clues appear in artifacts

### Status
Validated on 2026-03-28.

---

## Recommended implementation order
1. Issue 1
2. Issue 5 (deterministic lane)
3. Issue 2
4. Issue 3
5. Issue 4

Issue 1 + Issue 5 were the right first delivery because they improved real resilience immediately and created measurable proof. That proof has now been established in both deterministic and live source-backed runs.
