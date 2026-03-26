# Astra Bench Harness

## Summary

`bench/` 是 Astra 当前的 evaluator-first harness。

它和 `test/` 的分工不同：

- `test/` 负责单元测试、组件测试和回归测试
- `bench/` 负责场景执行、评分、结果汇总、版本对比，以及给下一轮 agent / generator 提供可消费反馈

当前 V1 覆盖的产品面：

- 网页翻译
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

## How To Run

全量运行：

```bash
pnpm bench
pnpm bench:loop
pnpm bench:task
pnpm bench:pass
pnpm bench:execute
pnpm bench:dispatch

# drill 一个本地演练场景，让 executor 进入 ready
pnpm bench:execute -- --drill-scenario hover/alt-success --drill-reason "Synthetic regression drill"
```

按 surface 过滤：

```bash
pnpm bench --surface hover
pnpm bench --surface page-translation
pnpm bench --surface article-extraction
pnpm bench --surface selection-explain
pnpm bench --surface input-translation
pnpm bench --surface subtitle
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

- `latest.json` 是机器可消费的结构化结果
- `latest.feedback.md` 是给下一轮生成器直接喂入的 handoff 文本
- `latest.handoff.json` 是 generator 优先级队列，包含 regression / improvement / score-delta 信息
- `latest.generator.md` 是可直接贴给 agent 的压缩版执行指令
- `latest.loop.json` 是单轮 loop runner 选出的当前修复队列
- `latest.loop.md` 是单轮 loop runner 的执行任务单
- `latest.patch-task.json` 是单轮 patch pass 的结构化任务定义
- `latest.patch-task.md` 是可直接贴给 generator 的聚焦修复任务单
- `latest.patch-context.json` 是 patch task 相关文件的结构化上下文快照
- `latest.patch-context.md` 是带行号的文件上下文包
- `latest.patch-pass.json` 是单轮 patch 执行摘要
- `latest.patch-pass.md` 是当前回合最直接的 executor brief
- `latest.executor.json` 是受限自动 patch 尝试的门控结果
- `latest.executor.md` 是最终执行或阻断说明
- `latest.dispatch.json` 是外部模型调用尝试的结果
- `latest.dispatch.md` 是外部模型返回或阻断原因

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

当前一共 17 个场景：

- `page-translation`: 3
- `article-extraction`: 3
- `hover`: 3
- `selection-explain`: 2
- `input-translation`: 3
- `subtitle`: 3

这组场景应该保持稳定可复现。如果某次代码修改让分数波动异常，先检查 scenario runtime 或 mock 是否被破坏，再判断是否是真实产品退化。

## Agent Workflow

建议的使用顺序：

1. 运行 `pnpm bench`
2. 运行 `pnpm bench:loop`
3. 先看 `bench-results/latest.loop.json` 或 `bench-results/latest.loop.md`
4. 用 `bench-results/latest.patch-task.md` 作为当前单轮修复任务单
5. 需要代码上下文时，直接看 `bench-results/latest.patch-context.md`
6. 用 `bench-results/latest.patch-pass.md` 作为当前回合最精简的执行 brief
7. 运行 `pnpm bench:execute` 查看当前回合是否允许自动尝试
8. 如果 gate 为 `ready`，运行 `pnpm bench:dispatch`
9. 需要全量上下文时，再看 `bench-results/latest.handoff.json` 和 `bench-results/latest.feedback.md`
10. 只修复失败、退化和低分场景
11. 再运行 `pnpm bench`
12. 最后运行 `pnpm test`

这就是 Astra 当前最小可用的：

```text
generator -> evaluator -> structured feedback -> next generator pass
```

如果当前 bench 已经全绿、没有任何 failure / regression，可用 drill 模式演练整条自动链路：

```bash
pnpm bench:execute -- --drill-scenario hover/alt-success --drill-reason "Synthetic regression drill"
pnpm bench:dispatch
```

drill 模式不会修改真实 benchmark 定义，只会在 loop 层临时把选中的场景强制变成一个 executor-ready 的回合。

如果本地没有 `ASTRA_EXECUTOR_API_KEY`，但你想把外部 dispatch 链完整演练到 `executed`，可以显式传一个 mock 响应：

```bash
pnpm bench:dispatch -- --mock-response "## Summary\nMock executor output"
```

这只用于 harness 演练，不代表真实模型调用。

## Next Likely Upgrades

- baseline import 与外部参考输出对比
- 让外部模型返回可自动应用的结构化 edit plan
- model judge 作为补充维度，而不是主评分器
