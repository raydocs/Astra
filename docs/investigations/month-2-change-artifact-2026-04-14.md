# Month 2 — Change artifact (frozen inventory)

_Generated: 2026-04-14_  
_Repository: `raydocs/Astra`_

This document is the **canonical artifact** for “everything that landed for Month 2” in git: merge boundaries, compare links, commit lists, and a **deduplicated file inventory** (160 paths) suitable for audits, handoffs, and release notes.

## 1. How the window is defined

| Slice | Meaning | Git |
|-------|---------|-----|
| **A — `month2/learning-loop-v1` merge** | First-class Month 2 product branch merged to `main` | Merge commit `6d79e2d` — first parent = pre-merge `main` (`08cbce7`), second parent = branch tip (`813b14e`) |
| **B — Post-merge follow-ups** | Ledger closeout, docs, Review UI, Study layout, `plan.md`, AGENTS, dependabot bumps on `main` | `6d79e2d..HEAD` (currently ends at `5cb0921`) |

**Union file set** = all paths touched in **A ∪ B** (see §5).

## 2. Compare links (GitHub)

Use these in PR descriptions or release tooling (no auth in URL):

- **Branch `month2/learning-loop-v1` vs merge-base parent**  
  `https://github.com/raydocs/Astra/compare/08cbce7...813b14e`

- **Follow-up commits on `main` after the merge**  
  `https://github.com/raydocs/Astra/compare/6d79e2d...HEAD`

## 3. Commit inventory

### 3a. Merge `6d79e2d` — second parent `813b14e` (150 files in diff)

High-level themes: learning-loop surfaces, popup study hub, bench-live lanes (popup proof, vocabulary SRS, onboarding, hover/selection, article extraction proof), CI live-browser hardening, extension/web/build scripts, `plan.md`, docs (Month 1 closeout, coverage matrix, lane conventions), iOS Safari Resources sync.

```text
git log --oneline 08cbce7..813b14e
```

(Run locally for the full list; tip of branch is `813b14e`.)

### 3b. `6d79e2d..HEAD` — follow-up (includes Month2-tagged + infra)

```text
5cb0921 docs(AGENTS): relay env keys, restart note, translate hello-world curl
68e2158 feat(month2): complete ledger #6/#9/#24/#30 — study layout, stats, revisit age
cbe55f8 Merge cursor/dev-env-setup-43fc: Month 2 learning-loop completion
8be9492 feat(month2): learning-loop docs, review UX, vocab search, study step order
5f38e5f Merge pull request #10 from raydocs/dependabot/npm_and_yarn/jsdom-29.0.2
3ddc1e8 Merge pull request #6 from raydocs/dependabot/github_actions/actions/upload-artifact-7
8d31010 Merge pull request #5 from raydocs/dependabot/github_actions/pnpm/action-setup-6
331d9ef feat(vocabulary): show daily study-loop stats in Review mode (Month 2)
d8bda47 docs: Month 1-2 plan harness scores, checkboxes, and learning-loop evidence
6a99b82 build(deps): bump jsdom from 26.1.0 to 29.0.2
702df94 build(deps): bump actions/upload-artifact from 4 to 7
2eb8cfd build(deps): bump pnpm/action-setup from 5 to 6
```

_Note: Dependabot merges are **not** Month 2 product scope but are part of the same post-merge git range; keep them for a literal “main moved” audit._

## 4. Regenerate the file list (union A ∪ B)

```bash
cd /path/to/Astra
{ git diff --name-only 08cbce7..813b14e; git diff --name-only 6d79e2d..HEAD; } | sort -u > month2-all-files.txt
wc -l month2-all-files.txt
```

Current union count: **160** paths (see §5).

## 5. Deduplicated path list (A ∪ B)

<!-- FILE_LIST_BEGIN: do not hand-edit; regenerate with §4 -->

```
AGENTS.md
.github/dependabot.yml
.github/workflows/bench-live.yml
.github/workflows/bench-opt.yml
.github/workflows/ci.yml
.github/workflows/firefox-release.yml
.gitignore
bench-live/driver.ts
bench-live/index.test.ts
bench-live/index.ts
bench-live/scenarios/article-extraction-docs.test.ts
bench-live/scenarios/article-extraction-docs.ts
bench-live/scenarios/dynamic-content-append.ts
bench-live/scenarios/helpers/hover-runtime.js
bench-live/scenarios/helpers/hover.ts
bench-live/scenarios/helpers/selection-explain-runtime.js
bench-live/scenarios/helpers/selection-explain.ts
bench-live/scenarios/holdout/interaction-stress.ts
bench-live/scenarios/holdout/page-translation-feed-card-churn.ts
bench-live/scenarios/holdout/translation-race.ts
bench-live/scenarios/hover-translation-basic.test.ts
bench-live/scenarios/hover-translation-basic.ts
bench-live/scenarios/index.ts
bench-live/scenarios/onboarding-smoke.ts
bench-live/scenarios/popup-deep-read-proof.ts
bench-live/scenarios/popup-deep-read-smoke.ts
bench-live/scenarios/selection-explain-basic.test.ts
bench-live/scenarios/selection-explain-basic.ts
bench-live/scenarios/site-automation-autostart.ts
bench-live/scenarios/vocabulary-srs-smoke.ts
bench-live/sleep.ts
bench/evaluators/article-extraction.ts
bench/evaluators/evaluators.test.ts
bench/scenarios/article-extraction.ts
bench/scenarios/helpers/article-extraction-fixtures.ts
bench/scenarios/helpers/article-extraction.ts
bench/scenarios/input-translation.ts
bench/scenarios/provider-routing.ts
bench/scenarios/selection-explain.ts
bench/splits.test.ts
docs/investigations/learning-loop-claim-impact-2026-04-14.md
docs/investigations/learning-loop-known-issues-2026-04-14.md
docs/investigations/learning-loop-navigation-matrix-2026-04-14.md
docs/investigations/learning-loop-overview-2026-04-13.md
docs/investigations/learning-loop-regression-checklist-2026-04-13.md
docs/investigations/learning-loop-ux-debt-2026-04-14.md
docs/investigations/learning-metrics-2026-04-13.md
docs/investigations/month-1-closeout-2026-04-13.md
docs/investigations/month-2-closeout-2026-04-14.md
docs/investigations/popup-deep-read-state-mapping.md
docs/investigations/sentence-pin-presearch-2026-04-14.md
docs/investigations/workstream-a-live-coverage-matrix.md
docs/investigations/workstream-f-live-flaky-inventory.md
docs/investigations/workstream-f-live-lane-conventions.md
docs/release-readiness-checklist.md
ios/AstraShell Extension/Resources/assets/pdf.worker.min-C8PGFc0r.mjs
ios/AstraShell Extension/Resources/assets/pdf.worker.min-DiYokoyG.mjs
ios/AstraShell Extension/Resources/background.js
ios/AstraShell Extension/Resources/chunks/ErrorBoundary-8QwVfFOf.js
ios/AstraShell Extension/Resources/chunks/_virtual_wxt-plugins-C38iXF5j.js
ios/AstraShell Extension/Resources/chunks/_virtual_wxt-plugins-U3jSQmDC.js
ios/AstraShell Extension/Resources/chunks/auth-Bk7_vvht.js
ios/AstraShell Extension/Resources/chunks/auth-wDtJi80f.js
ios/AstraShell Extension/Resources/chunks/config-DNFohAFD.js
ios/AstraShell Extension/Resources/chunks/config-dE44O_kr.js
ios/AstraShell Extension/Resources/chunks/epub-reader-ByQPZ9aJ.js
ios/AstraShell Extension/Resources/chunks/epub-reader-zy1AdeDt.js
ios/AstraShell Extension/Resources/chunks/i18n-BdJRuA3x.js
ios/AstraShell Extension/Resources/chunks/onboarding-DP4Yj3S-.js
ios/AstraShell Extension/Resources/chunks/onboarding-DhsDTQLe.js
ios/AstraShell Extension/Resources/chunks/options-BdE1TtN-.js
ios/AstraShell Extension/Resources/chunks/options-CUUsx-gM.js
ios/AstraShell Extension/Resources/chunks/pdf-reader-DuHtuguT.js
ios/AstraShell Extension/Resources/chunks/pdf-reader-vPCH6lV1.js
ios/AstraShell Extension/Resources/chunks/popup-DkX-ZzxL.js
ios/AstraShell Extension/Resources/chunks/popup-HEzGyP5g.js
ios/AstraShell Extension/Resources/chunks/schemas-DfQZzlfk.js
ios/AstraShell Extension/Resources/chunks/subtitle-reader-BE49Jyfz.js
ios/AstraShell Extension/Resources/chunks/subtitle-reader-DtJe8P7V.js
ios/AstraShell Extension/Resources/chunks/translation-cache-CsIzBdnu.js
ios/AstraShell Extension/Resources/chunks/translation-usage-CyNhuuOW.js
ios/AstraShell Extension/Resources/chunks/vocabulary-B2rKcghO.js
ios/AstraShell Extension/Resources/chunks/vocabulary-BeLqv1PW.js
ios/AstraShell Extension/Resources/chunks/vocabulary-DYFzLIVn.js
ios/AstraShell Extension/Resources/chunks/vocabulary-Jd_PFwhT.js
ios/AstraShell Extension/Resources/content-scripts/content.js
ios/AstraShell Extension/Resources/epub-reader.html
ios/AstraShell Extension/Resources/manifest.json
ios/AstraShell Extension/Resources/onboarding.html
ios/AstraShell Extension/Resources/options.html
ios/AstraShell Extension/Resources/pdf-reader.html
ios/AstraShell Extension/Resources/popup.html
ios/AstraShell Extension/Resources/subtitle-reader.html
ios/AstraShell Extension/Resources/vocabulary.html
ios/AstraShell Extension/Resources/_locales/en/messages.json
ios/AstraShell Extension/Resources/_locales/zh_CN/messages.json
package.json
plan.md
platform/cloudflare/src/handlers/auth-anonymous.test.ts
platform/cloudflare/src/handlers/auth-anonymous.ts
platform/cloudflare/src/index.ts
platform/cloudflare/src/repositories/shadow-state.test.ts
platform/cloudflare/src/routes.ts
platform/cloudflare/src/types/shadow-state.ts
pnpm-lock.yaml
public/_locales/en/messages.json
public/_locales/zh_CN/messages.json
scripts/verify-content-script-bundles.ts
scripts/verify-firefox-lint.ts
scripts/verify-zod-entrypoints.ts
src/entrypoints/background/index.test.ts
src/entrypoints/background/index.ts
src/entrypoints/content/index.test.ts
src/entrypoints/content/index.tsx
src/entrypoints/content/page-translate.ts
src/entrypoints/content/spa-navigation.ts
src/entrypoints/content/translation-context.test.ts
src/entrypoints/content/translation-context.ts
src/entrypoints/content/video-platforms/bilibili.ts
src/entrypoints/content/video-platforms/youtube.ts
src/entrypoints/epub-reader/main.tsx
src/entrypoints/onboarding/main.tsx
src/entrypoints/options/main.tsx
src/entrypoints/pdf-reader/main.tsx
src/entrypoints/popup/App.test.tsx
src/entrypoints/popup/App.tsx
src/entrypoints/popup/components/StudySection.tsx
src/entrypoints/popup/main.tsx
src/entrypoints/subtitle-reader/main.tsx
src/entrypoints/vocabulary/ReviewMode.test.tsx
src/entrypoints/vocabulary/ReviewMode.tsx
src/entrypoints/vocabulary/VocabularyApp.test.tsx
src/entrypoints/vocabulary/VocabularyApp.tsx
src/entrypoints/vocabulary/main.tsx
src/types/messages.ts
src/utils/cache/translation-cache-context.ts
src/utils/cache/translation-cache.test.ts
src/utils/cache/translation-cache.ts
src/utils/extension/messages.test.ts
src/utils/reading/assist.ts
src/utils/storage/config-sync.ts
src/utils/storage/page-digests.test.ts
src/utils/storage/page-digests.ts
src/utils/storage/reading-history-core.ts
src/utils/storage/reading-history.ts
src/utils/storage/study-progress.test.ts
src/utils/storage/study-progress.ts
src/utils/storage/vocabulary-core.ts
src/utils/storage/vocabulary.test.ts
src/utils/storage/vocabulary.ts
src/utils/translate/translate.test.ts
src/utils/translate/translate.ts
src/utils/zod-config.ts
test/fixtures/pages/selection-explain-basic.html
vitest.config.ts
web/src/app.tsx
web/src/lib/astra-web.test.ts
web/src/main.tsx
web/src/styles.css
wxt.config.ts
```

<!-- FILE_LIST_END -->

## 6. Pointers for humans / CI

- **Month 2 closeout**: `docs/investigations/month-2-closeout-2026-04-14.md`
- **Plan ledger + scores**: root `plan.md` (§11 Month 2, §13H2)
- **Learning-loop overview**: `docs/investigations/learning-loop-overview-2026-04-13.md`

## 7. Optional: attach CI artifacts

If you use GitHub Actions, attach the **`live-bench-results`** artifact from the `live-browser` job to the same release folder as this markdown export.
