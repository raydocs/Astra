# RC Rollback Drill

**RC Version:** `rc-2026-03-27`
**Purpose:** Document the rollback procedure, how to exercise it, and what to verify.

---

## 1. What "Rollback" Means in Current State

In the current system, rollback is an **execution model** -- it produces structured plans and artifacts that describe what steps would be taken to undo a promotion, but it does **not** automatically execute real VCS operations (git revert, branch deletion, PR closing) in production.

The rollback system consists of:

- **`bench-opt/rollback.ts`** -- The core module at `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/rollback.ts`
- **`buildBenchOptRollbackPlan()`** -- A pure, synchronous function that builds a structured rollback plan
- **`validateRollbackSafety()`** -- Pre-execution safety checks
- **`loadPreviousChampionForRollback()`** -- Loads the previous champion record for restoration
- **`executeBenchOptRollback()`** -- An async function that carries out the rollback workflow (defaults to dry-run mode)

### Rollback status states

| Status | Meaning |
|--------|---------|
| `idle` | No trigger or failure has been supplied. The plan exists but is dormant. |
| `planned` | A trigger exists and the plan describes what would happen, but execution is not armed. |
| `armed` | Execution is enabled via `--rollback-allow` and the trigger is not `unknown`. Ready to execute. |

### Rollback trigger types

| Trigger | When it applies |
|---------|----------------|
| `post-promotion-check-failed` | A check failed after promotion was applied |
| `canary-regression` | The canary deployment showed regression |
| `manual` | An operator explicitly requested rollback |
| `promotion-revoked` | A promotion decision was revoked |
| `unknown` | Default -- no trigger specified (results in `idle` status) |

---

## 2. How to Trigger a Rollback Drill

### Basic rollback plan (idle/dry-run)

This is what happens during normal `--promotion-plan` runs:

```bash
pnpm bench:opt -- --promotion-plan
```

This produces `bench-opt-results/latest.rollback.json` with `status: "idle"` and `dryRun: true`. The plan has 6 steps, all in `skipped` status because no trigger was supplied.

### Armed rollback drill

To produce a rollback plan that is in `armed` state with planned steps:

```bash
pnpm bench:opt -- --rollback-allow --promotion-plan
```

The `--rollback-allow` flag tells the system that rollback execution is permitted. Combined with a non-`unknown` trigger (which the runner supplies when rollback-allow is set), this produces a plan with `status: "armed"` and steps in `planned` status.

### Manual rollback with explicit trigger

For a more realistic drill, you can invoke the rollback module directly. The relevant functions are exported from `bench-opt/rollback.ts`:

```typescript
import { buildBenchOptRollbackPlan, executeBenchOptRollback } from "./bench-opt/rollback.ts"

const plan = buildBenchOptRollbackPlan({
  runId: "drill-2026-03-27",
  candidateId: "test-candidate-001",
  trigger: "manual",
  reason: "RC rollback drill — testing execution model",
  failedChecks: ["post-promotion-bench-regression"],
  branchName: "bench-opt/promote/drill-2026-03-27",
  pullRequestUrl: null,
  canaryEnvironment: null,
}, {
  allowRollback: true,
})

// Execute in dry-run mode (no real git operations)
const result = await executeBenchOptRollback(plan, {
  dryRun: true,
  outputDir: "bench-opt-results",
})

console.log(result.notes)
console.log(result.artifactPath)
```

---

## 3. Artifacts Produced

When a rollback drill runs, the following artifacts are produced:

### 3.1 Rollback plan JSON (`latest.rollback.json`)

Location: `bench-opt-results/latest.rollback.json`

Key fields:
```json
{
  "schemaVersion": 1,
  "runId": "...",
  "candidateId": "...",
  "trigger": "manual",
  "status": "armed",
  "dryRun": true,
  "executionEnabled": true,
  "reason": "...",
  "failedChecks": ["..."],
  "targets": {
    "branchName": "bench-opt/promote/...",
    "pullRequestUrl": null,
    "canaryEnvironment": null
  },
  "artifacts": {
    "rollbackRecordPath": "rollbacks/<runId>-<candidateId>.json",
    "revertMessagePath": "reverts/<branchName>.txt",
    "recoverySummaryPath": "recovery/<runId>-<candidateId>.md"
  },
  "steps": [
    { "id": "revert-commit", "kind": "revert-commit", "status": "planned", "reason": "..." },
    { "id": "close-pr", "kind": "close-pr", "status": "skipped", "reason": "..." },
    { "id": "disable-canary", "kind": "disable-canary", "status": "skipped", "reason": "..." },
    { "id": "restore-branch", "kind": "restore-branch", "status": "planned", "reason": "..." },
    { "id": "restore-champion", "kind": "restore-champion", "status": "planned", "reason": "..." },
    { "id": "record-rollback", "kind": "record-rollback", "status": "planned", "reason": "..." }
  ],
  "reasons": ["..."]
}
```

### 3.2 Rollback execution artifact (when `executeBenchOptRollback` is called)

Location: `bench-opt-results/rollbacks/rollback-<runId>-<candidateId>-<timestamp>.json`

Key fields:
```json
{
  "schemaVersion": 1,
  "timestamp": "...",
  "runId": "...",
  "candidateId": "...",
  "trigger": "manual",
  "mode": "dry-run",
  "plan": { "..." },
  "safetyChecks": {
    "valid": true,
    "checks": [
      { "name": "not-idle", "passed": true, "message": "..." },
      { "name": "recognized-trigger", "passed": true, "message": "..." },
      { "name": "rollback-target-exists", "passed": true, "message": "..." }
    ]
  },
  "previousChampion": {
    "found": false,
    "championTrialId": null,
    "candidateId": null,
    "resolvedConfigPath": null,
    "error": null
  },
  "execution": {
    "commitReverted": false,
    "revertSha": null,
    "revertError": null,
    "prClosed": false,
    "prCloseError": null,
    "canaryDisabled": false,
    "canaryDisableError": null,
    "branchRestored": false,
    "branchRestoreError": null,
    "championRestored": false,
    "championRestoreError": null,
    "rollbackRecorded": true
  }
}
```

### 3.3 Promotion and publish artifacts (context)

The rollback plan references the companion artifacts:
- `bench-opt-results/latest.promotion.json` -- The promotion decision that would be rolled back
- `bench-opt-results/latest.publish.json` -- The publish plan that would be undone

---

## 4. What an Operator Should Check After Rollback

### Immediate checks

1. **Rollback artifact exists and is well-formed:**
   ```bash
   ls bench-opt-results/rollbacks/
   cat bench-opt-results/latest.rollback.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('status:', d['status']); print('trigger:', d['trigger']); print('steps:', len(d['steps']))"
   ```
   Expected: `status: armed` (or `planned`), `trigger: manual` (or the actual trigger), `steps: 6`.

2. **Safety checks passed:**
   ```bash
   cat bench-opt-results/rollbacks/*.json | python3 -c "
   import sys,json
   d=json.load(sys.stdin)
   sc = d.get('safetyChecks',{})
   print('Safety valid:', sc.get('valid'))
   for c in sc.get('checks',[]):
       print(f'  {c[\"name\"]}: {\"PASS\" if c[\"passed\"] else \"FAIL\"} -- {c[\"message\"]}')
   "
   ```
   Expected: all checks PASS. If any fail, the rollback should not proceed.

3. **Execution mode is correct:**
   - In dry-run: all `execution.*` fields should be `false` or `null` (except `rollbackRecorded: true`).
   - In real mode: `commitReverted`, `branchRestored`, etc. should reflect actual operations.

4. **Previous champion state:**
   - If a champion was previously promoted, `previousChampion.found` should be `true`.
   - If no champion exists, `found: false` is acceptable for a first-run drill.

5. **Rollback reasons are human-readable:**
   ```bash
   cat bench-opt-results/latest.rollback.json | python3 -c "
   import sys,json
   d=json.load(sys.stdin)
   for r in d.get('reasons',[]):
       print(f'  - {r}')
   "
   ```
   Expected: each reason is a complete, readable sentence.

### Post-rollback system state

6. **Status artifact reflects rollback:**
   ```bash
   pnpm bench:opt:status
   ```
   The `overallState` should reflect the post-rollback state.

7. **No orphaned branches** (if real execution was used):
   ```bash
   git branch -a | grep bench-opt/promote
   ```
   Expected: the promotion branch should be deleted after rollback.

---

## 5. Known Limitations

### 5.1 Rollback is planning-oriented, not auto-executing

The current rollback system defaults to `dryRun: true`. Even when `executionEnabled` is `true` (via `--rollback-allow`), the execution path has integration points that are not yet wired:

| Step | Status |
|------|--------|
| `revert-commit` | Implemented: runs `git revert --no-edit HEAD` on the promotion branch |
| `close-pr` | **Integration point:** records intent but does not call `gh pr close`. Comment in code: "the owner should wire gh pr close here." |
| `disable-canary` | **Integration point:** records intent but does not call deployment tooling. Comment: "the owner should wire canary disable logic here." |
| `restore-branch` | Implemented: checks out main and deletes the promotion branch |
| `restore-champion` | Implemented: copies previous champion config back to `store/champions/current.json` |
| `record-rollback` | Implemented: writes the rollback artifact to disk |

### 5.2 Safety checks are structural, not environmental

`validateRollbackSafety()` checks plan structure (not-idle, recognized trigger, target exists) but does not verify:
- Whether the branch actually exists on the remote
- Whether the PR is still open
- Whether the canary environment is still running
- Whether the previous champion config is still valid

The `rollbackTargetBranchExists` option exists but must be supplied by the caller.

### 5.3 No automatic rollback triggers

The system does not watch for failures and automatically trigger rollback. All rollback triggers are explicit (via CLI flags or programmatic invocation).

---

## 6. What Would Need to Change for Real Operational Rollback

To move from execution model to real operational rollback, the following changes would be needed:

### 6.1 Wire PR close via gh CLI

In `bench-opt/rollback.ts`, the `executeBenchOptRollback` function has a placeholder at line 571-579:

```typescript
// Integration point: the owner should wire `gh pr close <url>` here.
execution.prClosed = false
execution.prCloseError = "Integration point: gh pr close not wired yet."
```

Replace with:
```typescript
const { stdout, error } = await execGit(repositoryRoot, ["gh", "pr", "close", plan.targets.pullRequestUrl])
```
Or use a dedicated `gh` CLI wrapper.

### 6.2 Wire canary disable

The canary disable step at line 581-589 needs to call the actual deployment tooling (e.g., Cloudflare Workers, Chrome Web Store API, or whatever the production canary environment uses).

### 6.3 Add environmental safety checks

Extend `validateRollbackSafety()` to check:
- Remote branch existence: `git ls-remote --heads origin <branch>`
- PR status: `gh pr view <url> --json state`
- Champion config validity: parse and validate the config JSON

### 6.4 Add automatic rollback triggers

Wire the following events to automatically create rollback plans:
- Post-promotion bench regression (run bench after promotion, compare to pre-promotion)
- Canary health check failure (if canary deployment is wired)
- Manual operator signal (e.g., via a webhook or CLI command)

### 6.5 Add rollback verification

After rollback execution, run the acceptance ladder:
```bash
pnpm type-check && pnpm test && pnpm bench && pnpm bench:live
```
Verify that the system is back to pre-promotion state.

### 6.6 Wire into CI

Add rollback drill as a step in `.github/workflows/bench-opt.yml`:
```yaml
- name: Rollback drill
  run: pnpm bench:opt -- --rollback-allow --promotion-plan
```

### 6.7 Default to dryRun: false

Once all integration points are wired and tested, change the default in `executeBenchOptRollback` from `dryRun: true` to `dryRun: false` (or require explicit opt-in via a `--rollback-execute` flag).

---

## References

- Rollback module: `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/rollback.ts`
- Promotion module: `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/promote.ts`
- Publish module: `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/publish.ts`
- Status module: `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/status.ts`
- Runner module: `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/runner.ts`
- Rollback tests: `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/rollback.test.ts`
- Wave 5 verification: `/Users/ruirui/Downloads/GitHub/Astra/docs/investigations/wave5-verification-report.md`
- RC freeze manifest: `/Users/ruirui/Downloads/GitHub/Astra/docs/rc-freeze-manifest.md`
