# Astra Documentation

This directory is the stable documentation entry point for Astra. It adds routing context for humans and agents without changing the repository layout.

## Conceptual four-bucket model

Astra uses many convention-bound physical roots. In docs, the repository can be understood through four **conceptual** buckets only; this pass does not create, move, or rename directories.

| Conceptual bucket | Meaning | Current physical examples |
|---|---|---|
| `src/` | Product/runtime source and source-bearing assets | `src/`, `web/src/`, `web/public/`, `public/`, `server/`, task-specific `platform/*/src/` |
| `script/` | Automation, CI, harnesses, deployment, verification tooling | `.github/`, `scripts/`, `ios/scripts/`, `bench/`, `bench-live/`, `bench-opt/`, `agent-config/` |
| `docs/` | Plans, specs, reviews, investigations, ADRs, analysis | `docs/`, legacy top-level `plans/` |
| `data/` | Generated output, local runtime state, caches, result artifacts, committed reference artifacts | `.output/`, `.wxt/`, `dist/`, `server/data/`, `bench-*results/`, `store/screenshots/`, `ios/AstraShell Extension/Resources/` |

For the canonical read-priority boundary, see [`docs/investigations/ai-readable-classification-boundary.md`](./investigations/ai-readable-classification-boundary.md).

## Documentation routes

| Area | Start here | Use when |
|---|---|---|
| AI context routing | [`ai-context/README.md`](./ai-context/README.md) | Choosing focused source, UI, planning, reference, or generated-artifact context. |
| Plans | [`plans/README.md`](./plans/README.md) | Reading implementation plans or future migration checklists. |
| Specs | [`specs/`](./specs/) | Product or feature contracts are relevant. |
| Reviews | [`reviews/`](./reviews/) | Prior critiques, certifications, or assessment notes are relevant. |
| Investigations | [`investigations/`](./investigations/) | Research, classification, support matrix, or gap-analysis context is needed. |
| ADRs | [`adr/`](./adr/) | Architecture decision records are relevant. |
| Analysis | [`analysis/`](./analysis/) | Analysis notes are relevant. |
| Bench harness | [`bench-harness.md`](./bench-harness.md), [`bench-opt.md`](./bench-opt.md), [`bench-opt-operator-runbook.md`](./bench-opt-operator-runbook.md) | Benchmark, live proof, or optimizer work is requested. |
| Relay server | [`relay-server.md`](./relay-server.md) | Relay setup, auth, translation relay, or local API behavior is in scope. |

## Current docs-only refactor status

The four-bucket layer is a repository-knowledge/index layer only. It preserves runtime behavior, package scripts, build configuration, source paths, generated paths, and committed reference artifacts.
