# Web `/assets` role investigation

## Recommendation

Hold the `/assets` learner retone until the product owner explicitly decides the surface role.

## Evidence from current code

- `src/web/src/app.tsx` contains certification-only seed content, workspace rows, and `/assets` route fixtures that are useful for visual certification and ops-style screenshots.
- The extension `src/entrypoints/vocabulary/VocabularyApp.tsx` already carries the learner Library job: recent saves, due review, source-backed cards, from-web/from-video filters, search, source return, and weekly digest.
- The mobile app already frames the companion job as Today Review, recent saved items, source return, and digest/habit—not live page capture.

## Product decision needed

Choose one of these before editing `/assets` copy or layout:

1. **Learner-facing companion** — retone `/assets` into recent saved / from web / from supported videos / today due / source return.
2. **Internal certification or ops surface** — keep it as a controlled route for screenshots, certification density, and internal workspace evidence.
3. **Hybrid** — add a clearly named learner route later (for example `/library`) and leave `/assets` stable.

## Current action

Do not rebuild `/assets` in this round. Product completeness work should continue on extension capture, supported-video save/review, mobile habit, feedback, digest, and documentation.
