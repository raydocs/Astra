# C2: Translation Progress in FloatBall

## Files to Modify
- `src/entrypoints/content/components/FloatBall.tsx`

## Changes
1. Add `progressText: string | null` to `getFloatBallVisualState()` return
2. When `phase === "running"`: `progressText = "${translatedBlocks}/${totalBlocks}"`
3. Replace SVG star with text overlay when `progressText` is non-null
4. Update tooltip: `"Translated: 12/45 | Failed: 2"`

## Text Style
```typescript
{ color: "#fff", fontSize: "11px", fontWeight: 700, letterSpacing: "-0.3px", whiteSpace: "nowrap" }
```

## Verification
```bash
npx tsc --noEmit && npx vitest run
```
