# Strategic Non-Goals Gate Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md), section 19.

## Scope

Convert the section-19 non-goals decision questions into a reusable proposal gate.

This now includes a minimal deterministic repo-side JSON/CI check for represented proposals. It does not build hosted PR bots, issue-label automation, support-desk imports, external integrations, or natural-language inference.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Six gate questions | ✅ Done | `ASTRA_PROPOSAL_GATE_QUESTIONS` covers zero-config support, cost control, ordinary-language explainability, privacy by default, learning-loop/paid-value fit, and support/analytics observability. |
| Proposal evaluator | ✅ Done | `evaluateAstraProposalGate()` returns `accept_candidate`, `advanced_or_beta_only`, or `defer`. |
| Hard non-goal risks | ✅ Done | Default unlimited high-cost use, default content upload, default provider console, default social community, and universal support claims produce blocking or boundary-required findings. |
| Next-step guidance | ✅ Done | Findings map to concrete next steps for cost class/kill switch, consent, ordinary-language copy, support/analytics fields, or advanced/beta boundaries. |
| Minimal JSON/CI enforcement | ✅ Done | `docs/analysis/strategic-non-goals-proposals.json` is checked by `pnpm check:strategic-non-goals` and CI. The check rejects malformed fixtures, `defer`, and decisions stricter than the fixture allows. |
| Hosted workflow automation | Deferred | PR templates, bots, issue-label checks, support-desk imports, external integrations, and natural-language inference remain future work. |

## Validation

```text
pnpm test src/utils/strategic-non-goals.test.ts
# 1 file / 4 tests passed

pnpm type-check
# [type-check-exit] code=0

pnpm check:repo-knowledge
# [repo-knowledge-exit] code=0

pnpm check:strategic-non-goals
# [strategic-non-goals-exit] code=0
```
