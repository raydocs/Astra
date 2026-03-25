# Test Fixtures & Harness

This directory contains shared helpers for Astra content-side tests.

## Utilities

- `utils/mockBrowser.ts` — browser API mock used by `#imports`
- `utils/domFixture.ts` — viewport, rect, observer, and selection helpers
- `utils/contentHarness.ts` — page fixture loader and DOM mounting helper

## Page fixtures

Fixtures live in `fixtures/pages/` and should represent stable page archetypes:

- `article-basic.html`
- `dynamic-feed.html`
- `dense-inline.html`
- `forms-and-nav.html`
- `nested-blocks.html`

When adding a fixture:
1. Keep markup realistic but minimal.
2. Prefer semantic containers (`main`, `article`, `nav`, `aside`, `form`).
3. Avoid scripts or browser-only behavior in fixture HTML.
4. Add at least one test that uses the new fixture.

## When to use fixture tests

- Prefer **unit tests** for narrow logic such as traversal/extraction scoring, parser behavior, or message validation.
- Use **fixture/harness tests** for cross-module DOM behavior where realistic page structure matters.
- Avoid asserting overly specific batching or call-order details in fixture tests; keep them as smoke/regression coverage.
