# Astra Benchmark Protocol v2.0.0-draft

_Draft foundation for the Astra v2 capability conquest campaign._
_Last updated: 2026-03-27_

This protocol extends the frozen proof/benchmark work from v1.0.0 into a **capability-conquest protocol**. v1 answered, “can Astra prove a hardened proof lane?” v2 answers, “can Astra systematically conquer the translation/reading/media/document surfaces required to compete with best-in-class references?”

## 1. Scope

Protocol v2 covers exactly these 10 capabilities:

1. 网页翻译
2. PDF 文件翻译
3. 视频双语字幕（YouTube 双语字幕）
4. Epub 电子书双语翻译
5. 图片翻译 (Beta)
6. 漫画翻译 (Beta)
7. 隐私模式 (Beta → core policy)
8. 鼠标悬停翻译
9. 字幕文件翻译
10. 输入框翻译

These capabilities are frozen as the **v2 conquest set**. New capabilities require a protocol version bump.

## 2. Capability-Level Verdict Taxonomy

In addition to the suite-level taxonomy from v1, protocol v2 introduces **capability-level verdicts**:

| Verdict | Meaning |
|---|---|
| `not-started` | No reliable deterministic lane exists yet. |
| `partial` | Some runtime or harness coverage exists, but the capability is not yet bench-grade. |
| `bench-pass` | Deterministic bench lane is green, but live/holdout remain incomplete. |
| `live-pass` | Deterministic + live lanes are green, but holdout/proof support remain incomplete. |
| `holdout-pass` | Deterministic + live + holdout are green; proof/reporting may still need protocol integration work. |
| `conquered` | Deterministic, live, holdout, and proof contributions are all green; operator/reporting and benchmark-pack coverage are complete. |

These capability verdicts are additive. They do **not** replace the existing suite verdict taxonomy (`pass`, `pass-with-warnings`, `visible-pass-hidden-fail`, `partial`, `fail`).

## 3. Conquest Requirement (“满分”)

A capability is only considered conquered when all of the following are true:

1. **Deterministic bench pass**
2. **Live standard pass**
3. **Holdout / hard-mode pass**
4. **Proof-suite stable-pass contribution**
5. **Visible gate rubric exists**
6. **Hidden/holdout robustness lane exists**
7. **Operator-readable status exists**
8. **Benchmark-pack coverage exists**

This protocol explicitly rejects cosmetic “100/100” claims that are not backed by all four harness lanes.

## 4. Wave Order

### Wave A — Capability matrix and protocol freeze
Wave A defines and freezes:
- capability registry
- capability matrix
- capability verdict language
- operator-facing capability status format
- benchmark-pack v2 guide and protocol docs

### Wave B — Highest-leverage conquest
Wave B covers:
- 网页翻译
- PDF 文件翻译
- YouTube 双语字幕
- 输入框翻译

### Wave C — Reading ecosystem conquest
Wave C covers:
- EPUB 双语翻译
- 字幕文件翻译
- 鼠标悬停翻译

### Wave D — Beta + privacy conquest
Wave D covers:
- 图片翻译 (Beta)
- 漫画翻译 (Beta)
- 隐私模式 (Beta → core policy)

## 5. Per-Capability Scorecard Requirement

Every capability must eventually have a scorecard section that exposes:

- deterministic bench status
- live status
- holdout status
- proof contribution status
- current capability verdict
- target behavior summary
- remaining missing harness lanes
- benchmark-pack inclusion status

These scorecards should appear in operator-facing status and in benchmark-pack documentation.

## 6. Public Reporting Artifacts

Protocol v2 requires the following public artifacts:

- `/Users/ruirui/Downloads/GitHub/Astra/docs/capability-matrix-v2.md`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/benchmark-protocol-v2.md`
- `/Users/ruirui/Downloads/GitHub/Astra/docs/benchmark-pack-v2-guide.md`
- capability status section in `/Users/ruirui/Downloads/GitHub/Astra/docs/bench-opt-operator-runbook.md`

Future benchmark-pack specs must also indicate whether a capability is:
- required for parity claims,
- beta-only,
- excluded from parity claims.

## 7. Harness Requirements by Capability

The implementation order inside each capability follows the same seven-step ladder:

1. Runtime or product surface
2. Deterministic evaluator + scenarios
3. Live standard scenario
4. Holdout scenario(s)
5. Capability verdict/reporting
6. Proof-suite integration
7. Benchmark-pack freeze/update

## 8. Proof-Suite Family Expansion

Current proof suite is already strong, but v2 requires explicit prompt families that stress:

- reading systems
- document translation
- media/subtitle coordination
- privacy-sensitive authoring
- image/comic reasoning once those surfaces exist

A capability cannot be `conquered` unless its class of behavior is represented in proof-suite prompts or explicitly exempted in the benchmark protocol.

## 9. Benchmark-Pack Policy for v2

Benchmark pack v2 must eventually move beyond a generic proof lane and explicitly declare:

- which capabilities are covered,
- which capabilities are beta-only,
- which capabilities are required for full parity claims,
- which capabilities are excluded pending subsystem completion.

Until benchmark-pack v2 is fully implemented, protocol v2 remains a **draft scaffold** rather than a frozen external benchmark commitment.

## 10. Acceptance by Wave

### Wave A acceptance
Wave A is complete only when every matrix row is decision-complete:
- exact target behavior
- current Astra gap
- which harness lanes are missing
- which wave owns the work
- what counts as parity-pass

### Wave B acceptance
The four highest-leverage capabilities must each reach at least `holdout-pass`.

### Wave C acceptance
Reading ecosystem capabilities must each reach at least `live-pass`, with EPUB and subtitle-file targeting `holdout-pass`.

### Wave D acceptance
Beta surfaces must have explicit beta-grade harnesses, and privacy mode must be promoted to a first-class product/policy gate.

## 11. Relationship to v1

- **v1.0.0** remains the frozen proof-suite benchmark protocol.
- **v2.0.0-draft** is the conquest protocol that organizes product expansion and harness obligations.
- v1 proves Astra’s hardened benchmark lane.
- v2 organizes how Astra extends that lane across the ten target product capabilities.

Until v2 is frozen, any external claim should distinguish between:
- **v1 proof trustworthiness**, and
- **v2 capability conquest progress**.
