# Learning loop — claim impact (Month 2)

## What we can claim (with current gates)

- Users can **read → explain → save → review** in the extension; **browser-backed** evidence exists via `bench-live/popup-deep-read-proof` and `bench-live/vocabulary-srs-smoke` (see live lane conventions).
- **Study progress** is persisted per page and visible in **popup Study** and **vocabulary Review** (today’s aggregates).
- **Revisit** is supported at minimum via **recent history** in the popup and **open source page** from vocabulary / review.

## What we must not over-claim

- **Learning-loop is not a required release gate** in Month 2 unless release checklist + CI are explicitly changed.
- **SRS review “Card X of Y”** is session ordering, not the same UI model as popup page-level `completedSteps` — do not imply identical progress semantics.
- **No guarantee** of cross-device study continuity without relay sync paths validated for study progress in your deployment.

## External comms

- Describe learning loop as **“extension-local loop with optional live proof”** until `learning-loop` lane is required in CI and has attached green summaries per closeout.
