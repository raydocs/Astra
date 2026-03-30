# Astra Capability Conquest Benchmark Pack v2 — Guide

_Draft guide for the v2 capability-conquest benchmark pack._
_Last updated: 2026-03-30_

This guide explains how v2 differs from the frozen proof benchmark pack in v1.

- **v1** proves Astra can sustain a hardened proof lane.
- **v2** tracks whether Astra can systematically conquer the ten target product capabilities required for translation/document/media parity.

## What v2 adds

Compared with v1, benchmark pack v2 introduces:

- capability-level scorecards
- capability verdict taxonomy (`not-started` → `conquered`)
- explicit wave ownership (B/C/D after protocol freeze)
- beta-vs-required capability labeling
- per-capability harness lane tracking:
  - deterministic bench
  - live
  - holdout
  - proof contribution

## Current status

As of this draft:
- the **capability registry** exists in code,
- the **capability matrix** is frozen in draft form,
- operator-facing status can now carry capability summaries,
- benchmark pack v2 can validate both **proof-suite output** and a **status artifact**,
- privacy-mode is now wired as a required capability governance gate in the v2 draft pack,
- benchmark pack v2 is **not yet frozen**,
- only a subset of the ten capabilities have strong existing runtime/harness foundations.

That means v2 currently functions as a **conquest planning pack**, not a final external parity certification pack.

## Covered capabilities

| Capability | Current state | Wave | Benchmark-pack role |
|---|---|---|---|
| 网页翻译 | strong | B | required |
| PDF 文件翻译 | strong | B | required |
| 视频双语字幕（YouTube） | strong | B | required |
| 输入框翻译 | strong | B | required |
| EPUB 双语翻译 | strong | C | required |
| 字幕文件翻译 | strong | C | required |
| 鼠标悬停翻译 | strong | C | required |
| 图片翻译 (Beta) | gap | D | beta |
| 漫画翻译 (Beta) | gap | D | beta |
| 隐私模式 (Beta → core policy) | partial | D (standalone conquest) | required-for-parity-governance |

说明：这里的 `Wave D` 对 privacy 指的是把它作为**单独 capability row** 完整征服的时点；privacy governance gate 本身需要更早并行推进，并且可以阻断更早 wave 的扩面 claim。

## How capability scorecards should be read

Each capability scorecard should answer five questions:

1. **Does the runtime exist?**
2. **Is deterministic bench coverage green?**
3. **Is there a real live lane?**
4. **Is there a hidden/holdout lane for robustness?**
5. **Does the proof suite include prompts that would expose regressions in this capability?**

The capability verdict is then interpreted like this:

| Verdict | Interpretation |
|---|---|
| `not-started` | No trustworthy conquest progress yet |
| `partial` | A runtime or harness slice exists, but the capability is not benchmark-grade |
| `bench-pass` | Deterministic coverage exists; live/holdout still incomplete |
| `live-pass` | Deterministic and live confidence exist; hidden robustness still incomplete |
| `holdout-pass` | Standard + hidden lanes pass; proof/reporting still may be incomplete |
| `conquered` | Capability is fit to participate in parity claims |

## Running v2 in practice

Until the full benchmark-pack exporter is upgraded, v2 runs should be interpreted as a combination of:

1. **Capability matrix progress**
2. **Status artifact capability cards**
3. **Wave-specific deterministic/live/holdout results**
4. **Proof-suite regression checks for affected prompt families**

Recommended operator workflow:

### 1. Check the capability matrix
Review:
- `/Users/ruirui/Downloads/GitHub/Astra/docs/capability-matrix-v2.md`

### 2. Run relevant deterministic and live lanes
Examples:

```bash
pnpm bench
pnpm bench:live -- --list
pnpm bench:opt
```

### 3. Validate the draft benchmark pack with both proof and status artifacts

```bash
npx tsx bench-opt/external-benchmark-pack-entry.ts \
  --pack v2 \
  --validate bench-opt-results/proof-suite/latest.proof-suite.json \
  --status bench-opt-results/latest.status.json
```

Without the status artifact, required capability governance checks such as `privacy-mode` are expected to fail.

### 4. Read capability cards in the status panel
The unified status artifact should show:
- protocol version
- total capabilities
- conquered count
- wave breakdown
- per-capability current lane state and verdict

### 5. Decide whether the capability can advance waves
A capability should not move from its wave until it satisfies that wave’s exit criteria and has an explicit next harness lane.

## Required future v2 pack fields

When benchmark-pack v2 is fully exported, it should explicitly include:

- protocol version
- capability registry snapshot
- per-capability required/beta/excluded policy
- per-capability verdicts
- per-capability lane coverage
- wave ownership
- parity-claim inclusion policy

## What does **not** count as conquest

The following do **not** count as conquering a capability:

- a runtime exists but has no deterministic evaluator
- deterministic bench passes but live lane is missing
- live lane passes but no holdout robustness exists
- hidden/holdout lane exists but proof suite can’t catch regressions from that surface
- documentation claims parity but operator/status output cannot expose failures

## Short version

v2 benchmark pack is about moving each target capability from:

`not-started -> partial -> bench-pass -> live-pass -> holdout-pass -> conquered`

Only `conquered` capabilities should participate in full parity claims.

That said, row-level conquest is still not sufficient on its own: regressions in cross-cutting governance tracks such as provider-routing maturity or privacy gating can still block a parity/conquest claim even when the frozen capability rows look green.
