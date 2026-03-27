# Astra Bench Harness

## Summary

`bench/` 是 Astra 当前的 split-aware, evaluator-first judge harness。

它和 `test/` 的分工不同：

- `test/` 负责单元测试、组件测试和回归测试
- `bench/` 负责场景执行、评分、结果汇总、版本对比，以及给下一轮 agent / generator 提供可消费反馈

当前 V1 覆盖的产品面：

- 网页翻译
- 站点自动化
- interaction priority
- frame coordination
- dynamic content
- 文章提取
- 悬停翻译
- 划词 explain
- 输入框翻译
- 字幕翻译

暂不覆盖：

- PDF
- EPUB
- 图片翻译
- multi-model judge
- 自动 retry loop

## Directory Layout

```text
bench/
  entry.ts                   # bench 主流程
  run.ts                     # CLI 入口
  types.ts                   # report / scenario / evaluator schema
  runtime/
    dom.ts                   # JSDOM 与交互辅助
    browser.ts               # bench 专用 browser mock
    fixtures.ts              # fixture 挂载与页面准备
  scenarios/                 # benchmark scenario 定义
  evaluators/                # 确定性打分逻辑
  reporters/
    json.ts                  # 写入 latest.json
    text.ts                  # 终端摘要
    feedback.ts              # agent 可消费 handoff 文本
    handoff.ts               # generator 优先级与压缩 prompt 输出
```

## Benchmark Splits

`/Users/ruirui/Downloads/GitHub/Astra/bench/splits.json` 是 split source of truth，`/Users/ruirui/Downloads/GitHub/Astra/bench/splits.ts` 负责加载和过滤。

当前 split discipline：

- `train`：用于日常迭代和 optimizer 候选搜索
- `validation`：用于选择 candidate / champion
- `holdout`：用于最终 promotion gate，不应用来反复调 prompt

CLI 支持 `--split train|validation|holdout`，也支持和 `--surface` 组合过滤。

## How To Run

全量运行：

```bash
pnpm bench
pnpm bench:loop
pnpm bench:task
pnpm bench:pass
pnpm bench:execute
pnpm bench:drill
pnpm bench:dispatch

# drill 一个本地演练场景，让 executor 进入 ready
pnpm bench:drill

# 查看 loop / dispatch CLI 帮助
pnpm bench:loop -- --help
pnpm bench:dispatch -- --help
```

按 surface 过滤：

```bash
pnpm bench -- --surface hover
pnpm bench -- --surface page-translation
pnpm bench -- --surface article-extraction
pnpm bench -- --surface selection-explain
pnpm bench -- --surface input-translation
pnpm bench -- --surface subtitle
```

按 split 过滤：

```bash
pnpm bench -- --split train
pnpm bench -- --split validation
pnpm bench -- --split holdout
pnpm bench -- --surface hover --split train
```

## Output Files

每次运行都会生成：

- `bench-results/latest.json`
- `bench-results/latest.feedback.md`
- `bench-results/latest.handoff.json`
- `bench-results/latest.generator.md`
- `bench-results/latest.loop.json`
- `bench-results/latest.loop.md`
- `bench-results/latest.patch-task.json`
- `bench-results/latest.patch-task.md`
- `bench-results/latest.patch-context.json`
- `bench-results/latest.patch-context.md`
- `bench-results/latest.patch-pass.json`
- `bench-results/latest.patch-pass.md`
- `bench-results/latest.executor.json`
- `bench-results/latest.executor.md`
- `bench-results/latest.dispatch.json`
- `bench-results/latest.dispatch.md`
- `bench-results/history/<run-id>.json`

其中：

- `latest.json` 是机器可消费的结构化结果；其中 `inventory.bySplit` 和 `filter.split` 会标明这次结果对应的 split 视角
- `latest.feedback.md` 是给下一轮生成器直接喂入的 handoff 文本
- `latest.handoff.json` 是 generator 优先级队列，包含 regression / improvement / score-delta 信息
- `latest.generator.md` 是可直接贴给 agent 的压缩版执行指令
- `latest.loop.json` 是单轮 loop runner 选出的当前修复队列；其中 `selectedItems[*].selectionScore` 是该项的排序权重，`selectedItems[*].selectionReasons` 是这份排序的可解释来源
- `latest.loop.md` 是单轮 loop runner 的执行任务单；每个被选中的 scenario 会额外打印 `Selection score` 和 `Selection reasons`，方便人工 review / debug；文件尾部还会附带当前回合的 `## Executor Gate`
- `latest.patch-task.json` 是单轮 patch pass 的结构化任务定义
- `latest.patch-task.md` 是可直接贴给 generator 的聚焦修复任务单
- `latest.patch-context.json` 是 patch task 相关文件的结构化上下文快照
- `latest.patch-context.md` 是带行号的文件上下文包
- `latest.patch-pass.json` 是单轮 patch 执行摘要
- `latest.patch-pass.md` 是当前回合最直接的 executor brief
- `latest.executor.json` 是受限自动 patch 尝试的门控结果；其中 `summary.gateSummary` 明确给出 `decision` / `reason` / `error`
- `latest.executor.md` 是最终执行或阻断说明；其中 `## Gate Decision` 和 `## History-backed readiness summary` 会解释为什么当前回合进入 ready / blocked
- `latest.dispatch.json` 是外部模型调用尝试的结果
- `latest.dispatch.md` 是外部模型返回或阻断原因；其中 `## Gate Decision` 会明确写出 dispatch 为什么 blocked / failed / executed

统一 schema 说明：这三份 `latest.*.json` 目前都使用 `schemaVersion: 1`，并共享同一层运行骨架：`runId`、`generatedAt`、`sourceArtifacts` 和 `summary`；差异只在各自的业务载荷上——`latest.loop.json` 记录 `selectedItems` / `selection`，`latest.executor.json` 记录 `actionableScenarios` / `writeScope` / `prompt`，`latest.dispatch.json` 记录 `provider` / `prompt` / `response`。

补充说明：

- `selectionScore` 只表示 loop 层的相对优先级，不是 evaluator 的产品评分，也不应该被下游当作“场景本身更好/更差”的绝对指标
- 下游消费者如果需要重排、过滤或展示 selected items，应保留 `selectionScore` 的降序语义，并把 `selectionReasons` 当作解释性元数据展示；不要把 reasons 里的字符串当成稳定的机器协议去解析
- drill 模式会把被强制注入的场景标记成 executor-ready，并用极高的 `selectionScore` 让它排在最前面；`selectionReasons` 会注明 drill scenario 和 drill reason

## Scoring Model

所有 evaluator 都统一输出：

- `scores`
- `total`
- `pass`
- `issues`
- `artifacts`
- `nextActions`

总分统一换算到 `0-100`。

默认通过条件：

- `total >= 80`
- 且没有 `critical` issue

严重问题会触发额外 penalty，所以“高风险但均分仍高”的情况不会误判为 pass。

## Current Scenario Count

当前 scenario 总数、surface 分布和 split 分布以 `benchmarkScenarios`、`/Users/ruirui/Downloads/GitHub/Astra/bench/splits.json` 和 `pnpm bench:inventory` 为准，不再在文档里手写硬编码数字。

这组场景应该保持稳定可复现。如果某次代码修改让分数波动异常，先检查 scenario runtime 或 mock 是否被破坏，再判断是否是真实产品退化。

## Agent Workflow

建议的使用顺序：

1. 先在 `train` 上迭代：`pnpm bench -- --split train`
2. 再在 `validation` 上确认：`pnpm bench -- --split validation`
3. 只在 promotion 前跑 `holdout`：`pnpm bench -- --split holdout`
4. 运行 `pnpm bench:loop`
3. 先看 `bench-results/latest.loop.json` 或 `bench-results/latest.loop.md`
4. 先看 `bench-results/latest.loop.json` 里的 `selectedItems[*].selectionScore` / `selectionReasons`，确认当前回合为什么选中了这些场景
5. 用 `bench-results/latest.patch-task.md` 作为当前单轮修复任务单
6. 需要代码上下文时，直接看 `bench-results/latest.patch-context.md`
7. 用 `bench-results/latest.patch-pass.md` 作为当前回合最精简的执行 brief
8. 运行 `pnpm bench:execute` 查看当前回合是否允许自动尝试；CLI 会直接打印 `Executor Gate`
9. 如果 gate 为 `ready`，运行 `pnpm bench:dispatch`；CLI 会直接打印 `Dispatch Gate`
   - 注意：当前 executor / dispatch 仍是 advisory 流程，不会自动修改文件
10. 需要全量上下文时，再看 `bench-results/latest.handoff.json` 和 `bench-results/latest.feedback.md`
11. `selectionScore` 是 loop 排序元数据，不是 evaluator/product score；`selectionReasons` 只适合人类审查和调试，不应被当成稳定机器协议
12. 只修复失败、退化和低分场景
13. 不要拿 `holdout` 结果做日常 prompt 调参；它只用于最终 gate
14. 再运行 `pnpm bench`
15. 最后运行 `pnpm test`

这就是 Astra 当前最小可用的：

```text
generator -> evaluator -> structured feedback -> next generator pass
```

如果当前 bench 已经全绿、没有任何 failure / regression，可用下面这组 drill：

```bash
pnpm bench:drill:current-failure
pnpm bench:drill
pnpm bench:drill:current-failure:dispatch
pnpm bench:drill:dispatch
```

### Drill matrix

- current-failure drill：`pnpm bench:drill:current-failure`
  - 用 synthetic current failure 走一遍 gate
- history-backed drill：`pnpm bench:drill`
  - 用 synthetic history-backed ready path 演练 ready gate
- current-failure drill + dispatch：`pnpm bench:drill:current-failure:dispatch`
  - 在 current-failure drill 基础上再跑一次 mock dispatch
- history-backed drill + dispatch：`pnpm bench:drill:dispatch`
  - 在 history-backed drill 基础上再跑一次 mock dispatch

drill 模式不会修改真实 benchmark 定义，只会在 loop 层临时把选中的场景强制变成一个 executor-ready 的回合。`pnpm bench:drill:current-failure` 走的是 synthetic current-failure path；`pnpm bench:drill` 走的是 history-backed ready path。两个 `:dispatch` 变体则分别在各自 drill 的基础上附带一个 mock dispatch，方便完整演练 artifact / CLI / gate summary。

如果本地没有 `ASTRA_EXECUTOR_API_KEY`，但你想把外部 dispatch 链完整演练到 `executed`，可以显式传一个 mock 响应：

```bash
pnpm bench:dispatch -- --mock-response "## Summary\nMock executor output"
```

这只用于 harness 演练，不代表真实模型调用。

## Next Likely Upgrades

- baseline import 与外部参考输出对比
- 让外部模型返回可自动应用的结构化 edit plan
- model judge 作为补充维度，而不是主评分器
