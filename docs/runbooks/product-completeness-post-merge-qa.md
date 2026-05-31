# Product Completeness Post-Merge QA Runbook

Use this after merging a product-completeness PR or before a paid-beta cut. The goal is to verify the ordinary-user loop, not every internal feature.

## 0. Preflight

```bash
git status --short --branch
pnpm install
pnpm check:repo-knowledge
pnpm check:product-copy
```

If public copy changed, optionally run the broader audit:

```bash
pnpm check:product-copy -- --all
```

## 1. Build and focused checks

```bash
pnpm type-check
pnpm test
```

If Web changed:

```bash
npx vitest run src/web/src/app.test.tsx
pnpm type-check:web
pnpm build:web
```

If extension UI changed, add focused tests for touched surfaces, for example:

```bash
pnpm exec vitest run src/entrypoints/popup/App.test.tsx
pnpm exec vitest run src/entrypoints/options/OptionsApp.test.tsx
pnpm exec vitest run src/entrypoints/content/components/SelectionToolbar.test.tsx src/entrypoints/content/components/FloatBall.test.ts
```

If video changed:

```bash
pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts
```

If mobile changed:

```bash
pnpm verify:mobile
pnpm test:mobile-domain
pnpm --dir apps/mobile type-check
```

## 2. First-success manual QA

Use a fresh browser profile or cleared extension storage.

Pass path:

```text
open Astra → sample lesson → understand content → save 3 expressions → review 3 cards → completion next step
```

Check:

- No provider/model/API setup appears.
- Save feedback is visible.
- Review cards exist.
- Completion state appears.

## 3. Web reading QA

Use a public English article or docs page.

Check:

- Translation/reading starts without configuration.
- Page remains usable.
- Selection explain works.
- Save creates source-backed review item.
- Long/partial states are understandable.

## 4. Supported-video QA

Use a supported YouTube video with captions.

Check:

- Subtitle/transcript experience is readable.
- Transcript or subtitle line can be saved.
- Saved item includes source title and timestamp.
- Review card shows video context.

Then test a no-caption video/fallback if available:

- Copy avoids universal support claims.
- User gets a next action.

## 5. Review habit QA

Seed or create due cards.

Check:

- Today review count is visible.
- Again / Good / Easy or equivalent is clear.
- Cards keep source context.
- Completion screen shows progress and next action.

## 6. Library QA

Check:

- Recently saved is easy to find.
- Web and video sources are distinguishable where available.
- Empty states tell users how to create the first item.
- User does not need folders/tags for the default path.

## 7. Mobile companion QA

If mobile is in scope:

- Today review appears first.
- SRS/due ordering is respected.
- Recent saved items are visible.
- Video/source links preserve context.
- Mobile does not claim live webpage injection.

## 8. Screenshot and public-page smoke

If landing/README/store visuals changed:

- Verify screenshots do not show advanced/dev/operator controls.
- Verify screenshots show understand → save → review when possible.
- Verify public copy avoids all-sites/all-videos/no-upload/local-only overclaims.

For Web deploy after explicit approval:

```bash
pnpm deploy:web:cloudflare
curl -I -L https://astra-web.pages.dev
curl -L -s https://astra-web.pages.dev | rg -n "Astra|Learn from the English|Zero-config|supported videos"
```

## 9. Final release note

Record:

- branch/commit;
- checks run;
- manual QA scenarios passed/failed;
- screenshots captured;
- known limitations;
- rollback notes if deployed.
