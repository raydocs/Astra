# A2: First-Run Onboarding Page

## Files to Create
- `src/entrypoints/onboarding/index.html` — WXT HTML entrypoint
- `src/entrypoints/onboarding/main.tsx` — React mount
- `src/entrypoints/onboarding/App.tsx` — Multi-step wizard
- `src/entrypoints/onboarding/steps/WelcomeStep.tsx`
- `src/entrypoints/onboarding/steps/LanguageStep.tsx`
- `src/entrypoints/onboarding/steps/ProviderStep.tsx`
- `src/entrypoints/onboarding/steps/DemoStep.tsx`
- `src/entrypoints/onboarding/steps/DoneStep.tsx`

## Files to Modify
- `src/entrypoints/background/index.ts` — Open onboarding on `runtime.onInstalled` with `reason === "install"`, gated by `astra.onboarding.completed` storage flag

## State Machine
```
"welcome" → "language" → "provider" → "demo" → "done"
```

## OnboardingState
```typescript
{ step, targetLang: "zh-CN", providerId: "openai"|"gemini"|"free", apiKey: "", useRelay: boolean }
```

## On Complete
- Call `saveConfig({ targetLang, provider: { id, apiKey, ... } })`
- Set `astra.onboarding.completed = true` in storage
- Open demo URL or close tab

## Verification
```bash
# Fresh install → onboarding opens → complete → config saved
npx tsc --noEmit && npx vitest run
```
