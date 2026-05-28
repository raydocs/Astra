# Legal, Trust, and Store Risk Checklist — 2026-05-27

Source strategy document: [`docs/plans/astra-zero-config-saas-operating-model-2026-05-27.md`](../plans/astra-zero-config-saas-operating-model-2026-05-27.md), sections 16–17.

## Scope

Create the first internal compliance/trust contract for Astra as a zero-config managed AI learning service.

This is not legal advice and does not replace formal review. It defines what product/legal evidence must exist before paid launch claims, public trial semantics, or store submission language can be treated as ready.

## Current implementation status

| Area | Status | Notes |
|---|---:|---|
| Privacy policy checklist | ✅ Contracted | `ASTRA_LEGAL_COMPLIANCE_CHECKLIST` requires data processed, purpose, service categories, Privacy Mode behavior, support report defaults, export, deletion, and cancellation handling. |
| Terms/refund/AI notice checklist | ✅ Contracted | Requires fair-use boundaries, cancellation/refund policy, minors boundary, and AI imperfection notice before paid launch. |
| Store permission copy | ✅ Contracted | `ASTRA_STORE_PERMISSION_COPY` provides ordinary-language explanations for page access, storage, tabs, optional notifications, and account continuity. |
| Export/copyright boundary | ✅ Contracted | `ASTRA_EXPORT_BOUNDARY_RULES` blocks default full-page saving, limits context, and makes public sharing user-initiated only. |
| Data deletion visibility | ✅ Launch blocker | Readiness helper blocks paid launch if deletion/export evidence is missing. |
| Support consent | ✅ Launch blocker | Checklist requires metadata-only reports by default and explicit content/screenshot action before upload. |
| Legal review | ✅ Launch blocker | `evaluateAstraComplianceReadiness()` requires formal legal/privacy review before paid launch readiness can be true. |
| Tone of voice | ✅ Contracted | `ASTRA_TONE_OF_VOICE_RULES` captures quiet/capable/trustworthy/non-technical/respectful trust language. |
| Production legal approval | Deferred | Requires external legal/privacy owner sign-off and final public URLs. |

## Validation

```text
pnpm test src/utils/trust/compliance.test.ts
# 1 file / 5 tests passed

pnpm type-check
# [type-check-exit] code=0

pnpm check:repo-knowledge
# [repo-knowledge-exit] code=0
```
