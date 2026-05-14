# Astra Bench Harness

## Summary

Astra 当前的 benchmark stack 不是单一的 `script/bench/`，而是 **三层 benchmark 治理 + 一层 test 基础设施**：

- `test/`：单元测试、组件测试、回归测试
- `script/bench/`：deterministic、split-aware、evaluator-first 的 judge harness
- `script/bench-live/`：source-backed / browser-backed 的 live validation 与显式 holdout
- `script/bench-opt/`：建立在 deterministic + live + holdout 结果之上的 optimizer / proof / promotion 治理层

这三层 benchmark 治理共同回答三个不同问题：

1. **`script/bench/`**：逻辑是否稳定、可复现、可打分
2. **`script/bench-live/`**：真实 runtime / browser / source path 是否真能跑通
3. **`script/bench-opt/`**：能力是否足够稳定，能否通过 proof / hidden gate / promotion 治理

当前 deterministic `script/bench/` 已覆盖的 surface：

- page translation
- site automation
- interaction priority
- frame coordination
- dynamic content
- article extraction
- hover translation
- selection explain
- input translation
- subtitle translation（含 YouTube subtitle deterministic path）
- subtitle-file translation
- PDF translation
- EPUB translation
- provider routing

当前 `script/bench-live/` 标准 live lane 已覆盖：

- page translation
- privacy-mode page translation
- PDF reader
- frame coordination
- hover translation
- input translation
- subtitle / YouTube subtitle / subtitle-file
- EPUB reader

当前显式 live holdout 已覆盖：

- page-translation layout noise / churn / malformed placeholder / invalid selectors
- privacy should-not-leak
- PDF layout noise
- EPUB long chapter
- subtitle / translation race
- SPA restart / rapid navigation restart
- provider switch / provider + site update restart
- background-routed direct / relay / fallback path

仍未成为 first-class benchmark surface 的方向：

- image translation / OCR
- comic translation
- scanned-PDF OCR path
- 更广的 provider ecosystem
- 更完整的 AI translation quality-control stack

## Benchmark Stack Layout

```text
script/bench/
  entry.ts                   # deterministic bench 主流程
  run.ts                     # deterministic CLI 入口
  splits.json                # split source of truth
  scenarios/                 # deterministic scenario 定义
  evaluators/                # 确定性打分逻辑
  reporters/                 # latest.json / feedback / loop / patch / dispatch artifacts

script/bench-live/
  entry.ts                   # live CLI 入口
  index.ts                   # live orchestration surface
  runtime.ts                 # live runtime event model
  paths.ts                   # call-time path resolvers for local overrides
  driver.ts                  # browser / fixture / artifact helpers
  source-runtime.ts          # source-backed execution path
  scenarios/                 # standard live scenarios
  scenarios/holdout/         # explicit live holdouts
  results.ts                 # data/bench-live-results/ artifact persistence

script/bench-opt/
  entry.ts                   # optimizer / orchestration CLI
  runner.ts                  # trial orchestration
  capability-proof.ts        # capability-proof prompt pack + summarization
  proof-suite.ts             # multi-run proof suite + hidden gate
  capabilities.ts            # capability registry / coverage model
  status.ts                  # operator-facing status artifact
```

## Split Discipline

`script/bench/splits.json` 是 deterministic split 的 source of truth，`script/bench/splits.ts` 负责加载和过滤。

当前 split 纪律：

- `train`：日常迭代、修复、candidate 搜索
- `validation`：选择 candidate / champion
- `holdout`：promotion 前的最终 deterministic gate，不用于反复调 prompt

CLI 支持 `--split train|validation|holdout`，也支持和 `--surface` 组合过滤。

## Snapshot Counts

不要在别处手工维护硬编码数量；以 CLI 输出为准。

- `pnpm bench:inventory` 给 deterministic inventory 真值
- `pnpm bench:live -- --list` 给标准 live lane 真值
- `script/bench-live/scenarios/holdout/index.ts` 给显式 live holdout 真值

作为 **2026-03-28** 的快照：

- deterministic `script/bench/`：`62` 个 scenario，`14` 个 surface
- split 分布：`train=34`、`validation=16`、`holdout=12`
- 标准 `script/bench-live/`：`18` 个 live scenario
- 显式 `bench-live` holdout：`21` 个 scenario

如果这些数字变化，优先更新代码和 inventory，不要先改这份文档里的文字描述。

## How To Run

### Deterministic bench

```bash
pnpm bench:inventory
pnpm bench
pnpm bench -- --split train
pnpm bench -- --split validation
pnpm bench -- --split holdout
pnpm bench -- --surface provider-routing
pnpm bench -- --surface page-translation --split validation
```

### Loop / executor / dispatch flow

```bash
pnpm bench:loop
pnpm bench:task
pnpm bench:pass
pnpm bench:execute
pnpm bench:dispatch
```

### Live bench

```bash
pnpm bench:live -- --list
pnpm bench:live -- --scenario script/bench-live/page-translation-article-basic-source-bilingual
pnpm bench:live -- --scenario script/bench-live/pdf-reader-basic
pnpm bench:live -- --scenario script/bench-live/privacy-mode-page-translation-source
pnpm bench:live -- --scenario script/bench-live/holdout/privacy-mode-should-not-leak
pnpm bench:live -- --scenario script/bench-live/holdout/background-routed-direct-relay-fallback-page-translation-source
```

### Bench-opt / proof / status

```bash
pnpm bench:opt:list
pnpm bench:opt
pnpm bench:opt:status
pnpm bench:opt:capability-proof
pnpm bench:opt:capability-proof -- --include-hover --include-subtitle-file --include-epub
```

### Drill matrix

```bash
pnpm bench:drill
pnpm bench:drill:current-failure
pnpm bench:drill:dispatch
pnpm bench:drill:current-failure:dispatch
```

`drill` 不会修改真实 benchmark 定义，只会在 loop 层注入 synthetic ready / current-failure path，方便演练 gate、artifact、dispatch 链路。

## Output Artifacts

### `data/bench-results/`

deterministic bench 与 loop / executor / dispatch 的主 artifact 目录。

每次 deterministic bench / loop 运行通常会更新：

- `data/bench-results/latest.json`
- `data/bench-results/latest.feedback.md`
- `data/bench-results/latest.handoff.json`
- `data/bench-results/latest.generator.md`
- `data/bench-results/latest.loop.json`
- `data/bench-results/latest.loop.md`
- `data/bench-results/latest.patch-task.json`
- `data/bench-results/latest.patch-task.md`
- `data/bench-results/latest.patch-context.json`
- `data/bench-results/latest.patch-context.md`
- `data/bench-results/latest.patch-pass.json`
- `data/bench-results/latest.patch-pass.md`
- `data/bench-results/latest.executor.json`
- `data/bench-results/latest.executor.md`
- `data/bench-results/latest.dispatch.json`
- `data/bench-results/latest.dispatch.md`
- `data/bench-results/history/<run-id>.json`

其中：

- `latest.json`：deterministic 结构化结果
- `latest.loop.*`：当前回合修复队列和排序原因
- `latest.patch-task.*`：聚焦修复任务单
- `latest.patch-context.*`：相关文件上下文包
- `latest.patch-pass.*`：当前回合最短执行 brief
- `latest.executor.*`：自动 patch gate 结果
- `latest.dispatch.*`：外部模型 dispatch 执行或阻断结果

### `data/bench-live-results/`

By default, `script/bench-live/results.ts` writes live results to `data/bench-live-results/`. Local runs may override the artifact root with `ASTRA_BENCH_LIVE_ARTIFACT_ROOT`; CI keeps the default path.

- `data/bench-live-results/latest.result.json`
- `data/bench-live-results/latest.result.md`
- `data/bench-live-results/<run-id>/result.json`
- `data/bench-live-results/<run-id>/result.md`
- `data/bench-live-results/<run-id>/...` 目录下的截图、HTML snapshot、fixture HTML、调试 artifact

Bench-live helpers also support local path overrides for built extension and fixture roots:

- `ASTRA_BENCH_LIVE_EXTENSION_PATH` overrides the default `.output/chrome-mv3` extension path.
- `ASTRA_BENCH_FIXTURE_ROOT` overrides the default `test/fixtures/pages` fixture root.

### `data/bench-opt-results/`

`script/bench-opt/` 会把 optimizer / status / proof / promotion 相关结果写到：

- `data/bench-opt-results/latest.json`
- `data/bench-opt-results/latest.status.json`
- `data/bench-opt-results/latest.status.md`
- `data/bench-opt-results/latest.resolved.json`
- `data/bench-opt-results/latest.orchestration.json`
- `data/bench-opt-results/capability-proof/latest.capability-proof.json`
- `data/bench-opt-results/capability-proof/latest.capability-proof.md`
- 以及 `telemetry/`、`logs/`、`store/`、`promotions/`、`publish/`、`rollbacks/` 等子目录

## Scoring Model

### Deterministic evaluators

所有 deterministic evaluator 都统一输出：

- `scores`
- `total`
- `pass`
- `issues`
- `artifacts`
- `nextActions`

总分统一映射到 `0-100`。

默认通过条件：

- `total >= 80`
- 且没有 `critical` issue

严重问题会触发额外 penalty，所以“均分不低但高风险”的情况不会被误判为 pass。

### Live evaluators

`script/bench-live/` 的 evaluator 输出以 `pass / score / issues / artifacts / nextActions` 为主，重点不是复刻 deterministic 细粒度分解，而是确认：

- 真实 source/runtime path 是否跑通
- browser-backed 产物是否可见
- privacy / routing / restart 等 runtime-only 现象是否可验证

### Bench-opt governance

`script/bench-opt/` 不替代 deterministic / live，而是消费两者结果，继续做：

- capability-proof
- hidden gate
- holdout hardening
- long-run stability
- promotion / rollback / publish 治理

## Recommended Workflow

建议顺序：

1. 先看 deterministic inventory：`pnpm bench:inventory`
2. 在 `train` 上迭代：`pnpm bench -- --split train`
3. 在 `validation` 上确认：`pnpm bench -- --split validation`
4. promotion 前再跑 deterministic `holdout`
5. 对涉及 runtime / browser / source path 的改动，补跑对应 `bench-live` 场景
6. 运行 `pnpm bench:loop`
7. 先看 `data/bench-results/latest.loop.json` / `latest.loop.md`
8. 需要修复任务单时，看 `latest.patch-task.md`
9. 需要上下文时，看 `latest.patch-context.md`
10. 跑 `pnpm bench:execute` 看 `Executor Gate`
11. gate 为 `ready` 时，再跑 `pnpm bench:dispatch`
12. 做 capability claim / 长稳验证时，再跑 `pnpm bench:opt:capability-proof` 或完整 `pnpm bench:opt`
13. 最后跑 `pnpm test`

### 额外注意

- `selectionScore` 是 loop 层排序权重，不是产品评分
- `selectionReasons` 是解释性元数据，不是稳定机器协议
- `holdout` 不应用来做日常 prompt 调参
- provider routing、privacy、active-session restart 这类问题，优先看 live artifacts，不要只看 deterministic 分数

## Near-Term Benchmark Expansion Targets

下一批最值得进入 benchmark stack 的方向：

- image translation / OCR
- comic translation
- broader document ingest / export matrix
- scanned-PDF OCR decision path
- broader provider breadth / fallback governance
- AI translation quality-control policy

这份文档的重点不是宣称“全都做完了”，而是明确 Astra 现在已经有一套 **deterministic + live + holdout + proof** 的最小可用 benchmark 治理体系，并且 provider routing / privacy / document readers 都已经进入可验证范围。
