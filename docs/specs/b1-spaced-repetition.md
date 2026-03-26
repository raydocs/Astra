# B1: Spaced Repetition System (Leitner 5-Box)

## Overview

Add SRS-based flashcard review to Astra's vocabulary system. Users save words → review via flashcards → words progress through 5 boxes → mastery.

## Algorithm: Leitner 5-Box

| Box | Interval | Meaning |
|-----|----------|---------|
| 1 | 1 day | New / forgotten |
| 2 | 2 days | Learning |
| 3 | 4 days | Familiar |
| 4 | 8 days | Good |
| 5 | 16 days | Mastered |

- Correct → promote to next box (max 5)
- Incorrect → demote to box 1

## Files to Create

### `src/utils/srs/leitner.ts`
Pure functions, no browser deps:
- `createDefaultSrsFields(now?)` → `{ srsBox: 1, nextReviewAt: now, reviewCount: 0, lastReviewedAt: null }`
- `promoteBox(fields, now?)` → move to min(box+1, 5), set nextReviewAt
- `demoteBox(fields, now?)` → move to box 1, set nextReviewAt
- `applyReview(fields, { correct }, now?)` → delegates to promote/demote
- `isDue(fields, now?)` → `now >= fields.nextReviewAt`
- `getDueCards(entries, now?)` → filter + sort by most overdue first
- `getBoxDistribution(entries)` → `{ box1, box2, box3, box4, box5, total }`
- `isMastered(fields)` → `fields.srsBox === 5`

### `src/utils/srs/leitner.test.ts`
10+ tests covering all functions with deterministic timestamps.

### `src/entrypoints/vocabulary/ReviewMode.tsx`
Flashcard component:
- State machine: `showing-front` → `showing-back` → next card → `session-complete`
- Front: word text, hostname tag
- Back: translation (indigo), explanation, context (italic), source URL
- Buttons: "Don't know" (red, demote) / "Know it" (green, promote)
- Keyboard: Space=flip, Left=don't know, Right=know it
- Session summary: correct/incorrect/promoted/demoted counts
- Empty state: "No cards due! Check back later."

### `src/entrypoints/vocabulary/ReviewStats.tsx`
- Horizontal stacked bar (box 1-5 with colors red→green)
- Text: "X due today | Y mastered | Z total"

## Files to Modify

### `src/utils/storage/vocabulary.ts`
- Add optional SRS fields to schema: `srsBox`, `nextReviewAt`, `reviewCount`, `lastReviewedAt`
- Add `ensureSrsFields()` migration for legacy entries (backfill defaults on read)
- Add `updateVocabularyEntry(id, patch)` for updating SRS fields after review
- Add `getDueVocabularyCount(now?)` for badge

### `src/entrypoints/vocabulary/VocabularyApp.tsx`
- Add tab navigation: "Word List" / "Review (N)"
- Review tab renders ReviewStats + ReviewMode
- Read `?tab=review` URL param for direct link from popup

### `src/entrypoints/background/index.ts`
- Add `alarms` API for periodic badge refresh (every 30 min)
- Badge: amber color, shows due count when no translations active
- Listen for vocabulary storage changes → refresh badge

### `wxt.config.ts`
- Add `"alarms"` to permissions

### `src/entrypoints/popup/App.tsx`
- Add "Review (N)" link that opens vocabulary page with `?tab=review`
- Load due count on mount via `getDueVocabularyCount()`

## Verification
```bash
npx vitest run src/utils/srs/
npx vitest run src/utils/storage/vocabulary.test.ts
npx tsc --noEmit
pnpm build
```
