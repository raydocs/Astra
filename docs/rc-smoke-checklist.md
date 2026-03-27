# RC Smoke Checklist

**RC Version:** `rc-2026-03-27`
**Purpose:** Manual pre-release verification. Run all checks below before tagging the RC.
**Estimated time:** 15-20 minutes (bench + live scenarios dominate)

---

## Basic Health

- [ ] **Type-check** -- 0 errors
  ```bash
  pnpm type-check
  ```
  Expected: exits 0, no type errors.

- [ ] **Unit tests** -- 510/510 pass (ignore worktree false fails)
  ```bash
  pnpm test
  ```
  Expected: 452+ real passes. 58 failures from `.bench-opt/worktrees/` are known false positives (B-class B3). To eliminate false failures, remove the stale worktree directory first:
  ```bash
  rm -rf .bench-opt/worktrees/
  pnpm test
  ```

- [ ] **Bench** -- at least 34/36 pass, avg score at least 90
  ```bash
  pnpm bench
  ```
  Expected: 34/36 pass, avg 94. The 2 failures are `selection-explain/*` (pre-existing B-class B2).

---

## Live Scenarios

- [ ] **List live scenarios** -- 7+ real scenarios visible
  ```bash
  pnpm bench:live -- --list
  ```
  Expected: at least 7 scenarios listed including `interaction-priority-basic`, `input-translation-basic`, `subtitle-basic`, `frame-coordination-basic`, and the page-translation variants.

- [ ] **page-translation (source bilingual)** -- pass
  ```bash
  pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual
  ```
  Expected: exits 0, score >= 80, screenshots produced.

- [ ] **interaction-priority-basic** -- pass
  ```bash
  pnpm bench:live -- --scenario bench-live/interaction-priority-basic
  ```
  Expected: exits 0, links clickable, input interactable, button clickable.

- [ ] **input-translation-basic** -- pass
  ```bash
  pnpm bench:live -- --scenario bench-live/input-translation-basic
  ```
  Expected: exits 0, final value `ZH:Hello world`, score 100.

- [ ] **subtitle-basic** -- known failure (B-class)
  ```bash
  pnpm bench:live -- --scenario bench-live/subtitle-basic
  ```
  Expected: FAIL with `waitForFunction` 30s timeout. This is a known B-class bug (VTTCue bridge timing). Document the failure but do not block RC on it.

- [ ] **frame-coordination-basic** -- pass
  ```bash
  pnpm bench:live -- --scenario bench-live/frame-coordination-basic
  ```
  Expected: exits 0, child frame skips float-ball/selection-toolbar, top frame has 2 translation markers.

---

## Optimizer Integration

- [ ] **bench-opt main path** -- produces status artifact
  ```bash
  pnpm bench:opt
  ```
  Expected: exits 0, `bench-opt-results/latest.status.json` is produced. Check that the file contains `overallState` and `summary` sections.

- [ ] **bench-opt with live-all** -- at least 6/7 scenarios pass
  ```bash
  pnpm bench:opt -- --live-all
  ```
  Expected: 6/7 live scenarios pass (subtitle-basic may fail). Live results flow into the status artifact.

- [ ] **bench-opt promotion plan** -- promotion/publish/rollback artifacts produced
  ```bash
  pnpm bench:opt -- --promotion-plan
  ```
  Expected: all three artifacts produced:
  - `bench-opt-results/latest.promotion.json`
  - `bench-opt-results/latest.publish.json`
  - `bench-opt-results/latest.rollback.json`

- [ ] **Status JSON has safety.guardrails.verdict** field
  ```bash
  cat bench-opt-results/latest.status.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('verdict:', d.get('safety',{}).get('guardrails',{}).get('verdict','MISSING'))"
  ```
  Expected: `verdict: warn` or `verdict: pass` (not `MISSING`).

- [ ] **Status JSON has telemetry.durationMs** field
  ```bash
  cat bench-opt-results/latest.status.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('durationMs:', d.get('telemetry',{}).get('durationMs','MISSING'))"
  ```
  Expected: a number (e.g., `durationMs: 49`), not `MISSING`.

- [ ] **Status JSON overallState is meaningful**
  ```bash
  cat bench-opt-results/latest.status.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('overallState:', d.get('overallState','MISSING'))"
  ```
  Expected: one of `idle`, `running`, `kept`, `rejected`, `promoted`, `blocked`, `handoff`, `completed`. Should NOT be stuck on `idle` after a full run -- typically `blocked` for a non-verified run.

---

## Advanced Paths

- [ ] **Verify + materialize** -- worktree created
  ```bash
  pnpm bench:opt -- --verify --materialize
  ```
  Expected: a worktree is created under `.bench-opt/worktrees/`, type-check/test/bench run within it, and a keep/reject decision is produced. Check that `bench-opt-results/latest.status.json` has a non-null `summary.keepRejectDecision`.

- [ ] **Orchestrate + session** -- session/handoff artifacts produced
  ```bash
  pnpm bench:opt -- --orchestrate --session
  ```
  Expected: 1/1 iteration completes, session phase reaches `handoff`. Session, checkpoint, and handoff artifacts are produced under `bench-opt-results/`.

---

## Promotion Safety

- [ ] **latest.status.json has safety section**
  ```bash
  cat bench-opt-results/latest.status.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('safety present:', 'safety' in d); print('guardrailVerdict:', d.get('guardrailVerdict','MISSING')); print('redFlagCount:', d.get('redFlagCount','MISSING'))"
  ```
  Expected:
  - `safety present: True`
  - `guardrailVerdict: warn` (or `pass`)
  - `redFlagCount: 0`

- [ ] **Guardrail violations are human-readable**
  ```bash
  cat bench-opt-results/latest.status.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
safety = d.get('safety',{})
guardrails = safety.get('guardrails',{})
violations = guardrails.get('violations',[])
if violations:
    for v in violations:
        print(f'  - {v}')
else:
    print('  No violations (clean).')
print(f'  Verdict: {guardrails.get(\"verdict\",\"MISSING\")}')
"
  ```
  Expected: violations (if any) are human-readable strings, not opaque codes. Verdict is a readable word.

- [ ] **Red flags section exists**
  ```bash
  cat bench-opt-results/latest.status.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
safety = d.get('safety',{})
red_flags = safety.get('redFlags',{})
print(f'  Red flag count: {red_flags.get(\"count\", \"MISSING\")}')
flags = red_flags.get('flags',[])
if flags:
    for f in flags:
        print(f'  - {f}')
else:
    print('  No red flags (clean).')
"
  ```
  Expected: `Red flag count: 0` (or a number). The section exists even if empty.

---

## Completion

When all checks above are complete:

1. Record any deviations from expected results in the RC notes.
2. Known acceptable failures:
   - `selection-explain` bench: 0/2 (pre-existing)
   - `subtitle-basic` live: FAIL (B-class VTTCue bridge timeout)
   - `.bench-opt/worktrees/` test pollution (58 false failures)
3. If all other checks pass, the RC is ready to tag.

**Tag command:**
```bash
git tag rc-2026-03-27 -m "RC freeze: Wave 5 verified, 34/36 bench, 6/7 live, safety+telemetry wired"
```
