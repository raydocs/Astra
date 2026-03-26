# A1: Free Translation Engine (Zero-Config Default)

## Why
The #1 adoption barrier. Users must have an API key before anything works. Immersive Translate has free engines as default.

## Approach: Google Translate via `translate.googleapis.com`
This is the unofficial Google Translate API endpoint used by many browser extensions. It's free, requires no API key, and supports all language pairs. Rate-limited but sufficient for personal use.

## Files to Create

### `src/utils/providers/google-free.ts`
```typescript
import { AstraError } from "@/types/translation"
import type { ProviderTranslationRequest } from "./types"

const GOOGLE_TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"

export async function translateWithGoogleFree(
  request: ProviderTranslationRequest,
): Promise<string[]> {
  const { texts, targetLang, sourceLang } = request
  const results: string[] = []

  for (const text of texts) {
    const params = new URLSearchParams({
      client: "gtx",
      sl: sourceLang ?? "auto",
      tl: mapLanguageCode(targetLang),
      dt: "t",
      q: text,
    })

    try {
      const response = await fetch(`${GOOGLE_TRANSLATE_URL}?${params}`)
      if (!response.ok) {
        throw new AstraError("PROVIDER_REQUEST_FAILED", `Google Translate returned ${response.status}`)
      }

      const data = await response.json()
      // Response format: [[["translated text","source text",null,null,N],...]]
      const translation = data[0]?.map((segment: any[]) => segment[0]).join("") ?? ""
      results.push(translation)
    } catch (error) {
      if (error instanceof AstraError) throw error
      throw new AstraError("PROVIDER_REQUEST_FAILED",
        error instanceof Error ? error.message : "Google Translate request failed")
    }
  }

  return results
}

function mapLanguageCode(code: string): string {
  // Astra uses "zh-CN", Google uses "zh-cn" or "zh"
  const map: Record<string, string> = { "zh-CN": "zh-cn", "zh-TW": "zh-tw" }
  return map[code] ?? code.toLowerCase()
}
```

### `src/utils/providers/google-free.test.ts`
- Mock fetch
- Test successful translation parsing
- Test error handling (429, 500)
- Test language code mapping

## Files to Modify

### `src/types/config.ts`
Change `ProviderIdSchema`:
```typescript
export const ProviderIdSchema = z.enum(["openai", "gemini", "free"])
```

Add to `getDefaultProviderModel`:
```typescript
case "free": return "google-translate"
```

Update `DEFAULT_ASTRA_CONFIG.provider`:
```typescript
provider: {
  id: "free",  // Changed from "openai" — works immediately after install
  accessToken: "",
  apiKey: "",
  model: "google-translate",
}
```

### `src/utils/providers/router.ts`
Add free provider routing:
```typescript
import { translateWithGoogleFree } from "./google-free"

// In translateWithProvider():
// Before checking apiKey or accessToken:
if (provider.id === "free") {
  return translateWithGoogleFree(request)
}
```

### `src/entrypoints/popup/components/GlobalSettingsSection.tsx`
Add to PROVIDER_OPTIONS:
```typescript
{ value: "free", label: "Free (Google Translate)" },
```

## Rate Limiting
Google Translate API has unofficial rate limits (~100 requests/minute). For page translation with 50+ blocks, this could be hit.

Strategy:
- Add 100ms delay between individual text translations in google-free.ts
- If 429 response: wait 2 seconds and retry once
- Cache integration (already done) dramatically reduces API calls on revisits

## Limitations vs Paid Providers
- No custom system prompts (explain/summarize/grammar won't work)
- Lower translation quality than GPT/Gemini for nuanced text
- Rate limited for heavy use
- Only supports `translate` task (not `explain` or `custom`)

The router should only use the free engine for `task === "translate"`. For explain/custom, it should fall back to showing an error: "This feature requires an AI provider (OpenAI or Gemini). Set up your API key in Settings."

## Verification
```bash
npx vitest run src/utils/providers/google-free.test.ts
npx tsc --noEmit
pnpm build
pnpm bench  # Existing scenarios should still pass
```
