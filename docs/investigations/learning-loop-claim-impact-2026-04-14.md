# Learning loop — claim impact (Month 2)

## What we can claim (with current gates)

- Users can **read → explain → save → review** in the extension, with browser-backed proof via `bench-live/popup-deep-read-proof` and `bench-live/vocabulary-srs-smoke`.
- **Study progress** is persisted per page and surfaced coherently enough to guide the next step.
- A replayable **revisit v1** path exists via **Vocabulary → Reading tab → Open** for article rows, with visible page identity and progress context.

## What we must not over-claim

- **Learning-loop is required in release policy and CI** for the narrow Month 2 popup → vocabulary/review → article revisit path; broader learning continuity claims still need separate proof.
- **SRS review “Card X of Y”** is session ordering, not the same UI model as popup page-level `completedSteps`; they are related, not identical.
- **No guarantee** of cross-device study continuity without validated relay sync paths for study progress in your deployment.
- **No generalized resume center** or sentence-position restoration is promised by Month 2 revisit v1.

## External comms

- Describe the learning loop as **“implemented, browser-proved, and release-gated for the narrow Month 2 learning-loop path.”**
- Describe revisit as **“one supported reopen path”**, not a generalized multi-surface resume system.
