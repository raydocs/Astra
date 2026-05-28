# AI quality human-scored evidence note — 2026-05-28

Source: macro product upgrade plan Section 24.

This note records repo-side AI quality report guardrails. It is **not** a completed human-scored provider-quality report, live provider scoring run, release-quality approval, or owner signoff.

## Current repo-backed evidence

| Area | Repo evidence | Current proof | Remaining boundary |
| --- | --- | --- | --- |
| Rubric and thresholds | `src/utils/ai-quality-system.ts`, `src/utils/ai-quality-system.test.ts`, `docs/quality/rubrics.md` | Defines the 1–5 rubric dimensions, blocker taxonomy, release thresholds, run summary, readiness evaluation, and trend summary. | Needs actual scored run data and reviewer notes. |
| Fixed fixture manifest | `test/fixtures/quality/ai-quality-samples.json` | Fixture manifest contains at least 100 P0 samples across five-plus ability categories. | Needs human or approved evaluation process scores for the target release. |
| Prompt-injection safety fixtures | `test/fixtures/quality/prompt-injection.json`, `src/utils/ai-safety.ts`, `src/utils/ai-safety.test.ts` | Malicious/untrusted-content safety fixtures exist and are deterministic. | Needs target-release live/provider safety scoring where applicable. |
| Human-scored report intake | `evaluateAiQualityHumanScoredReportEvidence()`, `pnpm check:macro-final-completion` | A report is acceptable only with reviewer/date containing a real calendar `YYYY-MM-DD`, target environment, non-placeholder run metadata, URL or repo artifact-path fixture manifest/live-provider/blocker-triage evidence with local-only/private-network/loopback URLs, malformed URLs, and path-traversal repo references rejected, finite integer sample counts matching the summarized P0 sample count, trend, release decision, release-readiness thresholds, and a well-formed run-summary object. The evaluator rejects impossible summary counts, non-integer/negative count records, out-of-range rates/scores, and low-score backlog scores; the final checker also rejects malformed arrays/records plus optional summary timestamp/run-id mismatches before evaluator preclaim checks run. | This validates supplied evidence; it does not create human/provider scores. |
| Manual QA checklist | `docs/reviews/macro-manual-qa-evidence-checklist-2026-05-28.md` | Section 24 rows identify P0 fixture scoring, live provider sample, blocker triage, and trend/decision note as required evidence. | Rows remain not-run until owner/date/environment/evidence/verdict fields are filled. |

## Minimum acceptable Section 24 report

A target-release human-scored AI quality report must include:

1. reviewer and review date containing a real calendar `YYYY-MM-DD`, environment, run id, rubric version, and fixture manifest version;
2. scores for the fixed P0 sample set using `docs/quality/rubrics.md`, with finite integer scored/live sample counts;
3. live provider sample evidence with sample IDs/categories and scoring notes, attached as a URL or repo artifact path;
4. blocker sample IDs, severities, backlog labels, owners, and release disposition, attached as a URL or repo artifact path;
5. trend direction compared with the previous fixed-set run, or an explicit new-baseline note;
6. release decision: `approve`, `approve_with_downgrade`, or `block`.

## Downgrade copy

Deterministic AI-quality utilities, rubric, fixture manifests, release-threshold evaluation, trend logic, and a human-scored report intake guard exist in repo. Production quality claims still require a dated human-scored provider-quality report with Section 24 owner/date/environment/evidence/verdict rows.
