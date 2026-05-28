# Astra GTM Demo Scripts and Growth Copy

Source plan: Section 27, Go-to-Market: Growth and Distribution, from the macro product upgrade plan dated 2026-05-27.

> Path note: the plan suggested `scripts/gtm-demos.md`, but this repo guardrail forbids reintroducing legacy top-level `scripts/`. This artifact lives under `docs/gtm/` instead.

## Positioning

Astra growth copy leads with real-content learning, not a feature list or AI-provider mechanics.

- Primary line: **Read anything. Learn what matters.**
- Supporting line: **Just read. Astra handles the AI.**
- Boundary: promote only release-gated capabilities; beta surfaces use “works best with…” language.

## First-version channels

1. Chrome Web Store — six screenshots plus scenario-led listing copy.
2. Landing Page — 60-second demo path and sample lesson CTA.
3. YouTube/Bilibili short demo — one real article/video becomes a review card.
4. Share Card — bilingual sentence card with Astra watermark and metadata-only landing tracking.

Deferred/secondary: Xiaohongshu, Twitter/X, SEO, and referral rewards. Referral MVP remains non-rewarding until abuse controls exist.

## Five demo scripts

### 1. Read one article, keep five expressions

- Target: Landing Page, YouTube/Bilibili, Chrome Web Store
- Runtime: 55 seconds
- Gate: Public Beta core reading/save/review path

Steps:
1. Open a real English article.
2. Use Astra to make the page understandable without setup.
3. Select a useful expression in context.
4. Save it as a reviewable card.
5. Open Review and show the original source context.
6. Close: **Read anything. Learn what matters.**

### 2. Watch a supported video as a language lesson

- Target: YouTube/Bilibili, Chrome Web Store
- Runtime: 58 seconds
- Gate: Video learning beta gate with works-best-with boundary

Steps:
1. Open a supported captioned video.
2. Show Astra's video learning panel or subtitle help.
3. Pick one useful expression from the transcript moment.
4. Save it with time/source context.
5. Review the saved expression later.
6. Close: **Turn videos you already watch into language practice.**

### 3. No API keys, no setup

- Target: Landing Page, Chrome Web Store, Twitter/X
- Runtime: 40 seconds
- Gate: Managed AI beta/free boundary and sample lesson first-success path

Steps:
1. Start Astra from the landing/sample path.
2. Choose a target language and goal in ordinary language.
3. Open the sample lesson.
4. Understand, save, and review one authored sentence.
5. Close: **Just read. Astra handles the AI.**

### 4. Three minutes of review from real content

- Target: Landing Page, Xiaohongshu, Chrome Web Store
- Runtime: 45 seconds
- Gate: Review daily-goal and source-context gate

Steps:
1. Open Today Review.
2. Show a card made from real content the learner saved.
3. Answer one card and show lightweight progress.
4. Return to the source for context.
5. Close: **Review what you chose, not a generic word list.**

### 5. Your learning trail

- Target: Landing Page, Chrome Web Store, SEO
- Runtime: 50 seconds
- Gate: Library/source controls and data-retention boundary

Steps:
1. Open Library after a few saves.
2. Show sources grouped by article/video/file/sample.
3. Show saved cards linked to a source.
4. Open a weekly digest-style summary without showing full page text.
5. Continue the source from the learning trail.
6. Close: **Your everyday reading becomes a learning trail.**

## Landing hero copy

- Headline: **Read anything. Learn what matters.**
- Subheadline: Astra turns real English webpages and supported videos into understanding, saved expressions, and lightweight review — without setup.
- Primary CTA: Try the sample lesson
- Secondary CTA: See how Astra saves and reviews

## Store listing core copy

- Title: Astra — learn English from real webpages and videos
- Short description: Read English webpages and supported videos with AI, save useful expressions, and review later — no API setup.
- Lead: Open a real article, page, PDF, or supported video; Astra helps you understand it, save useful expressions, and review them later with source context.

See also `store/listing-copy.md` for full English/Chinese listing and permission trust copy.

## Ten channel-specific social posts

1. YouTube/Bilibili: Demo: one English article → five saved expressions → a three-minute review from the page you actually read.
2. Xiaohongshu: 不用先背单词。打开真实英文内容，读懂一句，保存一句，明天复习一句。
3. Twitter/X: Astra turns everyday reading into language memory: understand a page, save the phrase, review it with source context.
4. SEO: Read English websites with AI and keep useful expressions for review.
5. Share Card: Shared from Astra: a real sentence, a useful translation, and a path back to lightweight review.
6. Landing Page: Try a zero-config sample: understand one sentence, save it, and review it in under a minute.
7. Chrome Web Store: Screenshots show the loop: read → explain → save → review → continue your learning trail.
8. YouTube/Bilibili: Watch a supported captioned video as a language lesson. Save one moment; review it later.
9. Xiaohongshu: 每天 3 分钟复习，不是随机词表，而是你昨天真正读过的表达。
10. Twitter/X: No setup-first workflow: just read, save what matters, and review from real context.

## Share-card templates

### Sentence translation

```text
{sourceSentence}
{translation}
From: {sourceTitle}
Shared from Astra — Read anything. Learn what matters.
```

### Review moment

```text
Today I saved: {sourceSentence}
Review it later with Astra.
Astra sentence card
```

## Readiness helper

`src/utils/gtm-campaign.ts` exposes:

- first-version channel definitions;
- campaign definitions;
- five demo scripts;
- landing/store/social/share-card copy deck;
- `detectGrowthCopyTechnicalTerms()`;
- `evaluateAstraGtmReadiness()`.

Readiness blocks if the first four channels are missing, demos exceed 60 seconds, materials fail to show the learning loop, copy uses internal technical terms, promoted capabilities lack release-gate evidence, share cards lack a watermark, or referral rewards are promised before abuse controls exist.
