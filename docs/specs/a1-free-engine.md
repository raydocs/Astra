# A1: Free Translation Engine (Google Translate — Zero-Config Default)

## Overview
Add `google-free` provider using `translate.googleapis.com`. No API key needed. Default for new installs so the extension works immediately.

## API: `https://translate.googleapis.com/translate_a/single?client=gtx&sl={sl}&tl={tl}&dt=t&q={q}`
- Response: nested JSON array `[[["translated","source",null,null,N],...]]`
- Rate limit: ~5 req/s sustained. Retry on 429/503 with exponential backoff.
- Only supports `task: "translate"`. Explain/custom → `PROVIDER_UNSUPPORTED_TASK` error.

## Files to Create

### `src/utils/providers/google-free.ts`
```typescript
export interface GoogleFreeTranslationOptions {
  texts: string[]
  targetLang: string
  sourceLang?: string
}

export async function translateWithGoogleFree(options: GoogleFreeTranslationOptions): Promise<string[]>
```
Internals:
- `normalizeGoogleLangCode(lang)` — maps "zh-CN" → "zh-cn" etc.
- `translateSingle(text, targetLang, sourceLang)` — single text via fetch
- `fetchWithRetry(url, maxRetries=3)` — exponential backoff (1s→2s→4s + jitter) on 429/503
- `splitLongText(text, maxChars=4800)` — sentence-boundary split for Google's 5k char limit
- Max 3 concurrent requests via semaphore

### `src/utils/providers/google-free.test.ts`
9 tests: success, batch, retry on 429, max retry exhaust, malformed JSON, wrong shape, long text split, auto-detect lang, standard lang passthrough.

## Files to Modify

### `src/types/config.ts`
- `ProviderIdSchema = z.enum(["google-free", "openai", "gemini"])`
- Add `GoogleFreeProviderConfigSchema` (id, accessToken, apiKey, model all with defaults)
- `DEFAULT_ASTRA_CONFIG.provider.id = "google-free"`
- `getDefaultProviderModel("google-free") → "google-free"`
- `hasProviderAccess`: return `true` unconditionally for `google-free`

### `src/types/translation.ts` + `src/types/messages.ts`
- Add `"PROVIDER_UNSUPPORTED_TASK"` to `TranslationErrorCode`

### `src/utils/providers/router.ts`
Add at TOP of `translateWithProvider()`:
```typescript
if (provider.id === "google-free") {
  if (request.task && request.task !== "translate") {
    throw new AstraError("PROVIDER_UNSUPPORTED_TASK",
      "Google Translate (Free) only supports translation. Switch to OpenAI or Gemini for explanations.")
  }
  return translateWithGoogleFree({ texts: request.texts, targetLang: request.targetLang, sourceLang: request.sourceLang })
}
```

### `src/utils/storage/config.ts`
Fix `migrateLegacyConfig()`: detect if ANY legacy keys exist.
- Has legacy keys → migrate to `openai` (preserve existing behavior)
- No legacy keys (fresh install) → use `DEFAULT_ASTRA_CONFIG` (now `google-free`)

### `src/entrypoints/popup/components/GlobalSettingsSection.tsx`
- Add `"google-free"` to PROVIDER_OPTIONS as first option: `{ value: "google-free", label: "Google Translate (Free)" }`
- Hide API key / relay URL / model fields when `google-free` selected
- Show info banner: "Uses Google Translate. No API key needed. For AI explanations, switch to OpenAI or Gemini."

## Rate Limiting Strategy
| Parameter | Value |
|-----------|-------|
| Max concurrent | 3 |
| Retry attempts | 3 |
| Base delay | 1000ms |
| Backoff | 2x (1s→2s→4s) |
| Jitter | ±20% |
| Retryable codes | 429, 503 |
| Text chunk size | 4800 chars |

## Migration Safety
- Fresh install (no storage) → `google-free` default ✓
- Existing user with stored config → keeps their provider ✓
- Legacy keys (apiKey/model/baseURL) → migrates to `openai` ✓

## Verification
```bash
npx vitest run src/utils/providers/google-free.test.ts
npx vitest run src/utils/providers/router.test.ts
npx vitest run src/utils/storage/config.test.ts
npx tsc --noEmit
pnpm build
pnpm bench
```
