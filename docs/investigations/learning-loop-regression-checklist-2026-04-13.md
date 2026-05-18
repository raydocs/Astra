# Learning loop regression checklist (Month 2)

_Use before release or after risky changes to popup, vocabulary, review, reading-history, or study-progress._

## P0 — must pass manually or via live lane

- [ ] Popup opens with session; **Study** tab/section renders without console errors.
- [ ] Sentence **explain** returns text and shows a result card.
- [ ] Sentence **save** creates or updates a vocabulary entry with source context.
- [ ] Open **Vocabulary** → **Review** tab → at least one card can be graded (SRS advance).
- [ ] Saved entry shows stable **source title / URL / snippet** when present in the entry payload.
- [ ] Open **Vocabulary** → **Reading** tab → article row shows **host + canonical page URL + translated count + ordered study steps + next-step hint**.
- [ ] **Open** from the Reading row reopens the intended article URL.
- [ ] `CI=true pnpm bench:live:lane:learning-loop` completes, or the three scenario commands complete separately with attached artifact paths.

## P1 — spot checks

- [ ] Previous/next sentence navigation in popup deep-read.
- [ ] Empty or thin study context shows explicit fallback copy (no crash).
- [ ] Popup recent-history reopen still works as a convenience path.

## Automation cross-reference

- Deterministic harness: `pnpm bench`
- Required browser-backed lane: `pnpm bench:live:lane:extension-core`
- Required learning-loop release lane: `pnpm bench:live:lane:learning-loop`
- Dedicated revisit proof: `pnpm bench:live -- --scenario bench-live/learning-loop-revisit-smoke`

## Policy note

The `learning-loop` lane is required in release policy and CI. Failures block release unless explicitly downgraded in the release checklist and CI in the same change set.
