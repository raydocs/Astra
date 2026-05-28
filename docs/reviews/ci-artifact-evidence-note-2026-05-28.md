# CI artifact evidence note — 2026-05-28

Source: macro final-completion blockers `ciQualityArtifactsAttached` and `ciLiveBrowserArtifactsAttached`.

This note records repo-side CI artifact guardrails. It is **not** a CI run, uploaded artifact, release approval, or proof that external CI has completed for the current worktree.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| CI upload configuration | `.github/workflows/ci.yml`, `.github/workflows/bench-live.yml`, `src/utils/release-stage-gate.test.ts` | The quality job runs `pnpm check:macro-final-completion` as its own step, then writes `quality-gate-manifest.json`; the live-browser job writes `live-bench-manifest.json`; both upload their result directories as artifacts with workflow/job conclusion fields. | Needs actual successful target-commit CI run URLs, uploaded artifact URLs, artifact ids, digests/checksums, and manifests. |
| Final evidence checker | `script/maintenance/check-macro-final-completion.ts` | True CI evidence fields must include artifact names, workflow/run context, `success` workflow/job conclusions, run/job/artifact identity, distinct artifact ids/URLs, artifact digest/checksum, URL or repo artifact-path manifest, 7–40 character non-zero hex commit SHA, owner/date with `YYYY-MM-DD`, and required coverage tokens. | Needs real artifact rows in `docs/reviews/macro-ci-artifact-packet-2026-05-28.json`. |
| CI artifact packet intake | `evaluateAstraMacroCiArtifactPacket()` | Requires quality and live-browser rows to include artifact name, workflow/job, CI run URL, successful workflow/job conclusions, stable run/job/artifact identity, stable artifact digest/checksum, artifact manifest path, downloadable non-local artifact URL, commit SHA, owner/date, and coverage for required commands/lanes. It rejects placeholder values, failed/missing conclusions, weak all-zero/repeated/local/sample/test run/artifact ids and digests, non-URL, malformed, or local/private CI/artifact URLs, weak manifest references, non-hex SHAs, weak owner dates, and duplicate uploaded artifact ids/URLs. | The placeholder packet remains empty until target-commit CI artifacts exist. |

## Required packet rows

`ciQualityArtifactsAttached` may only be marked true when the packet includes:

- artifact name `quality-gate-results`;
- CI quality workflow/job and run URL;
- stable non-weak run id, real job name, `success` workflow/job conclusions, stable non-weak uploaded artifact id, stable non-weak artifact digest/checksum, and artifact manifest path (`data/bench-results/quality-gate-manifest.json` or URL/repo artifact path);
- downloadable non-local artifact URL;
- target commit/SHA as a 7–40 character non-zero hex git SHA;
- owner/date containing a real calendar `YYYY-MM-DD`;
- coverage for `pnpm check:repo-knowledge`, `pnpm check:zod-entrypoints`, `pnpm check:macro-final-completion`, `pnpm type-check`, `pnpm lint:ci`, `pnpm test`, and `pnpm bench`.

`ciLiveBrowserArtifactsAttached` may only be marked true when the packet includes:

- artifact name `live-bench-results`;
- CI live-browser workflow/job and run URL;
- stable non-weak run id, real job name, `success` workflow/job conclusions, stable non-weak uploaded artifact id, stable non-weak artifact digest/checksum, and artifact manifest path (`data/bench-live-results/live-bench-manifest.json` or URL/repo artifact path);
- downloadable non-local artifact URL;
- target commit/SHA as a 7–40 character non-zero hex git SHA;
- owner/date containing a real calendar `YYYY-MM-DD`;
- release-proof lane coverage for source-core, extension-core, learning-loop, document-proof, youtube-proof, and youtube-holdout.

## Downgrade copy

CI artifact upload wiring and a CI artifact packet intake guard exist in repo. Final completion still requires actual successful CI quality/live-browser run URLs, stable non-weak run/job/artifact identity, `success` workflow/job conclusions, distinct uploaded artifact ids/URLs, stable non-weak artifact digests/checksums, artifact manifests, and downloadable uploaded artifacts for the target commit/worktree.
