# Workstream F Live Flaky Inventory (Month 1 Baseline)

_Last updated: 2026-04-13_

Purpose: track known flaky or unstable live lanes so release decisions are explicit and not memory-based.

## Open entries

| ID | Scenario / lane | Class | Status | Evidence / note | Owner | Next action |
|---|---|---|---|---|---|---|
| FLAKY-001 | `bench-live/subtitle-basic` (non-required lane) | B-class timing/race | Open | Known VTTCue bridge timeout risk; not in required Month 1 lanes | Unassigned | Stabilize VTTCue bridge timing and promote only after repeated green runs |

## Empty means healthy

If no entries are open, keep this file and set the table body to `None` rather than deleting the artifact.

## Promotion rule

A lane should not move into required release-proof gates until:

1. It has no open flaky entry, and
2. It shows repeatable green runs (at least 3 consecutive CI/manual runs).
