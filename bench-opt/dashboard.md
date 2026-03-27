# Astra Bench-Opt Operator Dashboard Specification

This document describes the data model, layout, and behaviour of the
bench-opt real-time operator dashboard. The dashboard is a read-only view
designed for a human operator to monitor, diagnose, and intervene in a
running optimization session.

---

## 1. Data Sources

| Source | Module | Refresh |
|---|---|---|
| Session state | `session.ts` (`BenchOptSessionState`) | Every iteration |
| Telemetry snapshot | `telemetry.ts` (`BenchOptTelemetrySnapshot`) | Every flush (configurable) |
| Guardrail result | `guardrails.ts` (`BenchOptGuardrailResult`) | After every candidate evaluation |
| Red-flag report | `red-flags.ts` (`BenchOptRedFlagReport`) | After every candidate evaluation |
| Status artifact | `status.ts` (`BenchOptStatusArtifact`) | On demand / after each phase |
| Score trends | `telemetry.ts` (`BenchOptTelemetryScoreTrend[]`) | Every iteration |
| Log stream | `logs.ts` (`BenchOptLogEntry[]`) | Real-time tail |

All data is JSON-serializable and stored under `bench-opt-results/`.

---

## 2. Layout Sections

### 2.1 Session Header

Displays the top-level session identity and phase.

- **Session ID** — from `sessionState.sessionId`
- **Run ID** — from `sessionState.runId`
- **Objective** — from `sessionState.objective`
- **Phase** — badge showing `running`, `compacting`, `handoff`, `paused`, or `completed`
- **Overall state** — from `BenchOptStatusArtifact.overallState` (idle / running / handoff / completed / kept / rejected / promoted / blocked)
- **Wall clock** — elapsed time since `sessionState.createdAt`
- **Started at** — human-readable timestamp

### 2.2 Iteration Progress

- **Current iteration** — `sessionState.progress.iteration` / `sessionState.budgets.maxIterations`
- **Completed iterations** — count of fully completed iterations
- **Progress bar** — visual fraction of iterations consumed vs budget
- **Time budget** — elapsed vs `sessionState.budgets.maxWallClockMs`

### 2.3 Score Overview

A compact summary of the best-performing candidate so far.

- **Best candidate ID** — from `statusArtifact.summary.bestCandidateId`
- **Best score** — from `statusArtifact.summary.bestScore`
- **Average score** — across all evaluated candidates
- **Evaluated split** — which split the displayed scores come from
- **Champion trial ID** — if one has been retained or promoted

### 2.4 Score Trend Charts

One chart per split (`train`, `validation`, `holdout` when available).

**X-axis:** Iteration number (0-based).
**Y-axis:** Average total score.

Data points come from `BenchOptTelemetryScoreTrend[]`:

```
iteration  | split       | averageTotal | surfaces[].averageTotal
0          | train       | 0.72         | { page-translation: 0.8, ... }
0          | validation  | 0.68         | { page-translation: 0.75, ... }
1          | train       | 0.75         | ...
```

Each surface should be plottable as its own series (toggle on/off).

Overlay lines:
- Champion score (horizontal dashed line) when a champion exists.
- Guardrail regression threshold (horizontal red dotted line).

### 2.5 Per-Surface Breakdown

A table (or grouped bar chart) showing each surface's latest scores for
the candidate vs the champion.

| Surface | Champion Avg | Candidate Avg | Delta | Status |
|---|---|---|---|---|
| page-translation | 0.80 | 0.82 | +0.02 | improved |
| site-automation | 0.65 | 0.60 | -0.05 | regressed |
| ... | ... | ... | ... | ... |

Rows with regressions exceeding the guardrail threshold should be
highlighted in red.

### 2.6 Guardrail Alerts

Displays violations from the latest `BenchOptGuardrailResult`.

- **Verdict badge** — `pass` (green), `warn` (yellow), `block` (red)
- **Violation list** — each violation rendered as:
  - ID and severity icon
  - Title (bold)
  - Description
  - Expandable evidence JSON

When the verdict is `block`, the dashboard should show a prominent banner
indicating that the loop has been halted.

### 2.7 Red Flags

Displays alerts from the latest `BenchOptRedFlagReport`.

- **Flag count** — total, with critical count highlighted
- **Flag list** — each flag rendered as:
  - Severity badge (warning / critical)
  - Description
  - Recommended action
  - Expandable evidence JSON

### 2.8 Telemetry Summary

From `BenchOptTelemetrySnapshot`:

- **Candidates evaluated** — total
- **Candidates kept / rejected** — with ratio
- **API calls** — total count
- **Token usage** — prompt / completion / total
- **Estimated cost** — USD
- **Avg time per iteration** — computed from `performance.iterationDurationsMs`
- **Avg time per evaluation** — computed from `performance.evaluationDurationsMs`

### 2.9 Log Stream

A scrollable, filterable log view tailing the session log file.

- **Level filter** — checkboxes for debug, info, warn, error, fatal
- **Component filter** — dropdown or text filter
- **Search** — free-text search across messages
- Each line shows: timestamp, level (color-coded), component, message,
  and an expand icon for metadata JSON.

### 2.10 Action Panel

Operator commands that can be issued while the session is running:

| Action | Effect | Confirmation Required |
|---|---|---|
| **Promote** | Mark the current champion as promoted and halt the loop. | Yes |
| **Reject** | Reject the latest candidate and continue to the next iteration. | No |
| **Pause** | Set session phase to `paused`; the loop will stop at the next checkpoint. | No |
| **Resume** | Set session phase back to `running` from `paused`. | No |
| **Force handoff** | Trigger an immediate handoff to the next agent/session. | Yes |
| **Adjust budget** | Update `maxIterations` or `maxWallClockMs` mid-run. | Yes |
| **Re-evaluate** | Re-run the evaluator on the current champion. | No |

Actions should be implemented as API calls or CLI commands that write to
the session state file, which the runner picks up at the next checkpoint.

---

## 3. Refresh Strategy

- **Polling:** Dashboard reads the latest artifacts from
  `bench-opt-results/` every N seconds (default 5s).
- **File watch:** Optionally use `fs.watch` on the telemetry and status
  JSON files for lower-latency updates.
- The log stream uses `tail -f` semantics on the JSONL log file.

---

## 4. Persistence

All data displayed on the dashboard is derived from files already written
by the telemetry, guardrails, red-flags, and status modules:

```
bench-opt-results/
  telemetry/
    telemetry-<sessionId>-<ts>.json
  logs/
    bench-opt-<sessionId>.log
    bench-opt-<sessionId>.log.1   (rotated)
  store/
    index.json
    experiments/
    champions/
    sessions/
```

No additional persistence layer is required.

---

## 5. Future Enhancements

- WebSocket push instead of polling.
- Multi-session comparison view.
- Historical session browser with diff overlays.
- Slack/webhook integration for critical guardrail blocks.
- Export dashboard state as a single-page HTML report.
