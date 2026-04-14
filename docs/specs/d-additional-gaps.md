# Additional Gap Specs (Beyond A/B/C)

## D1: Privacy Policy + About Page
**Files**: `src/entrypoints/options/OptionsApp.tsx` (About section)
**Content**: Link to privacy policy (hosted on GitHub Pages), data collection statement, open-source license

## D2: Data Export/Import
**Files**: New `src/utils/storage/backup.ts`
**Function**: Export all config + vocabulary + reading history as JSON. Import from JSON file. UI in Options page.

## D3: Translation Engine Badge
**Files**: `src/utils/dom/inject.ts`
**Change**: Add small "GT" / "GPT" / "Gemini" badge after each translated block showing which engine produced it. Useful for debugging and user confidence.

## D4: Translation Cost Estimator
**Files**: New `src/utils/cost-estimator.ts`
**Function**: Track total tokens/characters sent to paid providers per session. Show in popup: "This session: ~$0.003 (1,247 tokens)"
**Provider-specific**: OpenAI charges per token, Gemini per character, free = $0

## D5: "Don't Translate This" User Marker
**Files**: `src/entrypoints/content/page-translate.ts`
**Feature**: Right-click on any element → "Don't translate this" → adds `notranslate` class + saves to site config excludeSelectors. Persists across reloads.

## D6: Translation History Indicator
**Files**: `src/entrypoints/content/index.tsx`
**Feature**: On page load, check translation cache — if this page was translated before, show a subtle banner: "Previously translated · Click to restore"

## D7: Firefox Build Verification
**Files**: `wxt.config.ts`, `.github/workflows/ci.yml`
**Action**: Add `pnpm build --browser firefox` to CI. Test in Firefox Nightly. Fix any API incompatibilities.

## D8: Bundle Size Optimization
**Current**: 3.19MB total, pdf.worker.min.mjs = 1.24MB (39%)
**Actions**:
- Lazy-load pdf.js worker only when PDF reader opens
- Tree-shake epub.js (only import needed modules)
- Consider dynamic import for video platform adapters based on hostname

## D9:术语表管理 UI
**Files**: Options page Actions section or new Terminology section
**Feature**: Users can create term pairs (English → Chinese) that override translation for specific terms. Persist via vocabulary glossary entries and inject through the canonical request-time `terminologyGlossary` contract.

## D10: Chrome Web Store Preparation
**Files**:
- `store/description.md` — Store listing description
- `store/screenshots/` — 5 screenshots (popup, page translation, PDF reader, vocabulary, options)
- `store/privacy-policy.md` — Required privacy policy
- `public/icon-128.png`, `public/icon-48.png` — Required icon sizes
- Manifest: verify all required fields (version, icons, description)

## Execution Priority
1. **D10** (Store prep) — blocks distribution
2. **D2** (Data export) — user trust
3. **D7** (Firefox) — market expansion
4. **D8** (Bundle size) — performance
5. **D1** (Privacy policy) — compliance
6. **D3-D6** — polish features
