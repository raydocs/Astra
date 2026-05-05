# Learning Loop MVP Delivery Plan

Last updated: 2026-04-15

This delivery plan turns the near-term language-learning product direction into five concrete MVP tracks. The goal is not to ship every ambitious version at once. The goal is to tighten Astra's visible learning loop on top of the reading, vocabulary, and study-progress infrastructure that already exists in-repo.

## Product Goal

Compress Astra's main learning flow into one obvious path:

1. read real content
2. explain key sentences
3. save useful words or lines
4. continue learning from a visible queue
5. review later with as little friction as possible

## Track 1: One-Click Deep Read Mode

### MVP outcome

Turn article reading into a clearly recognizable study flow instead of a generic translation utility.

### User entry points

- Popup study hub on the current tab
- Web article import surface
- Owned reading queue resume flow

### MVP scope

- Show article title, summary, excerpt, and sentence deck together
- Make one sentence-level explain action always available
- Make one sentence-level save action always available
- Keep the current page's next study step visible
- Preserve reopening and progress continuity through owned-reading + study-progress

### Current implementation anchors

- `src/entrypoints/popup/components/StudySection.tsx`
- `src/entrypoints/popup/App.tsx`
- `web/src/lib/article-import.ts`
- `src/utils/storage/owned-reading.ts`
- `src/utils/storage/study-progress.ts`

### Gaps to close after MVP

- Dedicated article-reader visual mode instead of popup-first study flow
- Stronger sentence segmentation and sentence navigation across surfaces
- Better digest refresh and stale-state handling

### Acceptance

- A user can open Astra on a page and immediately see a study-oriented view instead of only controls
- A user can explain one sentence, save it, and reopen that work later
- Current-page next-step guidance is visible without visiting settings or the vocabulary list first

## Track 2: Save -> Next Step Guidance

### MVP outcome

Every save action should lead somewhere obvious.

### User entry points

- Selection toolbar save action
- Hover translate save action
- Popup study sentence save action

### MVP scope

- After save, show a short confirmation panel instead of only changing the button label
- Offer direct links to vocabulary and review
- Reuse due-count data when available
- Keep the copy compact and action-oriented

### Current implementation anchors

- `src/entrypoints/content/components/SelectionToolbar.tsx`
- `src/entrypoints/content/components/HoverTranslate.tsx`
- `src/entrypoints/popup/components/StudySection.tsx`
- `src/utils/storage/vocabulary.ts`

### Acceptance

- Saving from any primary reading surface gives the user an obvious next action
- The post-save state is visible long enough to be used, not just noticed
- Review and vocabulary surfaces open in one click from the save confirmation

## Track 3: Learning Desk Home

### MVP outcome

The vocabulary page should feel like a daily learning home, not only a storage list.

### User entry points

- `vocabulary.html`
- Links opened from popup, selection toolbar, hover translate, and subtitle reader

### MVP scope

- Add a top-level learning desk summary above the word list
- Surface due review count, in-progress reading count, and saved vocabulary count
- Surface the best next action: review now, continue reading, or open reading queue
- Keep existing list / review / reading tabs intact

### Current implementation anchors

- `src/entrypoints/vocabulary/VocabularyApp.tsx`
- `src/entrypoints/vocabulary/ReviewMode.tsx`
- `src/utils/storage/owned-reading.ts`
- `src/utils/storage/study-progress.ts`

### Acceptance

- Opening the vocabulary page tells the user what to do next in under 3 seconds
- Review and reading queue are reachable from the top of the page without scanning the whole UI
- The word list still works as before for management and export

## Track 4: TTS as a First-Class Learning Action

### MVP outcome

TTS should feel like part of the learning loop, not only a utility toggle.

### User entry points

- Study sentence deck
- Selection toolbar
- Hover translate overlay
- Saved vocabulary context and future reader surfaces

### MVP scope

- Keep speak controls visible beside explain/save controls on active learning surfaces
- Prefer sentence or selection-sized playback over long unstructured playback
- Reuse existing per-user TTS configuration and highlight behavior

### Current implementation anchors

- `src/utils/tts.ts`
- `src/entrypoints/popup/App.tsx`
- `src/entrypoints/popup/components/StudySection.tsx`
- `src/entrypoints/content/components/SelectionToolbar.tsx`

### Gaps to close after MVP

- Sentence autoplay / next-sentence playback
- Reader-surface synchronized highlighting
- TTS actions on vocabulary cards and owned reading readers

### Acceptance

- Users can speak the exact sentence they are learning from all main study surfaces
- TTS uses existing settings without extra setup work

## Track 5: Explanation Modes Instead of Raw Prompt Power

### MVP outcome

Expose explanation style as a learning choice, not as a prompt-engineering task.

### User entry points

- Onboarding language-level selection
- Study and explain surfaces
- Future options surface for explanation style

### MVP scope

- Keep the model contract simple: beginner, exam-focused, deep-understanding
- Start by shaping explain requests through existing reading-assist / provider pathways
- Avoid a heavy prompt-builder UI in this wave

### Current implementation anchors

- `src/utils/reading/assist.ts`
- `src/utils/providers/openai.ts`
- `src/utils/providers/gemini.ts`
- `src/entrypoints/onboarding/OnboardingApp.tsx`
- `src/types/config.ts`

### Gaps to close after MVP

- Per-surface explanation presets
- Saved user preference separate from language-level
- Prompt previews and advanced mode

### Acceptance

- Users can choose a recognizable explanation mode without understanding prompts
- Explain output differences are intentional and testable

## First Delivery Slice

This session starts with the two smallest, highest-leverage slices:

1. Learning desk home in `vocabulary.html`
2. Save -> next step guidance in selection / hover surfaces

These two changes improve the product's visible learning loop immediately while reusing existing vocabulary, review, owned-reading, and study-progress primitives.
