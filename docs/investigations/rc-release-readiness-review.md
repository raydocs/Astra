# RC Release-Readiness Review

## Summary verdict
**CONDITIONAL-GO**

The new bench-opt safety, telemetry, logging, and mutation subsystems are structurally present and mostly wired. However, there are several semantic gaps where the code gives the _appearance_ of safety enforcement without actually enforcing it at the decision boundary. These would let a bad candidate get promoted even when guardrails say "block." Automated tests would pass because the plumbing exists -- the issue is in the decision logic, not the infrastructure.

## Findings

### Critical (would block release)

1. **Guardrail "block" verdict does NOT actually block promotion.**
   The `checkGuardrails()` result is computed at `runner.ts:2076` and stored in `guardrailResult`. If the verdict is `"block"`, the runner only emits a `logger.warn()` (line 2086). The `decideBenchOptPromotion()` call at line 2164 never receives the guardrail verdict. The promotion decision at `promote.ts:345-346` computes `gateQualified` from splits, checks, live evaluator, and canary readiness -- but never from the guardrail verdict. The `deriveOverallState()` function in `status.ts:48` does check `guardrailVerdict === "block"`, but this only affects the _status artifact_ display, not the actual promotion decision. If `allowPromotion=true`, `verification=passed`, `keepReject!=reject`, and all splits are present, a candidate with a guardrail "block" can still be promoted.

2. **`--live-all` failure does NOT block promotion or CI.**
   In the GitHub Actions workflow (`bench-opt.yml:95`), the live smoke step has `continue-on-error: true`. Individual scenario failures are caught with `|| echo "::warning::"` (line 90-93). This means the CI job will always report green for this step regardless of live scenario outcomes. In the runner itself (lines 1947-1992), when `--live-all` is used, individual scenario exceptions are caught silently (line 1960-1962) and the aggregate `live.pass` field is computed, but a `live.pass === false` result is only fed to promotion as `liveEvaluatorPassed`. The promotion function does check this, but only if `liveEvaluatorPassed` is required -- and the default logic at `promote.ts:342` sets `liveEvaluatorPassed` from the input, which is `false` by default. The concern: CI will report success even when all live scenarios fail.

### Important (should fix before GA but not RC-blocking)

3. **Telemetry collector is created but never actually used.**
   `createTelemetryCollector()` is called at `runner.ts:1670`, and `telemetry.flush()` is called at line 2521. However, none of the collector's `record*` methods (`recordIterationStart`, `recordIterationEnd`, `recordTokenUsage`, `recordScoreTrend`, `recordCandidateDecision`, `recordEvaluationStart/End`) are ever invoked in runner.ts. The flushed telemetry snapshot will contain zero events, zero iterations, and zero cost data. Additionally, `estimatedCostUsd` is hardcoded to `null` at lines 2403 and 2559 in the status artifact construction, never using the collector's computed cost. The telemetry module is dead code in practice.

4. **Mutation modules (`mutate-tools.ts`, `mutate-graph.ts`, `mutate-prompts.ts`, `mutate-context.ts`) are orphan code from runner.ts perspective.**
   These four modules are imported only by `bench-opt/candidates/tool-config.ts` and `bench-opt/candidates/agent-graph.ts`. However, those candidate files are never imported by `runner.ts` or `registry.ts`. The registry at `registry.ts:5-8` only includes `promptCandidates` and `contextCandidates`. The `OptimizerCandidateKind` type union was expanded to `"prompt" | "context" | "tool-config" | "agent-graph"` in `types.ts:18`, but the runtime code paths only ever process `"prompt"` and `"context"` candidates. The expansion is a type-level change with no runtime effect.

5. **`bench-opt-results/` and `bench-live-results/` are NOT in `.gitignore`.**
   These directories contain local absolute paths (e.g., `/Users/ruirui/Downloads/GitHub/Astra/...`) baked into JSON artifacts. They appear as untracked files in the git status. If accidentally committed, they would (a) leak local filesystem layout and (b) break any tooling that expects relative paths.

6. **`latest.status.json` contains hardcoded local paths.**
   The status artifact at `bench-opt-results/latest.status.json` has `sourceArtifacts.baselineReport` set to `/Users/ruirui/Downloads/GitHub/Astra/bench-results/latest.json` and similar absolute paths throughout `paths`, `store`, and `publishPlan.artifacts`. These will not resolve on any other machine or CI.

### Advisory (nice to fix, not blocking)

7. **`checkGuardrails` is called with `surfaces: []` for the candidate input.**
   At `runner.ts:2077`, the candidate input passed to `checkGuardrails` has an empty `surfaces` array, which means surface-level regression detection (`detectSurfaceRegressions`) will always produce zero violations for the candidate side, even if per-surface regressions exist. This makes the guardrail check weaker than designed.

8. **Live browser path resolution on CI will fall through to `null`.**
   `driver.ts:8-12` defines `DEFAULT_BROWSER_CANDIDATES` as macOS-only paths (`/Applications/Google Chrome.app/...`). On ubuntu-latest CI, the workflow installs Playwright Chromium (line 85), but the `resolveLiveBrowserExecutablePath()` function checks the macOS paths first. If the `ASTRA_BENCH_LIVE_BROWSER_PATH` env var or Playwright's own executable path is not set, `withLiveBrowserPage` will throw `LiveBrowserUnavailableError`. The scenarios handle this gracefully (`continue-on-error`), but it means the live smoke lane is effectively a no-op on CI.

9. **Logger is created but barely used.**
   `createLogger()` is called at `runner.ts:1671` and used for a handful of `logger.info`/`logger.warn` calls. The logger's advanced features (iteration context via `setIteration`, candidate context via `setCandidateId`, child loggers) are never used. The file sink writes logs to `bench-opt-results/logs/` but since so few log calls exist, the output is minimal and not very useful for debugging.

10. **`scoreTrends` in the status telemetry is always empty.**
    At lines 2404 and 2560, `scoreTrends` is hardcoded to `[]`. The `extractScoreTrends` helper from `guardrails.ts:340-355` exists and could produce this data, but it is never called in the status artifact construction path.

11. **No `mutate-prompts.ts` or `mutate-context.ts` consumers at all.**
    Unlike `mutate-tools.ts` and `mutate-graph.ts` (which have consumers in `candidates/tool-config.ts` and `candidates/agent-graph.ts`), `mutate-prompts.ts` and `mutate-context.ts` export functions that are not imported from anywhere in the codebase. They are fully orphan modules with no test coverage beyond the code they define.

## Evidence

- `bench-opt/runner.ts:55-58` -- imports for `checkGuardrails`, `detectRedFlags`, `createTelemetryCollector`, `createLogger` are present
- `bench-opt/runner.ts:1670-1671` -- `createTelemetryCollector` and `createLogger` are called (created)
- `bench-opt/runner.ts:2076-2091` -- `checkGuardrails` and `detectRedFlags` are called; guardrail "block" only triggers `logger.warn`, never feeds into promotion
- `bench-opt/runner.ts:2159-2192` -- `decideBenchOptPromotion()` invocation; no reference to `guardrailResult`
- `bench-opt/runner.ts:2521` -- only call to `telemetry.flush()`; no `telemetry.record*()` calls anywhere in runner.ts
- `bench-opt/runner.ts:2403,2559` -- `estimatedCostUsd: null` hardcoded in status artifact
- `bench-opt/runner.ts:2404,2560` -- `scoreTrends: []` hardcoded in status artifact
- `bench-opt/promote.ts:345-346` -- `gateQualified` logic does not consider guardrails
- `bench-opt/status.ts:48-50` -- `deriveOverallState` checks `guardrailVerdict`, but this is display-only
- `bench-opt/registry.ts:5-8` -- only `promptCandidates` and `contextCandidates` are included; no tool-config or agent-graph candidates
- `bench-opt/types.ts:18` -- `OptimizerCandidateKind` includes `"tool-config" | "agent-graph"` but these are unused at runtime
- `bench-opt/candidates/tool-config.ts` -- imports `mutate-tools.ts` but is never imported by runner or registry
- `bench-opt/candidates/agent-graph.ts` -- imports `mutate-graph.ts` but is never imported by runner or registry
- `bench-opt/mutate-prompts.ts` -- no imports from anywhere in the codebase
- `bench-opt/mutate-context.ts` -- no imports from anywhere in the codebase
- `bench-live/driver.ts:8-12` -- hardcoded macOS-only browser paths
- `bench-live/driver.ts:84` -- `ASTRA_BENCH_LIVE_BROWSER_PATH` env var fallback
- `.github/workflows/bench-opt.yml:95` -- `continue-on-error: true` on live smoke step
- `.github/workflows/bench-opt.yml:90-93` -- individual scenario failures swallowed with `|| echo "::warning::"`
- `.gitignore` -- no entry for `bench-opt-results/` or `bench-live-results/`
- `bench-opt-results/latest.status.json` -- contains `/Users/ruirui/` absolute paths throughout
- `bench-opt-results/latest.status.json:338` -- `estimatedCostUsd: null` confirming telemetry is non-functional

## Recommendation

The RC can ship **if and only if** the following are addressed:

1. **Wire guardrail verdict into promotion gate.** At minimum, add `guardrailResult?.verdict === "block"` as a condition that sets `gateQualified = false` in the promotion call at `runner.ts:2169`. Without this, the safety infrastructure is cosmetic -- it detects problems and logs them but never prevents action.

2. **Make live smoke failures visible in CI.** Either remove `continue-on-error: true` from the workflow (so failures block the job), or create a separate gate step that reads the live results and fails the workflow if critical scenarios do not pass. The current setup creates false confidence.

3. **Add `bench-opt-results/` and `bench-live-results/` to `.gitignore`** before any contributor accidentally commits local-path-laden artifacts.

Items 3-11 from the findings are not RC-blocking but should be tracked for GA: the telemetry collector should either be wired into the runner's lifecycle or removed, and the orphan mutation modules should either be integrated or clearly marked as planned-but-unconnected.
