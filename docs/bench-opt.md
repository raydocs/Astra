# Astra Bench Opt

## Summary

`/Users/ruirui/Downloads/GitHub/Astra/bench-opt/` 是 Astra 的 Phase 2 optimizer foundation。

它目前不替换 `/Users/ruirui/Downloads/GitHub/Astra/bench/`，而是在 judge harness 之外先补一层独立的 experiment runner：

- 读取当前 `/Users/ruirui/Downloads/GitHub/Astra/bench-results/latest.json` 作为 baseline
- 组合 Phase 1 的 prompt/context candidates
- 对 candidate 做只读打分
- materialize trial / champion / store metadata
- 输出 worktree plan、bench-opt report 和 resolved optimizer config artifact

## Current Scope

Phase 2 当前已经包含：

- built-in prompt candidates
- built-in context candidates
- registry API
- standalone optimizer CLI
- baseline-aware candidate scoring
- dry-run worktree planning
- experiment run creation
- trial materialization
- champion selection scaffolding
- store/index persistence
- resolved config artifact generation

当前仍不做：

- 自动修改 judge harness
- 自动 rerun / keep / reject loop
- 自动发布主干
- live browser-backed optimizer trials

说明：当前仍是 read-only by default；真实 worktree materialization / apply 已有 skeleton，但默认不会执行。只有在显式传入 `--materialize` 和 `--apply-edits` 时，才会在选中的 candidate 上做一次受限执行。

## Scripts

当前可直接运行：

```bash
pnpm bench:opt
pnpm bench:opt:autoloop
pnpm bench:opt:resume-latest
pnpm bench:opt:list
pnpm bench:opt:loop
pnpm bench:opt:execute
pnpm bench:opt:dispatch
pnpm bench:opt:history
pnpm bench:live
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-translation-only
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-bilingual
pnpm bench:live -- --scenario bench-live/fixture-playwright-smoke
```

以及：

```bash
pnpm bench:opt -- --verify --materialize [--apply-edits]
pnpm bench:opt -- --orchestrate [--session]
pnpm bench:opt -- --session
pnpm bench:opt -- --promotion-plan
pnpm bench:opt -- --session --promotion-plan
pnpm bench:opt -- --live
pnpm bench:opt -- --live --promotion-plan
```

用于在 isolated worktree 上执行 bounded verification，并把 keep/reject、session lifecycle、promotion planning 结果回写到 runner 输出。

说明：

- `pnpm bench:opt`
  - 运行 `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/entry.ts`
  - 默认 materialize Phase 1 registry candidates
  - 读取 `/Users/ruirui/Downloads/GitHub/Astra/bench-results/latest.json`
  - 写入 `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.json`、`latest.md`，以及 `latest.resolved.json` / `latest.resolved.md`
  - 额外支持：
    - `--evaluated-split train|validation|holdout`
    - `--promotion-splits validation,holdout`
    - `--verify`
    - `--orchestrate`
    - `--orchestration-objective "..." `
    - `--orchestration-follow-up rerun|keep|reject`
    - `--orchestration-max-iterations N`
    - `--orchestration-no-rerun-continuation`
    - `--orchestration-no-checkpoints`
    - `--session`
    - `--session-force-compaction`
    - `--session-force-handoff`
    - `--session-resume /path/to/latest.session.json`
    - `--session-checkpoint /path/to/latest.checkpoint.json`
    - `--session-handoff /path/to/latest.handoff.json`
    - `--promotion-plan`
    - `--promotion-live-passed`
    - `--promotion-allow`
    - `--publish-allow`
    - `--rollback-allow`
    - `--live`
    - `--live-scenario bench-live/page-translation-article-basic-source-bilingual`
    - `--materialize`
    - `--apply-edits`
  - 如果额外传入 `--materialize` / `--apply-edits`，会在本轮选中的 candidate 上创建真实 worktree 并应用 candidate JSON 中的结构化 edits
  - 如果额外传入 `--session`，会写出 bounded session/checkpoint artifacts
  - 如果同时传入 `--session-resume` / `--session-checkpoint` / `--session-handoff`，runner 会把上一轮 session 链接回本轮 orchestration loop，而不是强制新建 session
  - 如果额外传入 `--promotion-plan`，会写出 promotion / publish / rollback dry-run artifacts
  - 如果额外传入 `--live`，runner 会执行当前 opt-in live evaluator，并写出 `latest.live.json` / `latest.live.md`
  - 默认 live path 现在优先运行 `bench-live/page-translation-article-basic-source-bilingual`：它会先在 JSDOM/Vite SSR 里调用真实 `/Users/ruirui/Downloads/GitHub/Astra/src/entrypoints/content/page-translate.ts`，再把生成后的 snapshot 放进真实 Chrome/Playwright 会话里截图，并复用 `/Users/ruirui/Downloads/GitHub/Astra/bench/evaluators/page-translation.ts` 做评分
  - `bench-live/page-translation-article-basic-bilingual` 仍保留，作为 contract-shaped browser fallback
  - `bench-live/fixture-playwright-smoke` 仍保留，用作更窄的 browser/bootstrap smoke
  - 如果同时传入 `--live --promotion-plan`，promotion gate 会优先消费 live evaluator 的 pass bit；如果当前环境没有可用浏览器，live scenario 会显式 `skipped`，promotion 仍保持 blocked
  - 如果额外传入 `--orchestrate`，会对当前最佳 candidate 运行 bounded orchestration loop，并写出 loop/iteration artifacts
  - 如果通过 runtime options 启用 orchestration，CLI 现在会额外打印 bounded orchestration loop 的 iteration/termination 摘要
- `pnpm bench:opt:list`
  - 列出 built-in prompt/context candidates
- `pnpm bench:opt:resume-latest`
  - 读取 `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/store/index.json` 中最新的 session/checkpoint/handoff bundle
  - 自动把这些路径转发给现有 `--session-resume` / `--session-checkpoint` / `--session-handoff`
  - 用于继续上一轮 bounded orchestration session，而不是手动抄三条路径
- `pnpm bench:opt:autoloop`
  - 自动判断当前应该 start 还是 resume
  - 基于 store 中最新 session bundle 连续跑多轮 bounded orchestration
  - 默认在每轮之间自动读取最新 session/checkpoint/handoff，直到 session terminal 或达到 cycle cap
  - 产出：
    - `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.autoloop.json`
    - `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.autoloop.md`
- `pnpm bench:opt:loop`
  - 继续复用现有 `/Users/ruirui/Downloads/GitHub/Astra/bench/loop.ts`
  - 默认附带 `--use-bench-opt`，优先消费 `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.resolved.json`
- `pnpm bench:opt:execute`
  - 继续复用现有 `/Users/ruirui/Downloads/GitHub/Astra/bench/loop.ts --skip-bench`
- `pnpm bench:opt:dispatch`
  - 继续复用现有 `/Users/ruirui/Downloads/GitHub/Astra/bench/dispatch.ts`
- `pnpm bench:opt:history`
  - 继续复用现有 `/Users/ruirui/Downloads/GitHub/Astra/bench/history.ts`
- `pnpm bench:opt:status`
  - 直接读取 `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.status.json`
  - 输出当前 operator-facing 统一状态摘要

## Experiment Store and Artifacts

`pnpm bench:opt -- --write` 当前会产出：

- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.json`
  - 本轮 candidate score report
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.md`
  - 人类可读的 score summary
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.resolved.json`
  - downstream bench loop 直接消费的 concrete optimizer config
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.resolved.md`
  - resolved config 的 Markdown 说明
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.orchestration.json`
  - opt-in planner/generator/evaluator orchestration artifact
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.orchestration.md`
  - orchestration Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.orchestration-loop.json`
  - opt-in bounded orchestration loop artifact（多轮 iteration、termination、final decision）
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.orchestration-loop.md`
  - orchestration loop Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/orchestration-iterations/`
  - 每轮 orchestration iteration 的 JSON / Markdown snapshot
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.session.json`
  - 当前 bounded session state
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.session.md`
  - session lifecycle Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.checkpoint.json`
  - 当前 run 的 checkpoint artifact
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.checkpoint.md`
  - checkpoint Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.compaction.json`
  - opt-in compaction artifact（仅在触发时写出）
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.compaction.md`
  - compaction Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.handoff.json`
  - opt-in handoff artifact（仅在触发时写出）
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.handoff.md`
  - handoff Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.live.json`
  - opt-in live evaluator 结果；当前默认来源于 `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/page-translation-article-basic-source.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.live.md`
  - live evaluator 的人类可读摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live-results/<run-id>/`
  - browser-backed live artifacts，包括 materialized fixture HTML、screenshot、snapshot HTML，以及 standalone `bench:live` 写出的 `result.json` / `result.md`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live-results/latest.result.json`
  - standalone `bench:live` 最近一次运行的 JSON 结果
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live-results/latest.result.md`
  - standalone `bench:live` 最近一次运行的 Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.promotion.json`
  - promotion gate decision
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.promotion.md`
  - promotion gate Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.publish.json`
  - downstream publish dry-run plan
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.publish.md`
  - publish plan Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.rollback.json`
  - downstream rollback dry-run plan
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.rollback.md`
  - rollback plan Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.status.json`
  - operator-facing unified status artifact，汇总当前 report / resolved config / execution / live / orchestration / session / promotion / publish / rollback 状态
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.status.md`
  - 统一的人类可读状态面板，适合直接查看当前长跑位置
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/store/index.json`
  - experiment / champion / session lifecycle 索引
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.autoloop.json`
  - 多轮 autoloop 摘要，包括每轮 start/resume mode、decision、phase、termination
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/latest.autoloop.md`
  - autoloop Markdown 摘要
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/store/experiments/*.json`
  - 单次 experiment 持久化结果
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt-results/store/champions/*.json`
  - 当前 champion record

说明：

- `latest.resolved.json` 现在既支持 registry candidate，也支持显式 JSON candidate 输入
- experiment trial 也会记录 `artifacts.resolvedConfigPath`，用于反查当前 champion 使用的 resolved config
- store index 现在还会记录最新的 `session/checkpoint/compaction/handoff` bundle，供 `pnpm bench:opt:resume-latest` 自动续跑

## Trial Splits and Champion Semantics

bench judge 已经支持：

- `train`
- `validation`
- `holdout`

bench-opt 的 trial model 也已经显式建模了这些 split。当前 Phase 2 runner 会把当前候选池切成一个实用的 promotion hierarchy：

- 多 candidate 时：最优 trial 作为 `holdout`，次优 trial 作为 `validation`，其余 trial 作为 `train`
- 单 candidate 时：维持 `train` fallback
- 显式传入 `--evaluated-split` 时：用该 split 覆盖默认分配

这表示：

- split discipline 已进入 type/model
- promotion logic 已经开始分离 `validation` 和 `holdout`

当前 champion semantics：

- `retained`：验证阶段 shortlisted，但还没走到最终 promotion
- `rejected`：本轮未被选中
- `promoted`：holdout gate 通过后的最终 champion

## Materialization and Apply Flow

当前结构：

- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/worktree.ts`
  - 只负责生成 worktree 计划
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/materialize.ts`
  - 可选地把 worktree 计划落地成真实 worktree
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/apply.ts`
  - 结构化 rewrite / replace skeleton

边界：

- 默认仍是 dry-run
- `--write` 只负责持久化 artifacts，不会自动 apply patch
- `--materialize` 会把选中的 candidate 的 worktree plan 变成真实 worktree
- `--apply-edits` 会把 candidate JSON 里的 `edits` 结构化修改应用到该 worktree
- 这仍然不是完整自动 loop；它只做一次 bounded execution，不会 rerun benchmark 或进入 keep/reject 轮询

### Explicit candidate JSON shape

显式 candidate JSON 现在可以附带 `edits`：

```json
{
  "id": "explicit/execution-candidate",
  "prompt": "Apply the smallest safe edit inside an isolated worktree.",
  "context": ["task", "candidateFiles"],
  "notes": ["explicit execution path"],
  "edits": [
    {
      "path": "file.ts",
      "justification": "update the exported value",
      "kind": "replace",
      "search": "1",
      "replace": "2"
    }
  ],
  "worktree": {
    "root": "/path/to/repo",
    "baseRef": "HEAD"
  }
}
```

说明：

- `rewrite` 会直接重写文件内容
- `replace` 会先检查 `search` 是否存在，再做一次替换
- 编辑路径必须落在 worktree 内部，超界会直接拒绝

## Phase 2 Notes

- 当前 score 主要还是 baseline-aware heuristic score，不是 agent self-play score
- 当前 built-in registry 重点是把“prompt candidate / context candidate / scoring / worktree plan / resolved config / experiment store / split-aware promotion gate”这条骨架固定下来
- `bench-opt-results/latest.resolved.json` 是 downstream bench loop 的 concrete config 输入：它显式包含选中的 prompt/context candidate IDs、rendered prompt/context payload 和 worktree 计划，不需要再从 summary 里猜
- prompt/context candidate 现在带有结构化 policy，已经开始驱动下游 runtime 分支：
  - prompt policy: `analysisMode` / `toolPolicy` / `writeScopeMode`
  - context policy: `rankingMode` / `maxFiles` / `maxLinesPerFile` / `preferHistory`
- 当前这些 policy 已接到 `/Users/ruirui/Downloads/GitHub/Astra/bench/reporters/patch-task.ts`、`patch-context.ts`、`executor.ts`

## Phase 8 Promotion / Publish / Rollback Skeleton

新的 Phase 8 skeleton 已存在于：

- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/promote.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/publish.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/rollback.ts`

当前能力：

- split/check/live gate 汇总成 promotion decision
- dry-run publish plan
- dry-run rollback plan
- 可通过 `pnpm bench:opt -- --promotion-plan` 直接由 runner 写出 promotion / publish / rollback artifacts

当前边界：

- 不会真的创建 branch / PR / canary
- 仍然需要后续接 GitHub/publish runtime

## Next Likely Upgrades

- 把 verification / keep-reject 变成 champion/challenger 默认主路径
- 把 orchestrator 接到真实 planner/generator/evaluator runtime
- 给 bench-live 接 Playwright
- 增加 tool policy / agent graph mutation hooks
- 把 promotion / publish / rollback 接到真实 VCS / rollout runtime


## Phase 2 Verification and Comparison

新的 Phase 2 骨架已经存在于：

- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/rerun.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/verify.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/compare.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/keep-reject.ts`

当前能力：

- 在 isolated worktree 里顺序运行 bounded commands
- 构造 split-aware verification plan（`type-check` / `test` / `bench -- --split ...`）
- 比较 baseline/champion vs trial/challenger 的 structured bench report
- 输出 `retain` / `reject` / `promote` 建议和原因

当前边界：

- 默认仍不会自动启用 verification；需要显式传入 `--verify`
- 当前 keep/reject 已接进 runner，但 promotion gate 仍默认 safe/blocking
- 这样做是为了先保持 Phase 1/2 已稳定的 optimizer runner 不被新骨架拖累

## Phase 3 Orchestrator Skeleton

新的 Phase 3 角色骨架已经存在于：

- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/planner.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/generator.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/evaluator.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/strategy.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/orchestrator.ts`

当前能力：

- planner / generator / evaluator 角色 contract 已显式建模
- 支持 bounded 单次 orchestration artifact
- runner 现在也支持 bounded orchestration loop artifact，并把 final iteration 继续保留为兼容的 `latest.orchestration.*`
- evaluator 会输出 follow-up decision 和 handoff request

当前边界：

- 还没有接真实 LLM runtime
- 当前已可 opt-in 生成 orchestration loop artifact，但还没有默认开启的 long-running autonomous主闭环

## Phase 4 Session / Checkpoint / Compaction Skeleton

新的 Phase 4 session scaffolding 已存在于：

- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/session.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/checkpoints.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/compaction.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-opt/handoff.ts`

当前能力：

- bounded session state
- rolling history / budget helpers
- checkpoint / compaction / handoff artifact builders
- 面向 long-running loop 的 resume metadata
- 当 orchestration loop 启用并传入 `--session` 时，runner 会把 session/checkpoint/compaction/handoff 绑定到 iteration 生命周期

当前边界：

- 当前已可通过 `--session` 在 runner 中写出 session/checkpoint artifacts
- `--session-force-compaction` / `--session-force-handoff` 只生成 bounded artifact，不会自动 resume 或重启 session

## Phase 5 Live Harness

新的 Phase 5 live bench skeleton 已存在于：

- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/runtime.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/rubrics.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/evaluator.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/fixture-playwright-smoke.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/page-translation-article-basic-source.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/page-translation-article-basic-source-translation-only.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/page-translation-article-basic.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/source-runtime.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/scenarios/placeholder.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/driver.ts`
- `/Users/ruirui/Downloads/GitHub/Astra/bench-live/entry.ts`

可直接运行：

```bash
pnpm bench:live
pnpm bench:live -- --list
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-bilingual
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-source-translation-only
pnpm bench:live -- --scenario bench-live/page-translation-article-basic-bilingual
pnpm bench:live -- --scenario bench-live/fixture-playwright-smoke
```

当前已经有两条真实 browser-backed 路径：

- `bench-live/page-translation-article-basic-source-bilingual`
  - 在 JSDOM/Vite SSR 中运行真实 `startPageTranslation()` 源码路径
  - 再用本地 Chrome + Playwright 加载生成后的 snapshot
  - 复用 page-translation evaluator contract
  - 产出 screenshot / HTML snapshot
  - 让 `bench:opt -- --live` 默认开始消费 source-backed live signal
- `bench-live/page-translation-article-basic-source-translation-only`
  - 在同一条 source-backed live bridge 上验证 `translation-only` 模式
  - 显式检查 hidden source wrappers 是否和 translated node count 对齐
- `bench-live/page-translation-article-basic-bilingual`
  - 保留 contract-shaped browser fallback，方便隔离 source bridge 与 browser capture 问题
- materialize fixture HTML 到 `/Users/ruirui/Downloads/GitHub/Astra/bench-live-results/<run-id>/`
- 把结果接进 live evaluator / bench-opt status / promotion gate

placeholder scenario 仍保留，用于无浏览器环境下的 contract fallback。

另外，standalone `pnpm bench:live` 现在会自动把最近一次 live run 持久化到 `/Users/ruirui/Downloads/GitHub/Astra/bench-live-results/latest.result.json` 和 `latest.result.md`，并在对应 `runId` 目录下追加 `result.json` / `result.md`。
