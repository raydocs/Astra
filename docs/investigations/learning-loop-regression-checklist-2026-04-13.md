# Learning loop regression checklist (Month 2)

_Use before release or after risky changes to popup, vocabulary, or study-progress._

## P0 — must pass manually or via live lane

- [ ] Popup opens with session; **Study** tab/section renders without console errors.
- [ ] Sentence **explain** returns text and shows result card; dismiss/replace works.
- [ ] Sentence **save** creates or updates a vocabulary entry; toast or UI confirms.
- [ ] Open **Vocabulary** → **Review** tab → at least one card can be graded (SRS advance).
- [ ] Saved entry shows **source title or URL** when present in entry payload.
- [ ] `pnpm bench:live:lane:learning-loop` completes (or `popup-proof` + `vocabulary-srs-smoke` separately).

## P1 — spot checks

- [ ] Previous/next sentence navigation in popup deep-read.
- [ ] Reading history entry exists after meaningful read (if enabled).
- [ ] Empty study context shows fallback copy (no crash).

## Automation cross-reference

- Deterministic harness: `pnpm bench` (translation / extraction / hover / selection benches).
- Browser-backed: `pnpm bench:live:lane:extension-core`, `pnpm bench:live:lane:learning-loop`.
