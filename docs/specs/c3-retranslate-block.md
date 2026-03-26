# C3: Single-Paragraph Re-translate

## Files to Create
None.

## Files to Modify
- `src/entrypoints/content/index.tsx` — Add CSS for `.astra-retranslate-btn`
- `src/entrypoints/content/page-translate.ts` — Add `retranslateBlock(element)` export + click handler
- `src/utils/dom/inject.ts` — Add "↻" button to completed translation wrappers
- `src/utils/cache/translation-cache.ts` — Add `deleteCachedTranslation(sourceText, targetLang)`

## Behavior
1. Hover over translation → "↻" button appears at top-right
2. Click → clears cache entry + removes DOM translation + re-queues block
3. New translation arrives via normal drain loop

## retranslateBlock(element)
```typescript
export async function retranslateBlock(element: HTMLElement): Promise<void> {
  // 1. Delete cache entry
  // 2. Remove translation DOM
  // 3. Reset block state via markSourceChanged
  // 4. enqueueBlock + scheduleDrain
}
```

## deleteCachedTranslation
```typescript
export async function deleteCachedTranslation(sourceText: string, targetLang: string): Promise<boolean>
```

## Verification
```bash
npx tsc --noEmit && npx vitest run
```
