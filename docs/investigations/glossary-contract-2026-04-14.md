# Glossary contract — canonical request-time terminology wiring

_Task `NW-G-02`_

_Last updated: 2026-04-14_

## Decision

Astra now uses **one glossary source of truth**, **one serialization format**, and **one canonical request-time wiring path**.

### Source of truth

**Source of truth:** glossary-enabled vocabulary entries in local vocabulary storage.

Specifically:

- `glossaryEnabled`
- `glossaryScope`
- `glossaryTargetText`
- fallback to `translation` when `glossaryTargetText` is empty

No caller-provided ad hoc `terminologyGlossary` string is authoritative anymore.

## Canonical serialization format

The only canonical `terminologyGlossary` serialization format is:

```text
source => target
```

One entry per line, deterministic order, with embedded newlines and separator-like content escaped deterministically so the line structure stays canonical.

Ordering rules:

1. hostname-scoped entries first when hostname is available
2. global entries after that
3. newest first within each scope bucket
4. dedupe by normalized source text, with hostname-scoped entries winning over global duplicates

## Canonical request-time path

The only canonical request-time wiring path is:

1. caller sends translation request context to background
2. background applies transport-boundary privacy sanitization
3. background resolves glossary entries from vocabulary storage using the request hostname
4. background serializes the glossary into canonical `source => target` lines
5. background injects that string into `context.terminologyGlossary`
6. provider prompt builders consume that field as terminology data
7. cache keys include the same canonical glossary string

## Current implementation boundary

### In scope now

- `src/utils/storage/vocabulary.ts`
  - glossary entry selection
  - canonical serialization
  - canonical `buildTerminologyGlossary(...)` helper
- `src/entrypoints/background/index.ts`
  - canonical request-time glossary injection
  - removal of caller-provided ad hoc glossary strings as an authority source
- `src/utils/providers/openai.ts`
  - continues to treat `terminologyGlossary` as terminology data, not free-form instructions
- `src/utils/cache/translation-cache-context.ts`
  - continues to key on the canonical `terminologyGlossary` string

### Still true after this task

- this is a runtime contract closure, not a glossary UI expansion
- this is not a claim of universal or provider-enforced hard guarantees
- this does not create a new release gate by itself
- release wording should stay narrower than “fully guaranteed terminology enforcement”

## Honest claim boundary after NW-G-02

Current honest statement:

- Astra now has a **canonical vocabulary-backed request-time glossary contract**
- that contract uses one deterministic serialization format and one background-owned injection path
- provider prompts receive terminology data in that canonical form
- cache invalidation follows the same canonical form

Current non-claims:

- not a universal terminology guarantee across every model behavior
- not a separate release-grade proof gate by itself
- not a glossary management product expansion

## Validation

### Code
- `src/utils/storage/vocabulary.ts`
- `src/entrypoints/background/index.ts`
- `src/utils/providers/openai.ts`
- `src/utils/cache/translation-cache-context.ts`

### Tests
- `src/utils/storage/vocabulary.test.ts`
- `src/entrypoints/background/index.test.ts`
- `src/utils/providers/openai.test.ts`
- `src/utils/translate/translate.test.ts`
- `src/utils/cache/translation-cache.test.ts`

## Consequence for future work

`NW-G-03` can now treat glossary data as settled input metadata rather than an unresolved contract question.
