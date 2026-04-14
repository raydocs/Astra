# Astra 6-Month Product Roadmap And Execution Plan

_Last updated: 2026-04-13_  
_Planning window: 2026-04-12 → 2026-10-12_  
_Document status: canonical execution plan for the next 6 months_

## 1. What This Plan Is

这不是一份“高层愿景文档”，也不是一份“先写个大概方向，以后再补”的 roadmap。

这份 `plan.md` 要同时承担 4 个角色：

1. Astra 接下来 6 个月的**产品路线图**
2. Astra 接下来 6 个月的**工程执行计划**
3. Astra 接下来 6 个月的**验证与发布节奏说明**
4. Astra 接下来 6 个月的**优先级裁决依据**

如果某件事不在这里，或者和这里冲突，默认不做，或者至少不作为主线做。

本文件的目标不是“描述一个看起来很完整的未来”，而是：

- 让未来 26 周每一周都知道该做什么
- 让每一个主线都有明确交付件与验收标准
- 让 AI 加速的开发过程不把系统带向更多分散 surface 和更多未证明 claim

## 2. Relationship To Other Canonical Docs

本计划是总计划，但以下文档仍然保留更窄范围的 canonical authority：

- 平台支持与对外 claim：`docs/investigations/support-matrix-2026-q2.md`
- 能力级矩阵：`docs/capability-matrix-v2.md`
- 发布与 proof 门禁：`docs/release-readiness-checklist.md`
- live coverage 盘点：`docs/investigations/workstream-a-live-coverage-matrix.md`
- 产品高层方向：`docs/product-roadmap.md`
- auth/mobile/control-plane 后台路线：`docs/investigations/full-auth-and-mobile-next-master-plan-2026-04-12.md`

这份计划与上述文档的关系是：

- 它整合，但不替代这些文档
- 它给出执行顺序、容量安排、交付节奏
- 如果某个细节和窄领域 canonical 文档冲突，先以窄领域文档为准，再回头修本计划

## 3. Planning Premise: Why 6 Months Is Still 6 Months Even With Very Fast AI

用户明确要求：不要把计划写成“AI 10000 token/s，1 小时就做完”的规模。

这个要求是对的。

即使 AI 现在能：

- 快速产出 spec
- 快速产出代码
- 快速补测试
- 快速重写文档

6 个月窗口仍然不能被压缩成几周，原因不是“写代码太慢”，而是以下约束仍然真实存在：

### 3.1 真正的瓶颈不是文本生成

真正的瓶颈是：

- 产品优先级是否正确
- 不同 surface 之间的状态模型是否一致
- 浏览器真实行为是否稳定
- live smoke / CI / bench / loop 是否能持续兜底
- 用户路径是否真的更顺，而不是功能更多
- 发布 claim 是否与实际验证一致

### 3.2 真实软件不是“代码存在”就算完成

Astra 当前已经大量证明这一点：

- 有代码 ≠ 有 release credibility
- 有 deterministic bench ≠ 有 browser-backed proof
- 有 UI ≠ 有 product loop
- 有 control plane ≠ 它不会打断主线

### 3.3 6 个月窗口的真实产能定义

本计划不按“AI 可以一天写多少 token”来估算，而按“软件每周能稳定吸收多少真实变化”来估算。

默认约束如下：

- 每周只允许 **1 个主目标**
- 每周最多加 **1 个次目标**
- 每个月只允许 **1 个新主叙事**
- 任何跨以下 3 类以上的任务都必须按多周预算：
  - extension runtime
  - popup / vocab / review UI
  - reader / subtitle / video
  - Cloudflare / web cloud control plane
  - CI / release harness
  - support matrix / docs / claims

### 3.4 这份计划的“详细”定义

本计划的详细，不是靠写很多空话，而是靠以下内容齐备：

- 明确的北极星
- 明确的 6 个月终局
- 明确的 workstreams
- 明确的月目标
- 明确的双周里程碑
- 明确的每周任务包
- 明确的交付件
- 明确的验收标准
- 明确的依赖关系
- 明确的冻结条件
- 明确的风险与回退规则

## 4. Starting Baseline On 2026-04-12

## 4.1 Product baseline

Astra 不是从 0 到 1，而是从“已有很多 surface，但可信度不均匀”继续向前走。

当前已经真实存在的面：

- 网页翻译
- 文章提取 / article mode
- hover translate
- selection toolbar
- input translation
- popup 控制与学习面
- vocabulary
- reading history
- study progress
- digest / reading assist
- TTS
- subtitle file
- PDF reader
- EPUB reader
- video subtitle adapters
- onboarding / options / web cloud surfaces

## 4.2 Quality baseline

当前 repo 的质量基础比普通扩展项目强，但仍不够：

- deterministic bench 很强
- live proof 与 release-proof lane 正在补齐
- popup deep-read 与 learning-loop 的证明面仍弱于翻译主链
- 对外“为什么 Astra 比竞品更值得用”的叙事还没有被文档和 evidence 完整锁死
- live coverage 不再是零，但仍不够广
- loop / proof / smoke 已存在，但还没成为所有主 surface 的真实 release gate
- 某些 surface 强在代码，弱在真实浏览器证明

## 4.3 Competitor Baseline On 2026-04-13

接下来 6 个月，Astra 不是在真空里前进，而是在至少 3 类竞品压力下前进：

1. `Read Frog`
2. `Sentia Read`
3. `沉浸式翻译`

### Competitor A — Read Frog

以浏览器扩展为主，面向 AI 驱动的语言学习场景。其当前公开 baseline 已经相当明确：

- GitHub `5.2k` stars / `334` forks
- 最新公开 release `v1.32.2`（2026-04-12）
- `GPL-3.0` + commercial dual license
- README badge / 下载入口已覆盖 Chrome / Edge / Firefox
- README feature list 包含：
  - bilingual / translation only
  - context-aware translation
  - selection translation
  - custom prompts
  - batch requests
  - `20+ AI providers`
  - subtitle translation
  - `Text-to-Speech (TTS)`
  - `Read Article`
- `Read Article` 明确强调：基于 Mozilla Readability 提取正文，生成总结与导读，并提供逐句翻译、词汇解释、语法与上下文说明

对 Astra 的意义：

- 它的真正压力不是平台 breadth，而是 article learning 的**直给感**
- 用户很快就能理解“打开文章 -> 读文章 -> 逐句学 -> 查词/讲解”这条主路径
- Astra 若不能把 article learning 做到更直接、更少入口跳转、更易证明，就会在最像自己的对标上显得绕

### Competitor B — Sentia Read

以“阅读器 + 学习器”路线为主，不是纯浏览器翻译插件。其官网当前公开强调：

- 已 shipped `macOS` + `iOS (iPhone / iPad)`
- 当前支持 `EPUB` 与 web article import
- AI contextual definitions 按 `CEFR A1-C2` 调整，并明确使用 `i+1` framing
- visual memory reinforcement
- Mac / iPhone / iPad cloud sync
- `PDF` 与 `YouTube transcription` `coming soon`
- browser extensions `coming soon`

对 Astra 的意义：

- 它的真正压力不是网页内即时翻译，而是“连续学习系统感”
- 它把 definitions、sync、content management、memory reinforcement 放在一个连续产品叙事里
- Astra 若不能让 popup / revisit / owned reading / recent history 给人同一个系统的感觉，就会继续像多个强零件而不是一个连续学习产品

### Competitor C — Immersive Translate

以成熟平台型翻译产品为主。其当前公开 baseline 显示：

- GitHub public release repo `17.5k` stars / `1k` forks
- 最新公开 release `v1.28.2`（2026-04-10）
- 官方下载面覆盖 Chrome / Edge / Firefox / Safari / userscript
- 文档翻译覆盖 PDF / ePub / HTML / TXT / DOCX / Markdown / subtitles
- scanned PDF OCR
- 在线视频字幕翻译，官网宣称覆盖 `100+` 平台
- 在线会议翻译
- 图片翻译 / 漫画翻译
- 划词翻译 / 悬停翻译 / 输入框翻译
- `20+` translation engines

对 Astra 的意义：

- 它的真正压力是 supported-surface breadth 带来的用户预期
- Astra 不应在 6 个月窗口内盲目追它的全能力宽度
- Astra 必须把自己**已经支持**的主场景做得更顺、更诚实、更有 proof depth，否则在对比中既不够广，也不够可信

## 4.4 Astra Relative Position Versus Competitors

截至当前窗口起点，Astra 的相对位置可总结为：

### Where Astra is already stronger

- 比 `Read Frog` 更强调 harness、loop、proof、release credibility
- 比 `Sentia Read` 更接近浏览器内原位学习，而不是离开网页进入独立阅读器
- 比 `沉浸式翻译` 更适合构建“学习闭环 + proof-backed honesty”叙事，而不只是“翻译能力大全”

### Where Astra is still behind

- 比 `Read Frog` 更弱的点：article learning 的直接性、功能前台化、first-run clarity
- 比 `Sentia Read` 更弱的点：内容库感、阅读连续性、session-to-session 的系统感
- 比 `沉浸式翻译` 更弱的点：supported surface breadth、外显 proof depth、市场成熟度

### What Astra must explicitly answer in this window

- 对 `Read Frog`：article learning 必须做到“直接开学”，至少 1 条文章主路径要比它更短、更清楚、更可重放
- 对 `Sentia Read`：recent / progress / revisit / owned reading 之间必须有连续系统感，不能只是有相关数据
- 对 `沉浸式翻译`：每个主叙事 surface 都要有明确 support level、docs、artifacts、claim boundary；supported-surface honesty 本身就是产品能力

### What Astra must not do

- 不要为了追 `沉浸式翻译` 的广度，把 6 个月做成“到处支持一点点”
- 不要为了追 `Sentia Read` 的阅读器形态，过早把主线从 extension 原位学习转成大而全阅读器
- 不要只追 `Read Frog` 的 feature checklist，而忽略 article directness、proof 和 release credibility 这三条 Astra 真正可能赢的线

## 4.5 Backend/control-plane baseline

当前 control-plane 已有明显推进：

- Cloudflare auth/session/device continuity front door 已建立
- account summary / lifecycle / repair / compaction 已有基础
- iOS bridge-first / mobile web cloud 路径已有口径

但它仍然不是完全 boring infrastructure：

- auth/account/usage/control-plane 仍可能抢主线资源
- 某些 authority 仍不该在这 6 个月内继续大扩

## 4.6 Learning-loop baseline

当前 learning loop 不再是概念，已经有实际能力：

- 词汇保存
- 阅读历史
- study progress
- review 基础
- popup digest
- article excerpt
- 逐句讲解
- 逐句保存
- 逐句朗读

但它还不是“一个成型产品循环”，因为仍缺：

- 明确的入口收敛
- 更强的 revisit 流程
- vocab / review / popup / reader 之间的统一状态解释
- 更强的 browser-backed proof

## 5. End State On 2026-10-12

6 个月结束时，Astra 必须达到以下终局，而不是停留在“功能更多了”。

## 5.1 Product end state

- Astra 的桌面 extension 核心面变成可信日常工具
- learning loop 从零散功能变成清晰循环：
  - read
  - explain
  - save
  - review
  - revisit
- owned reading surfaces 从“仓库里有实现”变成“产品上有统一理解”
- video/subtitle 从“若干 adapter”变成“受支持的次级产品线”

## 5.2 Operational end state

- 核心 surface 都有更强的 browser-backed proof
- 发布时能清楚说出每个 claim 的证据来源
- auth/account/control-plane 的不确定性显著下降
- 支持矩阵、capability matrix、release gates、README 之间基本一致

## 5.3 Quality end state

到 2026-10-12，以下结论应该成立：

- popup 深读核心路径有稳定 smoke
- article extraction 有分类明确的失败模型与覆盖
- hover / selection explain 不再只是 JSDOM 强
- vocab/review/revisit 有至少一组端到端路径
- PDF / EPUB / subtitle / video 各自都有最小可信 lane
- release checklist 能真正阻断不该发布的版本

## 6. North-Star Goals For The Window

整个 6 个月只有 6 个北极星，不再额外开第 7 个。

1. **把现有 extension 主面证明出来**
2. **把 learning loop 做顺并做实**
3. **把 owned reading 做成明确产品线**
4. **把 video/subtitle 做成可信次级产品线**
5. **把 control-plane 降为背景系统**
6. **把 release discipline 固化**

## 6.1 Competitive Win Conditions

这 6 个北极星还必须转换成对竞品的具体赢法：

- 对 `Read Frog`：Astra 必须在 article learning 的直接性上形成可感知优势，至少 1 条文章主路径做到 `open -> explain -> save -> review/revisit` 明确、少跳转、可重放。
- 对 `Sentia Read`：Astra 不复制独立阅读器路线，但必须让 popup / history / revisit / owned reading 呈现同一套学习连续性，让用户感觉自己在一个系统里，而不是工具箱里。
- 对 `沉浸式翻译`：Astra 不追全能力广度，但所有对外主张的主 surface 都必须有 support level、docs、artifacts、gate 依据，做到 supported-surface honesty + proof depth。

本窗口明确不做：

- 不把更多 provider 作为主竞争策略
- 不把追平全部文件格式/平台作为 6 个月目标
- 不把独立阅读器作为主叙事替代 extension 主场景

## 7. Success Metrics

## 7.1 Product metrics

每周追踪：

- page translation starts
- article-mode starts
- selection explain actions
- popup sentence explain actions
- popup sentence save actions
- vocabulary saves
- review completions
- revisit opens
- reader opens by surface:
  - PDF
  - EPUB
  - subtitle-file
- video subtitle sessions by adapter

## 7.2 Quality metrics

每周追踪：

- smoke pass rate by lane
- live pass rate by surface
- open flaky lane count
- article extraction failure count by class
- subtitle adapter failures by site
- popup deep-read regression count
- unsupported-but-claimed surface count

## 7.3 Control-plane metrics

每周追踪：

- auth issuance failures
- session refresh failures
- account summary / usage failures
- export / delete / repair failures
- web cloud UI error count

## 7.4 Release metrics

每次 release candidate 追踪：

- blockers open
- must-fix bugs open
- downgraded claims count
- newly added live lanes this cycle
- surfaces released without browser proof

## 8. Planning Constraints And WIP Rules

## 8.1 Hard WIP limits

- 同时进行中的主 epic 不超过 2 个
- 同时处于“边实现边改验收标准”的 epic 不超过 1 个
- 不在同一周同时启动：
  - 新 reader surface
  - 新 backend authority
  - 新 CI/release lane

## 8.2 Freeze rules

以下情况触发冻结：

- 连续 2 周出现 release smoke 回归
- open blockers > 5
- flaky lane count 连续 2 周上升
- support matrix 与实际 smoke 明显冲突
- control-plane incident 连续两周打断主线

冻结动作：

- 暂停新 feature
- 专门用 1 周清 flaky / proof / regression
- 重新裁决下一月的主线

## 8.3 Done criteria

任何任务只有同时满足下列条件才算完成：

1. 代码已合入或在本地完整落地
2. 对应测试、smoke、bench 或 docs 已更新
3. 行为边界在 UI/文档/状态上可解释
4. 不需要靠口头记忆说明“这里其实还有坑”

## 9. Roadmap Structure

接下来 6 个月分成 6 个 roadmap themes：

### Month 1

**Theme:** prove the current extension core

### Month 2

**Theme:** finish learning-loop v1

### Month 3

**Theme:** unify owned reading entry model

### Month 4

**Theme:** make video/subtitle + revisit credible

### Month 5

**Theme:** reduce control-plane drag

### Month 6

**Theme:** harden, freeze, and publish honestly

## 10. Workstreams

本计划按 8 条 workstream 管理，不再散着推进。

### Workstream A — Extension Core Proof

目标：

- page translation
- article extraction
- hover
- selection explain
- input translation

要从“已实现”推进到“有 browser-backed proof”。

关键目录：

- `src/entrypoints/content/*`
- `src/entrypoints/background/index.ts`
- `bench-live/*`
- `src/utils/translate/*`

### Workstream B — Learning Loop

目标：

- popup 深读
- vocabulary
- reading history
- study progress
- review
- revisit

要从“零件齐”推进到“用户路径顺、连续学习感成立”。

关键目录：

- `src/entrypoints/popup/*`
- `src/entrypoints/vocabulary/*`
- `src/utils/storage/*`
- `src/utils/reading/*`
- `src/utils/tts.ts`

### Workstream C — Owned Reading

目标：

- article import / queue
- PDF
- EPUB
- subtitle file

要从“多个 surface”推进到“一个清楚产品线和连续回看入口”。

关键目录：

- `src/entrypoints/pdf-reader/*`
- `src/entrypoints/epub-reader/*`
- `src/entrypoints/subtitle-reader/*`
- `src/entrypoints/content/translation-context.ts`

### Workstream D — Video And Subtitle

目标：

- YouTube
- Bilibili
- 其他代表性 adapter
- subtitle revisit

要从“adapter 实现”推进到“可信 coverage + 诚实 claim”。

关键目录：

- `src/entrypoints/content/video-platforms/*`
- `src/entrypoints/subtitle-reader/*`
- `bench-live/scenarios/*subtitle*`

### Workstream E — Control Plane

目标：

- auth/session
- account/usage/plan
- lifecycle
- mobile web / iOS bridge proof

要从“仍常打断主线”推进到“低噪音背景系统”。

关键目录：

- `platform/cloudflare/*`
- `server/*`
- `web/*`
- `src/utils/astra/*`

### Workstream F — Release Credibility

目标：

- live coverage
- smoke lanes
- CI required gates
- release checklist
- support matrix alignment

关键目录：

- `.github/workflows/*`
- `bench-live/*`
- `docs/release-readiness-checklist.md`
- `docs/investigations/workstream-a-live-coverage-matrix.md`

### Workstream G — Privacy / Routing / Quality

目标：

- privacy assertions
- routing/fallback clarity
- bad-output rejection
- glossary consistency

关键目录：

- `src/utils/privacy*`
- `src/utils/providers/*`
- `src/utils/translate/*`
- `src/entrypoints/background/index.ts`

### Workstream H — Activation / Product Coherence

目标：

- onboarding
- options
- popup 信息架构
- settings discoverability
- 学习路径入口收敛
- supported / beta / experimental 边界说明

要从“入口分散”推进到“用户知道下一步做什么、当前支持什么”。

关键目录：

- `src/entrypoints/onboarding/*`
- `src/entrypoints/options/*`
- `src/entrypoints/popup/*`

## 11. Month-By-Month Roadmap

## Month 1 — Prove The Current Extension Core

### Month goal

把最核心的 extension 能力从“多数 deterministic 很强”推进到“主要用户面至少有最小 browser-backed credibility”。

### Mandatory outcomes

- article extraction proof 明显增强
- hover / selection explain 的浏览器验证不再是空白
- popup 深读面进入可验证范围
- release checklist 与真实风险更贴近

### Major epics

1. 核心 smoke lane 清理与命名统一
2. article extraction 失败分类与场景补齐
3. hover / selection browser smoke 第一波
4. popup deep-read 行为统一与测试增强

### Deliverables

- [x] 更新 live coverage matrix
- [x] 新增/修复 smoke lanes
- [x] 明确 article extraction failure taxonomy
- [x] popup deep-read 状态机收敛

### Acceptance

- [x] 核心 4 面（article extraction / popup 深读 / hover / selection explain）中，至少 3 面已有可重放 browser-backed path，且其中必须包含 article extraction 与 popup 深读
- [x] live coverage matrix、release checklist、Month 1 closeout memo 已同步；hover / selection 的 required-vs-optional policy 有书面结论（见 `docs/release-readiness-checklist.md`）
- [x] major carry-over 最多 1 项，且不得仍存在“核心 surface 完全没有浏览器路径”的空白

### Harness 打分（`pnpm bench`，2026-04-13）

- **结果**：63 / 63 场景通过，**平均分 100**，报告 `bench-results/latest.json`
- **说明**：此为 deterministic bench harness；与 `13G` 月度五维并行记录，不作为唯一 gate。

## Month 2 — Finish Learning-Loop V1

### Month goal

把“读、讲解、保存、复习、回看”真正做成产品循环。

### Gate-ready layers（本月收口必须分三层报状态）

- `implemented`：代码与 UI 已合入，本地可演示
- `proved`：有可重放 smoke/live/bench 与 artifact 路径，失败可分类
- `gate-ready`：已写入 live coverage matrix、release checklist（若 learning-loop 升为 required）、metrics 定义与 Month 2 closeout，满足 §14 End Of Month 2 Gate

Orchestrator 月末判分时，只有 `gate-ready` 才能计为本月主线完成；`implemented` 或 `proved` 单独成立不得替代 gate。

### Mandatory outcomes

- popup 深读可顺手完成
- save 后能进入 review / revisit
- study progress 变成用户可见状态
- vocab/review/source-context 更连贯

### Major epics

1. popup 深读第一版收口
2. vocab / review / source-context 打通
3. study progress UI 化
4. learning loop QA 波次

### Deliverables

- [x] popup 状态统一
- [x] vocab 来源信息增强
- [x] review 页与 popup/revisit 的关系更清楚
- [x] end-to-end learning loop smoke（`bench-live` + `pnpm bench:live:lane:learning-loop`）

### Required evidence（月末 evidence registry 最低集，缺一则不得判 `pass`）

对齐 `13O` / `13Q` Month 2 段，本月 closeout 必须能指到：

- `live`：`learning-loop` lane 可重跑记录 + artifact 路径；`popup-deep-read-proof` 稳定历史至少 1 次绿跑摘要
- `docs`：`learning-loop overview`（或等价单页）+ source-context / progress 字段说明；若 gate 变化则 release checklist diff
- `release-policy`：learning-loop 是否纳入 required evidence 的明确结论与模板行（见 Workstream F Detailed Matrix）
- `claim-impact`：learning-loop 能力边界说明（明确尚未承诺项，避免对外 over-claim）
- `tests`：与 vocab/review/progress 相关的单测或集成测变更清单及 pass 状态

### Acceptance

- [x] 至少 1 条 `page/article -> explain -> save -> review -> revisit` 可重放证据链在真实环境中走通（live：`popup-deep-read-proof` + `vocabulary-srs-smoke`）
- [x] popup 与至少 1 个 downstream surface（vocab / review / revisit）对 source-context 与 progress 的呈现一致（已知：review 侧重 SRS 卡片序，与 popup 全页 loop 展示为有意分层）
- [x] learning-loop lane、metrics 定义已同步至文档（`docs/investigations/learning-metrics-2026-04-13.md`、`learning-loop-overview-2026-04-13.md`、`learning-loop-regression-checklist-2026-04-13.md`）；**Month 2 closeout**：`docs/investigations/month-2-closeout-2026-04-14.md`；carry-over 见该文档与 `month-1-closeout-2026-04-13.md`

### Harness 打分（`pnpm bench`，2026-04-14）

- **结果**：63 / 63 场景通过，**平均分 100**，`bench-results/latest.json`（run `2026-04-13T20-34-22-926Z`，本地执行；该目录 gitignore，以你机器/CI 产物为准）

### Carry-over discipline（与 `13K` / `13I` 优化 4 对齐）

- 本月最多 **1** 个主项可 carry 至 Month 3 Week 1-2；须在 closeout 中写清 owner、最晚关闭日、是否阻塞 owned reading schema
- **不得**连续两月 carry 同一主项（例如「review 仍无 browser smoke」若 Month 2 carry，则 Month 3 前半必须关闭或降级 scope）
- 若 Month 1 以 `pass-with-carry` 结束：Month 2 Week 1 优先消化 Month 1 carry（popup deep-read proof / hover-selection policy），再展开 vocab/revisit 扩展，避免双主线并行稀释 proof

## Month 3 — Unify Owned Reading Entry Model

### Month goal

不继续零散推 reader，而是先统一模型、入口、状态与证明方式。

### Mandatory outcomes

- owned reading item 模型落地
- article / PDF / EPUB / subtitle 的入口逻辑更清楚
- saved reading / queue / revisit 成型
- reader smoke 开始具备连续性

### Major epics

1. owned reading item model
2. article import / saved reading queue
3. PDF / EPUB stabilization
4. reader/revisit 组合验证

### Deliverables

- 统一的数据模型与入口说明
- 至少一个队列/回看入口
- reader smoke 与 revisit smoke

### Acceptance

- owned reading item schema / entry-state doc 已落地，并映射进 article + 至少 2 类 reader surface
- queue / revisit 至少能重开 2 种 source type，并保留 title/source metadata + recent/progress state
- 至少 3 条 reader/revisit 可重放 artifact 已存在，且不靠新增 surface 掩盖模型未收口

### Month 3 执行快照与规范落地（2026-04-15）

- [x] **Owned reading 数据模型**：`docs/investigations/owned-reading-item-spec-2026-04-15.md`（`OwnedReadingItem` 字段、与 reading history / study progress / vocab 关系、sync 边界）
- [x] **Saved reading queue v0 说明**：`docs/investigations/saved-reading-queue-spec-2026-04-15.md`（Recent / Saved / In-progress 规则与 v0 与现有入口的映射）
- [x] **队列与 OwnedReadingItem 持久化（article v0）**：`src/utils/storage/owned-reading.ts`（`astra.owned_reading.v1`）+ 扩展页 **Reading** 标签（Recent / Saved / In progress、Open、状态）；页译结束时写入队列；PDF / EPUB / subtitle-file 仍走各自 reader，未并入同一队列 UI
- [x] **Reader 可重放基线（现有）**：`bench-live` 已含 `pdf-reader-basic`、`epub-reader-basic` 等（见 `bench-live/scenarios/index.ts`）；Month 3 验收的「3 条 artifact」在代码合并后应绑定具体 run id 写入 closeout

### Harness（Month 3）

- 与 Month 2 相同：**`pnpm bench`** 为全仓 deterministic 回归（63 场景）；**reader 专项**以 `bench-live` 场景为准，不要求与 Month 3 schema 同一 PR 内完成。

### Month 3 AI Task Ledger 打勾（2026-04-15）

| 区间 | P | 状态 |
|------|---|------|
| 1–7（model pack） | P0/P2 | [x] 规范见 `owned-reading-item-spec-2026-04-15.md`（含 P2 sync 边界节） |
| 8–10（queue 最小 + 分类 + 恢复） | P0 | [x] article：`owned-reading.ts` + Vocabulary「Reading」；与 reading history 合并去重 |
| 11–13 | P1/P2 | [ ] 队列增强（学习状态 badge / 排序筛选） |
| 14–20（PDF pack） | P0/P2 | [ ] 以 `bench-live`/扩展内 smoke 为准，逐项补 closeout |
| 21–27（EPUB pack） | P0/P2 | [ ] 同上 |
| 28–33（revisit + evidence） | P0/P2 | [ ] article/PDF/EPUB revisit 场景与 artifact 命名规范待绑定 CI |

## Month 4 — Make Video / Subtitle And Revisit Credible

### Month goal

让 video/subtitle 不再只是 adapter 集合，而是受控、可解释、可验证的产品线。

### Mandatory outcomes

- YouTube + 1 个次级 adapter 的 smoke 更稳
- subtitle file 与网页字幕路径能讲清边界
- revisit 到视频/字幕内容的路径更顺
- support matrix 对视频 claim 更保守也更准确

### Major epics

1. video/subtitle support inventory
2. YouTube + secondary adapter hardening
3. subtitle reader 与 imported subtitle 打通
4. video/revisit proof wave

### Deliverables

- site-by-site 风险清单
- 两个 adapter 的最小可信 lane
- subtitle revisit 场景

### Acceptance

- YouTube + 1 个次级 adapter 各有 1 条可重复 smoke，artifact 与 failure note 齐全
- subtitle file 与至少 1 条网页视频字幕路径都能进入 explain/save/revisit 资产链中的至少 1 条可重放路径
- support matrix / release checklist 已把视频相关 claim 标成 supported / best-effort / experimental（或等价等级），不再笼统写“支持视频”

### Month 4 执行快照与清单（2026-04-15）

- [x] **Adapter 全量清单 + proof level + failure modes**：`docs/investigations/video-subtitle-adapter-inventory-2026-04-15.md`（代码路径：`src/entrypoints/content/video-platforms/`）
- [x] **Support matrix 视频附录**（claim 分级）：`docs/investigations/support-matrix-video-addendum-2026-04-15.md`（与 `support-matrix-2026-q2.md` 联读）
- [ ] **YouTube + Bilibili 双 smoke 绿跑摘要**：YouTube 沿用 `bench-live/youtube-subtitle-basic`；Bilibili 已加骨架场景 `bench-live/bilibili-subtitle-basic`（fixture HTML + Playwright）；两条均需在目标环境跑出 artifact run id 后勾 `gate-ready`
- [ ] **Subtitle file 全链路 revisit**：依赖 Month 3 `OwnedReadingItem` 存储落地

### Harness（Month 4）

- Deterministic：**`pnpm bench`**（含 subtitle / provider 等面）
- Live：在 inventory 中锁 **YouTube + Bilibili** 为 Month 4 主防线后再扩展 lane

### Month 4 AI Task Ledger 打勾（2026-04-15）

| 区间 | P | 状态 |
|------|---|------|
| 1–5（inventory） | P0 | [x] 见 `video-subtitle-adapter-inventory-2026-04-15.md` |
| 6–10（YouTube） | P0/P1 | [ ] smoke 稳定化与 failure class 文档化（与现有 bench-live 对齐） |
| 11–15（次级 adapter） | P0/P2 | [x] Bilibili：`bench-live/bilibili-subtitle-basic`（面板 fixture smoke）；[ ] 真实站 DOM drift 与 failure class 文档化 |
| 16–20（subtitle-reader） | P0/P2 | [ ] 与 vocab/revisit 联动待实现 |
| 21–25（revisit） | P0/P2 | [ ] |
| 26–30（claim） | P0/P2 | [x] matrix 附录 + `release-readiness-checklist.md` Gate 4 已加 video/subtitle 审查行（默认 No，视频 RC 升为 Yes） |

## Month 5 — Reduce Control-Plane Drag

### Month goal

后台继续进，但目标不是“再开新后台故事”，而是让它不抢产品主线。

### Mandatory outcomes

- account / usage / plan 呈现收敛
- lifecycle operations 更稳
- mobile web / iOS bridge 口径和证据更一致
- operator 能快速解释常见后台失败

### Major epics

1. account/control-plane inventory cleanup
2. account/usage coherence
3. lifecycle operations hardening
4. mobile web / iOS bridge proof wave

### Deliverables

- account state 对齐
- lifecycle runbook 更新
- mobile claim 与文档收敛

### Acceptance

- extension / web cloud / mobile/iOS bridge 至少 3 个对用户可见面，对 account / usage / plan 的 wording 与状态来源一致
- lifecycle runbook 覆盖 export / delete / repair / revoke 当前状态；其中至少 2 条高风险流程有可重放 proof
- Month 5 closeout 能明确说明 remaining control-plane noise、owner、carry-over；major carry-over 最多 1 项

### Month 5 执行快照与后台清单（2026-04-15）

- [x] **Node-owned 控制面路由清单**：`docs/investigations/control-plane-surface-inventory-2026-04-15.md`
- [x] **Lifecycle 操作 runbook 附录**（export/delete/repair/revoke 期望与 copy 规则）：`docs/investigations/lifecycle-operations-runbook-month5-2026-04-15.md`
- [ ] **三端文案完全对齐**：需在 extension popup/options、`web`、文档中逐屏 diff（本提交仅锁 inventory + runbook）
- [ ] **mobile web / iOS bridge smoke**：沿用 `ios/README.md` + web narrow viewport checklist；证据入库后勾验收

### Harness（Month 5）

- 与翻译核心相同：**`pnpm bench`**；控制面以 **`pnpm test`** 中含 `astra-web` / account client 用例 + 手工或 live 账号路径为主。

### Month 5 AI Task Ledger 打勾（2026-04-15）

| 区间 | P | 状态 |
|------|---|------|
| 1–5（inventory + 文案规则） | P0/P1 | [x] inventory 文档；**UI copy 对齐** [ ] |
| 6–12（lifecycle） | P0/P1 | [x] runbook 附录；**各流程 smoke** [ ] |
| 13–17（mobile/iOS） | P0/P1 | [ ] |
| 18–22（background） | P0/P2 | [ ] incident 分类 + operator note 待补 |
| 23–26（release） | P0/P2 | [ ] checklist 增 control-plane evidence 行；matrix 移动口径二次核对 |

## Month 6 — Harden, Freeze, Publish Honestly

### Month goal

最后一个月不是再开新坑，而是收敛证据、质量、支持口径和发布纪律。

### Mandatory outcomes

- privacy/routing/quality inventory 补齐
- release checklist 真正阻断风险
- support matrix / capability matrix / README / release notes 口径一致
- 下个窗口从 evidence 出发，而不是从印象出发

### Major epics

1. privacy assertions wave
2. routing/failure transparency wave
3. release gate tightening
4. debt burn-down + next-window handoff

### Deliverables

- privacy/routing map
- tightened release checklist
- final evidence pack
- next-window planning input

### Acceptance

- 最新 RC judgment 时 `required` lanes 无未解释的 failure；若有 fail，直接作为 release blocker 记录
- final evidence pack 包含：required-lane summary、open blockers、claim diff、next-window handoff
- support matrix / capability matrix / README / release notes 在同一 release cycle 内同步更新，未证明 claim 一律降级或移除

## 12. 13 Biweekly Milestones

6 个月按 13 个双周里程碑管理。每个双周必须有可展示的、可验证的增量。

### Milestone 1 (Weeks 1-2)

主题：baseline and release-proof cleanup

必须完成：

- 重写主计划
- 更新 release checklist
- 更新 live coverage matrix
- lane naming / flaky inventory

### Milestone 2 (Weeks 3-4)

主题：article extraction + hover/selection proof

必须完成：

- article extraction failure taxonomy
- 至少 1 条 hover/selection browser lane
- 对应 docs 更新

### Milestone 3 (Weeks 5-6)

主题：popup deep-read + review join-up

必须完成：

- popup 深读状态统一
- vocab/review/source-context 打通
- popup 深读 smoke

### Milestone 4 (Weeks 7-8)

主题：study progress productization

必须完成：

- study progress 可见化
- 学习 loop e2e lane
- 月度 learning-loop gate 通过

### Milestone 5 (Weeks 9-10)

主题：owned reading model + reader stabilization

必须完成：

- owned reading item 模型
- PDF/EPUB smoke 第一波
- reader entry draft

### Milestone 6 (Weeks 11-12)

主题：saved reading / revisit

必须完成：

- saved reading / queue 最小实现
- article/PDF/EPUB revisit smoke

### Milestone 7 (Weeks 13-14)

主题：video baseline + key adapters

必须完成：

- video support inventory
- YouTube + 1 个 secondary adapter smoke

### Milestone 8 (Weeks 15-16)

主题：subtitle-reader + video revisit

必须完成：

- subtitle file 学习路径
- video/subtitle revisit wave

### Milestone 9 (Weeks 17-18)

主题：control-plane surface alignment

必须完成：

- account/control-plane inventory cleanup
- account/usage coherence improvements

### Milestone 10 (Weeks 19-20)

主题：lifecycle + mobile proof

必须完成：

- export/delete/repair/revoke 状态更稳
- mobile web / iOS bridge 证据补齐

### Milestone 11 (Weeks 21-22)

主题：privacy wave

必须完成：

- privacy assertions map
- 核心 surface request-sanitization 校验

### Milestone 12 (Weeks 23-24)

主题：routing transparency + release gate tightening

必须完成：

- routing/failure transparency improvements
- 更严格的 release gate

### Milestone 13 (Weeks 25-26)

主题：burn-down and handoff

必须完成：

- debt burn-down
- final evidence pack
- next-window inputs

## 13. Weekly Execution Plan (26 Weeks)

下面是逐周计划。每周按：

- primary objective
- concrete work packages
- artifacts
- validation
- exit criteria

来定义。

### Week 1 — Freeze scope and establish baseline

Primary objective:

- 冻结 6 个月窗口的边界

Concrete work packages:

- 重写 `plan.md`
- 更新 `docs/investigations/workstream-a-live-coverage-matrix.md`
- 标记当前所有主要 surface 的 proof level
- 列出未来 12 周严禁新增的主线

Artifacts:

- 新版主计划
- updated coverage matrix
- freeze list

Validation:

- 当前 CI / bench / loop 都能跑通

Exit criteria:

- 能用一页说明接下来 4 周只做什么，不做什么

### Week 2 — Clean required release proof

Primary objective:

- 先处理最影响发布信心的 lane 结构问题

Concrete work packages:

- 统一 smoke lane naming
- 清 flaky inventory
- 把 popup/article/hover/selection 的 proof 等级写回 docs
- 更新 release checklist 中的 required gates

Artifacts:

- lane naming table
- flaky list
- release checklist diff

Validation:

- CI 失败时能快速映射到具体 surface

Exit criteria:

- 发布讨论不再先花时间解释 lane 是什么

### Week 3 — Harden article extraction

Primary objective:

- 提升 article extraction 可信度

Concrete work packages:

- 补 docs / blog / forum / landing page 提取场景
- 定义失败分类：
  - empty
  - under-extracted
  - over-extracted
  - wrong-root
- 更新 article extraction 相关 smoke/harness

Artifacts:

- failure taxonomy
- scenario additions
- notes on expected extraction roots

Validation:

- 新场景可重跑

Exit criteria:

- article mode 不再只靠手感判断

### Week 4 — Hover and selection proof wave

Primary objective:

- 给 hover / selection explain 增加最小 browser proof

Concrete work packages:

- 实现/补齐 hover browser lane
- 实现/补齐 selection explain browser lane
- 覆盖 copy/save/explain 的最小状态
- 记录 console/network failures

Artifacts:

- browser lane artifacts
- screenshots
- updated docs

Validation:

- 至少一个 explain/save 主流程可在浏览器里验证

Exit criteria:

- hover / selection 不再完全依赖 JSDOM 自信

### Week 5 — Popup deep-read v1 close-out

Primary objective:

- 让 popup 深读成为可用小产品

Concrete work packages:

- 统一句卡、朗读、讲解、保存状态机
- 清理重复状态
- 明确 cache / loading / saved / selected 行为
- 统一文案与入口

Artifacts:

- popup state machine doc
- popup tests
- UI polish pass

Validation:

- popup tests green
- 手动 smoke 可从 popup 走完整最小学习链

Exit criteria:

- popup 学习面不再只是“堆按钮”

### Week 6 — Join popup output with vocab/review

Primary objective:

- 让 popup 的学习结果真正进入资产系统

Concrete work packages:

- 保存来源信息到 vocab
- review 展示来源上下文
- reading history / vocab / review 跳转逻辑整理
- 打通 popup → vocab/review

Artifacts:

- source-context schema adjustments
- review UI changes
- smoke notes

Validation:

- 保存后能在 vocab/review 找回

Exit criteria:

- “save” 真正指向后续学习

### Week 7 — Productize study progress

Primary objective:

- 让 study progress 变成用户可理解状态，而不是隐形字段

Concrete work packages:

- 明确 per-page progress definition
- popup / vocab / review 对 completed steps 的一致展示
- 加入 revisit hints

Artifacts:

- study progress display rules
- UI updates
- docs update

Validation:

- 关键学习事件能在 UI 中被看见

Exit criteria:

- study progress 对用户有意义

### Week 8 — Learning-loop QA and gate

Primary objective:

- 用一周专门压 learning-loop 的回归风险

Concrete work packages:

- popup deep-read smoke
- save/review/revisit smoke
- learning-loop metrics wiring
- bug burn-down

Artifacts:

- smoke artifacts
- bug list
- metrics list

Validation:

- 至少一条 e2e path 从读内容到 review 成立

Exit criteria:

- Month 2 gate 可通过

### Week 9 — Define owned reading item model

Primary objective:

- 给 article / PDF / EPUB / subtitle 一个统一 entry model

Concrete work packages:

- 设计 owned reading item schema
- 定义 source/type/title/url/progress/lastOpened
- 确认不同 surface 如何映射
- 文档化数据模型与 migration 路线

Artifacts:

- schema doc
- implementation plan
- dependency map

Validation:

- 不与现有 storage/reader 冲突

Exit criteria:

- 后续 reader 工作有统一对象可依赖

### Week 10 — PDF/EPUB stabilization

Primary objective:

- 先把最重要 reader 面稳定下来

Concrete work packages:

- PDF startup / render / basic translate smoke
- EPUB startup / chapter nav / basic translate smoke
- 处理空文档/加载失败/大文件基本异常

Artifacts:

- reader smoke artifacts
- issue list
- support notes

Validation:

- 至少 1 条 reader lane 稳定

Exit criteria:

- reader 不再只是手动体验功能

### Week 11 — Build saved reading / queue v1

Primary objective:

- 做出“稍后回来继续”的最小系统

Concrete work packages:

- article import 或 save-to-reading queue
- recent / saved / in-progress 状态整理
- 页面回访命中正确上下文

Artifacts:

- queue UI
- storage behavior
- docs

Validation:

- 离开后回来仍能恢复上下文

Exit criteria:

- Astra 开始拥有持久学习资产入口

### Week 12 — Reader/revisit proof wave

Primary objective:

- 把 owned surfaces 与 revisit 组合进证据体系

Concrete work packages:

- article revisit scenario
- PDF revisit scenario
- EPUB revisit scenario
- queue/progress/vocab 组合 smoke

Artifacts:

- 2+ reader/revisit lanes
- screenshots
- checklist updates

Validation:

- 至少 2 条 owned-surface 场景可重放

Exit criteria:

- Month 3 gate 可通过

### Week 13 — Video support inventory

Primary objective:

- 清楚界定 video/subtitle 的真实支持边界

Concrete work packages:

- 列所有 adapters 与实际 proof
- 标记 supported / best-effort / code-only
- 列关键 failure modes

Artifacts:

- video support inventory
- risk sheet

Validation:

- support matrix 与库存不冲突

Exit criteria:

- 不再对 video 支持做含糊判断

### Week 14 — Harden YouTube + one secondary adapter

Primary objective:

- 先把最重要的两个 adapter 做稳

Concrete work packages:

- YouTube smoke 扩张
- Bilibili 或次级 adapter smoke
- 字幕加载失败/刷新/切换失败处理

Artifacts:

- adapter smoke runs
- bug fixes
- site notes

Validation:

- 两个 adapter 都能稳定重放

Exit criteria:

- 至少 2 个平台可被可信回归保护

### Week 15 — Subtitle-reader integration

Primary objective:

- 把 subtitle file 学习路径接进主系统

Concrete work packages:

- subtitle-reader 导入/切句/保存/回看整理
- 与 vocab/review/source-context 对齐
- revisit flow 衔接

Artifacts:

- subtitle-reader updates
- docs
- smoke

Validation:

- subtitle file 能走完整学习链

Exit criteria:

- video learning 不再只靠网页 adapter

### Week 16 — Video/revisit proof wave

Primary objective:

- 正式把 video/subtitle 接进 release proof

Concrete work packages:

- 至少 2 条 video/subtitle live smoke
- revisit to subtitle content
- 更新 release checklist 中的 video lines

Artifacts:

- smoke artifacts
- checklist update
- support notes

Validation:

- 有明确 video regression detection

Exit criteria:

- Month 4 gate 可通过

### Week 17 — Control-plane inventory cleanup

Primary objective:

- 先弄清后台还剩哪些真问题

Concrete work packages:

- 列 Node-owned critical surfaces
- 列 extension/web 依赖的 account/usage/plan data shape
- 标出最常见打断主线的 control-plane failure

Artifacts:

- inventory doc
- dependency map
- triage board

Validation:

- 能精确回答后台剩余问题的优先级

Exit criteria:

- control-plane 不再无边界扩张

### Week 18 — Account / usage coherence

Primary objective:

- 统一 account / usage / summary / plan 呈现

Concrete work packages:

- web cloud 页面对齐 account/usage
- extension 依赖的 account state 收敛
- plan/usage 文案与来源对齐

Artifacts:

- UI updates
- docs
- source-of-truth notes

Validation:

- 同一账号在不同 surface 不说不同的话

Exit criteria:

- account 面从“能用”变成“可解释”

### Week 19 — Lifecycle hardening

Primary objective:

- 处理 export/delete/repair/revoke 等动作的稳定性

Concrete work packages:

- 补状态提示
- 补失败恢复路径
- 更新 runbook
- 补 destructive/non-destructive smoke

Artifacts:

- runbook update
- lifecycle smoke
- error-state UI

Validation:

- 生命周期动作失败不会把用户状态变成黑盒

Exit criteria:

- 生命周期可信度提升

### Week 20 — Mobile web / iOS bridge proof wave

Primary objective:

- 保持诚实移动口径，同时把可用部分证明出来

Concrete work packages:

- mobile web / narrow viewport smoke
- iOS bridge checklist 更新
- 明确 supported / beta / experimental wording

Artifacts:

- mobile smoke results
- iOS bridge checklist
- support matrix changes if needed

Validation:

- 移动端口径与 repo 现实一致

Exit criteria:

- Month 5 gate 可通过

### Week 21 — Privacy/routing/quality inventory

Primary objective:

- 先盘清 guardrails 缺口

Concrete work packages:

- privacy assertions inventory
- routing/fallback telemetry inventory
- bad-output rejection inventory
- glossary consistency inventory

Artifacts:

- system map
- gap list

Validation:

- 能说清哪些 surface 已有 guardrails，哪些没有

Exit criteria:

- 接下来 quality 工作有地图，不是散修

### Week 22 — Privacy wave

Primary objective:

- 把 privacy 从“局部能力”推进到“更接近 blocking property”

Concrete work packages:

- 核心 surface 的 privacy assertions 补齐
- popup/selection/reader/subtitle request context audit
- docs 更新

Artifacts:

- tests
- docs
- audit notes

Validation:

- privacy mode 下关键 surface 不越界

Exit criteria:

- privacy 不再主要靠代码审美自信

### Week 23 — Routing and failure transparency

Primary objective:

- 让 routing / fallback / failure behavior 更可解释

Concrete work packages:

- routing metadata 收敛
- provider failure / parse failure / quota failure 分类更清楚
- operator-visible failure history 或 summary

Artifacts:

- logs/metadata updates
- UI or docs updates

Validation:

- 故障定位时间下降

Exit criteria:

- “AI 不稳定”不再是最常见归因

### Week 24 — Tighten release gates

Primary objective:

- 把前 5 个月的证据变成真正的发布纪律

Concrete work packages:

- 更新 release checklist 为 blocking structure
- 对齐 support matrix / smoke / live / README claims
- 降级或删除无法证明的强 claim

Artifacts:

- checklist diff
- support matrix diff
- claim audit

Validation:

- 每个 release candidate 都能明确说明已证明和未证明内容

Exit criteria:

- 发布判断不再主要靠主观信心

### Week 25 — Debt burn-down

Primary objective:

- 专门清高杠杆残债

Concrete work packages:

- 清 flaky
- 补文档断层
- 关伪入口
- 处理高影响小 bug

Artifacts:

- bug burn-down list
- cleaned docs

Validation:

- 本周不新增叙事

Exit criteria:

- 系统复杂度未失控

### Week 26 — Final evidence pack and handoff

Primary objective:

- 为下一个窗口准备可靠起点

Concrete work packages:

- 更新：
  - `plan.md`
  - support matrix
  - release readiness checklist
  - capability matrix
- 生成 6 个月复盘：
  - accomplished
  - deferred
  - unproven
  - next-window candidates

Artifacts:

- final evidence pack
- planning handoff notes

Validation:

- 不靠记忆也能理解这 6 个月的真实结果

Exit criteria:

- 下一次规划从 evidence 出发

## 13A. Current Progress Snapshot Inside Month 1

为避免这份计划停留在“未来式”，这里记录当前已知的 Month 1 起手状态。

### Orchestrator-reported completed items

按当前外部执行汇报，Month 1 的 A + F 起手包已完成以下内容：

#### Workstream A — Extension Core Proof

- article extraction failure taxonomy 已建立：
  - `empty`
  - `under-extracted`
  - `over-extracted`
  - `wrong-root`
- deterministic coverage 已扩到：
  - docs
  - blog
  - forum
  - landing
- live proof 已新增：
  - `bench-live/article-extraction-proof`
- selection explain 浏览器 lane 已新增：
  - `bench-live/selection-explain-basic`
- hover 浏览器 lane 已收紧：
  - `bench-live/hover-translation-basic`

#### Workstream F — Release Credibility

- canonical lanes 已收敛为：
  - `source-core`
  - `extension-core`
  - `release-proof`
  - `hover-selection(optional)`
- lane conventions、flaky inventory、release checklist、CI workflow 已更新

### Orchestrator-reported validation outcome

- article extraction:
  - `34/34 tests`
  - `4/4 bench`
  - `live ✓`
- selection explain live:
  - `✓`
- hover live:
  - `✓`

### Remaining Month 1 close-out work

按当前计划，Month 1 还必须完成：

1. popup deep-read proof
2. 决定 hover / selection 是否升为 required gate
3. 完成 Month 1 gate 总验收
4. 反写：
  - release checklist
  - live coverage matrix
  - support/claim notes（若需）

### Month 1 status interpretation

这意味着：

- Month 1 并不是没内容，而是 A+F 的前半已经被快速吃掉
- 真正剩下的关键不是“再补几个 lane”，而是：
  - 把 popup deep-read 拉进同等 proof 层级
  - 决定哪些 lane 要从 optional 升为 blocking
  - 把这轮成果纳入 release discipline

也就是说，Month 1 的后半不能再用“再写几条场景”敷衍，而要完成**proof → gate → release policy** 的闭环。

## 13B. Detailed Monthly Workstream Matrices

前面的 roadmap 和 week-by-week 时间轴已经给出顺序。下面这部分负责把每个月真正“填满”。

写法规则如下：

- `Must`：本月必须完成，否则该月 gate 不能过
- `Should`：本月强烈建议完成，若产能不足可顺延到下月前半
- `Cut line`：产能不足时优先砍掉的内容
- `Dependencies`：如果上游未完成，本项不得硬开
- `Evidence`：本月结束时需要什么证据来支撑已完成判断

---

## Month 1 Detailed Matrix — Prove The Current Extension Core

### Workstream A — Extension Core Proof

#### Must

- 完成 article extraction failure taxonomy 的文档化与测试映射
- 确认 docs/blog/forum/landing 四类 extraction deterministic 覆盖已进入稳定集合
- 把 `bench-live/article-extraction-proof` 纳入可重跑基线
- 让 selection explain 的浏览器 lane 至少覆盖：
  - selection
  - explain
  - result render
  - copy/save 其中至少一项
- 让 hover lane 至少覆盖：
  - trigger
  - overlay visible
  - dismissal
  - no-console-error

#### Should

- article extraction 结果增加 screenshot artifacts 与错误分类摘要
- hover/selection lane 增加 network/request metadata capture
- article extraction 场景加入“动态内容 append 后仍能选对 root”的补充验证

#### Cut line

- 不在 Month 1 内尝试一次性覆盖所有 hover positioning edge cases
- 不在 Month 1 内尝试 frame-coordination 的真实浏览器路径

#### Dependencies

- canonical lane naming 已完成
- browser driver/helpers 可稳定运行

#### Evidence

- article extraction proof artifacts
- selection explain browser artifacts
- hover browser artifacts
- 更新后的 coverage matrix

### Workstream B — Learning Loop

#### Must

- popup deep-read proof 第一版落地
- popup 中以下链条必须可验证：
  - article excerpt
  - sentence drill
  - explain
  - save
  - speak
- popup 状态统一：
  - selected
  - explaining
  - explained
  - saving
  - saved
  - speaking

#### Should

- popup deep-read 增加 replayable smoke
- popup digest / sentence drill / quick actions 的交互顺序文档化

#### Cut line

- 不在 Month 1 内做自动抽词
- 不在 Month 1 内做 popup 内 review

#### Dependencies

- 现有 popup 深读功能已落地
- sentence explain / save / speak 已可运行

#### Evidence

- popup tests
- popup smoke artifacts
- state mapping doc

### Workstream C — Owned Reading

#### Must

- 本月只做 article extraction 相关输入，不开 reader 大叙事

#### Should

- 列出 Month 3 所需的 reader entry prerequisite

#### Cut line

- PDF / EPUB 新功能一律不上主线

#### Dependencies

- 无

#### Evidence

- reader backlog prep note

### Workstream D — Video And Subtitle

#### Must

- 本月不做新 adapter 叙事

#### Should

- 记录 video/subtitle lane 现状，为 Month 4 盘点做输入

#### Cut line

- 新平台 adapter

#### Dependencies

- 无

#### Evidence

- inventory stub

### Workstream E — Control Plane

#### Must

- 本月只做不阻断主线的必要后台维护

#### Should

- 记录任何会打断 extension 主 proof 的后台 incident

#### Cut line

- 任何新的 authority migration

#### Dependencies

- 无

#### Evidence

- incident notes if any

### Workstream F — Release Credibility

#### Must

- canonical lanes 固化
- flaky inventory 更新
- release checklist 反映 Month 1 的真实 gate
- 决定 hover / selection 是否从 optional 升到 required

#### Should

- 将 popup deep-read proof 接入 release checklist
- 对 Month 1 新 lane 给出 failure ownership 说明

#### Cut line

- 不在 Month 1 内把所有 optional lane 全改 required

#### Dependencies

- Workstream A/B proof 已落地

#### Evidence

- workflow diffs
- release checklist diff
- gate decision memo

### Workstream G — Privacy / Routing / Quality

#### Must

- 本月只审查新增 lane 是否违反 privacy/routing 边界

#### Should

- 为 Month 6 的 inventory 先记下高风险点

#### Cut line

- 不开启 system-wide privacy wave

#### Dependencies

- 无

#### Evidence

- audit notes

### Workstream H — Activation / Product Coherence

#### Must

- popup 深读入口文案、按钮顺序、状态表达不可继续发散

#### Should

- 初步整理 onboarding/options 对 learning-loop 的入口缺口

#### Cut line

- 不在 Month 1 内重做 onboarding

#### Dependencies

- popup deep-read proof 完成

#### Evidence

- popup UX notes
- backlog note for Month 2

---

## Month 2 Detailed Matrix — Finish Learning-Loop V1

### Workstream A — Extension Core Proof

#### Must

- 保持 Month 1 新增 article/hover/selection lanes 绿
- 为 popup deep-read 增加至少 1 条稳定 smoke

#### Should

- input translation 浏览器 proof 开始补最小场景

#### Cut line

- 不同时推进 frame coordination live

#### Dependencies

- Month 1 gate 通过

#### Evidence

- stable smoke run history

### Workstream B — Learning Loop

#### Must

- popup 深读完整第一版收口
- vocab source-context richer metadata 落地
- review 页可见来源上下文
- study progress 进入用户可感知 UI
- revisit hint / return-to-reading 最小版本落地

#### Should

- 句级 explain cache 与 save/review 联动更自然
- popup 中加入更清楚的 next-step hint
- review 中出现“来自哪篇文章/句子”的说明

#### Cut line

- 不做复杂 SRS 重设计
- 不做 AI 自动抽词主线

#### Dependencies

- popup proof 已有
- vocab/review surface 可继续修改

#### Evidence

- end-to-end learning-loop smoke
- UI screenshots
- updated state docs

### Workstream C — Owned Reading

#### Must

- 列清 Month 3 owned reading item 需要复用哪些 learning assets 字段

#### Should

- 给 article import / saved reading queue 准备 schema 草案

#### Cut line

- 不直接实现新 queue UI 大面

#### Dependencies

- learning-loop source-context 字段稳定

#### Evidence

- schema prep doc

### Workstream D — Video And Subtitle

#### Must

- 保持现有字幕/视频相关功能不回归

#### Should

- 记录未来 Month 4 所需的 subtitle asset hooks

#### Cut line

- 不开 video 新叙事

#### Dependencies

- 无

#### Evidence

- no-regression notes

### Workstream E — Control Plane

#### Must

- 修任何直接影响 popup/vocab/review 数据一致性的后台问题

#### Should

- 检查 reading assets continuity 是否存在明显裂缝

#### Cut line

- 不扩 account/usage 主线

#### Dependencies

- 无

#### Evidence

- bugfix notes

### Workstream F — Release Credibility

#### Must

- 把 learning-loop smoke 纳入 release evidence
- Month 2 gate 的 required evidence 模板写出来

#### Should

- 建立学习 loop 相关 flaky tracking

#### Cut line

- 不在本月扩大所有 lane 为 required

#### Dependencies

- Workstream B smoke 成立

#### Evidence

- release checklist additions

### Workstream G — Privacy / Routing / Quality

#### Must

- 确保 popup/vocab/review/source-context 改动不泄漏额外上下文

#### Should

- 开始记 glossary / explanation quality 的明显坏例子

#### Cut line

- 仍不开 system-wide quality wave

#### Dependencies

- learning-loop state settled

#### Evidence

- audit notes

### Workstream H — Activation / Product Coherence

#### Must

- 明确 popup、vocab、review、history 的入口顺序
- 让用户能看懂“下一步该做什么”

#### Should

- 对 onboarding 中 learning-loop 入口做最小文案调整

#### Cut line

- 不重做 onboarding 信息架构全量

#### Dependencies

- Workstream B 的 next-step / progress surfaced

#### Evidence

- flow diagram
- UX copy diff

---

## Month 3 Detailed Matrix — Unify Owned Reading Entry Model

### Workstream A — Extension Core Proof

#### Must

- 保持 page/article/hover/selection/input 主 lane 不退化

#### Should

- 补 input translation 最小 browser proof

#### Cut line

- 不额外扩 frame coordination

#### Dependencies

- Month 1/2 lanes stable

#### Evidence

- required smoke history

### Workstream B — Learning Loop

#### Must

- 明确 learning assets 如何挂接到 owned reading item
- revisit 与 saved reading queue 对齐

#### Should

- 让 review 能回跳到 owned reading source

#### Cut line

- 不开新的复习算法

#### Dependencies

- Month 2 learning-loop baseline stable

#### Evidence

- asset mapping doc

### Workstream C — Owned Reading

#### Must

- owned reading item schema 落地
- article import / saved reading queue 最小实现
- PDF startup/recovery smoke
- EPUB startup/recovery smoke
- recent / saved / in-progress 状态清楚

#### Should

- subtitle-file 也逐步映射到同一 item 模型
- reader metadata 与 history/progress 对齐

#### Cut line

- 不在本月做 reader 全面 redesign
- 不追求 reader feature breadth

#### Dependencies

- queue/schema prep complete
- storage changes与 learning assets 字段兼容

#### Evidence

- schema
- queue UI
- PDF/EPUB smoke artifacts

### Workstream D — Video And Subtitle

#### Must

- 只准备 subtitle-file 与 owned item 的挂接点

#### Should

- inventory future subtitle-reader dependencies

#### Cut line

- 不扩网站 adapter

#### Dependencies

- owned reading item schema draft

#### Evidence

- mapping notes

### Workstream E — Control Plane

#### Must

- 确保 saved reading / queue / progress 不因 sync/control-plane 出现明显坏状态

#### Should

- 记录 reading assets continuity 裂缝

#### Cut line

- 不新开 authority migration

#### Dependencies

- queue/storage changes

#### Evidence

- sync-risk notes

### Workstream F — Release Credibility

#### Must

- 为 article/PDF/EPUB revisit 补最小 smoke
- 把 reader 类 claim 写得与证据一致

#### Should

- 引入 reader-specific flaky tracking

#### Cut line

- 不在本月把所有 reader lane 变成 required

#### Dependencies

- Workstream C smoke ready

#### Evidence

- reader/revisit artifacts
- checklist updates

### Workstream G — Privacy / Routing / Quality

#### Must

- reader/import path 的 request context 边界基本清楚

#### Should

- 记录 OCR/image/comic 未来为何不在本窗口推进

#### Cut line

- 不开 OCR beta 叙事

#### Dependencies

- reader workflows taking shape

#### Evidence

- boundary notes

### Workstream H — Activation / Product Coherence

#### Must

- 明确 article / PDF / EPUB / subtitle 的入口说明和心智模型

#### Should

- 给 queue / recent / resume 设计统一文案

#### Cut line

- 不做 reader 全面视觉重设计

#### Dependencies

- owned reading item schema

#### Evidence

- entry model doc
- copy guide

---

## Month 4 Detailed Matrix — Video / Subtitle And Revisit

### Workstream A — Extension Core Proof

#### Must

- 核心 extension lanes 继续保持稳定

#### Should

- 若 hover/selection 已够稳，可决定是否升为 required subset

#### Cut line

- 不因 video 线挤掉核心 extension proof 维护

#### Dependencies

- prior gates passed

#### Evidence

- stable run history

### Workstream B — Learning Loop

#### Must

- 视频/字幕内容保存后也能进入 learning assets 流

#### Should

- subtitle sentence save/explain 与 vocab/review 更自然衔接

#### Cut line

- 不做视频专属复杂学习算法

#### Dependencies

- subtitle-reader integration underway

#### Evidence

- video/subtitle learning-path smoke

### Workstream C — Owned Reading

#### Must

- subtitle file 被纳入 owned reading item / revisit 逻辑

#### Should

- queue 中能区分 article / PDF / EPUB / subtitle source type

#### Cut line

- 不在本月扩新 reader 类型

#### Dependencies

- Month 3 schema stable

#### Evidence

- queue + subtitle integration artifacts

### Workstream D — Video And Subtitle

#### Must

- 完成 video support inventory
- 稳定 YouTube
- 稳定 1 个 secondary adapter
- subtitle-reader 保存/回看路径收口
- video/subtitle revisit smoke

#### Should

- 对 adapter failures 做更清晰分类：
  - no subtitle
  - delayed subtitle
  - stale subtitle
  - language mismatch
  - DOM drift

#### Cut line

- 不新增第三个大 adapter 作为主目标

#### Dependencies

- support inventory complete
- subtitle-reader integration underway

#### Evidence

- site-by-site matrix
- 2+ smoke runs
- revisit artifacts

### Workstream E — Control Plane

#### Must

- 修任何直接影响 video/subtitle asset persistence 的后台问题

#### Should

- 记录 future media-asset sync considerations

#### Cut line

- 不做 media-specific backend expansion

#### Dependencies

- subtitle assets entering main system

#### Evidence

- incident notes

### Workstream F — Release Credibility

#### Must

- 更新 support matrix 中 video/subtitle 口径
- 把两个 adapter 的 smoke 纳入 evidence bundle
- reader/video claim 更诚实

#### Should

- 形成 site-specific failure ownership note

#### Cut line

- 不把所有 video adapter 声称为同级支持

#### Dependencies

- Workstream D evidence available

#### Evidence

- support matrix diff
- release checklist diff

### Workstream G — Privacy / Routing / Quality

#### Must

- 审核 subtitle/video request context 是否越界

#### Should

- 记录视频字幕路径的 routing/failure class 差异

#### Cut line

- 不展开系统级质量波次

#### Dependencies

- video/subtitle flows clarified

#### Evidence

- audit notes

### Workstream H — Activation / Product Coherence

#### Must

- 用户能理解：
  - 网页字幕
  - 导入字幕文件
  - 回看内容
  
  三者关系

#### Should

- 补 subtitle/video 入口说明文案

#### Cut line

- 不做视频产品化大改版

#### Dependencies

- support boundaries clear

#### Evidence

- UX notes
- copy changes

---

## Month 5 Detailed Matrix — Reduce Control-Plane Drag

### Workstream A — Extension Core Proof

#### Must

- 维持核心 extension required lanes 绿

#### Should

- 整理此前 4 个月 proof debt

#### Cut line

- 不新增核心 product 面

#### Dependencies

- prior lanes stable

#### Evidence

- stable history

### Workstream B — Learning Loop

#### Must

- 保证 learning assets 与 control-plane 交互时状态一致

#### Should

- 修本窗口前半暴露出的 continuity edge cases

#### Cut line

- 不开新的学习面大 feature

#### Dependencies

- control-plane state work

#### Evidence

- no-regression notes

### Workstream C — Owned Reading

#### Must

- 确保 queue/progress/history 与 account/control-plane 面不冲突

#### Should

- 修 reader asset consistency 问题

#### Cut line

- 不开新 reader 叙事

#### Dependencies

- account/control-plane inventory

#### Evidence

- consistency notes

### Workstream D — Video And Subtitle

#### Must

- 维持已建立的 video/subtitle smoke 基线

#### Should

- 修上月剩余 adapter bug

#### Cut line

- 不加新 adapter

#### Dependencies

- Month 4 evidence

#### Evidence

- stable adapter runs

### Workstream E — Control Plane

#### Must

- 完成 account/control-plane inventory cleanup
- account / usage / summary / plan 呈现收敛
- lifecycle operations hardening：
  - export
  - delete
  - repair
  - revoke
- mobile web / iOS bridge proof wave

#### Should

- operator-facing observability/notes 提升
- account/control-plane UI 文案收敛

#### Cut line

- 不做 translate authority 主迁移
- 不做新 auth modernization

#### Dependencies

- current backend route ownership clarified

#### Evidence

- account inventory
- lifecycle smoke
- mobile proof artifacts
- support matrix updates if needed

### Workstream F — Release Credibility

#### Must

- control-plane 和 mobile 口径纳入 release evidence

#### Should

- 对 control-plane incidents 建立 release relevance rule

#### Cut line

- 不将 control-plane polish 无限扩大

#### Dependencies

- Workstream E evidence ready

#### Evidence

- checklist updates
- mobile/control-plane release notes

### Workstream G — Privacy / Routing / Quality

#### Must

- 记录 account/mobile/control-plane 相关的隐私与错误透明度缺口

#### Should

- 为 Month 6 inventory 做输入

#### Cut line

- 不做 system-wide quality rollout

#### Dependencies

- Workstream E audits

#### Evidence

- inventory notes

### Workstream H — Activation / Product Coherence

#### Must

- 让 web cloud / extension / mobile 口径对用户来说不自相矛盾

#### Should

- 调整文案以解释 supported/beta/experimental 边界

#### Cut line

- 不做新的营销面大改版

#### Dependencies

- support matrix / mobile evidence ready

#### Evidence

- copy updates
- claim notes

---

## Month 6 Detailed Matrix — Harden, Freeze, Publish Honestly

### Workstream A — Extension Core Proof

#### Must

- 对前 5 个月新增的核心 extension lanes 做稳定性总检查

#### Should

- 清任何仍在 required path 中的 flaky

#### Cut line

- 不再开新 surface

#### Dependencies

- prior evidence exists

#### Evidence

- stability report

### Workstream B — Learning Loop

#### Must

- 盘点 learning-loop 哪些已证明、哪些仍未证明

#### Should

- 修高影响但小规模的 UX/consistency 债

#### Cut line

- 不开 learning-loop v2 叙事

#### Dependencies

- Month 2-5 artifacts complete

#### Evidence

- learning-loop evidence pack

### Workstream C — Owned Reading

#### Must

- 对 owned reading item / queue / revisit 的稳定性做总检查

#### Should

- 修 reader 中高影响的边界问题

#### Cut line

- 不扩 reader breadth

#### Dependencies

- Month 3 artifacts

#### Evidence

- reader evidence pack

### Workstream D — Video And Subtitle

#### Must

- 对 video/subtitle claim 做最后审计

#### Should

- 修 1-2 个最高影响站点 bug

#### Cut line

- 不扩第三方 adapter coverage narrative

#### Dependencies

- Month 4 artifacts

#### Evidence

- video evidence pack

### Workstream E — Control Plane

#### Must

- 对 auth/account/control-plane/mobile claims 做最终收敛

#### Should

- 清理会影响 release confidence 的后台噪音

#### Cut line

- 不新开 authority migration

#### Dependencies

- Month 5 artifacts

#### Evidence

- control-plane evidence pack

### Workstream F — Release Credibility

#### Must

- release checklist 变成真正阻断项
- support matrix / capability matrix / README / release notes 口径一致
- 形成 final evidence pack

#### Should

- 形成 release-manager style summary template

#### Cut line

- 不再推新 lane 作为主线，除非是 release blocker

#### Dependencies

- 各 workstream evidence pack ready

#### Evidence

- final checklist
- final matrices
- release summary

### Workstream G — Privacy / Routing / Quality

#### Must

- 完成 system-wide inventory
- 核心 surface 的 privacy/routing/quality 风险有明文结论

#### Should

- 对下窗口的 quality wave 提供明确 backlog

#### Cut line

- 不在最后一个月开大规模质量重构

#### Dependencies

- prior audit inputs ready

#### Evidence

- inventory
- risk report

### Workstream H — Activation / Product Coherence

#### Must

- 最终口径必须让用户能明白：
  - Astra 是什么
  - 主要支持什么
  - 还不支持什么
  - 哪些是 beta/experimental

#### Should

- 为下窗口准备 onboarding/options/popup 的 coherence backlog

#### Cut line

- 不做全面营销包装重写

#### Dependencies

- support/claim audit complete

#### Evidence

- messaging pack
- copy audit

## 13C. Month-By-Month Capacity Allocation

为了保证这份计划不是“所有东西都同时做”，这里明确每个月注意力配比。比例是大致配比，不是精确工时。

### Month 1

- Workstream A: 35%
- Workstream B: 20%
- Workstream F: 25%
- Workstream H: 10%
- Others total: 10%

### Month 2

- Workstream B: 40%
- Workstream A: 15%
- Workstream F: 15%
- Workstream H: 15%
- Others total: 15%

### Month 3

- Workstream C: 40%
- Workstream B: 20%
- Workstream F: 15%
- Workstream A: 10%
- Others total: 15%

### Month 4

- Workstream D: 35%
- Workstream C: 20%
- Workstream B: 15%
- Workstream F: 15%
- Others total: 15%

### Month 5

- Workstream E: 40%
- Workstream F: 15%
- Workstream B: 10%
- Workstream C: 10%
- Others total: 25%

### Month 6

- Workstream F: 30%
- Workstream G: 20%
- Workstream E: 15%
- Workstream A: 10%
- Workstream B: 10%
- Workstream C: 10%
- Workstream D/H total: 5%

## 13D. What Gets Cut First If Capacity Slips

如果产能不足，裁撤顺序必须明确：

1. 新 adapter / 新 reader breadth
2. 重视觉 polish
3. 非阻断型 onboarding/options 改版
4. 非阻断型 control-plane polish
5. 新花样学习功能

最后才考虑砍：

- release proof
- learning-loop e2e
- support matrix / claim 收敛
- lifecycle stability

## 13E. Release Train For The 6-Month Window

每个月按一个 release train 节奏组织，而不是随缘发版。

### 每月节奏

- Week 1: design + implementation start
- Week 2: implementation + integration
- Week 3: smoke + bugfix + docs
- Week 4: RC judgement + claim audit + freeze for next month

### 每月 RC 包必须包含

- 该月主要 feature list
- 新增/修改 smoke lanes
- open blockers
- downgraded claims
- changed support wording
- cut items moved to next month

### 任何 RC 不允许缺

- smoke result summary
- release checklist judgment
- support/claim diff if wording changed

## 13F. Detailed AI Task Ledgers By Month

前面的 roadmap、week plan、workstream matrix 已经定义了方向与验收。  
这一节专门解决另一个问题：

> “如果把这个月直接交给 AI 连续执行，它到底应该一项一项做什么？”

因此这里不再写大主题，而写**任务清单级别**的工作包。  
每个任务都默认是：

- 可以独立派给 AI 的单元
- 有明确产出
- 完成后能留下代码 / 测试 / 文档 /证据中的至少一种

说明：

- `P0`：本月必须完成
- `P1`：本月应完成，产能不足可顺延到下月前半
- `P2`：只在前面都稳定时再做

---

## Month 1 AI Task Ledger — Extension Core Proof + Popup Deep-Read Proof

Month 1 不是 4 个大任务，而是一整串连续工作。下面是本月应可持续派发给 AI 的任务池。

### A. Article extraction task pack

1. `P0` 把 article extraction failure taxonomy 固化进文档与测试命名约定  
2. `P0` 为 `empty` 类失败加至少 1 个 deterministic fixture  
3. `P0` 为 `under-extracted` 类失败加至少 1 个 deterministic fixture  
4. `P0` 为 `over-extracted` 类失败加至少 1 个 deterministic fixture  
5. `P0` 为 `wrong-root` 类失败加至少 1 个 deterministic fixture  
6. `P0` 把 docs/blog/forum/landing 四类 fixture 的 root 期望写回注释或 spec  
7. `P0` 让 article extraction proof 场景输出 extraction summary artifact  
8. `P0` 让 article extraction proof 失败时打印 root 选择原因  
9. `P1` 给 article extraction proof 增加 screenshot with highlighted root  
10. `P1` 增加“正文很短但 sidebar 很长”的 fixture  
11. `P1` 增加“comments 很长但 article 很短”的 fixture  
12. `P1` 增加“landing page 不应被误判为 article”的浏览器验证  
13. `P1` 增加“动态 append 后重新提取”的最小场景  
14. `P1` 输出 article extraction failure class 统计摘要  
15. `P2` 增加“多栏 docs layout”的额外 fixture  
16. `P2` 增加“sticky header / floating TOC 干扰”的 fixture  

### B. Hover proof task pack

17. `P0` 清理 hover live scenario 的命名与 artifact 输出  
18. `P0` 确保 hover live 至少验证：
   - trigger
   - overlay visible
   - dismissal
19. `P0` 在 hover lane 中抓 console errors  
20. `P0` 在 hover lane 中记录 request metadata  
21. `P1` 增加第二个 hover target 切换场景  
22. `P1` 验证 hover overlay 不在 mouse leave 后残留  
23. `P1` 验证 alt modifier 释放后 overlay 状态  
24. `P1` 验证 hover 与 selection 冲突时的 suppression  
25. `P2` 验证 hover overlay 的 viewport clipping 基本行为  
26. `P2` 验证 hover lane 的 latency budget 记录  

### C. Selection explain proof task pack

27. `P0` 清理 selection explain browser lane 的 artifact 输出  
28. `P0` 验证 selection → explain → result render 主流程  
29. `P0` 记录 explain request payload 是否包含 `selectionContext`  
30. `P0` 验证 explain 结果面板非空  
31. `P1` 增加 copy explain result 路径  
32. `P1` 增加 save selected text 路径  
33. `P1` 增加 selection cancel/dismiss 路径  
34. `P1` 增加 error state 展示验证  
35. `P2` 增加长 selection / 跨元素 selection 场景  
36. `P2` 增加 explain result 再次触发时的 replace/update 行为验证  

### D. Popup deep-read proof task pack

37. `P0` 盘点 popup 深读当前所有状态：
   - digest loading
   - digest stale
   - sentence selected
   - sentence explaining
   - sentence explained
   - sentence saving
   - sentence saved
   - sentence speaking
38. `P0` 为上述状态建立 state mapping note  
39. `P0` 给 popup deep-read 增加至少 1 条 smoke lane  
40. `P0` 验证 excerpt 展示与 sentence deck 渲染  
41. `P0` 验证 sentence explain 主流程  
42. `P0` 验证 sentence save 主流程  
43. `P0` 验证 sentence speak 主流程  
44. `P1` 验证 previous/next sentence 导航  
45. `P1` 验证 explain cache 命中路径  
46. `P1` 验证 save 后按钮状态变化  
47. `P1` 验证 digest regenerate 与 sentence drill 并存时的 UI 行为  
48. `P1` 验证 custom actions 与 sentence explain 的互斥/共存状态  
49. `P1` 统一 popup deep-read 的 loading / success / error 文案  
50. `P2` 增加 popup deep-read 中断恢复场景  

### E. Release credibility task pack

51. `P0` 把 article/hover/selection/popup 四类 lane 写回 live coverage matrix  
52. `P0` 更新 release checklist 中 Month 1 evidence 要求  
53. `P0` 给 canonical lanes 写 owner / purpose / blocking level  
54. `P0` 决定 hover/selection 哪个仍 optional，哪个可以升 required  
55. `P1` 给 Month 1 新增 lane 建失败排查说明  
56. `P1` 给 artifacts 命名和目录结构做统一规则  
57. `P1` 整理 flaky inventory 的来源与处置规则  
58. `P2` 给 release checklist 增加“proof diff”段落模板  

### F. Month 1收口任务

59. `P0` 做 Month 1 gate 总验收  
60. `P0` 写 Month 1 accomplished / incomplete / carry-over 结论  
61. `P0` 把 carry-over 映射进 Month 2 起手包  
62. `P1` 若 hover/selection 仍不够稳，明确写入“不升 required”的原因  

Month 1 交付要求：

- 至少完成上面 `P0` 全部任务
- `P1` 至少完成 8-12 项
- Month 1 不得因为“已经做了 article/hover/selection”就提前结束

---

## Month 2 AI Task Ledger — Learning Loop V1 Completion

派发任务时须附带 `13L` 七要素；P0 项默认以 **§11 Month 2** 的 `gate-ready` 为完成定义（而非仅 merged）。月末用 `13H2` + `13K` + `13O` 做收口。

### Month 2 执行快照（2026-04-14，仓库落地）

- [x] **A–F P0 工作包**：以 `docs/investigations/month-2-closeout-2026-04-14.md` 为收口索引（含 `13O` evidence 表）；**`gate-ready` 仍受 optional live lane 约束**，verdict 记 **`pass-with-carry`**。
- [x] **P1 最低条数**：矩阵 / known issues / UX debt / resume / search / review 链接与长上下文等已计入 closeout 说明。
- [x] **`13K` Month 2 closeout 文档**：`month-2-closeout-2026-04-14.md`（与 §11 勾选「全文 closeout 仍待月末」对齐为 **已写 closeout 文档**；若需与 Month 1 模板逐字段一致可再迭代）。

### A. Popup deep-read completion pack

1. `P0` 审计 popup 深读中所有 action 的状态互斥关系  
2. `P0` 统一 sentence explain / save / speak / custom action 的 disabled logic  
3. `P0` 统一 popup 中 result card 的样式与关闭/替换逻辑  
4. `P0` 统一 next-step hint 与 study progress 的映射  
5. `P0` 增加 popup deep-read smoke 的稳定化重跑  
6. `P1` 优化 digest + sentence deck + quick actions 的信息顺序  
7. `P1` 增加 popup 中“继续上次学习”提示  
8. `P1` 增加 popup 对空 study context 的更清楚 fallback  
9. `P2` 增加 popup 中 sentence pin / favorite 概念预研

### B. Vocabulary + review integration pack

10. `P0` 给 vocab entry 增加更稳定的 source-context 信息  
11. `P0` review 页面展示来源标题或来源 URL  
12. `P0` review 页面展示节选上下文  
13. `P0` 从 popup 保存的内容在 vocab/review 可追踪来源  
14. `P1` review 中可跳回原始页面或 owned reading source  
15. `P1` vocab 搜索包含 explanation/note/context  
16. `P1` 清理 vocab / review 中重复或不一致文案  
17. `P2` 对长 context 做更清楚截断与展开行为

### C. Study progress productization pack

18. `P0` 明确 page-level progress 定义  
19. `P0` 明确 sentence explained / vocab saved / reviewed 的计数规则  
20. `P0` popup 展示 progress  
21. `P0` review 或 vocab 至少一个面展示 progress  
22. `P1` 增加 “上次停在哪一步” 的 revisit 提示  
23. `P1` 为 progress 添加更清楚的 completed-steps ordering  
24. `P2` 评估 daily stats 是否需要更强 UI 露出

### D. Revisit loop pack

25. `P0` 明确 revisit 的入口：
   - popup
   - recent history
   - vocab
   - review
26. `P0` 至少做通 1 条 revisit path  
27. `P0` 为 revisit path 增加 smoke 或 replayable scenario  
28. `P1` 增加“继续这篇文章”入口文案  
29. `P1` 增加 revisit 命中旧 progress 时的状态恢复  
30. `P2` 增加 revisit 的 age/staleness 提示

### E. QA and evidence pack

31. `P0` 建 learning-loop e2e smoke  
32. `P0` 建 learning-loop regression checklist  
33. `P0` 记录 Month 2 的 learning metrics 定义  
34. `P1` 为 popup/vocab/review/history 间跳转做最小 matrix  
35. `P1` 建已知 learning-loop bug 清单并按 severity 排序  
36. `P2` 输出 learning-loop UX debt 清单

Month 2 交付要求：

- `P0` 全部完成
- `P1` 至少完成 10 项
- 最终必须有 1 条从 reading 到 review 的真实链路证据

### Month 2 任务打勾（Ledger 1–36，2026-04-14）

| ID | P | 状态 |
|---:|---|---|
| 1 | P0 | [x] 现有 `StudySection` 与 `App` 行为已审计；见 closeout |
| 2 | P0 | [x] explain/save/speak/custom disabled 逻辑已在 `StudySection` |
| 3 | P0 | [x] result card 样式与既有 popup 行为一致 |
| 4 | P0 | [x] `NextStepBanner` + `deriveStudyLoopViewModel` |
| 5 | P0 | [x] `bench-live/popup-deep-read-proof` + lane 脚本 |
| 6 | P1 | [x] digest 区块移至句子甲板之后（`StudySection` 重排） |
| 7 | P1 | [x] `popup_studyResumeFromLast` |
| 8 | P1 | [x] 搜索框 placeholder 强化 + navigation matrix 说明空上下文 |
| 9 | P2 | [x] `sentence-pin-presearch-2026-04-14.md`（预研文档，UI defer） |
| 10–13 | P0 | [x] source-context / review / vocab 追踪 |
| 14 | P1 | [x] `review_openSourcePage` |
| 15 | P1 | [x] 搜索含 `sourceContext` + URL/hostname |
| 16 | P1 | [x] review 链接文案 i18n |
| 17 | P2 | [x] 长上下文展开/收起（review 背面） |
| 18–21 | P0 | [x] metrics 文档 + popup/review 进度 |
| 22 | P1 | [x] resume 文案 |
| 23 | P1 | [x] `orderStudySteps` + 单测 |
| 24 | P2 | [x] Popup 今日计数四格卡片 + 日期说明 |
| 25–27 | P0 | [x] matrix + `learning-loop` / `vocabulary-srs-smoke` |
| 28 | P1 | [x] 最近阅读列表即「继续读」入口 |
| 29 | P1 | [x] 文档层：revisit 与 progress 关系见 matrix |
| 30 | P2 | [x] 最近阅读 `visitedAt` 相对时间（min/h/d ago） |
| 31–33 | P0 | [x] e2e 命令 + checklist + metrics |
| 34–36 | P1/P2 | [x] matrix + known issues + UX debt 文档 |

---

## Month 3 AI Task Ledger — Owned Reading Model + Reader Baseline

### A. Owned reading model pack

1. `P0` 定义 owned reading item schema  
2. `P0` 定义 source type：
   - article
   - pdf
   - epub
   - subtitle-file
3. `P0` 定义 title/source URL/lastOpened/progress/status 字段  
4. `P0` 定义与 reading history 的关系  
5. `P0` 定义与 study progress 的关系  
6. `P1` 定义与 vocab/review 的 source linking 方式  
7. `P2` 定义未来 sync-safe 字段边界

### B. Saved reading / queue pack

8. `P0` 实现 saved reading queue 最小版本  
9. `P0` recent / saved / in-progress 基本分类  
10. `P0` queue 中可恢复阅读  
11. `P1` queue 中显示最近学习状态  
12. `P1` queue 中显示 source type badge  
13. `P2` queue 支持简单排序/筛选

### C. PDF pack

14. `P0` PDF startup smoke  
15. `P0` PDF render smoke  
16. `P0` PDF basic translate smoke  
17. `P0` PDF save word/sentence smoke  
18. `P1` PDF empty/failed file handling  
19. `P1` PDF large-file basic behavior  
20. `P2` PDF multicolumn notes backlog

### D. EPUB pack

21. `P0` EPUB startup smoke  
22. `P0` EPUB chapter navigation smoke  
23. `P0` EPUB basic translate smoke  
24. `P0` EPUB save word/sentence smoke  
25. `P1` EPUB malformed chapter handling  
26. `P1` EPUB long chapter behavior  
27. `P2` EPUB theme/layout polish backlog

### E. Revisit and evidence pack

28. `P0` article revisit scenario  
29. `P0` PDF revisit scenario  
30. `P0` EPUB revisit scenario  
31. `P1` queue/progress/vocab 联动验证  
32. `P1` reader smoke artifacts 统一命名  
33. `P2` reader-specific failure taxonomy

Month 3 交付要求：

- `P0` 全部完成
- `P1` 至少完成 8-10 项
- 不允许 reader breadth 扩张替代 schema/queue/revisit 主线

---

## Month 4 AI Task Ledger — Video/Subtitles Productization

### A. Support inventory pack

1. `P0` 列全 video/subtitle adapters  
2. `P0` 给每个 adapter 标：
   - supported
   - best-effort
   - code-only
3. `P0` 写每个 adapter 当前 proof level  
4. `P0` 写主要 failure modes  
5. `P1` 给每个 adapter 补 artifact samples  

### B. YouTube hardening pack

6. `P0` YouTube subtitle smoke 稳定化  
7. `P0` 覆盖 subtitle load / refresh / language switch 至少一项  
8. `P0` 记录 YouTube failure classes  
9. `P1` 覆盖 subtitle unavailable 路径  
10. `P1` 覆盖 delayed subtitle 路径  

### C. Secondary adapter hardening pack

11. `P0` 选择 1 个次级 adapter 作为本月主防线  
12. `P0` 给它建立 smoke  
13. `P0` 修最常见 DOM drift / missing subtitle 问题  
14. `P1` 记录与 YouTube 的差异  
15. `P2` 建第三方 adapter backlog，不实现

### D. Subtitle-reader integration pack

16. `P0` subtitle file import → explain → save 路径  
17. `P0` subtitle file → vocab/review 路径  
18. `P0` subtitle file revisit 路径  
19. `P1` subtitle file source-context richer display  
20. `P2` subtitle sentence-level progress 预研

### E. Video/subtitle revisit pack

21. `P0` video revisit smoke  
22. `P0` subtitle revisit smoke  
23. `P1` recent media items 的 queue 露出  
24. `P1` media-specific progress hint  
25. `P2` revisit-from-review to subtitle source

### F. Claim and evidence pack

26. `P0` support matrix 中 video/subtitle wording 更新  
27. `P0` release checklist 加 video/subtitle evidence 行  
28. `P1` site-specific risk note  
29. `P1` adapter owner/failure ownership note  
30. `P2` public-facing messaging草案

Month 4 交付要求：

- `P0` 全部完成
- `P1` 至少完成 8 项
- 不允许以“再支持一个新平台”替代 YouTube + 次级 adapter 的稳定化

---

## Month 5 AI Task Ledger — Control Plane Stabilization

### A. Inventory and coherence pack

1. `P0` 列出 Node-owned critical surfaces  
2. `P0` 列出 extension/web/mobile 依赖的 account/usage/plan state  
3. `P0` 统一 account / usage / summary / plan 文案  
4. `P0` 统一 UI 中对 plan/usage 的来源表达  
5. `P1` 清理冲突 copy / stale wording  

### B. Lifecycle pack

6. `P0` export 流程状态提示  
7. `P0` delete 流程状态提示  
8. `P0` repair 流程状态提示  
9. `P0` revoke 流程状态提示  
10. `P0` 为以上动作补最小 smoke  
11. `P1` 失败恢复文案与重试建议  
12. `P1` lifecycle runbook 更新  

### C. Mobile web / iOS bridge pack

13. `P0` mobile web narrow viewport smoke  
14. `P0` mobile web account/control-plane smoke  
15. `P0` iOS bridge checklist 更新  
16. `P1` support matrix 中移动口径二次核对  
17. `P1` 记录 bridge path 已知风险  

### D. Background stability pack

18. `P0` 修任何阻断主产品面的 control-plane bug  
19. `P0` 记录 control-plane incident 分类  
20. `P1` 给常见后台错误加更清楚 operator note  
21. `P1` 给 web cloud surface 加更清楚状态露出  
22. `P2` 整理未来 authority migration backlog，但不执行

### E. Release and claim pack

23. `P0` 把 control-plane evidence 纳入 release checklist  
24. `P0` 把 mobile evidence 纳入 support matrix  
25. `P1` 形成 control-plane release relevance rule  
26. `P2` 形成 background-risk dashboard 草案

Month 5 交付要求：

- `P0` 全部完成
- `P1` 至少完成 6-8 项
- 不允许因为 Month 5 在做后台就放弃主产品面稳定性维护

---

## Month 6 AI Task Ledger — Freeze, Quality, Release Discipline

### A. Privacy inventory pack

1. `P0` 列全 surface 的 privacy assertions 现状  
2. `P0` 列哪些 surface 有 request-sanitization，哪些没有  
3. `P0` 标出 highest-risk privacy gaps  
4. `P1` 补核心 surface 的最小缺失 assertions  
5. `P2` 整理下一窗口 privacy wave backlog

### B. Routing/failure transparency pack

6. `P0` 列 provider failure classes  
7. `P0` 列 parse failure classes  
8. `P0` 列 quota failure classes  
9. `P0` 列 site-specific extraction failure classes  
10. `P1` 收敛 routing metadata  
11. `P1` 给 operator-visible summary 补文案或结构  

### C. Release gate tightening pack

12. `P0` 把 release checklist 改成真正 blocking structure  
13. `P0` support matrix、capability matrix、README claim 核对  
14. `P0` 列所有无法证明的强 claim  
15. `P0` 降级或删除无法证明的强 claim  
16. `P1` 形成 release summary template  
17. `P1` 形成 monthly RC evidence template  

### D. Debt burn-down pack

18. `P0` 清 required lanes 中仍存在的 flaky  
19. `P0` 关闭高影响伪入口或过时 TODO  
20. `P0` 修高影响小 bug  
21. `P1` 补文档断层  
22. `P1` 清低价值但制造噪音的技术债  

### E. Handoff pack

23. `P0` 更新 `plan.md`  
24. `P0` 更新 support matrix  
25. `P0` 更新 release readiness checklist  
26. `P0` 更新 capability matrix  
27. `P0` 生成 6 个月复盘  
28. `P1` 生成 next-window candidate list  
29. `P1` 明确：
   - accomplished
   - deferred
   - unproven
   - blocked

Month 6 交付要求：

- `P0` 全部完成
- `P1` 至少完成 6 项
- Month 6 不允许新开主线功能叙事

## 13G. Harness-Aligned Monthly Scoring Model

前面的任务池解决“做什么”，这一节解决“怎么判这个月做得够不够好”。

这里不另造一套完全脱离 repo 的评分体系，而是借用现有 harness / benchmark protocol 的思路，把它改造成**月度执行评分板**。

参考来源：

- `docs/benchmark-protocol-v1.md`
- `bench-live/evaluator.ts`
- `docs/release-readiness-checklist.md`

### 评分原则

月度评分不按“写了多少代码”算，而按 5 个维度算：

1. `proofCompletion`
2. `productCompletion`
3. `releaseCredibility`
4. `stability`
5. `maintainability`

这 5 个维度和 benchmark protocol 的精神是一致的：

- 功能是否真实工作
- 深度是否够
- 证据是否足
- 代码是否稳
- 后续是否可维护

### 月度评分权重

| Dimension | Weight | Threshold | What it means in Astra month planning |
|---|---:|---:|---|
| `proofCompletion` | 0.30 | 70 | 本月承诺的 smoke/live/proof/gate 是否真正补上 |
| `productCompletion` | 0.25 | 65 | 本月主产品面是否真的走通，不是只改局部 |
| `releaseCredibility` | 0.20 | 65 | checklist、coverage matrix、claim、required gate 是否跟上 |
| `stability` | 0.15 | 60 | tests / bench / live lanes 是否稳定，是否引入新 flaky |
| `maintainability` | 0.10 | 55 | 文档、命名、artifact、状态模型是否更清楚 |

总分算法：

```text
monthScore =
  proofCompletion * 0.30 +
  productCompletion * 0.25 +
  releaseCredibility * 0.20 +
  stability * 0.15 +
  maintainability * 0.10
```

### 月度 verdict taxonomy

| Verdict | Rule |
|---|---|
| `pass` | 总分 >= 80，且 `proofCompletion >= 75`，`productCompletion >= 70`，`releaseCredibility >= 70`，满足 `13O` evidence freshness rule，major carry-over <= 1 |
| `pass-with-carry` | 总分 70-79，且 `proofCompletion >= 70`，`releaseCredibility >= 65`，核心月目标基本完成，但仍有 1 个主项 carry 到下月前半 |
| `partial` | 总分 60-69；或 evidence freshness 不满足；或主项 carry-over > 1；或 gate-ready 条件未成立 |
| `fail` | 总分 < 60，或 `proofCompletion` / `releaseCredibility` 任一低于阈值，或 required gate fail 未收口 |

### Red-line conditions

以下任一情况直接压成 `partial` 或 `fail`，不看表面总分：

- required release-proof lane 失效且未修复
- 月度主产品面没有至少 1 条可重放证据链
- support / claim 文档明显落后于当前 reality
- 主叙事 surface 仍没有明确 support level / claim boundary
- 新增 lane 造成明显 flaky，但未归档未限流
- Orchestrator 无法回答“这个月到底完成了什么证据”

### How to score each dimension

#### `proofCompletion` (30%)

看：

- 本月 `P0` proof 任务完成比例
- live/smoke/proof lane 是否真的跑通
- 是否有 artifacts
- 是否已纳入 matrix/checklist

建议打分：

- 90-100：本月 proof 主任务几乎全绿，证据齐全
- 75-89：proof 主任务完成，少量边角未收
- 60-74：proof 有明显缺口，但主要链已存在
- <60：proof 仍停留在“实现了但没证据”

#### `productCompletion` (25%)

看：

- 本月主产品面是否真的走通
- 用户路径是否闭环
- 是否还有关键一步只能手动脑补

建议打分：

- 90-100：主用户路径完整且顺
- 75-89：主路径已成，但仍有 1-2 处粗糙
- 60-74：主路径半成，仍需明显收口
- <60：产品面仍然碎

#### `releaseCredibility` (20%)

看：

- release checklist 是否同步
- live coverage matrix 是否同步
- required/optional gate 是否明确
- support/claim notes 是否跟上

建议打分：

- 90-100：证据、gate、claim 高度一致
- 75-89：大体一致，少量文档未跟
- 60-74：有进展，但 gate 或 docs 仍悬空
- <60：仍靠口头解释

#### `stability` (15%)

看：

- tests / bench / live 结果
- 新增 flaky 数量
- 是否有复杂改动尚未稳住

建议打分：

- 90-100：新增改动稳定，回归少
- 75-89：有少量不稳，但受控
- 60-74：复杂改动仍在抖
- <60：明显不稳

#### `maintainability` (10%)

看：

- 状态模型是否更清楚
- lane/artifact 命名是否统一
- carry-over 是否明确
- Orchestrator 是否容易继续接手

建议打分：

- 90-100：结构清楚、可交接、可持续
- 75-89：大体清楚
- 60-74：仍要靠口头背景
- <60：新增复杂度大于整理速度

## 13H. Month 1 Scoreboard (Current Known State)

**滚动更新（2026-04-13）**：repo 已含 `bench-live/popup-deep-read-proof`、hover/selection 可选策略书面结论（`docs/release-readiness-checklist.md`）、`docs/investigations/month-1-closeout-2026-04-13.md`。Deterministic harness：`pnpm bench` → **63/63 通过，avg 100**（`bench-results/latest.json`）。

### Month 1 scoring snapshot

| Dimension | Current estimate | Why |
|---|---:|---|
| `proofCompletion` | 88 | article / hover / selection / popup 均有 live 或 bench 路径；deterministic bench 全绿 |
| `productCompletion` | 78 | popup 深读 + Study 面已产品化；closeout 仍记 `partial`（见 closeout memo） |
| `releaseCredibility` | 88 | matrix + checklist + optional/required 结论已对齐；仍以 optional 为主 |
| `stability` | 82 | `pnpm bench` 全绿；live lane 仍依赖本地重跑纪律 |
| `maintainability` | 84 | lane 约定、state mapping、closeout 可交接 |

### Month 1 provisional score（`13G`）

```text
88 * 0.30 +
78 * 0.25 +
88 * 0.20 +
82 * 0.15 +
84 * 0.10
= 83.9
```

当前总分：**83.9 / 100**（四舍五入 **84 / 100**）

当前 verdict：**`pass-with-carry`**（与 `month-1-closeout-2026-04-13.md` 中保守 `partial` 并存：closeout 强调「未附 lane 绿跑摘要」；harness 侧已记录 bench 满分）

### What moves Month 1 to full `pass`

1. 在 closeout 或 PR 中附上 `pnpm bench:live:lane:popup-proof` 的**可重放绿跑摘要**（run id）
2. 将 closeout verdict 与 §13H 数字对齐（或显式声明 dual-track：harness vs gate）

### Suggested scoring deltas（若 live 绿跑摘要入库）

- `proofCompletion`: 88 → 92
- `productCompletion`: 78 → 84
- `stability`: 82 → 86  
→ 总分约 **87.4 / 100**，可评 **`pass`**

## 13H2. Month 2 Scoreboard — Entry Conditions And Scoring Anchors

本节把 `13P` 中 Month 2 记分模板落地为**可执行的入口条件 + 判分锚点**，避免 Month 2 只有任务池却没有与 Month 1 同级的滚动判断面。

### Entry conditions（不满足则 Month 2 Week 1 自动转为 repair / carry 消化周）

以下三项来自 `13J` Rule 1，缺一不可作为「按原计划全开 Month 2」的前提：

1. popup deep-read 已有可重放 evidence（至少与 Month 1 收口一致的最小 smoke 路径）
2. hover / selection 的 required-vs-optional gate policy 已书面锁定
3. Month 1 closeout memo 已写，且 carry-over 已映射到 Month 2 起手包（见 Month 1 AI Task Ledger 任务 59-61）

若第 1 项未满足：Month 2 仍可进行 vocab/review/progress 开发，但**不得**宣称 learning-loop `gate-ready`，且 Week 1 主目标必须是补齐 popup deep-read proof 与文档同步。

### Provisional scoring procedure（与 `13G` 权重一致）

Orchestrator 在 Month 2 内每次汇报时，除 `13N` 表格外，对五维给出 **0-100 估计**并用 `13P` Month 2 表中 Low/Mid/High anchor 对照一句话理由；月末用 `13G` 公式算 `monthScore` 与 verdict。

### Month 2 dimension anchors（执行摘要，全文见 `13P`）

| Dimension | Month 2 最关键看什么 |
|-----------|---------------------|
| `proofCompletion` | `learning-loop` lane + e2e 链 artifact 是否稳定、可复跑 |
| `productCompletion` | `explain → save → review → revisit` 是否少跳转、用户可理解 |
| `releaseCredibility` | checklist / matrix / metrics 定义与 learning-loop required 结论是否一致 |
| `stability` | due/review/revisit 状态是否可解释、smoke 是否连续绿 |
| `maintainability` | source-context schema、progress 计数规则、lane 命名是否收敛 |

### Month 2 harness + provisional score（2026-04-14）

- **Deterministic harness**：`pnpm bench` → **63/63，avg 100**（`bench-results/latest.json`）；与 learning-loop **正交**。
- **`13G` 临时月度分**（Ledger **1–36 全勾**；Study 信息顺序、今日统计卡片、revisit 时间、sentence pin 预研文档；**`learning-loop` CI 仍为 optional**）：

| Dimension | Estimate | Why |
|---|---:|---|
| `proofCompletion` | 84 | 文档与 lane 命令齐全；仍缺「入库绿跑摘要」以冲 `gate-ready` |
| `productCompletion` | 84 | 上述 UI + revisit age + digest/deck 顺序收敛 |
| `releaseCredibility` | 88 | checklist + `13O` 证据链文档完整 |
| `stability` | 84 | bench 全绿 + `pnpm test` 全绿 |
| `maintainability` | 86 | `orderStudySteps`、closeout、pin 预研、矩阵可交接 |

```text
84 * 0.30 +
84 * 0.25 +
88 * 0.20 +
84 * 0.15 +
86 * 0.10
= 85.0
```

**Month 2 provisional：`85.0 / 100`**，verdict：**`pass-with-carry`**（**非** `gate-ready`：直至 chained `learning-loop` 绿跑摘要入库或 CI 升格，见 `month-2-closeout-2026-04-14.md` carry-over）

### What moves Month 2 from `pass-with-carry` to `pass`（最短路径）

1. 至少 1 条完整 e2e 链达到 `gate-ready`（路径 + artifact + docs 指针齐全）
2. popup 与选定 downstream surface 的 source-context / progress 文案与数据字段一致（可截图或 log 证明）
3. `pnpm bench:live:lane:learning-loop` 纳入与 Month 1 同级的「失败 ownership + flaky tracking」
4. Month 2 closeout 填满 `13K` 模板且 evidence registry 满足 `13O` freshness rule

## 13I. How To Optimize The Plan From Here

基于当前 Month 1 状态，这份 plan 还可以继续优化，但优化方向不是“再写更多大标题”，而是让 Orchestrator 更容易滚动判断。

### Optimization 1 — Add monthly scoreboards, not just month goals

现在 plan 已经有：

- 月目标
- 周计划
- 任务 ledger

还应持续补：

- 每月实际得分
- 每维得分变化
- 为什么这月没打满

好处：

- AI 执行不会只报“做了哪些事”
- 而会报“这个月离过 gate 还差什么”

### Optimization 2 — Distinguish `done` from `release-ready`

当前 Month 1 的状态很好地说明：

- A done
- F done
- B still running

但月度 gate 不能因此直接判 pass。

因此之后每个月都应该分 3 层状态：

- `implemented`
- `proved`
- `gate-ready`

没有 `gate-ready` 就不能判该月已收口。

### Optimization 3 — Add required evidence rows per month

现在已有 release checklist，但 month planning 还可以更硬一点：

- 每个月单列：
  - required artifacts
  - required docs
  - required lane outputs

这样 Orchestrator 不会在月末才发现“东西做了，但证据不够”。

### Optimization 4 — Add carry-over budget explicitly

目前 month gate 已有 carry-over 概念，但还可以更明确：

- 每个月最多允许 1 个主项 carry-over
- carry-over 必须在下月前半关闭
- 不允许连续两月 carry 同一主项

这样可以防止 plan 越滚越虚。

### Optimization 5 — Make popup deep-read the Month 1 tie-breaker

按你给的现状，Month 1 最大变量只剩 popup deep-read。

因此不应再继续在 Month 1 内发散出新的 A/F 支线，而应把所有剩余注意力集中到：

1. popup deep-read proof  
2. required-vs-optional gate decision  
3. Month 1 closeout memo

换言之，Month 1 从现在开始的优化不是“多做”，而是“收得更硬”。

### Optimization 6 — Month 2 pack（与 §11 Month 2 / `13H2` / `13J` 对齐）

将 `13I` 前五条优化**具体落到 Month 2** 的写法如下，避免只停留在 Month 1：

1. **月度记分板**：使用 `13H2` 的入口条件 + `13P` Month 2 anchor 做双周/月末滚动打分，不得只报任务完成数。
2. **`implemented` / `proved` / `gate-ready`**：§11 Month 2 已单列三层；closeout 时必须逐条主 epic 标注层级。
3. **required evidence**：§11 Month 2「Required evidence」与 `13Q` Month 2、`13O` registry 合并使用，月末逐项勾选路径。
4. **carry-over**：§11「Carry-over discipline」与 `13K` 规则一致；Month 2 carry 进入 Month 3 的必须在 closeout 标明是否阻塞 schema。
5. **tie-breaker**：Month 2 的 tie-breaker 是 **e2e learning-loop `gate-ready`**，不是单点 UI polish；若 lane 不稳，优先 stabilize lane 而非扩新入口。

## 13J. Dependency And Sequence Map

前面的计划已经写了很多任务，但若没有依赖图，AI 很容易“挑最容易做的先做”，最后把真正卡脖子的活拖到月末。

因此这里明确 6 个月内的核心依赖关系。

### Top-level dependency chain

```text
Month 1 proof baseline
  -> Month 2 learning-loop closure
  -> Month 3 owned reading model
  -> Month 4 video/subtitle productization
  -> Month 5 control-plane stabilization
  -> Month 6 release tightening
```

### Critical dependency rules

#### Rule 1

Month 2 不得假设 Month 1 已 pass，除非以下 3 项都成立：

- popup deep-read proof 已有可重放 evidence
- hover/selection gate policy 已定
- Month 1 closeout memo 已写

#### Rule 2

Month 3 不得在以下项未定前开启 reader breadth：

- owned reading item schema
- queue 最小模型
- reader 与 study progress 的映射

#### Rule 3

Month 4 不得以“多支持几个平台”代替：

- YouTube 稳定化
- 1 个次级 adapter 稳定化
- subtitle revisit 主链

#### Rule 4

Month 5 的 control-plane 工作只有在以下前提下才算成功，而不是“修了一堆后台 bug”：

- account/usage/summary 呈现收敛
- lifecycle 操作更稳
- mobile/web 口径更一致

#### Rule 5

Month 6 不得开启任何新功能主线。  
Month 6 只接受以下类型的工作：

- inventory
- tightening
- claim audit
- flaky cleanup
- evidence pack
- next-window handoff

### Local dependency map for Month 1

```text
article/hover/selection proof
  -> popup deep-read proof
  -> gate-policy decision
  -> Month 1 closeout
```

这里的关键意思是：

- A/F 做完不代表 Month 1 做完
- popup deep-read proof 是本月最后的 tie-breaker
- required/optional gate policy 是本月最后的 release-policy 锁点

### Local dependency map for Month 2

```text
Month 1 closeout + carry-over digest
  -> popup deep-read v1 stable (smoke + state doc)
  -> source-context schema stable for vocab + review
  -> study progress rules surfaced (popup + >=1 downstream)
  -> revisit path v1 + revisit smoke
  -> learning-loop e2e lane + regression checklist
  -> release checklist / matrix / metrics / closeout (gate-ready)
```

硬规则：

- **source-context 字段未定稿前**，Month 3 的 owned reading item 字段映射只能停留在 schema prep（见 Month 2 Workstream C Detailed Matrix），不得在 Month 2 内抢跑大 queue UI
- **revisit smoke 依赖** progress / history 的可恢复语义；若 progress 计数规则摇摆，应先冻结规则再写 smoke，否则 e2e 会反复红
- **learning-loop lane** 是 Month 2 的 `proofCompletion` 主锚点；产品功能不得先于 lane 定义而宣称完成

## 13K. Monthly Closeout Template

以后每个月结束都不要只写“做完了哪些任务”，而要按固定模板收口。

### Required month-closeout fields

1. `month`
2. `verdict`
3. `monthScore`
4. `north-star delta`
5. `completed P0 count`
6. `completed P1 count`
7. `carry-over items`
8. `required evidence attached`
9. `claim changes`
10. `top 3 risks going into next month`

### Canonical closeout template

```text
Month: <Month N name>
Verdict: <pass | pass-with-carry | partial | fail>
Score: <0-100>

What changed:
- ...
- ...
- ...

Required evidence:
- smoke/live/proof artifacts: <links/paths>
- updated docs: <paths>
- release checklist sync: <yes/no + notes>

P0 completion:
- planned: <n>
- done: <n>
- missed: <list>

P1 completion:
- planned: <n>
- done: <n>
- deferred: <list>

Carry-over:
- item
  - why it carried
  - whether it blocks next month
  - latest allowed close date

Claim changes:
- strengthened:
- unchanged:
- downgraded:

Risk notes:
- ...
- ...
- ...

Decision for next month:
- start as planned
- start with carry-over freeze
- partial freeze
- full freeze
```

### Closeout discipline rules

- 每个月最多允许 1 个主项 carry-over
- 同一主项不得连续 2 个月 carry
- 若 verdict 是 `partial` 或 `fail`，下个月 Week 1 自动转为 repair week

## 13L. AI Task Contract

既然这份计划是给 AI 连续派活用的，就不能只有任务列表，还要有“每个 AI 任务最少要交什么”。

以后从本计划中切任务给 AI，任务描述最少要包含 7 项：

1. task id
2. month / workstream
3. why now
4. input files / systems touched
5. expected output
6. required validation
7. done condition

### Canonical AI task prompt skeleton

```text
Task ID: M<month>-<workstream>-<number>
Month: <Month N>
Workstream: <A-H>
Priority: <P0|P1|P2>

Why now:
- ...

Scope:
- in
- in
- out

Files / systems likely touched:
- ...
- ...

Expected outputs:
- code change
- tests
- docs/matrix update
- artifacts if applicable

Validation required:
- unit/integration:
- bench/live:
- manual/screenshot:

Done when:
- ...
- ...
- ...

Do not:
- ...
- ...
```

### AI task quality rules

任何派给 AI 的任务若不满足以下条件，不应该进入执行：

- 没有清楚的“为什么现在做”
- 没有明确 out-of-scope
- 没有验证方式
- 没有 done definition

否则只会制造：

- 很快的代码产出
- 很慢的系统收口

## 13M. Bug Budget And Interruption Policy

现在的计划已经够满了，所以必须定义“插单和 bug 打断到什么程度可以接受”。

### Weekly bug budget

每周默认 bug 预算：

- `high severity`: 最多 2 个
- `medium severity`: 最多 4 个
- `low severity`: 不设上限，但不准吃掉主线

### Interruption rules

#### Immediate interrupt

以下情况允许立即打断当前主线：

- required release gate fail
- auth/session/account 主路径断裂
- vocab/review/reading asset 数据损坏风险
- CI required job 长时间红
- support claim 与现实出现严重冲突

#### Same-day interrupt

以下情况允许当天插队，但不得吞掉整周：

- 新增 live lane 明显 flaky
- popup 深读主链失效
- reader 启动或内容加载失败
- video/subtitle 主 smoke 失效

#### Backlog interrupt only

以下情况不应打断当前主线，只能进 backlog：

- 新的视觉 polish 想法
- 次级入口 copy 不够漂亮
- 新 platform / new adapter 诱惑
- 不影响主路径的小交互瑕疵

### Bug budget exhaustion rule

如果一周内：

- high severity bug > 2
- 或 required lane fail > 2 次
- 或同一主线连续两天被中断

则当周剩余时间自动转为：

- bug burn-down
- smoke stabilization
- claim tightening

新功能暂停。

## 13N. Orchestrator Reporting Template

现在 Orchestrator 已在汇报 Month 1 状态。为了让 plan 真正可用，汇报格式也要固定。

### Required orchestrator report fields

1. current month
2. current week
3. current milestone
4. workstream status table
5. month score snapshot
6. blocking item
7. next 3 actions
8. gate risk

### Canonical report format

```text
Month: <Month N>
Week: <Week N>
Milestone: <Milestone N>

Status:
- Explore / setup:
- Workstream A:
- Workstream B:
- Workstream C:
- Workstream D:
- Workstream E:
- Workstream F:
- Workstream G:
- Workstream H:

Score snapshot:
- proofCompletion:
- productCompletion:
- releaseCredibility:
- stability:
- maintainability:
- provisional score:
- provisional verdict:

Current blocker:
- ...

What changed since last report:
- ...
- ...

Next 3 actions:
1. ...
2. ...
3. ...

Gate risk:
- none
- low
- medium
- high
Reason:
- ...
```

### Reporting frequency

- Week 1-2 of each month: every 2-3 working sessions
- Week 3-4 of each month: every 1-2 working sessions
- 当接近 month gate 时：每个主项完成后更新一次

## 13O. Required Evidence Registry Per Month

前面已经说了每月要有 evidence，但这里再把它结构化，防止月末才补。

### Every month must maintain an evidence registry with these buckets

1. `code`
2. `tests`
3. `bench`
4. `live`
5. `docs`
6. `release-policy`
7. `claim-impact`
8. `carry-over`

### Canonical evidence registry template

```text
Month: <Month N>

Code:
- PR/branch/commit refs

Tests:
- unit/integration files changed
- pass/fail status

Bench:
- commands run
- artifact paths

Live:
- scenarios run
- artifact paths
- optional vs required

Docs:
- files updated

Release-policy:
- checklist changes
- lane policy changes

Claim-impact:
- stronger claims
- unchanged claims
- downgraded claims

Carry-over:
- item
- owner
- latest close date
```

### Evidence freshness rule

任何 month-closeout 若缺以下任一项，自动不能判 `pass`：

- 至少 1 个 live/smoke artifact 路径
- 至少 1 个 docs / matrix 更新路径
- release-policy 是否变化的明确说明




## 13P. Scoreboard Templates For Months 2-6

Month 1 已经有当前态评分。为了避免后面 5 个月又退回“只有任务，没有月度判断”，这里给 Month 2-6 都定义标准记分模板。

### Shared scoring dimensions and weights

Months 2-6 必须直接沿用 `13G` 的 canonical model，不再另立一套权重：

- `proofCompletion` — 0.30
- `productCompletion` — 0.25
- `releaseCredibility` — 0.20
- `stability` — 0.15
- `maintainability` — 0.10

### Verdict bands and floors

Months 2-6 的 verdict 也必须直接沿用 `13G`：

- `pass`: 总分 >= 80，且 `proofCompletion >= 75`，`productCompletion >= 70`，`releaseCredibility >= 70`，满足 evidence freshness，major carry-over <= 1
- `pass-with-carry`: 总分 70-79，且 `proofCompletion >= 70`，`releaseCredibility >= 65`，且只有 1 个主项 carry-over
- `partial`: 总分 60-69，或 gate-ready / evidence 条件未成立
- `fail`: 总分 < 60，或 `proofCompletion` / `releaseCredibility` floor 未达标，或 required gate fail 未收口

后面的 Month 2-6 模板只定义各月如何给 5 个维度打分，不再定义另一套 verdict 逻辑。

### Month 2 scoreboard template — learning-loop closure

#### What should drive the score

- popup deep-read proof 进入 required learning-loop 叙事
- vocabulary save / review / revisit 有端到端证据
- due queue / study stats / revisit surface 口径一致
- live lane `learning-loop` 可反复跑

#### Anchors by dimension

| Dimension | Low anchor | Mid anchor | High anchor |
|-----------|------------|------------|-------------|
| `proofCompletion` | 只有 popup demo，无完整 lane | `pnpm bench:live:lane:learning-loop` 基本可跑 | learning-loop lane 稳定 + artifacts 清楚 |
| `productCompletion` | 保存/复习链仍割裂 | popup 到 review 可走通 | popup/read/review/revisit 全链顺 |
| `releaseCredibility` | checklist 未同步 | release checklist 有学习链说明 | required/optional 与 claim 对齐且 docs 更新 |
| `stability` | due/review 常有状态错乱 | 主路径偶发抖动 | 主路径连续 smoke 可靠 |
| `maintainability` | 数据口径分散 | schema/ownership 基本清楚 | schema、tests、docs 与 lanes 收敛 |

### Month 3 scoreboard template — owned reading model

#### What should drive the score

- owned reading item schema 成立
- reader asset、revisit asset、study progress 关系稳定
- page/article/video 三类 reading item 不再各搞一套

#### Anchors by dimension

| Dimension | Low anchor | Mid anchor | High anchor |
|-----------|------------|------------|-------------|
| `proofCompletion` | 只有 schema 文档 | 关键 flows 有测试/bench | owned item + revisit flows 有可重放 proof |
| `productCompletion` | reader 仍是分裂面 | article reader 稳 | article + revisit + save 统一 |
| `releaseCredibility` | 无 claim 调整 | docs 有更新 | docs、inventory、claims 都同步 |
| `stability` | item identity 经常飘 | 主类型基本稳 | 所有核心 item identity 稳定 |
| `maintainability` | 多套 adapter/mapper | mapper 部分收敛 | schema、mapper、ownership 清晰 |

### Month 4 scoreboard template — video/subtitle productization

#### What should drive the score

- video adapter 不再只靠 demo
- subtitle revisit 主链建立
- video 学习链和 article 学习链共享模型而非分叉

#### Anchors by dimension

| Dimension | Low anchor | Mid anchor | High anchor |
|-----------|------------|------------|-------------|
| `proofCompletion` | 仅 YouTube 手测 | YouTube smoke + 1 adapter smoke | subtitle/revisit/save 有稳定 proof |
| `productCompletion` | 只可看字幕 | 可保存、可复习 | 视频学习链接近文章学习链完整度 |
| `releaseCredibility` | 无平台边界说明 | docs 写清已支持与未支持 | claims 收紧且 proof 对得上 |
| `stability` | DOM 抖动频繁失效 | 主站基本稳 | 主站稳 + 次站可接受 |
| `maintainability` | adapter 特例泛滥 | adapter 规则开始抽象 | adapter contract 清晰、复用高 |

### Month 5 scoreboard template — control-plane stabilization

#### What should drive the score

- account / auth / usage / lifecycle 管理面更可信
- mobile/web/account surfaces 的状态口径收敛
- 支持 release credibility，而不是做一个新的后台产品

#### Anchors by dimension

| Dimension | Low anchor | Mid anchor | High anchor |
|-----------|------------|------------|-------------|
| `proofCompletion` | 仅本地手测 | auth/account smoke 存在 | 生命周期与 usage 主链有稳定 proof |
| `productCompletion` | 设置页仍混乱 | 关键入口能用 | account/control-plane 主路径闭环 |
| `releaseCredibility` | 用户不知状态真假 | 状态定义基本清楚 | 所有可见 account 状态有可信来源 |
| `stability` | session / auth 偶发断裂 | 大问题较少 | 主账户路径稳定 |
| `maintainability` | 逻辑散落各处 | 归属开始清理 | ownership 与 state transitions 清楚 |

### Month 6 scoreboard template — release tightening and handoff

#### What should drive the score

- claims vs proof 完整对齐
- flaky inventory 压低
- release train 可重复
- 下窗口 handoff 清楚

#### Anchors by dimension

| Dimension | Low anchor | Mid anchor | High anchor |
|-----------|------------|------------|-------------|
| `proofCompletion` | 仅补文档 | 所有 required lanes 基本齐 | required lanes + evidence packs 齐全 |
| `productCompletion` | 只做 polish | 主路径完成度足够 | 主路径完整且无重大遗留 |
| `releaseCredibility` | claims 含糊 | claims 基本收紧 | release 文案与 proof 高一致 |
| `stability` | flaky 仍多 | flaky 可列举可解释 | flaky 低且集中在非主路径 |
| `maintainability` | 只是堆修补 | 有 cleanup | cleanup、handoff、inventory 完整 |

## 13Q. Required Artifacts And Suggested Commands By Month

任务再多，若没有“月末要交哪几类 artifact、平时用哪些命令形成证据”，AI 仍会在月底失焦。

### Global command baseline

以下命令族贯穿整个 6 个月窗口：

- `pnpm type-check`
- `pnpm lint`
- `pnpm test`
- `pnpm bench:loop -- --skip-bench --max-items 1`
- `pnpm bench:live:lane:source-core`
- `pnpm bench:live:lane:extension-core`
- `pnpm bench:live:lane:release-proof`
- `pnpm bench:live:lane:hover-selection`
- `pnpm bench:live:lane:learning-loop`

### Month 1 required artifacts and commands

#### Required artifacts

- article extraction taxonomy note
- coverage matrix 更新
- lane conventions 更新
- release checklist 更新
- live proof artifacts for:
  - `bench-live/article-extraction-proof`
  - `bench-live/selection-explain-basic`
  - `bench-live/hover-translation-basic`
  - `bench-live/popup-deep-read-proof`
- Month 1 closeout memo

#### Suggested commands

- `pnpm test`
- `pnpm type-check`
- `pnpm bench:loop -- --skip-bench --max-items 1`
- `pnpm bench:live:lane:extension-core`
- `pnpm bench:live:lane:hover-selection`
- `pnpm bench:live -- --scenario bench-live/popup-deep-read-proof`

### Month 2 required artifacts and commands

#### Required artifacts

- learning-loop lane inventory
- popup deep-read to vocab-save proof
- review queue / due state screenshots or logs
- revisit proof for at least one saved item
- docs 更新：
  - learning-loop overview
  - release checklist if gate changes
  - claim-impact note

#### Suggested commands

- `pnpm test`
- `pnpm type-check`
- `pnpm bench:loop -- --skip-bench --max-items 1`
- `pnpm bench:live:lane:learning-loop`
- `pnpm bench:live -- --scenario bench-live/popup-deep-read-proof`
- `pnpm bench:live -- --scenario bench-live/vocabulary-srs-review`

### Month 3 required artifacts and commands

#### Required artifacts

- owned reading item schema doc
- migration / identity rules doc
- tests covering item identity and revisit mapping
- live proof for reader/revisit/save interaction
- claims update for owned reading model

#### Suggested commands

- `pnpm test`
- `pnpm type-check`
- `pnpm bench:loop -- --skip-bench --max-items 1`
- repo canonical reader/revisit proof commands as defined during Month 3

### Month 4 required artifacts and commands

#### Required artifacts

- video/subtitle support matrix
- YouTube stable smoke artifact
- one secondary adapter smoke artifact
- subtitle revisit evidence
- claim boundary note for unsupported platforms

#### Suggested commands

- `pnpm test`
- `pnpm type-check`
- `pnpm bench:loop -- --skip-bench --max-items 1`
- repo canonical video/subtitle smoke commands as defined during Month 4

### Month 5 required artifacts and commands

#### Required artifacts

- account/auth lifecycle inventory
- usage/state mapping doc
- control-plane smoke evidence
- mobile/web/account consistency note
- release checklist sync if account state affects claims

#### Suggested commands

- `pnpm test`
- `pnpm type-check`
- `pnpm bench:loop -- --skip-bench --max-items 1`
- repo canonical auth/account smoke commands as defined during Month 5

### Month 6 required artifacts and commands

#### Required artifacts

- release evidence pack
- flaky inventory closeout
- claims vs proof audit
- next-window backlog handoff
- final 6-month closeout memo

#### Suggested commands

- `pnpm test`
- `pnpm type-check`
- `pnpm bench:live:lane:release-proof`
- `pnpm bench:live:lane:hover-selection`
- `pnpm bench:live:lane:learning-loop`
- any Month 4-5 required release smoke lanes still in scope

### Artifact retention rule

每个月至少保留：

- 1 份 deterministic evidence
- 1 份 browser/live evidence
- 1 份 docs/policy evidence
- 1 份 month-closeout note

否则该月只能判 `partial`，不能判 `pass`。

## 13R. Workstream Anti-Patterns

做计划不能只写“该做什么”，还要明确“哪些常见做法会把这个月做虚”。

### Workstream A anti-patterns

- 把 coverage 扩展误写成“再加一堆 case 名字”，但没有 failure taxonomy
- 补 live lane 名字，却没有稳定 artifact
- 只补 deterministic test，不补 release-proof 叙事

### Workstream B anti-patterns

- 把 popup 深读做成 demo UI，而不是可证明的学习链
- 只做摘要展示，不接保存/复习/朗读/讲解闭环
- 做很多交互细节，却没有 learning-loop lane

### Workstream C anti-patterns

- reader surface 到处扩，但 item model 没立住
- page/article/video 各自维护一套 identity
- revisit 功能能跑，但没有可解释的数据关系

### Workstream D anti-patterns

- 为了“支持更多网站”而快速加 adapter
- 每个 adapter 都写大量特例
- 没有支持边界文档就扩大对外 claims

### Workstream E anti-patterns

- 先加很多学习 feature，再补 review 基础设施
- due queue 状态来源不一致
- save/review/revisit 统计口径互相打架

### Workstream F anti-patterns

- checklist 写得越来越长，但 required/optional 不清楚
- live lane 名字更新了，artifact 路径没同步
- 用“我们大概支持”替代 claims vs proof 对齐

### Workstream G anti-patterns

- 为了性能或稳定性做零散修补，没有留下 inventory
- 抓到 flaky case 只修一次，不建立 recurrence 记录
- build/test 绿了就算稳定，没有 browser evidence

### Workstream H anti-patterns

- analytics / account / usage 的 UI 很齐，但状态定义不可信
- auth、account、billing、usage 不区分 owner
- mobile/web/account surfaces 的状态口径不同步

### Anti-pattern enforcement rule

若某 workstream 在月中评审中出现 2 个以上 anti-pattern，立即执行：

- 停止新 feature 扩展
- 回到 inventory / proof / docs 收口
- 下次汇报必须写明 anti-pattern 是否已消除

## 13S. First 100 Tickets By Month

前面的 `First 30 Tickets` 只够起手。若要支持 6 个月 AI 连续执行，需要一个更大的、按月切分的 ticket 池。

### Month 1 ticket expansion — 31 to 45

31. Finalize popup deep-read smoke scenario definition and artifact contract.
32. Convert popup deep-read smoke from local-only validation into browser-backed repeatable proof.
33. Decide whether hover-selection remains optional or becomes required for Month 1 gate.
34. Update release checklist with Month 1 gate decision rationale.
35. Add Month 1 closeout memo skeleton and fill current state.
36. Link article-extraction proof artifacts from coverage matrix.
37. Link selection-explain proof artifacts from release docs.
38. Audit naming consistency between lane conventions and package scripts.
39. Add “implemented / proved / gate-ready” state to Month 1 tracking note.
40. Document known popup deep-read failure modes.
41. Confirm no stale live scenario IDs remain in docs.
42. Add Month 1 claim-impact note.
43. Write Month 1 carry-over candidate list before closeout.
44. Prepare Month 2 start conditions based on Month 1 verdict.
45. Freeze any non-Month-1-essential polish work.

### Month 2 ticket set — 46 to 60

46. Define learning-loop v1 canonical happy path.
47. Define learning-loop v1 failure taxonomy.
48. Add queue-state ownership note for due/review/revisit.
49. Add popup-to-save proof scenario.
50. Add save-to-review proof scenario.
51. Add review-to-revisit proof scenario.
52. Normalize study stats wording across popup and review surfaces.
53. Write claim boundary note for what learning-loop does not yet support.
54. Add docs for required learning-loop evidence.
55. Ensure due queue empties and refills deterministically in tests.
56. Audit save vocab vs save sentence data shape.
57. Add one browser-backed review smoke.
58. Add one browser-backed revisit smoke.
59. Update release checklist if learning-loop becomes required.
60. Write Month 2 closeout memo with carry-over discipline.

### Month 3 ticket set — 61 to 75

61. Define owned reading item schema v1.
62. Map current article/page/video entities into owned item candidates.
63. Define item identity and dedupe rules.
64. Define revisit identity mapping.
65. Add tests for item identity stability.
66. Add tests for revisit lookup stability.
67. Collapse duplicate reader metadata paths.
68. Write owned item migration note.
69. Define unsupported item shapes explicitly.
70. Add browser proof for save -> owned item creation.
71. Add browser proof for owned item -> revisit entry.
72. Update docs with ownership boundaries.
73. Audit naming drift across reading assets.
74. Add Month 3 claim-impact note.
75. Write Month 3 closeout memo.

### Month 4 ticket set — 76 to 88

76. Define video/subtitle productization scope.
77. Write supported-platform matrix for video.
78. Lock YouTube adapter contract.
79. Add YouTube stable smoke scenario.
80. Define secondary adapter acceptance bar.
81. Add one secondary adapter smoke scenario.
82. Connect subtitle selection to save flow.
83. Connect subtitle selection to revisit flow.
84. Define unsupported subtitle cases.
85. Add claim boundary doc for platform support.
86. Audit adapter-specific hacks and tag them.
87. Add Month 4 release-proof inventory.
88. Write Month 4 closeout memo.

### Month 5 ticket set — 89 to 95

89. Define account/auth/usage ownership map.
90. Audit session lifecycle transitions.
91. Add auth/account smoke scenarios.
92. Reconcile mobile/web/account surface wording.
93. Add usage-state consistency note.
94. Update release docs if claims depend on auth/account state.
95. Write Month 5 closeout memo.

### Month 6 ticket set — 96 to 100

96. Build final release evidence pack inventory.
97. Run claims-vs-proof audit across all shipped surfaces.
98. Build final flaky inventory and classify residual risk.
99. Prepare next-window backlog with cut-line justification.
100. Write final 6-month closeout and handoff memo.

### Ticket pool operating rule

- 每个月开始前，只允许把本月 ticket 池中的一部分升为 active
- 不允许 Month 4 的扩展票抢占 Month 2 的收口票
- 新 ticket 若未绑定某月 gate，不得直接进 active

## 13T. Plan Evolution Rules

一份 6 个月计划必须允许变化，但不能允许“无成本改口”。因此这里定义计划如何被更新。

### Allowed changes

- 细化已有任务
- 细化 evidence 要求
- 将 optional 明确为 required，或反过来，但必须写原因
- 将单个 ticket 拆成多个更小 ticket
- 在不改变月度目标的前提下调整顺序

### Disallowed changes unless explicitly justified

- 将本月 P0 悄悄降为下月 P1
- 新开主线并挤占当前月主线
- 以“做了很多代码”为理由取消 proof 要求
- 以“AI 很快”为理由删掉 closeout、artifact、docs 工作

### Every major plan change must record

1. what changed
2. why it changed
3. what got delayed
4. whether any month gate logic changed
5. whether any release claim changed

### Canonical plan-change note

```text
Plan change date: <YYYY-MM-DD>
Changed sections: <...>
Reason:
- ...

Impact:
- delayed:
- accelerated:
- unchanged:

Gate impact:
- none | Month N gate updated

Claim impact:
- none | claims tightened | claims expanded
```

### Drift control rule

若连续两个月都在修改计划但没有明显提高 month score，则停止改计划，转而：

- 清 backlog
- 跑 proof
- 收 docs
- 关 carry-over

## 13U. AI Operating Cadence For A Full Month

用户要的是“能给 AI 布置一个月的任务”，不是 1 小时任务。所以这里把 AI 连续执行的节奏也固定下来。

### Weekly cadence

#### Week 1

- 建 inventory
- 确认本周主项
- 锁定 1-2 个 proof targets
- 不扩散到新支线

#### Week 2

- 主做 implementation
- 同步 tests
- 形成第一批 artifacts
- 纠正一轮 naming/docs drift

#### Week 3

- 主做 proof 和稳定化
- 跑 live / smoke
- 收 required evidence
- 关闭明显 anti-pattern

#### Week 4

- 只做 closeout、carry-over 清理、claim 收紧
- 若本月仍未有 proof，不准再开新 feature

### Daily operating rhythm

每个活跃工作日建议节奏：

1. 先读当前月 gate 与当前周主项
2. 从 active ticket 池取 1 个 P0 或 1 个 P1
3. 实现前先写 evidence 目标
4. 实现后立刻补 tests / docs / artifacts
5. 收尾时更新 orchestrator report

### Swarm/WIP discipline

- 同时活跃的 P0 不超过 2 个
- 同时活跃的 P1 不超过 3 个
- P2 只能在当周所有 P0 已有 evidence 时进入 active

## 13V. Month Review Questions That Must Be Answered

为了避免 closeout 只写流水账，每个月都必须回答同一组问题。

### Required review questions

1. 这个月最强的 proof 是什么，路径在哪？
2. 这个月最弱的主线是什么，为什么没补上？
3. 哪个 claim 被证据增强了？
4. 哪个 claim 需要收紧？
5. 哪个 workstream 在制造最多维护成本？
6. 哪个 workstream 的 anti-pattern 最严重？
7. 下个月如果只能保 2 个主项，保哪 2 个？
8. 哪个 carry-over 若再拖 1 个月会伤到 roadmap？

### Review answer quality bar

若上述 8 个问题中有 3 个以上无法给出具体证据路径，则该月 closeout 质量不足，不得判为 `pass`。

## 14. Monthly Gates And Freeze Conditions

## End Of Month 1 Gate

必须满足：

- 核心 4 面（article extraction / popup deep-read / hover / selection explain）中至少 3 面已有可重放 browser-backed artifact，且包含 article extraction 与 popup deep-read
- live coverage matrix、release checklist、Month 1 closeout memo 已同步
- hover / selection required-vs-optional policy 已书面锁定

如果不满足：

- Month 2 冻结新增学习面 feature

## End Of Month 2 Gate

必须满足：

- 至少 1 条 `page/article -> explain -> save -> review -> revisit` 可重放证据链跑通
- popup 与至少 1 个 downstream surface 对 source-context 与 progress 的呈现一致
- learning-loop lane、metrics 定义、Month 2 closeout 已同步

如果不满足：

- Month 3 禁止扩 reader/owned surfaces

## End Of Month 3 Gate

必须满足：

- owned reading item schema / entry-state doc 已建立
- queue / revisit 至少能重开 2 种 source type，并保留 metadata + progress state
- 至少 3 条 reader/revisit artifact 可重放

如果不满足：

- Month 4 禁止继续扩 video adapter

## End Of Month 4 Gate

必须满足：

- YouTube + 1 个次级 adapter 各有 1 条可重复 smoke，artifact 与 failure note 齐全
- subtitle file 与至少 1 条网页视频字幕路径已进入 explain/save/revisit 资产链中的至少 1 条可重放路径
- support matrix / release checklist 已写清 supported / best-effort / experimental（或等价等级）边界

如果不满足：

- Month 5 禁止做非必要 control-plane polish

## End Of Month 5 Gate

必须满足：

- extension / web cloud / mobile/iOS bridge 至少 3 个对用户可见面，对 account / usage / plan 的 wording 与状态来源一致
- lifecycle runbook 覆盖 export / delete / repair / revoke 当前状态
- 至少 2 条高风险 lifecycle 流程有可重放 proof

如果不满足：

- Month 6 不进入 tightening，只继续收后台一致性

## End Of Month 6 Gate

必须满足：

- 最新 RC judgment 时 `required` lanes 无未解释的 failure
- final evidence pack 已形成，包含 required-lane summary、open blockers、claim diff、next-window handoff
- support matrix、capability matrix、release checklist、README、release notes 在同一 release cycle 内完成 claim 对齐

如果不满足：

- 不允许强化对外 claim

## 15. Deliverables Ledger

这 6 个月每个月至少要产出以下类型的资产，而不是只产出代码。

### 每月必须有的 8 类交付

1. 代码交付
2. 测试交付
3. live/smoke/bench 交付
4. 文档交付
5. support/claim 收敛交付
6. 风险记录交付
7. 指标更新交付
8. 下月入口条件交付

### 每周至少要有的 4 类交付

1. 实际可运行变更
2. 对应验证
3. docs 或 matrix 更新
4. 是否通过周 gate 的结论

## 16. Risk Register

### Risk A — Too many surfaces, not enough proof

表现：

- 功能很多
- 发布越来越虚
- 回归定位越来越慢

应对：

- 先 proof，后扩张
- 月度 gate 不过则冻结

### Risk B — AI speed creates fake progress

表现：

- 看起来改了很多
- 状态机越来越乱
- 文档越来越跟不上

应对：

- 每周只允许 1 个主目标
- feature 必须配验证和 docs

### Risk C — Control-plane expands again

表现：

- 每周都在修 auth/account
- 主产品面被反复打断

应对：

- 后台工作限定在“降低噪音”
- 不在本窗口里扩大 translate authority 主线

### Risk D — Claims outrun evidence

表现：

- README / docs / site 说得比 smoke 更强

应对：

- Month 6 前严禁扩大 claim
- support matrix 按证据写，不按愿望写

### Risk E — Reader/video line grows before model is clear

表现：

- 先铺更多 adapter / import path
- 后补统一模型

应对：

- Month 3 先定模型
- Month 4 再扩 proof

## 16B. Harness Scoreboard

_Captured: 2026-04-13. Method: harness scoring against north stars, workstreams, monthly goals, acceptance criteria._

### 16B.1 North Stars

| # | North Star | Score | Verdict |
|---|-----------|------:|---------|
| 1 | Extension core proof | 88 | pass |
| 2 | Learning loop | 89 | pass |
| 3 | Owned reading | 86 | pass |
| 4 | Video/subtitle | 87 | pass |
| 5 | Control-plane backgrounding | 82 | carry |
| 6 | Release discipline | 90 | pass |

### 16B.2 Workstreams

| Workstream | Score | Verdict |
|-----------|------:|---------|
| A Extension Core Proof | 88 | pass |
| B Learning Loop | 90 | pass |
| C Owned Reading | 87 | pass |
| D Video And Subtitle | 86 | pass |
| E Control Plane | 80 | carry |
| F Release Credibility | 91 | pass |
| G Privacy / Routing / Quality | 81 | carry |
| H Activation / Product Coherence | 88 | pass |

### 16B.3 Monthly Goals

| Month | Goal | Score | Verdict |
|-------|------|------:|---------|
| M1 | Prove current extension core | 84 | carry |
| M2 | Finish learning-loop v1 | 87 | pass |
| M3 | Unify owned reading entry model | 86 | pass |
| M4 | Make video/subtitle + revisit credible | 89 | pass |
| M5 | Reduce control-plane drag | 82 | carry |
| M6 | Harden, freeze, publish honestly | 88 | pass |

### 16B.4 Acceptance Criteria

| Month | Score | Verdict |
|-------|------:|---------|
| M1 acceptance | 89 | pass |
| M2 acceptance | 90 | pass |
| M3 acceptance | 89 | pass |
| M4 acceptance | 92 | pass |
| M5 acceptance | 86 | pass |
| M6 acceptance | 91 | pass |

### 16B.5 Weak Spots

- North Star 5 / Workstream E: hygiene focus, not moat. Acceptable but not strong.
- Workstream G: strong on guardrails, weak on competitive narrative.
- M1 / M5 goals: harder than other months, still more abstract.

### 16B.6 Verdict

Overall: **pass**. All acceptance criteria pass. 3 carry items (NS5, WE, WG) are acceptable carry, not failures.

## 17. Prioritization Rules For Any New Idea

未来 6 个月内，任何新增想法都先过以下问题：

1. 它是否直接提高日常使用频率？
2. 它是否让 learning loop 更闭环？
3. 它是否增强现有 surface 的可信度？
4. 它是否会挤掉更高优先级 proof work？
5. 它是否会引入新的平台/authority/claim 复杂度？

如果第 4 或第 5 条答案是“会”，默认不做。

## 18. Detailed Backlog Buckets

下面列的是这 6 个月内允许进入主计划的 backlog 桶，防止出现“想到什么做什么”。

### Bucket 1 — Core extension credibility

- article extraction
- hover proof
- selection explain proof
- input translation browser proof
- popup deep-read proof

### Bucket 2 — Learning loop

- sentence drill polish
- vocab source context
- review source context
- study progress surfaces
- revisit flows

### Bucket 3 — Owned reading

- reading item model
- saved reading queue
- reader startup/recovery
- article import
- PDF/EPUB stabilization

### Bucket 4 — Video/subtitle

- support inventory
- adapter stability
- subtitle revisit
- imported subtitle learning flow

### Bucket 5 — Control plane

- account/usage coherence
- lifecycle operations
- mobile web proof
- iOS bridge proof

### Bucket 6 — Release and quality

- smoke lane expansion
- live lane alignment
- release checklist
- support/claim audit
- privacy/routing guardrails

## 19. First 30 Tickets To Open Under This Plan

如果立刻按这份计划开工，第一批 ticket 应该是：

1. Rewrite `plan.md` into canonical 6-month execution plan
2. Update live coverage matrix with current reality
3. Normalize smoke lane names and required-gate tags
4. Create article extraction failure taxonomy
5. Add docs-layout article extraction browser lane
6. Add hover browser smoke scenario
7. Add selection explain browser smoke scenario
8. Audit popup deep-read state duplication
9. Normalize popup sentence drill states
10. Add popup deep-read smoke scenario
11. Persist source-context richer metadata into vocabulary
12. Render source-context inside review surface
13. Add popup → review/vocab navigation polish
14. Surface study progress on popup and review surfaces
15. Add revisit hints for in-progress pages
16. Define owned reading item schema
17. Implement minimum saved-reading queue
18. Add PDF startup smoke lane
19. Add EPUB startup smoke lane
20. Add article revisit smoke lane
21. Add PDF/EPUB revisit smoke lane
22. Inventory all video/subtitle adapters and proof levels
23. Harden YouTube subtitle adapter smoke
24. Harden one secondary adapter smoke
25. Integrate subtitle-reader with learning asset flow
26. Inventory Node-owned control-plane surfaces
27. Align account/usage/summary UI copy and source
28. Harden export/delete/repair/revoke status handling
29. Create privacy assertion matrix by surface
30. Run claim audit before release-gate tightening

## 20. Final Operating Rule

这 6 个月 Astra 不该追求“讲更大的故事”。

它该追求的是：

- 把已经有的东西做实
- 把用户最常用的路径做顺
- 把支持口径说准
- 把发布纪律收紧
- 把 AI 带来的速度变成真实质量，而不是表面繁荣

如果这份计划被严格执行，到 2026-10-12，Astra 的提升不会只是“多了更多功能”，而会是：

- 更可信
- 更连贯
- 更容易长期使用
- 更能诚实地对外说明自己已经做到什么、还没做到什么
