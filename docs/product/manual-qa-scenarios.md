# Astra Manual QA Scenarios

These scenarios test whether Astra feels complete to ordinary users. They intentionally focus on product use, not store review or legal policy.

## QA persona

Use this persona for every scenario unless noted otherwise:

- Chinese-native English learner.
- Does not know provider, model, API key, token, quota, or relay concepts.
- Wants to read English webpages and supported videos, save useful expressions, and review later.
- Expects Astra to work without configuration.

## Scenario 1 — First success sample lesson

**Goal:** New user experiences the full understand → save → review loop within 3 minutes.

Steps:

1. Install/open Astra with a fresh profile.
2. Confirm Astra does not ask for provider/model/API setup.
3. Start the sample lesson or first-use path.
4. Read the provided English content with Chinese support.
5. Save 3 useful words/sentences.
6. Open today’s review.
7. Complete the 3 review cards.

Pass criteria:

- User sees clear progress after every save.
- User sees a completion moment after review.
- User knows what to do next: read a page, watch a supported video, or continue review.

Fail examples:

- User lands on a settings screen first.
- User sees provider/model/API/quota language.
- Saved items do not become review cards.

## Scenario 2 — Webpage reading and saving

**Goal:** User reads a real English webpage and saves expressions without organizing anything.

Steps:

1. Open a supported English article or documentation page.
2. Start Astra translation/reading help.
3. Confirm the page remains readable.
4. Select one useful phrase and one full sentence.
5. Explain each selection.
6. Save each item.
7. Open Review or Library.

Pass criteria:

- Main actions are obvious and minimal.
- Save feedback says the item is in today’s review or equivalent.
- Saved items keep source page context.
- Partial/long-page states do not feel broken.

## Scenario 3 — Page limitation fallback

**Goal:** User is not stranded when a page cannot be translated fully.

Steps:

1. Open a browser/internal/protected/dynamic page where full translation is unavailable.
2. Trigger Astra translation or selection explain.
3. Observe the fallback copy.

Pass criteria:

- Copy explains the limitation in ordinary language.
- User gets a concrete next action, such as selecting a sentence for explanation.
- No raw request/provider/permission stack trace appears.

## Scenario 4 — Supported video learning

**Goal:** User saves a timestamp-backed learning moment from a supported video.

Steps:

1. Open a supported YouTube video with captions.
2. Enable Astra subtitle/transcript support.
3. Open transcript panel if available.
4. Save one subtitle/transcript line.
5. Open Review.
6. Inspect the saved video card.

Pass criteria:

- Copy says supported video or best-effort where relevant.
- Saved card includes video title/source and timestamp.
- User can understand or return to the source moment.
- No full transcript export is required for the default path.

## Scenario 5 — No-caption video fallback

**Goal:** User understands what to do when captions are unavailable.

Steps:

1. Open a video without usable captions.
2. Trigger Astra video support.
3. Observe fallback UI/copy.

Pass criteria:

- Copy does not imply Astra supports every video.
- User receives a next action, such as pasting a short excerpt.
- Failure state does not mention provider/model internals.

## Scenario 6 — Daily review habit

**Goal:** Review feels like a short daily habit.

Steps:

1. Create or seed due review cards.
2. Open Today Review.
3. Check visible card count and expected effort.
4. Complete cards with Again / Good / Easy or equivalent.
5. Reach completion state.

Pass criteria:

- Review starts without configuration.
- Cards show source context.
- Completion shows progress and a next action.
- UI does not feel like a complex Anki clone.

## Scenario 7 — Library as learning history

**Goal:** User can find recent saved items without managing folders.

Steps:

1. Save items from a webpage and a supported video.
2. Open Library/Vocabulary/Assets surface.
3. Find recently saved items.
4. Inspect source grouping/context.
5. Use search/filter if available.

Pass criteria:

- Recently saved and today review are easy to find.
- Items show source context.
- Empty states explain how to create the first item.
- No manual folder/tag setup is required.

## Scenario 8 — Free-to-Pro value moment

**Goal:** User sees value-framed Pro copy when reaching a limit.

Steps:

1. Use enough Free functionality to trigger a limit or Pro-only action.
2. Observe the prompt.

Pass criteria:

- Copy explains value: longer webpages, more supported videos, sync, review history.
- Copy does not say quota/token/provider failure.
- User can continue with a fallback or understand why Pro helps.

## Scenario 9 — Mobile companion review

**Goal:** Mobile acts as a habit/review companion, not a live webpage injector.

Steps:

1. Open mobile companion with saved/due cards.
2. Start today review.
3. Inspect recent saved/source context.
4. Follow a video/source link if available.

Pass criteria:

- Today review is the first useful action.
- Recent saved items are visible.
- Video/source context survives.
- UI does not promise live third-party webpage translation on mobile.

## Scenario 10 — Copy scan sanity check

Run:

```bash
pnpm check:product-copy
```

Pass criteria:

- Changed public-copy files do not introduce overclaims or technical ordinary-user language.
- Any broader baseline debt found with `-- --all` is tracked separately, not hidden.
