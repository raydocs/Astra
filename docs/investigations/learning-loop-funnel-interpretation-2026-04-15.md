# Learning Loop Funnel Interpretation (2026-04-15)

This note defines the minimum Month 1/2 event layer for the learning loop and the claims we should avoid.

## Event Set

- `deep_read_opened`
- `sentence_explained`
- `sentence_saved`
- `review_answered`
- `returned_to_source`
- `resumed_reading`

These events are recorded locally through the shared telemetry store as `feature_usage` records with `feature: "learning_loop"`.

## What These Events Mean

- `deep_read_opened`: a user entered Deep Read from popup restore or a reopen path.
- `sentence_explained`: at least one sentence explanation completed successfully.
- `sentence_saved`: at least one sentence was saved into vocabulary from a learning surface.
- `review_answered`: a review card was answered from Review mode.
- `returned_to_source`: the user explicitly jumped back to the source page/article URL.
- `resumed_reading`: the user resumed a reading asset from Vocabulary or Review.

## Safe Interpretations

- Whether the popup → Deep Read → vocab/review loop is being exercised at all.
- Whether sentence-level work is happening before or after Deep Read opens.
- Whether reopen surfaces are sending people back into reading or source pages.
- Whether changes increase or reduce local loop completion signals on the same device.

## What Not To Over-Claim

- Do not treat these local events as cross-device product analytics.
- Do not interpret `deep_read_opened` as full article completion.
- Do not interpret `returned_to_source` or `resumed_reading` as meaningful reading depth by themselves.
- Do not compare users or cohorts from this store; it is a local diagnostics layer, not a product analytics warehouse.

## CI / Artifact Guidance

- The canonical release proof remains `CI=true pnpm bench:live:lane:learning-loop`.
- Artifact root is `bench-live-results/<run-id>/` locally and the `live-bench-results` workflow artifact in CI.
- Ownership should remain with the same live-browser workflow discipline as other required lanes: failures are release-facing until downgraded explicitly in docs.
