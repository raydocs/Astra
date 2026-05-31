# Astra Product Completeness QA Checklist

Use this checklist for product-focused PR review and manual QA. It intentionally ignores store/legal concerns and focuses on whether Astra feels complete to ordinary users.

## North-star path

```text
Open Astra → understand a real English page/video → save useful expressions → review later → feel progress
```

Every product PR should make at least one step in this path clearer, faster, or more trustworthy.

## 1. First success

- [ ] A new user can start without configuring providers, models, API keys, tokens, quotas, or relay settings.
- [ ] The sample or first-use path demonstrates understanding, saving, and review.
- [ ] Saving produces visible progress, such as “saved to today’s review”.
- [ ] The user sees a completion moment after the first review.
- [ ] The next step is obvious: read a page, watch a supported video, or continue review.

## 2. Web reading

- [ ] Main actions are minimal: translate/stop, bilingual/translation-only, save/review.
- [ ] Selection explain/save does not ask the user to choose provider, model, card type, or destination.
- [ ] Long-page progress or partial success does not look like a broken state.
- [ ] Page limitations give a fallback action, such as selecting a sentence for explanation.
- [ ] Technical error strings are not shown in the ordinary user path.

## 3. Supported video learning

- [ ] Copy says “supported videos” or “best-effort”, not all/every video.
- [ ] Subtitle/transcript saves include source title and timestamp where available.
- [ ] Video review cards show where the sentence came from.
- [ ] No-caption states explain the next best action.
- [ ] Full transcript/export controls are not part of the default learning path.

## 4. Review habit

- [ ] Today’s review count and expected effort are visible.
- [ ] Again / Good / Easy or equivalent choices are enough by default.
- [ ] Cards keep source context attached.
- [ ] Completion shows progress and a next action.
- [ ] Review feels like a short daily habit, not a settings-heavy study system.

## 5. Library and learning history

- [ ] Recently saved and today review are easy to find.
- [ ] Items are naturally grouped by webpage, supported video, or writing source where possible.
- [ ] Empty states teach users how to create their first saved item.
- [ ] Library does not require manual folder/tag organization for the default path.
- [ ] Search/filter behavior, if present, works on source and saved expression text.

## 6. Copy and trust

- [ ] Ordinary UI avoids provider/model/API key/token/quota/relay language.
- [ ] Public copy avoids all-websites/all-videos/unlimited claims.
- [ ] Managed-AI copy uses “no unnecessary uploads” instead of “no uploads” or “local-only”.
- [ ] Membership prompts explain value: longer webpages, supported videos, sync, review history.
- [ ] Errors tell users what to do next.

For changed public-copy surfaces, run:

```bash
pnpm check:product-copy
```

For a broader non-gating audit of the current baseline, run:

```bash
pnpm check:product-copy -- --all
```

## 7. Mobile companion

- [ ] Mobile prioritizes today review, recent saved items, streak/reminder, and source links.
- [ ] Mobile does not imply live third-party webpage injection.
- [ ] Video/source links make it easy to return to context.

## Product PR acceptance question

> Can a non-technical Chinese user complete one more step of read/watch → save → review without learning a technical concept?

If the answer is no, the PR may still be useful infrastructure, but it should not be described as a product-completeness win.
