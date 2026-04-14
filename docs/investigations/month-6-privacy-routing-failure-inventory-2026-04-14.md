# Month 6 — Privacy / routing / failure inventory

_Task **`M6-G-01`**_

## Concrete code paths (read order)

1. **`src/entrypoints/background/index.ts` — `handleTranslate`**  
   Loads `readConfig` + `readAstraSession`, resolves managed provider via `resolveManagedProviderConfig`, applies translation **cache** (`getCachedTranslations` / `setCachedTranslation` when `isTranslationCacheable`), batches uncached texts into `translateWithProviderDetailed`, validates response length vs uncached batch, maps back to original indices, returns `runtime/translate-batch:success` or error. Cache read failures are swallowed (non-fatal).

2. **`src/utils/providers/router.ts`** — `translateWithProviderDetailed` / `translateWithProvider`  
   Normalizes credentials; if **direct** API key present, tries `translateDirect` (OpenAI / Gemini); on failure, may **fallback to relay** when `classifyProviderFailure` returns `fallback-to-relay` (per `PROVIDER_FAILURE_POLICY` and loose network-message regex) **and** relay URL + access token exist. Otherwise wraps `ProviderRoutingError` with `attemptedTransports` / `finalTransport`, emits `translation_error` telemetry.

3. **`src/utils/providers/relay.ts`** — `translateWithRelay`  
   Builds `POST {relayBaseURL}/translate` with `Authorization: Bearer {accessToken}`; body includes `provider`, `model`, `texts`, `targetLang`, optional `sourceLang`, `context`, `task`, prompts, etc. Parses JSON with Zod; trims strings; maps non-`AstraError` failures to `PROVIDER_REQUEST_FAILED`.

4. **`src/utils/translate/translate.ts`** (orchestration in content scripts / UI callers)  
   Validates batch shape (`quality-check`), splits oversized inputs, builds batches (`MAX_BATCH_ITEMS` / `MAX_BATCH_CHARS`), sends **`requestTranslationBatch`** to background with bounded **concurrency** (`MAX_CONCURRENCY`), merges segments back into caller order — errors surface as `TranslateResult` without re-implementing provider privacy rules (background owns provider choice).

**Privacy implication (honest):** any path that reaches `translateWithRelay` sends **request texts and context** to the operator-controlled relay; direct provider paths send the same payload to the vendor API from the extension. Routing/fallback changes *which* backend sees the content, not whether it leaves the device.

## Failure / risk categories (inventory only)

1. **Dual transport / surprise relay** — User has both API key and Astra session: direct failure can **silently fall back** to relay; copy and privacy expectations may assume “BYOK only” unless UI states otherwise.

2. **Fallback policy asymmetry** — Only some `AstraError` codes allow relay fallback; **network** heuristics are regex-based — unusual errors may **fail-fast** or classify incorrectly.

3. **Relay URL / token drift** — Missing or stale `relayBaseURL` / `accessToken` → `CONFIG_MISSING` or 401 from relay; not always distinguishable in user-facing copy without reading response body handling.

4. **Relay response shape / length** — Mismatched translation count or Zod parse failure → `PROVIDER_PARSE_FAILED`; user sees generic failure while root cause is server/version skew.

5. **Partial cache hits** — `handleTranslate` merges cached + fresh rows; cache write uses `Promise.allSettled` — **failed writes** do not fail the request; repeat calls may re-hit the provider for the same text (cost / latency), not a privacy leak but an **evidence** inconsistency for “cached” claims.

6. **Cache read errors ignored** — Swallowed cache read may force **full retranslation**; similar to (5) for cost; if cache ever stored sensitive context keys incorrectly, mis-read path is unlogged at this layer.

7. **Batch splitting vs provider limits** — `translate.ts` chunks by char/item count; relay or direct API may still reject oversized **semantic** payloads or rate-limit parallel batches (`MAX_CONCURRENCY`), surfacing as provider errors without a single user-visible “reduce size” contract.

8. **Telemetry on errors** — `translation_error` events include code, message, provider id, transport, attempted transports — useful for ops; risk if messages ever echo **user content** (depends on upstream error strings).

9. **Context and task fields** — `context`, `task`, `customSystemPrompt`, `placeholderFormat`, `languageLevel` flow to both direct and relay bodies; **page/site context** in `context` is the main privacy-sensitive payload — same fields on whichever transport wins.

10. **Session / managed provider resolution** — `resolveManagedProviderConfig` (not expanded here) gates which provider id + model reach the router; mis-resolution could send requests under wrong **model** or **provider id** to relay (billing / capability mismatch), not necessarily a silent privacy change but a **correctness** risk.

11. **No transport in metadata to UI** — Callers often receive strings only; **routing metadata** (`fallbackUsed`, `finalTransport`) may not propagate to every surface — hard to audit “which backend saw this” in support without logs.

12. **Server-side relay policy** — Quota, logging, retention, and third-party forwarding live in `server/`; extension inventory stops at the fetch boundary — **unverified** relay behaviors belong in server/runbook audits, not assumed from client code.

## Output of this inventory pass

This note **does not** close gaps — it names subsystem boundaries and honest risk buckets for Month 6 quality work. Prioritized fixes should be opened as scoped tasks once a specific guardrail is missing (for example: user-visible disclosure when fallback-to-relay occurs, stricter error classification, or explicit cache failure telemetry).
