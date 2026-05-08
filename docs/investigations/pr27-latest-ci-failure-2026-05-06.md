# Investigation: PR27 latest CI failure after popup fixes

## Summary
PR27 no longer fails in `quality` or `live-browser`; the latest CI run on `df2d57b` fails only in `build-extension (safari)` because the committed iOS Safari extension resources are stale relative to a fresh `.output/safari-mv3` build. The fix is to run `pnpm build:safari`, `pnpm ios:sync-extension`, verify with `ios/scripts/verify-safari-build-sync.sh`, and commit only `ios/AstraShell Extension/Resources/` changes.

## Symptoms
- User reports PR27 still has not passed after the previous fixes were committed and pushed.
- Previous remote failure before the fix was `live-browser` / `bench-live/popup-deep-read-proof` on SHA `b0a3c8d`.
- Local validation before push passed `pnpm type-check`, `pnpm build`, and `pnpm bench:live:lane:learning-loop`.
- Current local working tree also contains unrelated cleanup changes that have not been committed.

## Background / Prior Research

### Latest PR / CI status (explore agents)
- PR27 branch head is now `df2d57b01f33cd4d3d2e6fa04ae1b5386d540c19`, matching the pushed commit `Stabilize popup deep-read proof and popup sizing`.
- Latest CI run: `25446482076`, workflow `CI`, PR URL https://github.com/raydocs/Astra/pull/27.
- Run `25446482076` results:
  - `quality`: success.
  - `live-browser`: success.
  - `build-extension (chrome)`: success.
  - `build-extension (firefox)`: success.
  - `build-extension (safari)`: failure.
- Failing job: `build-extension (safari)`, job ID `74653325694`, URL https://github.com/raydocs/Astra/actions/runs/25446482076/job/74653325694.
- Failing step: `Verify Safari bundle sync`.
- Exact error:
  ```text
  [astra-ios] Safari build output is out of sync with committed extension resources
  [astra-ios] Run 'pnpm ios:sync-extension' after 'pnpm build:safari' and commit the updated resources.
  ```
- This is a new failure category, not the prior `popup-deep-read-proof` failure. The prior `live-browser` lane now passes remotely.
- Root-cause clue: source/bundle hashes changed after JS/CSS changes, but `ios/AstraShell Extension/Resources/` was not regenerated and committed after `pnpm build:safari`.

## Investigator Findings
<!-- Pair investigator will append structured analysis here. -->

### 2026-05-06 Pair Investigator - Safari bundle sync failure

#### Contract verified
- CI `build-extension` is a three-browser matrix (`chrome`, `firefox`, `safari`) and the Safari leg runs `pnpm build:safari` before the failing verification step (`.github/workflows/ci.yml:112-152`).
- `pnpm build:safari` expands to `wxt build -b safari`, then canonicalizes generated Safari JS, then runs the content-script bundle guardrail against `.output/safari-mv3/content-scripts` (`package.json:19-22`).
- The CI-only Safari sync check is intentionally separate from the build: `ios/scripts/verify-safari-build-sync.sh` compares the generated source directory `${REPO_ROOT}/.output/safari-mv3` against committed `${IOS_DIR}/AstraShell Extension/Resources` with `diff -qr`, excluding only `.DS_Store` and `.gitkeep` (`ios/scripts/verify-safari-build-sync.sh:8-10`, `ios/scripts/verify-safari-build-sync.sh:55-66`).
- The repair script is `pnpm ios:sync-extension`, which runs `ios/scripts/sync-safari-build.sh`; that script deletes every top-level entry in the iOS Resources destination except `.gitkeep`, then copies the current `.output/safari-mv3` contents into it (`package.json:21-23`, `ios/scripts/sync-safari-build.sh:8-10`, `ios/scripts/sync-safari-build.sh:50-52`).

#### Local reproduction
- Ran: `pnpm build:safari && bash ios/scripts/verify-safari-build-sync.sh`
- Result: `pnpm build:safari` succeeded, including `Content script bundle guardrail passed for 1 bundle(s).`, then `verify-safari-build-sync.sh` failed with the same contract error as CI:
  - `[astra-ios] Safari build output is out of sync with committed extension resources`
  - `[astra-ios] Run 'pnpm ios:sync-extension' after 'pnpm build:safari' and commit the updated resources.`
- The diff output shows stale hashed bundle filenames and HTML references in committed iOS Resources, e.g. `.output/safari-mv3/chunks/popup-BGZq-nVM.js` exists while `ios/AstraShell Extension/Resources/chunks/popup-CRI0FraV.js` is still committed; similarly, generated `deep-read`, `document-intake`, `epub-reader`, `image-translate`, `onboarding`, `options`, `pdf-reader`, `subtitle-reader`, `vocabulary`, `ErrorBoundary`, and the corresponding HTML files differ.
- Ran a safe temp-destination contract check without touching committed iOS Resources:
  - `tmpdir=$(mktemp -d); bash ios/scripts/sync-safari-build.sh --dest "$tmpdir/Resources" && bash ios/scripts/verify-safari-build-sync.sh --dest "$tmpdir/Resources"; rc=$?; rm -rf "$tmpdir"; exit $rc`
  - Result: sync copied `.output/safari-mv3` to the temp Resources directory, and verify then printed `Safari build output matches committed extension resources`.
- After the build/verify reproduction, tracked working tree status remained limited to the pre-existing unrelated local changes plus this investigation doc; no source files were changed by the reproduction command.

#### Root cause
- The PR branch head `df2d57b01f33cd4d3d2e6fa04ae1b5386d540c19` updated extension JS/CSS/HTML build inputs enough to change Safari output hashes, but the generated iOS Safari extension resource snapshot under `ios/AstraShell Extension/Resources/` was not regenerated and committed. CI correctly fails because the committed Safari bundle is stale relative to `pnpm build:safari` output.
- This is unrelated to the earlier `live-browser` / `bench-live/popup-deep-read-proof` failure; the latest CI facts already show `live-browser` passed and only `build-extension (safari)` failed at `Verify Safari bundle sync`.

#### Exact repair
Run these from repo root on a clean checkout of the PR branch:

```bash
pnpm build:safari
pnpm ios:sync-extension
bash ios/scripts/verify-safari-build-sync.sh
git status --short -- 'ios/AstraShell Extension/Resources'
```

Then commit only the regenerated files under `ios/AstraShell Extension/Resources/` that changed because of the sync. A compact one-liner equivalent is:

```bash
pnpm ios:prepare && bash ios/scripts/verify-safari-build-sync.sh
```

#### Local unrelated cleanup changes to avoid committing
- `.gitignore` has an unrelated local addition: `bench-live-results-test/` (`.gitignore:17`; also visible in `git diff -- .gitignore`). Do not include it in the Safari sync repair unless intentionally desired in a separate cleanup commit.
- `bench-live-debug.ts` is deleted in the current local working tree (`git diff -- bench-live-debug.ts` shows the entire 30-line debug helper removed). Do not include that deletion in the Safari sync repair.
- The investigation file `docs/investigations/pr27-latest-ci-failure-2026-05-06.md` is currently untracked locally; if this report should be preserved, add it deliberately, but it is not part of the CI repair itself.

#### Suggested verification before push
```bash
pnpm build:safari
bash ios/scripts/verify-safari-build-sync.sh
git diff --stat -- 'ios/AstraShell Extension/Resources'
git status --short
```

Expected: the verify script passes after `pnpm ios:sync-extension`; `git status --short` should not include `.gitignore` or `bench-live-debug.ts` in the Safari sync commit.

## Investigation Log

### Phase 1 - Initial assessment
**Hypothesis:** The new PR27 failure may be a different CI job/step than the previously fixed `popup-deep-read-proof`, or it may be an environment-specific failure not reproduced by the local macOS learning-loop lane.
**Findings:** Pending latest CI log verification.
**Evidence:** User report plus prior local validation notes.
**Conclusion:** Needs latest GitHub Actions run/log/artifact verification before code changes.

## Root Cause
Commit `df2d57b` changed extension build inputs enough to change generated Safari bundle filenames/bytes/HTML references, but the committed snapshot under `ios/AstraShell Extension/Resources/` was not regenerated and committed. CI's Safari matrix leg runs `pnpm build:safari` and then `ios/scripts/verify-safari-build-sync.sh`, which compares `.output/safari-mv3` against `ios/AstraShell Extension/Resources/` with `diff -qr`. The generated and committed directories differ, so CI correctly fails.

This is a new Safari resource-sync failure. It is not a recurrence of the previous `live-browser` / `popup-deep-read-proof` failure; that job now passes remotely.

## Recommendations
1. Run `pnpm build:safari`.
2. Run `pnpm ios:sync-extension`.
3. Run `bash ios/scripts/verify-safari-build-sync.sh` and require the success message `Safari build output matches committed extension resources`.
4. Stage and commit only `ios/AstraShell Extension/Resources/` for this repair, e.g. `git add -- 'ios/AstraShell Extension/Resources'`.
5. Do not mix unrelated local cleanup changes (`.gitignore`, deleted `bench-live-debug.ts`) into the Safari sync repair commit unless intentionally creating a separate cleanup commit.

## Preventive Measures
- After any PR source/CSS change that affects extension bundles, run `pnpm ios:prepare` or `pnpm build:safari && pnpm ios:sync-extension` before pushing.
- Keep `ios/scripts/verify-safari-build-sync.sh` in local pre-push/checklist for Safari-affecting PRs.
- Treat committed `ios/AstraShell Extension/Resources/` as a generated snapshot that must be updated with bundle hash changes.
