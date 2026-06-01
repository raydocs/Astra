# Astra competitor benchmark: Read Frog and LingQ

Last updated: 2026-06-01.

This note keeps the product bar honest. Astra should not try to become a provider console, a LingQ clone, or a generic content library. Its wedge is:

```text
Real webpages and supported videos → understand now → save the useful expression → source-backed review later.
```

## Corrected positioning

| Product | What it really is | Astra implication |
|---|---|---|
| Read Frog | Open-source immersive translation plus immediate AI explanation. It is strong on provider breadth, BYO-key, free/open-source distribution, and fast iteration. It is not currently a local SRS/known-word learning loop. | Astra should beat Read Frog on zero-config managed service, save → review → retain, mobile habit, source-backed Library, and supported-video moments. Do not compete by exposing 20+ providers to ordinary users. |
| LingQ | Mature comprehensible-input learning platform with known-word states, new-word percentage, content library/import, dictionary/community meanings, mobile apps, and SRS. | LingQ is the real learning-depth benchmark. Astra should borrow only wedge-safe pieces: trustable explanations, soft difficulty, fewer repeated explanations, and a small number of better review modes. Do not copy the full content library, scoreboard, community, or LMS surface. |

## Important code-backed correction

Astra does **not** currently enforce a Free-tier review-library card cap. The local vocabulary storage cap is a global storage guard (`MAX_ENTRIES = 2000` in `src/utils/storage/vocabulary.ts`), not a Free vs Pro paywall. Pro value copy must not promise a larger review library unless a real tiered limit exists.

Paid value should stay on the code-backed axes that actually exist or are intentionally managed:

- longer webpages / longer videos;
- deeper explanations;
- synced learning history;
- more included reading / managed AI capacity;
- digest and continuity value where implemented.

## Comparison matrix

| Dimension | Astra | Read Frog | LingQ |
|---|---|---|---|
| Default user model | Zero-config managed AI for ordinary learners. Advanced provider controls must stay out of the ordinary path. | BYO-key/provider/model configuration is a core strength and a core friction. | Subscription learning platform; provider choice is not the user-facing model. |
| Web reading | Bilingual reading plus selection explain, source-backed save, Review, and Library. | Strong immersive translation and AI actions. | Reading happens inside imported/hosted lessons more than arbitrary webpages. |
| Learning loop | Save → Leitner review → source-backed Library → mobile habit. | No comparable local SRS/known-word loop in the verified baseline. | Known-word states, new-word percentage, SRS, content library, and mobile loop are core. |
| Explanation trust | AI-first explanations; no dictionary ground truth or confidence layer yet. | AI-first explanations; strong configurability but not a dictionary-first learning model. | Dictionary/community meanings first; AI meanings are supplemental. |
| Known words / difficulty | No explicit known-word state or personalized new-word percentage. Mastery can only be inferred from saved/reviewed cards. | No verified known-word/SRS baseline. | Core product concept: unknown/learning/known word states and personalized difficulty. |
| SRS/card depth | Leitner 5-box; word/sentence review is the practical main path. | Not a core feature. | More mature review modes and deeper study workflows. |
| Video learning | Supported-video subtitles/transcript save with source and timestamp; no full transcript export by default. | YouTube subtitle translation is a strength; learning retention loop is weaker. | YouTube/Netflix import into a lesson ecosystem. |
| Mobile | Native companion for Today Review, recent saves, source return, and habit. | No verified native mobile companion baseline. | Mature mobile apps. |
| Content discovery | Intentionally minimal; users bring real content. | Minimal; tool-first. | Major strength: library/community/import ecosystem. |
| Monetization | Managed AI implies real cost limits; copy must match enforced limits. | Free/open-source plus BYO cost model. | Subscription with a hard free LingQ limit. |

## Real gaps worth fixing

### P0 — explanation trust

Astra's highest-risk learning gap is not provider breadth. It is teaching the wrong thing confidently. For Chinese learners of English, start with a wedge-safe trust layer:

- dictionary/pronunciation fallback for common English words and phrases where licensing permits;
- “in this sentence” explanations that separate contextual meaning from general meaning;
- soft uncertainty copy when a term is ambiguous;
- no provider/model/API choices in ordinary UI;
- no page/video content treated as instructions.

### P0 — monetization integrity

Pro copy must only promise value that is enforced or implemented. If Astra wants to sell a larger review library, implement a real tiered card cap and migration UX. Otherwise keep Pro value on managed-AI capacity, longer content, deeper explanations, sync, digest, and continuity.

### P1 — fewer repeated explanations and soft difficulty

Do not copy LingQ's public vocabulary scoreboard. Instead, infer a small “known enough” set from mastered saved cards and user-dismissed annotations, then use it to reduce repeated explanations and show calm difficulty copy:

- “This looks smooth for quick reading.”
- “A few expressions may be worth saving.”
- “This is a better page for slow reading.”

Avoid “you know 4,213 words” gamification unless explicitly revisiting positioning.

### P1 — a few better review modes

Keep the review surface simple, but improve learning depth with a small bounded set:

- cloze from the user's saved sentence;
- reverse recall for high-value saved phrases;
- dictation from TTS for saved sentences.

Do not build an Anki-style note-type editor.

## Astra advantages to preserve

- Real save → SRS → retain loop, which Read Frog does not provide in the verified baseline.
- Mobile habit companion, not mobile webpage injection.
- Zero-config managed AI for ordinary users.
- Supported-video source/timestamp loop across capture and review.
- Calm UX: no provider console, no quota-shaming copy, no content-heavy telemetry, no social pressure.

## Non-goals to keep explicit

- BYO-key/provider/model console for ordinary users.
- DeepL or large provider roster as the main differentiator.
- LingQ-style hosted content library or full LMS.
- Known-word scoreboards and Duolingo-style gamification.
- Social/community/shared decks.
- Full Anki clone, custom note types, or complex deck management.
- Full transcript/SRT export as a default path.
- Microphone pronunciation scoring or live tutoring.

## Acceptance evidence before claiming “surpasses Read Frog”

- A fresh user can understand → save → review without configuring providers or API keys.
- Web selection saves source-backed cards and gives clear saved feedback.
- Supported-video saves preserve source title and timestamp and can return to the moment from Review/Library.
- Mobile shows Today Review and recent saved items without claiming live webpage injection.
- Public Pro copy matches code-enforced limits.
- `pnpm check:product-copy` passes for changed public copy.
- Safari resources are synced when public extension assets/locales change.
