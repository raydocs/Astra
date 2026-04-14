# Month 6 — Privacy / routing / failure inventory

_Task **`M6-G-01`**_

**Status:** inventory only. This document names guardrails, weak spots, and proof depth. It does **not** claim closure.

> **Update (next window, 2026-04-14):** the specific privacy-authority gap identified here is now resolved in `docs/investigations/privacy-authority-decision-2026-04-14.md`, the glossary contract gap is now resolved in `docs/investigations/glossary-contract-2026-04-14.md`, and the fallback disclosure / observability gap now has a canonical popup-backed local support/operator path in `docs/investigations/translation-routing-observability-2026-04-14.md`. This file remains the Month 6 baseline inventory snapshot.

## 1. Current source-of-truth paths

1. **`src/entrypoints/background/index.ts` — `handleTranslate`**  
   Background is the hot-path broker. It reads config + Astra session, resolves the effective provider config, applies translation cache reads/writes, calls `translateWithProviderDetailed`, records local usage, and returns runtime success/error payloads.

2. **`src/utils/providers/router.ts` — `translateWithProviderDetailed` / `classifyProviderFailure`**
   This is the transport router. It decides **direct**, **relay**, or **direct → relay fallback**, and emits routing metadata (`attemptedTransports`, `finalTransport`, `fallbackUsed`).

3. **`src/utils/providers/openai.ts` / `gemini.ts` / `relay.ts`**
   These are the actual egress points. They send request texts plus optional context/task/glossary fields to either the provider SDK or the Astra relay.

4. **`src/utils/privacy.ts`**
   This is the current privacy sanitizer. It only strips request-context fields; it does **not** own the full transport boundary.

5. **`src/entrypoints/content/page-translate.ts` / `subtitle-translate.ts` / `translation-context.ts` / `components/InputTranslate.tsx`**
   These are the main content-side callers that decide when privacy mode applies and whether sensitive input fields should be skipped.

6. **`src/utils/translate/translate.ts`**
   This is batching/orchestration only. It preserves request fields and returns typed success/error results, but it does not add independent privacy or fallback policy.

## 2. Privacy assertions that actually exist today

| Surface | Guardrail that really exists | Where enforced | Proof depth now | Honest limit |
|---|---|---|---|---|
| Input translation on form fields | Sensitive inputs/textareas are skipped based on field type/name/autocomplete heuristics | `src/utils/privacy.ts` → `isSensitiveInput`; used by `src/entrypoints/content/components/InputTranslate.tsx` | Unit: `src/utils/privacy.test.ts` | Heuristic only. It is not a universal PII detector. |
| Page translation request context | With `privacyMode=true`, request context is reduced to `hostname` + sanitized `pageUrl` (origin + path only) | `src/entrypoints/content/page-translate.ts` + `src/utils/privacy.ts` | Unit: `src/utils/privacy.test.ts`, `src/entrypoints/content/translation-context.test.ts`; live scenario path exists: `bench-live/privacy-mode-page-translation-source`, holdout `bench-live/holdout/privacy-mode-should-not-leak` | Background/provider layers trust caller context. If a new caller bypasses sanitization, the router will still send unsanitized context. |
| Subtitle translation request context | Same privacy-mode sanitization model as page translation | `src/entrypoints/content/subtitle-translate.ts` + `src/utils/privacy.ts` | Unit: `src/entrypoints/content/subtitle-translate.test.ts` | Same caller-owned limitation as page translation. |
| Popup study context | Privacy mode suppresses richer study context such as `articleExcerpt` | `src/entrypoints/content/translation-context.ts` → `buildPageStudyContext` | Unit: `src/entrypoints/content/translation-context.test.ts` | This protects popup/study context, not transport generally. |
| URL sanitization | Query string and fragment are stripped from `pageUrl` | `src/utils/privacy.ts` | Unit: `src/utils/privacy.test.ts` | Only applies when callers invoke sanitization. |
| Off-device disclosure boundary | None of the translation paths are local-only: both direct provider and relay paths send text + context off-device | `src/utils/providers/openai.ts`, `gemini.ts`, `relay.ts` | Code inspection only | Current privacy mode changes **what context is sent**, not whether content leaves the device. |

### Bottom line

**Protected now:** caller-side request-context sanitization for page translation and subtitle translation, plus sensitive-input blocking for input translation.
**Not protected as a hard system invariant:** the background/router/provider boundary itself. It will forward whatever sanitized-or-unsanitized payload it receives.

## 3. Routing / fallback classes that actually exist today

| Class | Actual behavior | Source |
|---|---|---|
| Empty request short-circuit | Returns success with `[]`; no provider dispatch | `background/index.ts`, `translate.ts` |
| Cache-only short-circuit | If all requested texts are cached, background returns immediately without provider dispatch | `background/index.ts` |
| Direct only | If API key exists and succeeds, request ends on direct provider transport | `providers/router.ts` |
| Relay only | If no direct API key but relay token + URL exist, request goes to relay | `providers/router.ts` |
| Direct → relay fallback | Only for `PROVIDER_REQUEST_FAILED` or non-`AstraError` messages matching the network regex, and only when relay access exists | `providers/router.ts` |
| Fail-fast direct error | `CONFIG_MISSING`, `CONTENT_UNAVAILABLE`, `PROVIDER_PARSE_FAILED`, `INVALID_RESPONSE`, `SITE_DISABLED`, `QUOTA_EXCEEDED`, `UNKNOWN` do **not** trigger relay fallback | `PROVIDER_FAILURE_POLICY` in `providers/router.ts` |
| Relay terminal failure | Relay errors still return routing metadata, but translation fails | `providers/router.ts` |
| Advisory quality warning only | Empty/suspicious/untranslated outputs produce warnings, never block success | `translate/quality-check.ts`, `translate.ts` |

## 4. Failure categories

### A. Privacy / disclosure failures

1. **Unsanitized caller payload reaches router**
   The background/provider stack does not re-sanitize. New or drifted callers can bypass the current privacy contract.

2. **Silent backend change on fallback**
   A direct request can fail and retry through relay without a user-visible disclosure at the moment of the request.

3. **Telemetry/error-string leakage risk**
   `translation_error` telemetry includes upstream `message`. If an upstream error ever echoes user content, that content can enter telemetry.

### B. Routing / transport failures

4. **Fallback misclassification**
   Network fallback for non-`AstraError` failures depends on a regex over the message string. Unusual transport failures may classify incorrectly.

5. **Relay credential drift**
   Missing/stale `relayBaseURL` or `accessToken` turns fallback into `CONFIG_MISSING` or relay-side request failure.

6. **Provider/model mis-resolution**
   `resolveManagedProviderConfig` can still route the wrong provider/model combination into the router if session/config state drifts.

### C. Contract / shape failures

7. **Provider/relay response shape mismatch**
   Zod parse failure or translation-count mismatch surfaces as provider parse/invalid-response errors.

8. **Batching vs real upstream limits**
   `MAX_BATCH_ITEMS`, `MAX_BATCH_CHARS`, and `MAX_CONCURRENCY` are local heuristics, not a negotiated provider contract.

### D. Evidence / observability failures

9. **Cache miss opacity**
   Cache read failures are swallowed and cache writes use `Promise.allSettled`; repeated requests may re-hit provider/relay without a visible explanation.

10. **Transport metadata stops early**
   Background runtime responses can include routing metadata and local usage storage records it, but not every user/support surface exposes it as the canonical answer to “which backend handled this request?”.

## 5. Glossary / terminology drift

This is one of the highest-risk documentation/runtime drift areas.

### What exists

- Request schema supports **`terminologyGlossary`** in `TranslationRequestContext`.
- Provider prompt building includes `terminologyGlossary` and labels it as terminology data rather than instructions.
- Translation cache keys include `terminologyGlossary`, so glossary changes can invalidate cache entries.
- Vocabulary storage already has glossary-oriented fields and helpers:
  - `glossaryEnabled`
  - `glossaryScope`
  - `glossaryTargetText`
  - `listGlossaryEntriesForHostname()`
  - `serializeGlossary()`

### What was missing at Month 6 closeout

- There was **no active runtime call site** wiring `listGlossaryEntriesForHostname()` / `serializeGlossary()` into page/subtitle/background translation requests in the Month 6 tree.
- The request field existed, but the vocabulary-backed glossary path was not yet the system of record for translation-time terminology enforcement.
- Tests still used ad hoc glossary strings (for example `Astra=阿斯特拉`) while `serializeGlossary()` emitted `source => target` lines.

### Current next-window update

- `docs/investigations/glossary-contract-2026-04-14.md` now records the canonical glossary contract.
- Vocabulary glossary entries are now the source of truth for request-time terminology data.
- The only canonical serialization format is `source => target` per line.
- Background now owns the canonical request-time glossary injection path.
- Cache keys and provider prompts now consume that same canonical string.

### Honest conclusion

Astra now has a **canonical vocabulary-backed request-time glossary contract**. That is stronger than Month 6 plumbing-only status, but it still does **not** justify blanket claims of guaranteed terminology enforcement across all model behavior.

## 6. Protected vs weak surfaces

| Surface | Current state | Why |
|---|---|---|
| Sensitive input fields | **Protected, but heuristic** | `isSensitiveInput` blocks obvious password/card/secret-style inputs before translation starts. |
| Page translation privacy mode | **Protected, but caller-owned** | Context sanitization exists and has unit + scenario coverage, but only because the page-translation caller applies it. |
| Subtitle translation privacy mode | **Protected, but caller-owned** | Same as page translation. |
| Popup/study context in privacy mode | **Protected** | Richer study excerpt is omitted when privacy mode is on. |
| Background transport boundary | **Weak** | No authoritative re-sanitization layer. Background forwards caller payload. |
| Relay/direct disclosure semantics | **Weak** | Fallback can change backend without a first-class per-request disclosure model. |
| Error taxonomy for users | **Weak** | Internal codes exist, but user-facing meaning is still broad and sometimes generic. |
| Glossary semantics | **Improved, still bounded** | Canonical request-time wiring now exists via vocabulary-backed glossary data at the background boundary, but broader enforcement guarantees remain unproved. |
| Live privacy proof in release docs | **Weak** | Bench scenarios exist, but Month 6 closeout docs do not yet carry a fresh attached privacy replay bundle. |
| Relay server privacy/retention assertions | **Unverified in this client audit** | Client code stops at the fetch boundary; server logging/retention/forwarding policy must be audited separately. |

## 7. Highest-risk gaps (prioritized)

### P0 / highest-risk

1. **Background/router is not the authoritative privacy guardrail**
   The system relies on caller discipline. That is workable today, but it is not a hard invariant and is the biggest architecture-level privacy gap in this inventory.

2. **Glossary contract drift is real**
   Vocabulary glossary state, request-time `terminologyGlossary`, and docs/product language are not aligned under one contract. This is the clearest Month 6 correctness/claim gap outside privacy.

3. **Fallback can silently change who receives the content**
   The router is behaving as designed, but the disclosure/observability story is weaker than the routing behavior itself.

### P1 / next-risk

4. **Regex-based fallback classification is brittle**
   Message-string heuristics are not a durable transport classifier.

5. **Telemetry/error message content is not explicitly sanitized**
   Useful today, but the safety property depends on upstream errors not echoing sensitive content.

6. **Privacy proof is present in code, not yet prominent in release evidence**
   Scenarios exist, but they are not yet part of the canonical release evidence bundle.

### P2 / lower but still real

7. **Cache failures are silent**
   This is primarily a cost/latency/explainability issue, not the biggest privacy risk.

8. **Quality warnings are advisory only**
   Bad-output detection exists, but it does not yet drive fallback/retry/blocking policy.

## 8. Existing proof and evidence pointers

### Unit/integration proof already in tree

- `src/utils/privacy.test.ts`
- `src/utils/providers/router.test.ts`
- `src/entrypoints/content/translation-context.test.ts`
- `src/entrypoints/content/subtitle-translate.test.ts`
- `src/entrypoints/background/index.test.ts`
- `src/utils/translate/translate.test.ts`

### Browser-backed privacy proof paths already defined

- `CI=true pnpm bench:live -- --scenario bench-live/privacy-mode-page-translation-source`
- `CI=true pnpm bench:live -- --scenario bench-live/holdout/privacy-mode-should-not-leak`

**Important:** those live scenarios exist in the registry, but this inventory pass did **not** attach a fresh replay artifact. Treat them as available proof paths, not as already-closed Month 6 evidence.

## 9. Month 6 quality map

Month 6 follow-up work should start from this order:

1. **Decide the real privacy authority**: either make background/provider sanitization authoritative, or explicitly keep caller-owned sanitization and downgrade claims accordingly.
2. **Formalize the glossary contract**: one serialization format, one source of truth, one documented request-time wiring path.
3. **Tighten fallback disclosure semantics**: support/operator surfaces should be able to answer which transport handled a request without reading raw logs.
4. **Promote privacy proof into release evidence** if Month 6 wants privacy to behave like a gate rather than a partial promise.
5. **Only then** refine secondary issues like cache-failure visibility and stronger quality/failure policies.

## 10. Inventory conclusion

The repo already has **real privacy and routing guardrails**, but they are uneven:

- **Strongest today:** caller-side context sanitization, sensitive-input blocking, router metadata, and unit coverage.
- **Weakest today:** authoritative privacy ownership, glossary contract alignment, and user-visible disclosure of transport/fallback behavior.

That is the concrete map for Month 6. Do not describe these areas from memory; use this inventory as the baseline.
