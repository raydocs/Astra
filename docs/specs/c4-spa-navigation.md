# C4: SPA Navigation Auto-Restart

## Files to Create
- `src/entrypoints/content/spa-navigation.ts` — Navigation watcher with History API monkey-patch

## Files to Modify
- `src/entrypoints/content/index.tsx` — Install watcher, auto-restart translation on URL change

## spa-navigation.ts API
```typescript
export function createSPANavigationWatcher(): {
  start(callback: (prevUrl: string, newUrl: string) => void): void
  stop(): void
}

export function isSignificantUrlChange(prev: string, next: string): boolean
// Returns true if pathname or search changed (ignores hash-only changes)
```

## Implementation
- Monkey-patch `history.pushState` and `history.replaceState`
- Listen for `popstate` event
- 300ms debounce to coalesce rapid navigations
- On significant URL change: stop current session → wait 500ms → restart

## Content Script Integration
```typescript
spaWatcher.start(async (prevUrl, newUrl) => {
  if (!isSignificantUrlChange(prevUrl, newUrl)) return
  const wasActive = getPageTranslationState().phase !== "idle"
  if (wasActive) {
    stopPageTranslation()
    await new Promise(r => setTimeout(r, 500))
    await startPageTranslation()
  }
})
```

## Verification
```bash
npx tsc --noEmit && npx vitest run
```
