# Astra Next Phase: Implementation Plan for Codex Sub-agents

## Overview

This document contains **parallel-executable task specs** designed for AI sub-agents (Codex/Claude). Each task is self-contained with full context, file paths, function signatures, and verification criteria. Tasks are independent — all can run simultaneously.

**Current state**: 112 files, 20k LOC, 418 tests, 35 bench scenarios, builds to 3.19MB Chrome extension.

**Target**: From "needs API key to work" → "install and immediately useful for language learning"

---

## Task Group A: Zero-Config Usability (P0)

### A1: Free Translation Engine (Google Translate)

**Why**: The #1 barrier to adoption. Immersive Translate works instantly after install because it has free engines.

**Spec**: (Awaiting planner agent — will be filled in)

**Files to create**:
- `src/utils/providers/google-free.ts` — Free Google Translate via `translate.googleapis.com`
- `src/utils/providers/google-free.test.ts`

**Files to modify**:
- `src/types/config.ts` — Add `"free"` to `ProviderIdSchema`
- `src/utils/providers/router.ts` — Auto-select free when no apiKey and no relay access
- `src/entrypoints/background/index.ts` — No changes needed (router handles it)

**Verification**: `pnpm test && pnpm build && pnpm bench`

---

### A2: First-Run Onboarding Page

**Why**: New users see a blank popup and don't know what to do. 90%+ will uninstall.

**Spec**: (Awaiting planner agent — will be filled in)

**Files to create**:
- `src/entrypoints/onboarding/index.html`
- `src/entrypoints/onboarding/main.tsx`
- `src/entrypoints/onboarding/OnboardingApp.tsx`

**Files to modify**:
- `src/entrypoints/background/index.ts` — Open onboarding page on `runtime.onInstalled` with reason "install"

**Verification**: Install extension fresh → onboarding page opens → complete steps → extension works

---

## Task Group B: Learning Loop (P1)

### B1: Spaced Repetition System (Leitner)

**Why**: Core differentiator. "From translation to learning." Neither competitor has solid SRS.

**Spec**: (Awaiting planner agent — will be filled in)

**Files to create**:
- `src/utils/srs/leitner.ts` — SRS algorithm
- `src/utils/srs/leitner.test.ts`
- `src/entrypoints/vocabulary/ReviewMode.tsx` — Flashcard UI
- `src/entrypoints/vocabulary/ReviewStats.tsx` — Progress stats

**Files to modify**:
- `src/utils/storage/vocabulary.ts` — Add SRS fields to VocabularyEntry
- `src/entrypoints/vocabulary/VocabularyApp.tsx` — Add "Review" tab

**Verification**: Save 5 words → open vocabulary → start review → flip cards → verify box progression

---

### B2: Learning Progress Dashboard

**Why**: Users need to see "I'm making progress" to stay motivated.

**Files to create**:
- `src/entrypoints/vocabulary/ProgressDashboard.tsx`

**Content**:
- Words by mastery level (box 1-5 counts)
- Daily streak counter
- "Words mastered this week" chart
- "Due for review today" count

---

## Task Group C: Daily Use UX (P1)

### C1: Click-to-Toggle Translation Display

**Why**: Users can't hide individual translations. Must stop entire page translation.

**Files to modify**:
- `src/entrypoints/content/page-translate.ts` — Add click handler to `.astra-translation` elements
- `src/utils/dom/inject.ts` — Add toggle class on click

**Behavior**: Click translated text → toggle between visible/hidden with fade animation. Click again → show again.

---

### C2: Translation Progress in FloatBall

**Why**: Users can't tell how far translation has progressed on long pages.

**Files to modify**:
- `src/entrypoints/content/components/FloatBall.tsx`

**Changes**:
- Show "12/45" text inside the ball (translated/total blocks)
- Use `subscribePageTranslationState` to get live counts
- Tooltip shows: "Translating: 12 of 45 blocks (27%)"

---

### C3: Single-Paragraph Re-translate

**Why**: When a translation is wrong, users must re-translate the entire page.

**Files to modify**:
- `src/entrypoints/content/page-translate.ts` — Export `retranslateBlock(element)`
- `src/utils/dom/inject.ts` — Add "↻" button on hover over translation
- `src/utils/cache/translation-cache.ts` — Add `invalidateEntry(sourceText, targetLang)`

**Behavior**: Hover over translation → small "↻" icon appears → click → re-translates that one block

---

### C4: SPA Navigation Auto-Restart

**Why**: Modern SPAs (Twitter, React apps) navigate without page reload. Translation stops.

**Files to modify**:
- `src/entrypoints/content/index.tsx` — Add History API listeners

**Implementation**:
```typescript
// Detect SPA navigation
let lastPathname = location.pathname
const originalPushState = history.pushState
history.pushState = function(...args) {
  originalPushState.apply(this, args)
  checkNavigation()
}
window.addEventListener("popstate", checkNavigation)

function checkNavigation() {
  if (location.pathname !== lastPathname) {
    lastPathname = location.pathname
    // If translation was active, restart it
    void reconcileSiteAutomation()
  }
}
```

---

### C5: Provider Hot-Switch (No Page Refresh)

**Why**: Changing provider in popup currently requires page refresh.

**Files to modify**:
- `src/entrypoints/content/index.tsx` — Already has `browser.storage.onChanged` listener

**The listener already exists** (line 89-91):
```typescript
browser.storage.onChanged?.addListener((_changes, areaName) => {
  if (areaName !== "local") return
  void reconcileSiteAutomation()
})
```

This should already handle provider changes. **Verify this works** — if it does, this task is just documentation.

---

## Task Group D: UI Quality (P2)

### D1: i18n String Sweep

**Why**: 98% of UI strings are hardcoded Chinese. Extension is unusable for non-Chinese users.

**Files to modify**: All .tsx files in:
- `src/entrypoints/popup/components/`
- `src/entrypoints/content/components/`
- `src/entrypoints/options/`
- `src/entrypoints/vocabulary/`
- `src/entrypoints/pdf-reader/`
- `src/entrypoints/epub-reader/`
- `src/entrypoints/subtitle-reader/`

**Strategy**: Replace every Chinese string literal with `t("keyName")`. Add corresponding keys to both `public/_locales/zh_CN/messages.json` and `public/_locales/en/messages.json`.

**Can be parallelized**: One sub-agent per directory.

---

### D2: Accessibility (ARIA)

**Why**: Screen readers can't use the extension. WCAG compliance required for some markets.

**Files to modify**: All content script components:
- `SelectionToolbar.tsx` — `aria-label` on all buttons
- `HoverTranslate.tsx` — `role="tooltip"`, `aria-label`
- `FloatBall.tsx` — `aria-label`, `role="button"`
- `InputTranslate.tsx` — `aria-label`
- `PdfReaderApp.tsx` — landmark roles
- `EpubReaderApp.tsx` — landmark roles

---

### D3: shadcn/Radix UI Component Migration

**Why**: Current inline styles are hard to maintain. Read Frog uses shadcn — proven quality.

**Strategy**: Gradual migration starting with Options page (most UI-heavy).

**Phase 1**: Install `@radix-ui/react-select`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`
**Phase 2**: Replace Options page select/input/button with Radix primitives
**Phase 3**: Style with Tailwind CSS classes instead of inline styles

---

## Task Group E: Advanced Features (P3)

### E1: Ollama / Local Model Support

**Why**: Privacy-conscious users. Works offline. No API costs.

**Files to create**:
- `src/utils/providers/ollama.ts`
- `src/utils/providers/ollama.test.ts`

**Implementation**: Ollama runs a local HTTP server on `http://localhost:11434`. Use the same `generateText` from Vercel AI SDK with `@ai-sdk/ollama` or direct fetch.

---

### E2: Multi-Provider Failover Chain

**Why**: If one provider fails, fall back to another without user intervention.

**Files to modify**:
- `src/utils/providers/router.ts`

**Implementation**:
```typescript
// Try providers in order: direct API key → relay → free
async function translateWithProviderChain(providers: ConfiguredProvider[], request): Promise<string[]> {
  for (const provider of providers) {
    try {
      return await translateWithProvider(provider, request)
    } catch (error) {
      if (isLastProvider) throw error
      console.warn(`Provider ${provider.id} failed, trying next...`)
    }
  }
}
```

---

### E3: Context-Aware URL Restore for Vocabulary

**Why**: Users save a word but can't go back to where they found it.

**Files to modify**:
- `src/entrypoints/vocabulary/VocabularyApp.tsx` — Add "Open source page" link per entry
- URL is already stored in `VocabularyEntry.url`

---

## Execution Strategy for Codex Sub-agents

### Parallel Batch 1 (Independent, no file conflicts):
- **A1** Free Translation Engine
- **B1** Spaced Repetition System
- **A2** Onboarding Page
- **D1** i18n Sweep (split by directory)

### Parallel Batch 2 (After Batch 1):
- **C1** Click-to-Toggle
- **C2** FloatBall Progress
- **C3** Single-Paragraph Re-translate
- **C4** SPA Navigation

### Parallel Batch 3 (After Batch 2):
- **D2** Accessibility
- **E1** Ollama
- **E2** Failover Chain
- **B2** Progress Dashboard

### Verification After Each Batch:
```bash
npx tsc --noEmit  # 0 errors
npx vitest run     # all pass
pnpm bench         # 35+ scenarios at 100
pnpm build         # builds successfully
```

---

## Appendix: File Dependency Map

```
A1 (free engine) → modifies: config.ts, router.ts
A2 (onboarding) → creates: onboarding/*, modifies: background/index.ts
B1 (SRS) → creates: srs/*, modifies: vocabulary.ts, VocabularyApp.tsx
C1 (toggle) → modifies: page-translate.ts, inject.ts
C2 (progress) → modifies: FloatBall.tsx
C3 (re-translate) → modifies: page-translate.ts, inject.ts, translation-cache.ts
C4 (SPA) → modifies: content/index.tsx
D1 (i18n) → modifies: all .tsx files, _locales/
E1 (ollama) → creates: providers/ollama.ts
E2 (failover) → modifies: router.ts
```

**Conflicts to avoid in parallel execution:**
- A1 and E2 both modify router.ts → run sequentially
- C1 and C3 both modify page-translate.ts → run sequentially
- All D1 sub-tasks are independent (different directories)
