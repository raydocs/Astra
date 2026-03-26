# C1: Click-to-Toggle Translation Display

## Files to Modify
- `src/entrypoints/content/index.tsx` — Add CSS for `.astra-translation[data-astra-collapsed]`
- `src/entrypoints/content/page-translate.ts` — Add click handler that toggles `data-astra-collapsed` attribute

## CSS
```css
.astra-translation[data-astra-collapsed] .astra-translation-inner {
  opacity: 0.2;
  text-decoration: line-through;
  cursor: pointer;
  transition: opacity 0.2s ease;
}
```

## Click Handler
- Install on `startPageTranslation()`, remove on `cleanupSession()`
- Target: `[data-astra-translation="1"]` (completed only, not loading)
- Toggle `data-astra-collapsed` attribute
- `stopPropagation()` to prevent bubble to other handlers

## Verification
```bash
npx tsc --noEmit && npx vitest run
```
