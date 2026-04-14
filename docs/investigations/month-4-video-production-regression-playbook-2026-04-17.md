# Month 4 — Video production regression playbook (manual)

**Date:** 2026-04-17  
**Scope:** Real **www** watch pages for **YouTube** and **Bilibili** with the Astra extension loaded. Use this when validating production traffic, geo/login/player churn, and caption UX — not the bench-live inline fixtures.

## Preconditions

1. **Chromium with Playwright binary** — Install Playwright’s Chromium so local extension loading matches CI expectations (`npx playwright install chromium`). See `AGENTS.md` (extension-loaded live scenarios).
2. **Extension build** — From repo root: `pnpm build` (load the produced unpacked extension in your dev browser profile as you normally do for manual QA).
3. **Adapter expectations vs inventory** — Canonical table: `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md` §Adapter table.
   - **Supported (Month 4 primary video):** `youtube.ts` / YouTube — **supported**, proof **L3** (includes bench-live **fixture** lane; production is still manual here).
   - **Best-effort / secondary:** `bilibili.ts` / Bilibili — **best-effort**; fixture smoke raises wiring to **L3**, **real site remains L2** until extended proof.
   - **Fixture-only / out of Month 4 lane scope:** Netflix, Prime Video, Disney+, Coursera, Udemy adapters are **code-only** (L1) in the inventory — do **not** treat this playbook as proof for those sites unless scope explicitly expands.

When a run fails, classify the issue using the **production vs fixture** failure-class tables in the same inventory doc:

- [YouTube — failure classes (production vs fixture)](video-subtitle-adapter-inventory-2026-04-15.md#youtube--failure-classes-production-vs-fixture)
- [Bilibili — failure classes (production vs fixture)](video-subtitle-adapter-inventory-2026-04-15.md#bilibili--failure-classes-production-vs-fixture)

## Explicit non-goals

- This playbook **does not** replace or duplicate automated coverage from **`bench-live/youtube-subtitle-basic`** and **`bench-live/bilibili-subtitle-basic`**. Those scenarios use **`inline:youtube-subtitle`** / **`inline:bilibili-subtitle`** fixture pages — keep them green in CI for adapter skeleton and wiring; use **this** document for **production** watch-page checks.

Bench fixture commands and artifact layout remain documented in `docs/investigations/month-4-video-smoke-replay-2026-04-16.md`.

---

## Manual steps — YouTube

1. Open **https://www.youtube.com** in a profile with the **built** extension enabled.
2. Open a **watch** URL for a video that has **human or auto captions** enabled (confirm the native CC control shows an active track).
3. Play for ~15–30s with captions **on**; seek once and pause briefly (exercises timing paths similar to adapter assumptions).
4. Open **Astra’s extension panel** (popup/side panel per your build) on the same tab and confirm the **video / subtitle surface** responds (no blank error state; cues or reader path as expected for the build under test).
5. **Evidence**
   - **Console:** DevTools → Console → right-click → **Save as…** (or equivalent).  
     **Filename:** `m4-prod-youtube-<YYYYMMDD>-<your-initials>-console.txt`  
     Example: `m4-prod-youtube-20260417-ab-console.txt`
   - **Screenshot:** capture the **watch page + caption overlay** (and panel if separate).  
     **Filename:** `m4-prod-youtube-<YYYYMMDD>-<your-initials>-<step>.png`  
     Use `<step>` tokens such as `watch`, `panel`, `after-seek` if multiple shots are needed.

If something breaks, map symptoms to **`YT_*`** classes in the inventory link above and note the class id in your failure note.

---

## Manual steps — Bilibili

1. Open **https://www.bilibili.com** with the same extension profile.
2. Open a **video** page where subtitles are **visible** in the player (confirm the site’s subtitle panel actually shows text during playback).
3. Play ~15–30s; toggle theater/fullscreen once if you routinely ship to users in those modes (DOM differs from inline).
4. Verify the **extension panel** on that tab as for YouTube.
5. **Evidence** — same convention as YouTube, with site token **`bilibili`**:
   - Console: `m4-prod-bilibili-<YYYYMMDD>-<your-initials>-console.txt`
   - Screenshots: `m4-prod-bilibili-<YYYYMMDD>-<your-initials>-<step>.png`

On failure, map to **`BILI_*`** classes in the [Bilibili failure-class table](video-subtitle-adapter-inventory-2026-04-15.md#bilibili--failure-classes-production-vs-fixture).

---

## Cross-links

| Topic | Doc |
|--------|-----|
| Adapter matrix, proof levels, **failure class tables** | `docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md` |
| Fixture bench replay commands + honest scope | `docs/investigations/month-4-video-smoke-replay-2026-04-16.md` |
