# C5: Provider Hot-Switch (No Page Refresh)

## Files to Modify
- `src/entrypoints/content/index.tsx` — Add `handleProviderChange()` to storage.onChanged listener

## How It Works (Mostly Already Done)
The existing `browser.storage.onChanged` listener calls `reconcileSiteAutomation()`. We need to add provider-change detection that calls `retryFailedBlocks()` when the provider changes and there are failed blocks.

## New Function
```typescript
async function handleProviderChange(changes: Record<string, StorageChange>): Promise<void> {
  const configKey = "astra.config.v1"
  if (!changes[configKey]) return

  const old = changes[configKey].oldValue?.provider
  const next = changes[configKey].newValue?.provider
  if (!old || !next) return

  const changed = old.id !== next.id || old.apiKey !== next.apiKey || old.model !== next.model
  if (!changed) return

  const state = getPageTranslationState()
  if (state.phase === "idle" || state.progress.failedBlocks === 0) return

  retryFailedBlocks()
}
```

## Key Insight
`translateTexts()` → `requestTranslationBatch()` → background `handleTranslate()` → reads `readConfig()` fresh every call. So the new provider is automatically used on the next batch — no explicit notification needed.

## Verification
```bash
npx tsc --noEmit && npx vitest run
```
