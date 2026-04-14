# Privacy authority decision — translation transport boundary

_Task `NW-G-01`_

_Last updated: 2026-04-14_

## Decision

**Authoritative owner:** the **background translation boundary** now owns request-context sanitization for translation requests when `privacyMode=true`.

That means:

- caller surfaces may still pre-sanitize context earlier for surface-local behavior,
- but provider dispatch and translation-cache context must not rely on caller discipline alone,
- and the background must sanitize `payload.context` before cache lookup and before provider/router dispatch.

## Why this is the chosen boundary

This is the narrowest closure that resolves the Month 6 architecture gap without a broad privacy redesign:

- all translation egress already funnels through `src/entrypoints/background/index.ts`
- background already reads config and resolves the effective provider path
- background is the last client-owned point before direct or relay transport
- this closes the documented “caller-owned only” gap without changing translation UX or server policy

## Current implementation boundary

### In scope now

- `src/entrypoints/background/index.ts`
  - sanitizes `payload.context` through `sanitizeTranslationContextForTransport(...)`
  - uses the sanitized context for both:
    - translation-cache context construction
    - provider/router dispatch
- `src/utils/privacy.ts`
  - remains the canonical sanitizer
  - now also exposes the transport-boundary helper used by background

### Still true after this task

- privacy mode does **not** mean translation is local-only
- text still leaves the device on direct or relay paths
- this task does **not** assert server-side retention or logging guarantees
- sensitive-input blocking remains heuristic
- some caller surfaces still pre-sanitize earlier because they also shape local UI behavior

## Honest claim boundary after NW-G-01

Current honest statement:

- privacy mode sanitizes translation request context at the **background transport boundary**
- some covered caller surfaces also pre-sanitize before that boundary
- privacy mode still does **not** guarantee local-only translation or end-to-end secrecy across all systems

Current non-claims:

- not a universal PII detector
- not a server/privacy-retention audit
- not a broader privacy-mode redesign

## Proof / validation

### Code
- `src/entrypoints/background/index.ts`
- `src/utils/privacy.ts`

### Tests
- `src/utils/privacy.test.ts`
- `src/entrypoints/background/index.test.ts`

### Key assertion now covered

If a caller sends unsanitized `TranslationRequestContext` while `privacyMode=true`, the background sanitizes it before:

1. cache key generation
2. direct provider dispatch
3. relay dispatch / fallback path

## Relation to Month 6 docs

- `docs/investigations/month-6-privacy-routing-failure-inventory-2026-04-14.md` remains the Month 6 baseline inventory.
- This document is the **current resolution** of the specific privacy-authority gap that inventory identified.
- `docs/release-readiness-checklist.md` should use this document for current release-facing wording.

## Next task dependency

`NW-G-02` can proceed after this task because the request-time privacy boundary is now explicit enough to evaluate glossary wiring against one transport rule instead of caller-by-caller discipline.
