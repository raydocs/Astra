# Astra Zero-Configuration SaaS Operating Model

中文名：**Astra 零配置托管式 AI 学习产品运营底座方案**  
日期：2026-05-27  
文档性质：最高优先级战略文档 / 托管式 AI 会员服务经营模型 / 成本、调度、增长、支持、留存与运营底座  
建议文件名：`astra-zero-config-saas-operating-model-2026-05-27.md`

---

## 0. 文档边界与最高优先级判断

### Operating question

Astra 如果从“浏览器翻译插件”走向“用户只购买会员，Astra 负责所有 AI 能力供给”的产品形态，如何做到：

- 普通用户零配置；
- AI 成本可控；
- 模型调度可自动化；
- Free / Trial / Pro 的用量经济成立；
- 激活、留存、增长、支持、退款、合规可运营；
- 在不暴露 provider / model / API key / token / prompt 的情况下，提供稳定、可信、优雅的学习体验。

### Strategic decision

这份文档不再讨论“还缺哪些功能”，而是定义 Astra 作为 **zero-config managed AI learning SaaS** 的经营系统。

前两份文档分别回答：

| 文档 | 核心问题 | 本文档是否重复 |
|---|---|---|
| `astra-competitive-code-remediation-2026-05-27.md` | 如何在功能和 UX 上追平 / 超过 Read Frog 与 Immersive Translate | 不重复网页翻译、YouTube、FloatBall、serviceMode 工程、bench-live、代码路径拆解 |
| `astra-macro-product-upgrade-plan-2026-05-27.md` | Astra 长期应该成为怎样的 AI 语言学习平台 | 不重复宏观产品愿景、Library、学习闭环、OKR 总体规划 |
| `astra-zero-config-saas-operating-model-2026-05-27.md` | Astra 如何作为付费托管服务稳定赚钱、增长、运营 | 本文档唯一重点 |

Astra 的商业壁垒不是“支持哪个模型”，而是把模型、成本、质量、失败、用量、客服、留存、增长和隐私全部藏在后台，让普通用户只感受到一个稳定、优雅、可复习的语言学习会员服务。

### First implementation

第一版只做最小可经营底座：

1. 内部成本账本；
2. 自动任务分级；
3. Free / Trial / Pro 权益矩阵；
4. 用户不可见的模型调度策略；
5. 普通用户文案词典；
6. 一键 report flow；
7. privacy-safe analytics；
8. 最小运营后台；
9. feature flag / kill switch；
10. 支持退款、取消、删除数据的基础流程。

### Non-repetition boundary

本文档刻意不展开：

- 网页 DOM 翻译策略；
- YouTube 字幕注入实现；
- FloatBall UI 工程；
- serviceMode schema / router / cache key 代码路径；
- Read Frog / Immersive 逐项功能对比；
- bench-live scenario 具体实现；
- 组件级 UI 重构任务。

---

## 1. Executive Summary

### Operating question

为什么 Astra 必须走 zero-config managed AI，而不是继续做一个可配置 AI 翻译工具？

### Strategic decision

Astra 面向的是普通用户，不是模型玩家。普通用户真正购买的是：

- 不用配置；
- 不用理解 AI；
- 不用申请 API key；
- 不用判断哪个模型更好；
- 不用处理失败；
- 不用担心翻译、解释、摘要、复习如何衔接；
- 打开网页、视频或文档就能理解并沉淀成学习资产。

这和 BYOK / 开源插件的本质区别是：

| 维度 | BYOK / 开源插件 | Astra zero-config SaaS |
|---|---|---|
| 用户心智 | 我需要配置 AI 才能用 | 我买会员后直接用 |
| Provider / model | 用户自己选择、承担失败 | Astra 后台自动调度 |
| 成本控制 | 用户自己付 API 成本 | Astra 负责毛利和限额 |
| 失败恢复 | 用户看技术错误 | Astra 给可行动恢复路径 |
| 质量一致性 | 取决于用户配置 | Astra 统一调度、缓存、fallback |
| 商业模式 | 工具 / 插件 | 持续托管会员服务 |
| 护城河 | 功能列表 | 学习数据、调度系统、支持体验、复习习惯 |

Astra 的目标不是让用户感觉“这里可以配置很多 AI”，而是让用户感觉：

> Astra handled it.

### First implementation

V0 只需做到：

- 普通用户路径不出现 provider / model / API key / token / prompt；
- 用户只看到 Astra AI、阅读偏好、学习偏好、会员权益；
- 后台对任务进行分级、计量、缓存、fallback；
- 出错时显示普通语言；
- 付费时卖“更省心、更长内容、更稳定、更好学习资产”，不卖“更多 token”。

### Internal policy

1. 普通用户 UI 不展示 provider / model / API key。
2. 任何高成本能力必须有内部成本类别。
3. 任何失败必须有用户可懂文案和下一步动作。
4. 任何上报默认不包含正文。
5. 任何付费承诺必须能被运营后台观测和支持。

### User-facing experience

用户看到的是：

- `Astra AI is ready`
- `Understand this page`
- `Save for review`
- `Astra is using a faster mode`
- `Longer videos are included with Pro`
- `Your learning data can be deleted anytime`

用户不应该看到：

- provider
- model
- API key
- token
- quota
- upstream
- relay
- prompt
- rate limit
- fallback stack

### Metrics

| 指标 | V0 验收 |
|---|---:|
| 普通用户关键路径技术术语暴露 | 0 |
| 登录后无需配置即可完成首次理解 | ≥ 95% |
| Free 用户 AI 成本可归因比例 | 100% |
| Pro 用户高成本任务可归因比例 | 100% |
| 用户可见失败有恢复动作比例 | ≥ 95% |
| Support report 默认不含正文比例 | 100% |

### Risks

| 风险 | 处理 |
|---|---|
| 零配置导致成本不可控 | 权益账本、任务分级、缓存、降级、重度用户策略 |
| 用户不知道为什么付费 | Pro value moments 嵌入激活路径 |
| 后台调度失误影响质量 | 任务级质量指标和 fallback ladder |
| 支持压力过大 | 一键 report + known issues + 聚合失败页面 |
| 隐私信任不足 | 默认不上传正文，用户可删可导出 |

### Non-goals

- 不做 provider 控制台；
- 不默认 BYOK；
- 不给普通用户模型列表；
- 不承诺无限制高成本 AI；
- 不把本文档变成具体功能实现清单。

---

## 2. Operating Model Boundary

### Operating question

Astra 的经营系统到底管什么？哪些问题不由本文件处理？

### Strategic decision

Astra 的 zero-config SaaS operating model 管的是“供给、成本、权益、支持、增长、留存、合规、运营”，不是“功能点怎么写代码”。

### Scope

| 模块 | 本文档负责 | 本文档不负责 |
|---|---|---|
| AI 能力供给 | 成本类别、任务路由、fallback、缓存策略 | 具体 provider SDK 代码 |
| 会员 | Free / Trial / Pro 权益、用量语言、取消后数据处理 | 支付网关集成细节 |
| 激活 | 首 10 分钟 funnel、first value、first Pro value | 具体组件实现 |
| 文案 | 技术词替换、错误、paywall、support copy | 完整品牌手册视觉稿 |
| 支持 | report flow、support bundle、known issues | 工单系统 vendor 选择 |
| 留存 | review、digest、continue、提醒政策 | Review 算法代码 |
| 增长 | share、referral、creator、SEO 的运营机制 | 具体投放预算 |
| 学习图谱 | 记什么、不记什么、用户控制 | 数据库 schema 代码 |
| 后台 | 最小运营后台字段和权限 | 后台前端实现 |
| Analytics | 事件体系、A/B、决策节奏 | 埋点 SDK 细节 |
| Legal | 风险清单、政策边界 | 法律意见书 |

### First implementation

将 Astra 的运营模型拆成四个最小系统：

1. **Entitlement System**：用户买了什么、能用什么、什么时候降级。
2. **Cost and Routing System**：每个 AI 任务是什么成本类别、该走什么策略。
3. **Trust and Support System**：失败怎么上报、如何排查、用户数据如何保护。
4. **Growth and Retention System**：用户为什么回来、为什么愿意升级、为什么愿意分享。

### Internal policy

每个新功能上线前必须回答：

| 问题 | 必须有答案 |
|---|---|
| 这个功能的成本类别是什么？ | low / medium / high / long-running |
| Free 是否可用？ | 可用 / 限量 / 不可用 / sample only |
| Pro 如何体现价值？ | 更长、更深、更稳、同步、学习资产 |
| 失败怎么降级？ | retry / faster mode / partial result / async |
| 是否默认保存正文？ | 默认否 |
| 是否可被运营后台观测？ | 是，且不含正文 |
| 是否有用户可懂文案？ | 是 |

### User-facing experience

用户不会看到运营边界，只会感觉：

- Astra 默认可用；
- 长内容有清晰解释；
- 失败时知道下一步；
- 会员价值自然出现；
- 保存的学习资产可控；
- 取消或删除数据不被刁难。

### Metrics

| 指标 | 验收 |
|---|---|
| 新功能上线前成本类别覆盖 | 100% |
| 新功能上线前用户文案覆盖 | 100% |
| 新功能上线前 support report 字段覆盖 | 100% |
| 新功能上线前 privacy boundary 明确 | 100% |

### Risks

- 团队把它当“又一份愿景文档”，不落到经营规则；
- 继续增加功能但没有成本账本；
- 使用技术术语包装会员权益；
- 出问题时只能看日志，无法从用户报告聚合。

### Non-goals

- 不替代产品 roadmap；
- 不替代竞品整改计划；
- 不替代法律审查；
- 不替代工程任务拆分。

---

## 3. SaaS Unit Economics Model

### Operating question

Astra 每个用户到底赚不赚钱？增长是否会导致亏损扩大？

### Strategic decision

Astra 必须从第一天就以单位经济模型管理 AI 成本。付费会员不是“无限使用 AI”，而是“在 Astra 管理好的边界内，获得更稳定、更省心、更高质量的学习体验”。

### Core equation

Astra 需要每月持续追踪：

| 指标 | 含义 | 决策用途 |
|---|---|---|
| Net ARPU | 扣除支付手续费后的单付费用户月收入 | 决定成本上限 |
| AI Cost / Active User | 每活跃用户 AI 成本 | 控制免费和试用 |
| AI Cost / Pro User | 每 Pro 用户 AI 成本 | 判断毛利 |
| Infra Cost / User | 存储、同步、队列、邮件、日志 | 判断扩展成本 |
| Support Cost / User | 工单、退款、人力排障 | 判断客服压力 |
| Gross Margin | Net ARPU - AI - Infra - Support | 决定定价和限制 |
| Heavy User Ratio | 高成本用户比例 | 决定限流和高阶套餐 |
| Abuse Rate | 异常批量/自动化使用比例 | 决定风控 |
| Trial Cost / Conversion | 试用成本 / 转化率 | 决定 trial 长度 |

### Unit economics target

第一版不需要绝对精准，但必须有目标区间：

| 层级 | 建议经营目标 |
|---|---|
| Free active user | 月均 AI 成本必须低到可由营销预算承受 |
| Trial user | 成本应与 trial→Pro 转化率挂钩，不能无上限 |
| Pro normal user | AI + infra + support 成本应显著低于净 ARPU |
| Pro heavy user | 可接受少量亏损，但必须被识别和策略化 |
| Extreme / abuse user | 必须被限速、降级、要求升级或阻断 |

### User behavior cost tiers

| 用户类型 | 行为特征 | 风险 | 策略 |
|---|---|---|---|
| Visitor | 安装后偶尔试用 | 成本低，价值未建立 | sample + 短任务 |
| Light learner | 每周少量网页/选中解释 | 健康 | Free/Pro 都可支持 |
| Daily learner | 每天网页、保存、复习 | Pro 主力 | 提供稳定体验 |
| Video-heavy learner | 长视频、摘要、笔记多 | 高成本但高价值 | Pro 限额 + async |
| Document-heavy learner | 长 PDF/长文频繁处理 | 高成本 | Pro 限额 + 分段 |
| Automation-like user | 大量重复/批量请求 | 滥用风险 | 限速、验证码、人工审核 |
| Support-heavy user | 频繁失败/退款/报告 | 运营成本高 | support macro + known issues |

### First implementation

V0 建立四张内部账：

| 账本 | 记录什么 | 不记录什么 |
|---|---|---|
| Cost Ledger | 任务类别、成本 bucket、耗时、缓存命中、fallback | 正文 |
| Usage Ledger | 用户层级、任务次数、长内容次数、失败次数 | 正文 |
| Value Ledger | 首次理解、保存、复习、digest、Pro value moment | 正文 |
| Risk Ledger | 重度使用、异常频率、失败聚集、退款风险 | 正文 |

### Internal policy

1. 所有 AI 任务必须归类到 cost class。
2. 所有 Pro 权益必须有成本预算。
3. Free / Trial 的高成本能力必须可关闭或降级。
4. 高成本任务优先考虑异步、分段、缓存、摘要优先。
5. 重度用户不直接惩罚，先提供更清晰的长内容策略和高阶计划预留。

### User-facing experience

用户不看成本，只看体验：

- Free：适合每天轻量阅读和体验；
- Trial：完整体验 Astra 如何帮你学习；
- Pro：适合长期阅读、视频、文档、复习和同步；
- 长内容：Astra 会分段处理或提示 Pro；
- 重复内容：Astra 使用已保存结果，更快返回。

### Metrics

| 指标 | V0 验收 |
|---|---:|
| AI task cost class coverage | 100% |
| Pro gross AI cost 可归因 | 100% |
| Free 高成本任务阻断/降级覆盖 | 100% |
| Heavy user monthly report | 每周至少一次 |
| Cost spike alert | 每日可见 |
| Cache hit rate dashboard | 可见 |
| Trial cost per converted Pro | 可计算 |

### Risks

| 风险 | 应对 |
|---|---|
| 免费用户成本失控 | Free 只开放低/中成本任务，高成本 sample only |
| Trial 被薅羊毛 | Trial 限制长内容和批量任务 |
| Pro 重度用户亏损 | 长视频/长文单独额度或排队降级 |
| 成本数据不准 | 用 bucket 先近似，再逐步精细化 |
| 团队过早优化成本影响体验 | 先保护首 10 分钟体验，再优化高成本任务 |

### Non-goals

- 不在普通 UI 展示成本；
- 不把 token 作为用户理解单位；
- 不用复杂计费表吓退用户；
- 不承诺 Pro 无限制高成本 AI。

---

## 4. AI Cost Model

### Operating question

哪些任务贵？哪些任务便宜？哪些可以缓存、异步、本地化或降级？

### Strategic decision

Astra 要把 AI 任务按“用户价值 × 成本风险 × 时效要求”分级，而不是所有请求都用同一条链路。

### Task cost classes

| Cost class | 任务类型 | 成本驱动 | 用户价值 | 策略 |
|---|---|---|---|---|
| Low | 短句翻译、单词解释、已缓存结果、简单 Review 卡片 | 文本短、上下文少 | 高频轻量 | Free 可较宽松 |
| Medium | 网页段落理解、选中解释、语法说明、写作润色 | 中等文本、多次调用 | 核心体验 | Free 限量，Pro 默认 |
| High | Deep Read、长文摘要、复杂技术解释、视频摘要 | 长上下文、质量要求高 | Pro 价值点 | Trial/Pro 限量 |
| Long-running | 长视频、长 PDF、多章节总结、大量卡片生成 | 分段、排队、失败重试 | 高价值但高风险 | Pro 限额、异步、缓存 |
| Memory-light | 复习调度、简单卡片状态、Library 组织 | 主要本地/数据库 | 留存核心 | 尽量慷慨 |
| Risky | 批量导出、重复长内容、异常自动化 | 高成本或版权/滥用 | 不一定高 | 限流、审核、降级 |

### Cost model by product surface

| Product surface | 内部任务 | 成本风险 | First implementation |
|---|---|---|---|
| Page understanding | 段落翻译、上下文解释、术语一致性 | 中 | batch + cache + viewport priority |
| Selection explain | 短文本解释、上下文片段 | 低到中 | 快速模型优先，失败重试 |
| Deep Read | 长文摘要、结构化解释、重点句 | 高 | Pro/Trial 限量，异步生成 |
| Video summary | transcript 分段摘要、章节、重点表达 | 高到 long-running | Pro 额度 + 分段缓存 |
| Review card | 词句卡片、cloze、例句 | 低到中 | 保存时轻量生成，后续后台补强 |
| Writing assist | 输入改写、润色、解释 | 中 | 用户明确触发，低延迟 |
| Digest | 周报汇总、学习统计、推荐复习 | 中 | 后台批处理，低频 |
| Personal glossary | 术语抽取、偏好总结 | 低到中 | 小批量、可回滚 |

### Cost reduction levers

| Lever | 适用任务 | 用户是否感知 | 风险 |
|---|---|---|---|
| Cache | 重复段落、字幕、摘要、卡片 | 感知为更快 | stale / 版本不一致 |
| Deduplication | 同一页面重复请求 | 不感知 | key 设计错误 |
| Batch | 网页段落、字幕、卡片 | 感知为更快 | 单批失败影响较大 |
| Async | 长视频、长文、Digest | 感知为“稍后完成” | 需要进度和通知 |
| Partial result | 长内容 | 感知为先有结果 | 质量不完整 |
| Degrade quality | 超时/高成本 | 感知为“快速模式” | 质量下降 |
| Local template | 简单 Review 卡片 | 不感知 | 教学质量有限 |
| Content caps | 极长内容 | 感知为限制 | 需要好文案 |
| Membership routing | Pro 用更高质量 | 感知为更好 | 不应伤害 Free 首次体验 |

### Free / Trial / Pro cost budgets

| Tier | 成本目标 | 可开放 | 应限制 |
|---|---|---|---|
| Free | 证明价值，低成本可持续 | sample、短文本、少量网页、少量保存、本地复习 | 长视频总结、长文 Deep Read、批量导出 |
| Trial | 让用户体验完整闭环，但有边界 | 网页、保存、Review、少量长内容、一次视频/文件高级体验 | 极长内容、连续批处理、异常重度 |
| Pro | 日常学习主力，毛利健康 | 高额度网页、视频、文件、同步、Digest、支持 | 极端滥用、超长批量、持续自动化 |
| Premium later | 高强度用户 | 更长内容、更高质量、更多导出 | 仍需 fair use |

### First implementation

1. 为每个 AI 请求打上 `taskClass`、`surface`、`tier`、`costBucket`、`latencyBucket`、`cacheStatus`。
2. 先用 bucket，不需要一开始精准计算到分。
3. 对 high / long-running 任务增加每日和每月策略阈值。
4. 对 Trial 增加“完整体验但不可无限重跑”的限制。
5. 对 Pro 增加“无限低成本 + 高成本合理额度 + 额外排队/降级”的模型。

### Implementation status — 2026-05-28

- Repo-side slice implemented: relay translation now enforces `ENTITLEMENT_MATRIX` monthly allowances for metered high / long-running task classes using durable per-user monthly task counters in the file-backed user store. Over-limit requests return `QUOTA_EXCEEDED` before provider spend; non-metered tasks and failed provider attempts do not consume this allowance. Checkout, subscription state transitions, provider billing, and broader cost ledger work remain out of scope.
- Focused cost-visibility slice implemented: operator-only `GET /v1/ops/cost/usage-summary` now applies an internal deterministic estimate registry to retained usage metadata and returns aggregate estimated spend plus a daily spend/spike/risk signal for the web cost card. The response remains metadata-only and intentionally excludes user IDs, emails, device IDs, hostnames, prompts/text, provider names, provider models, and real provider invoice/billing data.
- Long-running lifecycle foundation implemented: `src/types/long-running-tasks.ts` defines a strict metadata-only task contract for `queued` / `running` / `partial` / `succeeded` / `failed` / `canceled` records, with task class/category/surface/source fingerprint, progress, partial-result metadata, retry/degrade/fallback hints, timestamps, idempotent `clientRequestId` create behavior, and an explicit privacy boundary. `src/server/long-running-task-store.ts` persists the lifecycle metadata in a file-backed relay store, and `src/server/index.ts` exposes authenticated create/list/status/cancel routes plus operator-only metadata update/list routes and deletes retained lifecycle metadata during account deletion. This is intentionally not a Deep Read/video/PDF processor and does not store page text, transcripts, file bodies, prompts, model outputs, raw private URLs, notifications, provider queues, or billing artifacts.

### Internal policy

- Low 成本任务可以慷慨；
- Medium 成本任务用于建立日常习惯；
- High 成本任务用于 Pro value；
- Long-running 任务必须有异步和缓存；
- Risky 任务必须有风控；
- 所有任务必须可解释为用户价值，不为技术实验消耗成本。

### User-facing experience

| 内部状态 | 用户表达 |
|---|---|
| cost cap reached | 今天的免费长内容体验已用完 |
| high-cost task queued | Astra 正在处理较长内容 |
| degrade to fast model | 已切换到更快的理解模式 |
| cache hit | 已使用保存结果，更快完成 |
| long-running task | 这个内容较长，Astra 会分段处理 |
| Pro required | 更长的视频和深度解释包含在 Pro 中 |

### Metrics

| 指标 | 验收 |
|---|---|
| 每类任务成本可见 | 100% |
| High / long-running 成本日报 | 可用 |
| Cache hit rate | 可用 |
| Trial 用户高成本消耗 | 可控并可按 cohort 追踪 |
| Pro 重度用户占比 | 每周可见 |
| 降级后用户重试/取消率 | 可见 |
| 成本异常报警 | 日级可用 |

### Risks

- 过度降级导致 Astra 质量变差；
- Free 体验太差导致用户不愿升级；
- Trial 过慷慨导致薅羊毛；
- Pro 权益太宽导致毛利不可控；
- 成本策略过于复杂，用户感知为被限制。

### Non-goals

- 不把成本表展示给用户；
- 不要求用户选择便宜/昂贵模型；
- 不用“token”表达权益；
- 不做无限制长视频/长文件承诺。

---

## 5. Automatic Model Routing Strategy

### Operating question

用户不配置 provider 和 model，Astra 后台如何自动决定速度、质量、成本和 fallback？

### Strategic decision

模型不是用户设置项，而是 Astra 的内部供应链。用户只选择体验偏好，Astra 自动路由。

用户可见的最多是：

- Automatic
- Faster
- Balanced
- Best quality

但这些只是体验偏好，不是模型选择。

### Routing dimensions

| 信号 | 用途 |
|---|---|
| taskClass | 判断任务成本类别 |
| surface | 网页、选择、视频、文件、Review、写作 |
| contentLength | 判断是否需要分段/长上下文 |
| languagePair | 判断语言能力和模型表现 |
| userTier | 决定额度和质量策略 |
| userPreference | Fast / Balanced / Best quality |
| privacyMode | 减少上下文或禁用某些记忆 |
| cacheStatus | 优先复用结果 |
| providerHealth | 避免 outage |
| latencyBudget | 决定是否降级 |
| costBudget | 决定是否走高成本路径 |
| qualityRisk | 技术、法律、医学等内容需谨慎 |

### Task routing table

| Task class | 用户场景 | Latency budget | Quality target | Cost budget | Default routing | Fallback |
|---|---|---:|---|---|---|---|
| Instant phrase | 划词、短句理解 | 1–2s | 快速可懂 | Low | 快速模型 / cache | 模板解释 |
| Paragraph understanding | 网页段落 | 2–6s | 流畅、上下文一致 | Medium | 平衡模型 + batch | 减少上下文 |
| Context explanation | 难句解释 | 3–10s | 教学感、准确 | Medium | 中高质量模型 | 简短解释 |
| Deep reading | 长文理解 | 10–60s | 结构化、覆盖重点 | High | 长上下文 / 分段 | 摘要优先 |
| Video summary | 长 transcript | 20–120s | 章节、重点表达 | High / long-running | 分段 + 汇总 | 只生成章节摘要 |
| Review card | 保存后卡片 | 1–8s | 简洁、可复习 | Low / medium | 低成本稳定模型 | 模板卡 |
| Writing assist | 输入润色 | 2–8s | 自然、可靠 | Medium | 中高质量模型 | 简化润色 |
| Digest | 周报 | 后台 | 个性化但不 creepy | Medium | 批处理 | 统计型 digest |

### Fallback hierarchy

| Level | 内部动作 | 用户感知 |
|---|---|---|
| L0 cache | 使用缓存或已保存结果 | 更快 |
| L1 same tier retry | 同策略重试一次 | 无感或短等待 |
| L2 faster model | 切换快速稳定路径 | “Astra is using a faster mode” |
| L3 reduced context | 减少上下文，只处理核心内容 | “Showing a simpler result first” |
| L4 partial result | 返回已完成部分 | “Part of this is ready” |
| L5 async | 后台继续处理 | “Astra will finish this in the background” |
| L6 user action | 提示重试/升级/报告 | “Try again / Report this page” |

### Membership-aware routing

| Tier | Routing behavior |
|---|---|
| Free | 快速/平衡优先，长内容受限，高成本任务 sample only |
| Trial | 允许体验高质量路径，但有限次数和长内容边界 |
| Pro | 默认更稳定、更高额度，高成本任务可排队处理 |
| Premium later | 更长内容、更高质量、更高并发 |
| Privacy mode | 减少上下文和记忆使用，不为了个性化牺牲隐私 |

### First implementation

1. 先不暴露真实模型。
2. 建立内部 routing policy 配置表。
3. 所有任务写入 routing decision log，但不含正文。
4. 每次 fallback 记录原因类别：timeout / outage / cost / length / quality / unknown。
5. 普通 UI 只显示体验状态，不显示技术供应链。

### Implementation status — 2026-05-28

- Focused routing-policy coverage slice implemented: source now has an internal deterministic routing policy registry covering every canonical `AstraTaskClass`, with explicit default routes, fallback ladders, surface/cost/tier/privacy/service-preference dimensions, and a complete fallback reason route policy where `unknown` is an intentional fallback action. Relay translation usage metadata continues to record task class, cost bucket, provider route, fallback reason, and fallback-used status without page text; billing and user-facing provider/model UI remain unchanged.
- Focused provider-health auto-mitigation slice implemented: `/v1/translate` now derives a metadata-only `providerHealthMitigation` decision from retained recent provider-health summaries after hard kill switches. Healthy health is a no-op; watch/incident health deterministically forces fast stable mode or, for providerless incident traffic with an entitled alternative, bypasses the unhealthy provider and records `fallbackReason: outage` / `fallbackUsed: true` in internal usage metadata. This intentionally defers external monitors, broad ML routing, and full autonomous provider-route operations.

### Internal policy

- 模型供应商可以换，用户承诺不能换；
- 用户买的是体验等级，不是模型品牌；
- 任何模型升级必须看质量、延迟、成本、失败率四个指标；
- 不能为了省成本破坏首次成功；
- 高成本模型只用于用户能感知价值的任务。

### User-facing experience

| 用户动作 | 用户看到 |
|---|---|
| 打开普通网页 | Astra 自动理解 |
| 内容很长 | Astra 会分段处理 |
| 网络慢 | Astra 正在使用更稳定的模式 |
| Pro 高质量 | Best for long or technical content |
| 供应商 outage | Astra 暂时切换到稳定模式 |
| 模型失败 | Try again / Report issue |

### Metrics

| 指标 | 验收 |
|---|---|
| routing decision coverage | 100% |
| fallback reason coverage | 100% |
| provider/model health dashboard | 可用 |
| fallback 后成功率 | 按任务可见 |
| fallback 后用户取消率 | 可见 |
| Fast / Balanced / Best quality 的成本差异 | 可见 |
| 供应商 outage 自动绕过 | 可验证 |

### Risks

- 后台调度复杂导致 debug 困难；
- 用户选择 Best quality 但成本失控；
- Fast 模式质量过差损害信任；
- 过度 fallback 让结果不一致；
- 内部模型变更影响用户保存内容一致性。

### Non-goals

- 不向普通用户展示模型名称；
- 不让用户配置 base URL；
- 不让客服随意为用户切模型；
- 不承诺某个模型永久可用。

---

## 6. Graceful Degradation Ladder

### Operating question

当模型慢、失败、内容过长、成本过高、供应商 outage 或用户取消时，Astra 如何优雅处理？

### Strategic decision

失败不是技术状态，而是用户任务被打断。Astra 必须用“可恢复体验”替代“错误码”。

### Degradation matrix

| 内部问题 | Astra 动作 | 用户文案 | 是否消耗额度 |
|---|---|---|---|
| 高质量路径超时 | 切换快速模式 | Astra is taking longer than usual. Showing a faster result first. | 不重复扣 |
| 上游 outage | fallback 到稳定路径 | Astra switched to a more stable mode. | 不重复扣 |
| 内容过长 | 分段处理 / 摘要优先 | This is a long document. Astra will process it in parts. | 按完成计 |
| 长视频成本高 | Pro 限额 / 后台排队 | Longer video analysis is included with Pro. | 开始后计 |
| 缓存命中 | 直接返回 | Using a saved result. | 不扣或低成本 |
| 低置信度 | 标注不完整，可重试 | This explanation may be incomplete. Try again for a better result. | 视情况 |
| 用户取消 | 保存已完成部分 | Progress saved. | 按已完成计 |
| 网络断开 | 暂停并重试 | Astra will retry when you are back online. | 不重复扣 |
| 页面受保护 | 提供 selection / reader path | This page is protected. Try selecting text instead. | 未开始不扣 |
| 超过 Free | 提示 Pro 或 limited mode | You’ve used today’s free long-content experience. | 未开始不扣 |

### Failure copy principles

| 原则 | 说明 |
|---|---|
| 不说技术原因 | 不说 upstream、provider、rate limit |
| 给下一步 | Retry / Use faster mode / Save progress / Report |
| 不惩罚用户 | 失败不重复扣额度 |
| 保留进度 | 已完成部分可见 |
| 适度透明 | 说“较长内容”“暂时繁忙”，不说内部栈 |
| 支持上报 | 无法恢复时一键 report |

### First implementation

V0 必须支持五种降级：

1. timeout → faster mode；
2. high-cost long content → partial + async；
3. provider outage → stable route；
4. content too long → split / summary first；
5. repeated failure → report flow。

### Implementation status — 2026-05-28

- Repo-side long-running/async foundation implemented for item 2: relay now has a generic metadata-only long-task lifecycle contract/store/API for Deep Read, long video, long PDF/document, digest, review batch, and other long-running categories. The lifecycle supports queued/running/partial/succeeded/failed/canceled status, progress buckets, partial-result summary metadata, retry/degrade/fallback hints, timestamps, authenticated user status/cancel boundaries, and operator-only metadata update/list visibility.
- Completion evidence: focused tests cover store create/status/update transitions, partial-result metadata, task class/category support, privacy rejection for content-shaped fields/raw URLs, authenticated/anonymous boundaries, user status/list/cancel routes, and operator update/list routes. Validation commands for the implementation slice are recorded in the agent summary for this change.
- Explicit deferrals: no full Deep Read/video/PDF processors, no storage of user content bodies/model output, no email/push notifications, no worker/provider queue infrastructure, no billing/production deployment changes, and no broad client UI integration beyond the relay lifecycle API.

### Internal policy

- 用户未获得结果，不应消耗正式额度；
- 已完成部分应保存，不让用户从零开始；
- fallback 不应该改变学习资产结构；
- 降级事件必须计入 analytics；
- 同一页面连续失败应提示 report，不反复空转。

### User-facing experience

好的失败体验：

- “Astra is taking longer than usual. Showing a faster version first.”
- “This content is long. Astra will finish it in parts.”
- “Some parts are ready. You can keep reading.”
- “Try again with Best quality.”
- “Report this page. We’ll include technical details, not your page text.”

坏的失败体验：

- “Provider failed”
- “Token limit exceeded”
- “429”
- “Model unavailable”
- “Relay upstream timeout”
- “Unknown error”

### Metrics

| 指标 | 验收 |
|---|---|
| 用户可见错误中技术术语 | 0 |
| timeout fallback 成功率 | 可见 |
| 长内容 partial result 生成率 | 可见 |
| 失败后 report click rate | 可见 |
| 失败后用户继续任务比例 | 可见 |
| 重复失败同页面聚合 | 可见 |
| 失败不重复扣额度 | 100% |

### Risks

- 降级后结果质量下降；
- 用户误以为 Astra 偷工减料；
- partial result 让用户以为完成了；
- 高成本任务提示 Pro 太早导致反感；
- 失败文案过于含糊导致不信任。

### Non-goals

- 不展示错误栈；
- 不要求用户切换 provider；
- 不让用户手动选择 fallback 模型；
- 不把失败归咎于用户。

---

## 7. Entitlement, Usage Limits, and Membership Economics

### Operating question

Free / Trial / Pro 应该分别给用户什么？如何表达限制而不让用户觉得被技术计费？

### Strategic decision

Free 负责证明价值；Trial 负责体验完整闭环；Pro 负责持续省心使用；限制策略负责保护毛利。

### Membership philosophy

| Tier | 核心职责 | 不能做什么 |
|---|---|---|
| Free | 让用户第一次相信 Astra 有用 | 不应要求配置、不应过早卡死 |
| Trial | 让用户体验完整学习闭环 | 不应无限消耗高成本任务 |
| Pro | 让用户长期省心学习 | 不应承诺无限高成本 AI |
| Premium later | 服务重度学习者 | 不应影响 Pro 的简单心智 |

### Entitlement matrix

| 能力 | Free | Trial | Pro | Premium later |
|---|---|---|---|---|
| Sample page | 完整 | 完整 | 完整 | 完整 |
| Short selection explain | 每日适量 | 较高 | 高额度 | 更高 |
| Page understanding | 每日少量 | 完整体验 | 高额度 | 更高 |
| Save items | 少量 | 较多 | 高额度 / 同步 | 更高 |
| Local review | 可用 | 可用 | 可用 | 可用 |
| Cloud sync | 不可用或预览 | 可体验 | 包含 | 包含 |
| Deep Read | sample / 限量 | 少量完整 | 月度额度 | 更高 |
| Long video summary | 不可用或 sample | 少量 | 月度额度 | 更高 |
| Long document | 不可用或 sample | 少量 | 月度额度 | 更高 |
| Weekly Digest | 预览 | 可用 | 包含 | 包含 |
| Export | 受限 | 受限 | 基础 | 高级 |
| Priority support | 否 | trial support | 包含 | 优先 |

### Limit expression

| 内部概念 | 用户语言 |
|---|---|
| quota | 今日免费学习时间 / 本月长内容额度 |
| token limit | 内容太长 |
| rate limit | 今天使用较多，请稍后继续 |
| high-cost task | 长内容 / 深度分析 |
| fallback | 更稳定模式 |
| model tier | 快速 / 平衡 / 深度理解 |
| usage cap | 本月 Pro 长内容额度 |
| abuse | 异常大量请求 |

### What should be limited vs degraded

| 能力类型 | 策略 | 原因 |
|---|---|---|
| 短文本理解 | 尽量宽松 | 激活与日常价值 |
| Review | 尽量慷慨 | 留存核心 |
| 保存学习资产 | Free 少量，Pro 高额度 | 形成价值 |
| 页面翻译/理解 | Free 限量，Pro 高额度 | 核心价值且成本中等 |
| Deep Read | 限量 | 成本高、价值高 |
| 长视频总结 | 限量 | 成本高 |
| 长文件处理 | 限量/异步 | 成本和版权风险 |
| 批量导出 | 限制 | 成本和版权风险 |
| 同步 | Pro 权益 | 持续价值 |
| Digest | Pro 权益或 Trial 体验 | 留存价值 |

### Cancellation policy

| 用户状态 | 数据处理 |
|---|---|
| Pro 取消但账号保留 | 学习资产保留，只是 Pro 能力停止或降级 |
| 回到 Free | 可查看已有资产，新增/同步/长内容受限 |
| 删除账号 | 提供删除学习数据路径 |
| 退款 | 不惩罚学习资产，按政策处理会员 |
| 导出数据 | 用户可导出自己的学习资产，不默认导出第三方完整内容 |

### First implementation

1. 建立 Free / Trial / Pro entitlement matrix。
2. 用普通语言重写所有用量限制。
3. 对 high / long-running 设置内部阈值。
4. 取消后保留用户已保存资产的查看权，限制新增高级处理。
5. 支持“临近限制”温和提醒，不突然硬卡。

### Internal policy

- 限制的是高成本任务，不限制学习习惯；
- Review 不应成为付费墙；
- Free 要足以证明价值，但不能替代 Pro；
- Trial 要体验闭环，而不是只给额度；
- Pro 要卖稳定和省心，不卖 token。

### User-facing experience

| 场景 | 文案 |
|---|---|
| Free 接近限制 | You’ve used most of today’s free learning time. |
| Free 到达限制 | You can continue tomorrow, or upgrade for longer reading. |
| 长视频 | Longer video lessons are included with Pro. |
| Pro 使用高 | Astra is processing a lot of long content. Some tasks may take longer. |
| 取消后 | Your saved learning items stay in your account. Pro features will pause after the current period. |
| 恢复订阅 | Welcome back. Your learning history is still here. |

### Metrics

| 指标 | 验收 |
|---|---|
| Paywall view → upgrade click | 可见 |
| Limit hit → churn/upgrade | 可见 |
| Trial high-cost usage | 可控 |
| Pro AI cost / Pro user | 可见 |
| Cancellation reason coverage | ≥ 80% |
| Cancellation 后数据投诉 | 低且可追踪 |
| Free 用户首次价值达成 | 不被 limit 伤害 |

### Risks

- 限制太早，Free 用户没体验到价值；
- 限制太晚，成本失控；
- Pro 用户以为“无限”而不满；
- Trial 被重度用户薅高成本能力；
- cancellation 后数据策略不清导致不信任。

### Repo-side completion evidence — 2026-05-28

- Added beta-safe `GET/POST /v1/account/trial-intent` returning `astra-beta-trial-lifecycle.v1` metadata: eligibility, trial status, `startedAt`/`expiresAt` when applicable, conversion next step, and beta boundary flags.
- `POST /v1/account/trial-intent` requires an authenticated non-anonymous account and records only a metadata analytics event (`trial_intent_recorded`). It does not call checkout/portal, collect payment, mutate subscription status, change plan, or grant trial/Pro entitlement.
- Astra Web account now shows a `Beta trial interest` CTA/state with ordinary beta copy and disabled checkout/portal actions.
- Tests cover explicit action required, anonymous denial, unchanged account plan/subscription/limits, metadata-only analytics, deterministic beta response, and no provider/model/token/payment secret leakage.

### Non-goals

- 不用 token 作为用户权益；
- 不做复杂点数商城；
- 不做用户手动模型选择来节省额度；
- 不承诺无限长视频、无限长文、无限导出。
- 本切片不实现支付网关、webhook、checkout completion、subscription truth source、trial entitlement grant、Pro entitlement grant、referral reward。

---

## 8. Activation Funnel Operating System

### Operating question

用户安装后的前 10 分钟，如何从“不知道 Astra 是什么”走到“我愿意继续用/试用/付费”？

### Strategic decision

Astra 的首次成功必须由产品主动引导，而不是等待用户探索。Activation 不是 UI onboarding，而是经营漏斗。

### First 10 minutes funnel

| Step | 用户任务 | 用户可能困惑 | Astra 动作 | 事件指标 | 失败恢复 |
|---|---|---|---|---|---|
| Install | 安装成功 | 不知道下一步 | 自动打开 welcome/sample | extension_installed | 提供 sample path |
| Setup | 选择目标语言 | 怕配置复杂 | 只问语言、水平、目标 | onboarding_completed | 可跳过 |
| First value | 看懂内容 | 不知道在哪用 | sample page 或当前 tab CTA | first_value_seen | Try sample page |
| First save | 保存一句 | 不知道保存有何用 | 显示保存后 Review card | saved_item_created | 解释保存用途 |
| First review | 复习一张卡 | 怕学习负担 | 1-card review | first_review_completed | 稍后提醒 |
| First Pro value | 理解会员价值 | 为什么付费 | 长内容/同步/Digest/高质量 moment | pro_value_seen | 不强迫 |
| Return | 次日回来 | 忘记产品 | Today Review / Continue | return_day1 | 轻提醒 |

### Onboarding questions

第一版只问：

1. 你想把内容理解成什么语言？
2. 你当前大概水平？
3. 你主要想用 Astra 做什么？

可选答案：

| 问题 | 选项 |
|---|---|
| 目标语言 | 中文、英文、日文、韩文、其他 |
| 当前水平 | Beginner / Intermediate / Advanced |
| 使用目的 | 读网页、看视频、读文件、工作学习、考试、兴趣阅读 |

不要问：

- provider；
- model；
- API key；
- prompt；
- token；
- relay；
- batch；
- 自定义 endpoint。

### First implementation

1. Welcome 页面提供 `Try Astra on a sample page`。
2. Onboarding 只问 3 个问题，30 秒内完成。
3. 首次 sample page 自动引导保存一句。
4. 保存后立即显示 1-card review。
5. Pro value 只在用户碰到真实价值点时出现。
6. 失败时总有 `Try sample page` 作为兜底。

### Internal policy

- Onboarding 不是设置页；
- 不要把高级偏好放到首次流程；
- 首次成功优先于账号完善；
- Paywall 不应在用户理解价值前硬挡；
- 第一次保存必须立刻解释“之后会复习”。

### User-facing experience

首屏文案方向：

- “Choose your language. Astra handles the AI.”
- “Start with a sample page.”
- “Save one useful sentence.”
- “Your first review card is ready.”
- “Longer videos and deeper explanations are included with Pro.”

### Metrics

| 指标 | V0 目标 |
|---|---:|
| onboarding completion | ≥ 80% |
| install → first value | P50 < 60s |
| first value success | ≥ 90% |
| first save rate | ≥ 25% |
| first review completion | ≥ 15% |
| pro value seen | 可追踪 |
| install → trial intent | 可追踪：`POST /v1/account/trial-intent` records authenticated `trial_intent_recorded` metadata only during beta |
| trial start | Deferred until billing/trial semantics are finalized; do not emit from free-beta sign-in or upgrade-interest clicks |
| trial → Pro | Deferred until checkout/payment/subscription truth source exists |

### Repo-side completion evidence — 2026-05-28

- Trial conversion path is explicit but beta-safe: Web account CTA records trial interest through `POST /v1/account/trial-intent`; response exposes no-payment/no-entitlement/no-subscription-mutation boundaries.
- `trial_started` remains a future lifecycle event and is not emitted by this slice. Current beta observability uses `trial_intent_recorded` until real trial start semantics exist.
- Exact deferrals: payment gateway mutation, subscription lifecycle, checkout completion, Pro grant, trial entitlement grant, referral rewards, and trial→Pro conversion source of truth.

### Risks

- Onboarding 过长；
- Sample page 看起来像 demo，不像真实产品；
- 用户没有马上打开英文网页；
- Paywall 过早；
- 保存/复习显得像负担。

### Non-goals

- 不在首次流程里教全部功能；
- 不在首次流程里展示配置项；
- 不强迫用户创建复杂学习计划；
- 不把首次成功依赖真实网页成功率。

---

## 9. User-Facing Language System

### Operating question

如何把技术复杂性全部翻译成普通用户能理解的任务语言？

### Strategic decision

Zero-config 不只是隐藏设置，而是从文案系统上消除技术心智。Astra 的语言必须像学习助手，不像 AI 控制台。

### Forbidden vocabulary in ordinary UI

| 禁止普通用户看到 | 替代表达 |
|---|---|
| provider | Astra AI |
| model | 智能模式 / 不显示 |
| API key | 不显示 |
| token | 内容长度 / 今日免费学习时间 |
| quota | 今日可用次数 / 本月长内容额度 |
| rate limit | 今天使用较多，请稍后继续 |
| relay | Astra service / 不显示 |
| upstream | Astra 暂时无法连接 |
| fallback | 已切换到更稳定模式 |
| prompt | 学习说明 / 不显示 |
| embedding | 不显示 |
| vector | 不显示 |
| sync conflict | 学习记录暂时未同步 |
| request failed | Astra 暂时无法处理 |
| 429 / 500 | 普通错误文案 |
| route | 智能处理 / 不显示 |
| batch | 分段处理 / 不显示 |

### Copy dictionary

| 场景 | 用户文案 | 避免 |
|---|---|---|
| AI ready | Astra AI is ready. | Provider connected |
| Fast mode | Faster understanding | Cheap model |
| Best quality | Best for long or technical content | Premium model |
| Long content | This is long. Astra will process it in parts. | Token limit exceeded |
| Free limit | You’ve used today’s free long-content experience. | Quota exceeded |
| Retry | Try again | Request failed |
| Fallback | Astra switched to a more stable mode. | Fallback provider |
| Cache | Using a saved result. | Cache hit |
| Sync issue | Your learning record is saved on this device for now. | Sync conflict |
| Support | We’ll include technical details, not your page text. | Send logs |
| Paywall | Longer videos and deeper explanations are included with Pro. | Upgrade quota |

### Error copy templates

| Error type | Copy | CTA |
|---|---|---|
| Slow | Astra is taking longer than usual. | Use faster mode |
| Temporary failure | Astra couldn’t finish this yet. | Try again |
| Protected page | This page is protected. | Try selecting text |
| Long content | This content is long. | Process in parts |
| No captions | No captions were found. | Try another video |
| Free limit | Today’s free long-content experience is used. | Upgrade / Continue tomorrow |
| Network | You appear to be offline. | Retry when online |
| Sync | Saved on this device for now. | Try syncing later |
| Unknown | Astra couldn’t process this page. | Report this page |

### Paywall copy principles

| 原则 | 示例 |
|---|---|
| 讲价值 | “Turn longer videos into reviewable notes.” |
| 讲省心 | “Astra handles the AI for you.” |
| 讲持续 | “Keep learning across devices.” |
| 讲学习资产 | “Save more sentences and review them later.” |
| 不讲技术 | 不说 token/model/provider |
| 不羞辱用户 | 不说 “limit exceeded” |

### Settings copy principles

普通设置应该按任务分组：

| 分组 | 用户看到 |
|---|---|
| Language | Target language, explanation level |
| Reading | Bilingual / translation only |
| Learning | Save to review, Today Review |
| Astra AI | Automatic / Faster / Balanced / Best quality |
| Privacy | Privacy Mode, delete learning data |
| Account | Membership, sync, export |

高级诊断放二级入口，且默认不展示。

### First implementation

1. 建立 UI 文案词典。
2. 搜索普通 UI 中所有技术词并替换。
3. paywall、error、support、settings 文案统一使用词典。
4. 技术词只保留在 internal diagnostics 或 developer mode。
5. 所有新文案 PR 必须过普通用户语言检查。

### Internal policy

- 一切技术能力都必须映射到用户任务；
- 一切限制都必须映射到用户价值；
- 一切错误都必须映射到下一步动作；
- 文案短、温和、清楚；
- 不用恐吓式、惩罚式文案。

### Metrics

| 指标 | 验收 |
|---|---|
| 普通 UI 技术词扫描 | 0 |
| error copy 有 CTA 比例 | ≥ 95% |
| paywall copy 使用价值语言 | 100% |
| support copy 明确隐私 | 100% |
| onboarding 完成率 | 不低于基线 |
| error 后 retry/report 比例 | 可见 |

### Risks

- 文案过度柔化导致用户不知道问题；
- 限制表达太模糊导致不满；
- support 文案太短导致信息不足；
- 不同页面文案不一致。

### Non-goals

- 不为高级用户删除所有诊断入口；
- 不承诺没有技术失败；
- 不用营销文案掩盖真实限制；
- 不用“AI 魔法”替代清晰解释。

---

## 10. Support and Failure Operations

### Operating question

普通用户遇到“这个网页用不了”时，Astra 如何支持、聚合、修复，同时保护隐私？

### Strategic decision

Support 是付费托管服务的一部分。Astra 不能要求普通用户打开 DevTools，也不能默认上传用户正文。

### Report flow

| Step | 用户看到 | 内部动作 |
|---|---|---|
| 1. Report this page | “Tell us what happened” | 创建 report draft |
| 2. 选择问题类型 | 翻译慢 / 不完整 / 无法保存 / 会员问题 / 其他 | error category |
| 3. 隐私说明 | “We include technical details, not your page text.” | 默认不含正文 |
| 4. 可选截图 | 用户主动选择 | screenshot optional |
| 5. 可选正文片段 | 明确同意才上传 | explicit consent |
| 6. 提交 | “Thanks — we’ll use this to improve Astra.” | report id |
| 7. 后续 | known issue / email follow-up | support queue |

### Support bundle schema

| Field | 默认包含 | 说明 |
|---|---|---|
| reportId | 是 | 支持追踪 |
| extensionVersion | 是 | 排查版本 |
| browserName | 是 | 浏览器类别 |
| browserVersionBucket | 是 | 粗粒度版本 |
| osCategory | 是 | Windows / macOS / Linux / iOS / Android |
| featureSurface | 是 | page / selection / video / file / review / account |
| hostname | 是 | 不含完整路径参数 |
| pathPatternHash | 可选 | 避免敏感 URL |
| actionBeforeFailure | 是 | 最后动作 |
| errorCategory | 是 | 普通错误分类 |
| latencyBucket | 是 | 快慢判断 |
| membershipTier | 是 | free / trial / pro / canceled |
| privacyMode | 是 | true / false |
| servicePreference | 是 | Automatic / Faster / Balanced / Best quality |
| cacheStatus | 是 | hit / miss / unknown |
| fallbackUsed | 是 | true / false |
| screenshot | 用户主动 | 默认否 |
| selectedText | 明确同意 | 默认否 |
| pageText | 明确同意 | 默认否 |
| consoleLog | 可选脱敏 | 默认否 |

### Failure aggregation

| 聚合维度 | 用途 |
|---|---|
| hostname | 找出高失败站点 |
| featureSurface | 找出产品薄弱面 |
| errorCategory | 优先修复类别 |
| extensionVersion | 判断版本回归 |
| browserName | 兼容性 |
| membershipTier | 判断付费体验影响 |
| privacyMode | 判断隐私模式影响 |
| fallbackUsed | 判断调度有效性 |
| report volume | known issue 触发 |

### Known issues system

第一版 known issues 至少包括：

- 某些网站保护页面无法完整处理；
- 某些视频没有字幕；
- 某些长内容需要更久；
- 某些浏览器权限未开启；
- 网络或 Astra 服务暂时繁忙；
- 隐私模式下某些上下文能力减少。

### Refund / cancellation reasons

| Reason | 产品含义 |
|---|---|
| Too expensive | 定价或价值表达问题 |
| Didn’t use it | 激活/留存问题 |
| Didn’t work on my sites | 覆盖/支持问题 |
| Too slow | 调度/性能问题 |
| Privacy concerns | 信任问题 |
| Expected different features | 定位/文案问题 |
| Found another tool | 竞争问题 |
| Temporary break | win-back 机会 |
| Other | 人工查看 |

### First implementation

1. 每个核心失败卡片加入 `Report this page`。
2. Support bundle 默认不含正文。
3. 建立 report 聚合表。
4. 创建 known issues 页面。
5. 取消/退款必须收集 reason。
6. 客服 macro 使用普通用户语言。

### Internal policy

- 默认不上报正文；
- 默认不让运营查看用户学习内容；
- 用户必须明确同意才上传截图或正文片段；
- support 的目标是分类和恢复，不是窥探内容；
- 高频失败站点进入产品 backlog；
- 付费用户失败要可被优先定位。

### User-facing experience

好的 support 文案：

- “We’ll include technical details, not your page text.”
- “You can add a screenshot if you want us to see the issue.”
- “This site is a known issue. We’re tracking it.”
- “Your report helps Astra improve this page type.”

### Metrics

| 指标 | 验收 |
|---|---|
| report 提交成功率 | ≥ 95% |
| 默认不含正文 | 100% |
| report 可聚合字段完整 | ≥ 95% |
| top issue 每周可见 | 是 |
| refund/cancel reason 覆盖 | ≥ 80% |
| support first response macro coverage | ≥ 80% |
| unresolved / urgent / stale triage aggregate risk | 可见，metadata-only |
| known issue 点击后重复 report 下降 | 可见 |

### Implementation status — 2026-05-28

- Focused SLA/stale-triage visibility slice implemented: existing support report summaries include aggregate `slaRisk` fields for unresolved count, urgent unresolved count, stale triage age buckets, overdue follow-up count, oldest unresolved age, and generated/current time. These fields are derived only from report `submittedAt`, triage status/priority/updatedAt, and follow-up path/status/updatedAt; no external support workflow, email/reminder/notification/CRM, customer reply flow, or hosted support desk is introduced.

### Risks

- 用户误以为 Astra 上传了网页内容；
- support bundle 信息不足导致无法排查；
- screenshot 包含敏感信息；
- report 太复杂导致没人提交；
- known issues 过多显得产品不稳定。

### Non-goals

- 不在 MVP 做复杂客服后台；
- 不默认收集 console 全量日志；
- 不默认上传页面正文；
- 不在此 slice 做 email、reminder、notification、CRM、customer reply 或 hosted support desk；
- 不承诺所有站点都能处理；
- 不把技术错误暴露给用户。

---

## 11. Retention and Habit System

### Operating question

用户为什么会回来？Astra 如何不靠骚扰，而靠学习价值形成长期习惯？

### Strategic decision

Retention 不应该靠打卡压力，而应该靠“我保存的东西有价值、今天有一点点可以继续学、Astra 记得我的学习轨迹”。

### Retention loops

| Loop | 目标 | 触发 | 用户感受 |
|---|---|---|---|
| Today Review | 每天 3 分钟复习 | 保存后 / 次日 | 轻、可完成 |
| Continue Reading | 回到未读完内容 | Library / popup | 任务延续 |
| Continue Watching | 回到视频时间点 | 视频笔记 | 学习延续 |
| Weekly Digest | 看见长期价值 | 每周 | 成就感 |
| Forgotten Words | 复习弱项 | Review due | 有针对性 |
| Source Return | 回到原网页/视频 | Review card | 上下文记忆 |
| Pro Value Summary | 续费价值 | 月末 / 账期前 | 会员值得 |
| Win-back | 温和唤回 | 7/14/30 天未回访 | 不打扰 |

### Notification policy

| 原则 | 说明 |
|---|---|
| 默认少通知 | 不做高频提醒 |
| 产品内优先 | popup / library / review 优先 |
| email 可选 | digest 必须可退订 |
| 不恐吓 | 不说 “你落后了” |
| 不制造焦虑 | 保存越多不等于负担越大 |
| 可暂停 | 用户可关闭提醒 |
| 有内容才提醒 | 没有复习内容不提醒 |
| 有价值才发 | Digest 要有真实学习总结 |

### Reminder matrix

| 场景 | 提醒方式 | 频率 |
|---|---|---|
| 保存后首次 review | 产品内即时 | 一次 |
| Today Review due | popup badge / optional notification | 每日最多一次 |
| Weekly Digest | email / web / popup | 每周一次，可关闭 |
| 未完成长内容 | Library / popup | 轻量 |
| 7 天未回访 | optional email | 最多一次 |
| Pro 月度价值 | account / digest | 每月一次 |
| 取消后 win-back | email 可选 | 低频 |

### First implementation

1. Today Review：每天 3–5 张卡。
2. 保存后立刻告诉用户“已加入复习”。
3. Weekly Digest：第一版用统计 + 重点词句，不必过度 AI。
4. Continue Reading/Watching：Library 和 popup 显示最近内容。
5. 允许关闭提醒。
6. 不做 streak 作为主心智，避免压力。

Repo-side local readiness slice complete (2026-05-28): extension popup now shows a calm, metadata-only reminder readiness card for Today Review, Continue Reading, and Weekly Digest using local due counts, owned-reading counts, and weekly digest/activity stats. It is capped to three product-internal items, stores only reminder policy metadata, and includes local pause/disable/enable controls. Email, push providers, server-side digest sending, CRM/marketing win-back, and external notifications remain explicitly deferred.

### Internal policy

- Retention 的核心是学习价值，不是 DAU 操纵；
- 不使用羞耻型、焦虑型文案；
- Reminder 必须可关闭；
- Weekly Digest 必须能说明用户本周学到了什么；
- Review 数量默认轻，先建立习惯。

### User-facing experience

| 场景 | 文案 |
|---|---|
| 保存后 | Saved for your next review. |
| 当日复习 | 3 cards are ready. Finish in about 2 minutes. |
| 完成 | Done for today. |
| 周报 | You learned 12 expressions from 3 pages this week. |
| 继续阅读 | Continue where you left off. |
| 继续观看 | Continue from 08:32. |
| 回访 | Your saved items are waiting when you’re ready. |

### Metrics

| 指标 | 验收 |
|---|---|
| saved → first review | 可见 |
| review completion rate | 可见 |
| D1 / D7 retention | 可见 |
| Weekly Digest open rate | 可见 |
| Reminder opt-out rate | 可见 |
| Continue click rate | 可见 |
| Churn risk after save-no-review | 可见 |
| 用户投诉“提醒太多” | 低且可追踪 |

### Risks

- Review 负担太重；
- Digest 变成广告邮件；
- 通知频率过高；
- streak 让用户焦虑；
- 保存越多越混乱；
- 用户看不到 Pro 长期价值。

### Non-goals

- 不做复杂课程系统；
- 不做社交打卡；
- 不做排行榜；
- 不做强制每日提醒；
- 不把 retention 建立在焦虑上。

---

## 12. Product-Led Growth Loops

### Operating question

Astra 如何在不做重社交社区的情况下，通过学习成果自然传播？

### Strategic decision

第一阶段做轻量 product-led growth，不做社区。最自然的传播点是“我学到的句子/视频笔记/双语卡片”。

### Growth loops

| Loop | 用户动作 | 外部可见资产 | 回流路径 |
|---|---|---|---|
| Bilingual sentence card | 分享一个句子 | 漂亮双语卡片 | watermark → sample page |
| Learning note share | 分享视频学习笔记 | 摘要 + 重点表达 | public landing |
| Weekly Digest share | 分享本周学习 | 学习成就图 | Astra intro |
| Referral | 邀请朋友 | non-rewarding sample lesson invite first; rewards deferred until readiness contract passes | install |
| Public sample page | 体验 Astra | 无需安装预览 | install CTA |
| Creator workflow | 博主展示精读过程 | 学习截图/视频 | landing |
| SEO pages | 搜索场景 | 教程页 | install/trial |
| Export note | 导出学习笔记 | 带来源和 Astra 标识 | organic |

### Share card design principles

| 原则 | 说明 |
|---|---|
| 美观 | 用户愿意发出去 |
| 不泄露隐私 | 默认只分享用户主动选择内容 |
| 带上下文 | 来源标题可选 |
| 带轻水印 | Astra brand but not aggressive |
| 有回流 | sample page / install CTA |
| 可关闭水印 later | Pro 可定制或弱化 |
| 不默认公开 | 用户主动分享 |
| Saved-sentence slice | Vocabulary/Library only; short translated saved snippets; no local-file snippets, source URL/path/query telemetry, public hosting, or reading-history bulk share |

### Referral policy

| 项目 | 第一版建议 |
|---|---|
| 第一版边界 | non-rewarding invite only; sample-content-first; metadata-only telemetry |
| 奖励 | Deferred. Do not grant Pro/trial time, create entitlements, start trials, change billing, checkout, payment, subscription, or account plans in this slice. |
| Readiness contract | `src/utils/referral-readiness.ts` defines `astra-referral-readiness.v1`, canonical invite metadata, campaign sanitization, invite/conversion rate-limit policy constants, metadata safety checks, identity-risk checks, and readiness evaluation. |
| 必须通过才可考虑奖励 | rewards disabled, sample content first, metadata-only events, invite/conversion rate limits enforced, self-referral blocked, duplicate device/install/payment-or-billing identity blocked, reward ledger idempotency ready, operator audit ready. |
| 触发 | 用户完成 first save 或 first review 后；当前实现为 sample lesson first review 后 |
| 文案 | “Invite a friend to learn from real content.” |
| 不做 | 多级分销、复杂积分、排行榜、任何 reward grant / Pro trial entitlement / checkout or billing mutation |

### SEO landing map

| 页面 | 搜索意图 |
|---|---|
| AI bilingual reading extension | 读英文网页 |
| YouTube bilingual subtitles for language learning | 看视频学语言 |
| Save English sentences for review | 复习词句 |
| AI reading assistant for Chinese speakers | 中文用户读英文 |
| Learn vocabulary from real articles | 真实内容学词 |
| Read English technical docs with AI | 技术文档学习 |

### First implementation

1. 先做 bilingual sentence share card。
   - Current focused user-content slice: Vocabulary/Library expanded saved-card CTA only for short translated user-selected snippets, with `contentOrigin: user_selected` and metadata-only telemetry.
2. 创建 public sample page，展示 zero-config 体验。
   - Done locally: `src/web/src/app.tsx` now exposes a static public `#/sample` page with safe demo copy, zero-config sample framing, and install/start CTAs. The page is public without auth, records only local metadata (`public_sample` / `zero_config_static`), and does not render user-provided query/share/private text.
3. first review 后提示 referral。
4. Weekly Digest 支持导出图片。
5. Creator workflow 用手动 demo，不急着做社区功能。
6. SEO landing 先做 3–5 个高意图页面。
   - Done locally: the web app now includes four lightweight static intent pages: `#/learn/read-english-webpages`, `#/learn/youtube-bilingual-subtitles`, `#/learn/save-english-sentences`, and `#/learn/ai-reading-assistant-chinese`. They are product-copy pages with safe CTAs and metadata-only local landing telemetry. External SEO deployment work — canonical URLs, sitemap/SSR/static prerendering, search-console setup, copy localization, backlinks, paid campaigns, and marketing operations — remains deferred outside this repo-side slice.

### Internal policy

- 分享必须用户主动；
- 用户保存内容分享只允许明确点击的短句卡，不分享所有阅读历史；
- 不默认公开学习历史；
- 分享资产不能包含完整第三方文章/字幕；
- 增长 loop 不应影响核心学习体验；
- 第一阶段不做社交 feed。

### User-facing experience

好的增长文案：

- “Share this sentence card”
- “Invite a friend to try Astra”
- “Create a learning note from this video”
- “Try Astra on a sample page”

避免：

- “Post your learning history”
- “Compete with friends”
- “Share everything you read”
- “Unlock virality”

### Metrics

| 指标 | 验收 |
|---|---|
| share card creation | 可见 |
| share → landing visit | 可见 |
| landing → install | 可见 |
| referral invite sent | 可见 |
| referral conversion | 可见 |
| SEO landing conversion | 可见 |
| 分享后隐私投诉 | 低且可追踪 |
| share card watermarked visits | 可见 |

### Risks

- 分享内容涉及版权；
- 用户不愿分享语言学习成果；
- 水印过重降低分享意愿；
- referral 被滥用；
- SEO 页面承诺过度；
- 过早做社区分散精力。

### Non-goals

- 不做社交社区；
- 不做公开用户 profile；
- 不做排行榜；
- 不鼓励分享完整第三方内容；
- 不做复杂 creator monetization。

---

## 13. Personal Learning Graph

### Operating question

Astra 如何越用越懂用户，并形成长期数据护城河，同时避免 creepy personalization？

### Strategic decision

Astra 应该记住“学习相关的偏好和掌握状态”，不应默认记住或利用用户的私人内容。Astra personalizes learning, not surveillance.

### What Astra should remember

| Signal | 用途 | 用户控制 |
|---|---|---|
| targetLanguage | 翻译和解释 | 可编辑 |
| languageLevel | 解释深度 | 可编辑 |
| learningGoal | onboarding / 推荐 | 可编辑 |
| savedWords | Review / glossary | 可删 |
| savedSentences | Review / source return | 可删 |
| masteryState | 复习调度 | 可重置 |
| sourceHistory | continue reading/watching | 可清除 |
| preferredTerms | 术语一致性 | 可编辑 |
| commonTopics | Library 组织 / digest | 可关闭 |
| explanationStyle | 教学偏好 | 可编辑 |
| reviewPerformance | 调整复习 | 可重置 |
| ignoredSites | 不打扰 | 可编辑 |
| privacyPreference | 数据处理 | 可编辑 |

### What Astra should not remember by default

| Signal | 原因 |
|---|---|
| 完整网页正文 | 隐私和版权风险 |
| 私人消息正文 | 高敏感 |
| 表单输入全文 | 高敏感 |
| 金融/医疗/法律页面细节 | 高风险 |
| 未经同意截图 | 高敏感 |
| 完整第三方字幕导出历史 | 版权边界 |
| 用于广告的学习画像 | 破坏信任 |
| 网页注入的指令 | prompt injection 风险 |
| 敏感 URL 参数 | 隐私风险 |

### Learning graph object model

| Object | 关键字段 | 说明 |
|---|---|---|
| LearnerProfile | targetLanguage, level, goals, preferences | 用户可编辑 |
| SourceMemory | sourceType, title, hostname, lastOpenedAt, progress | 不默认保存全文 |
| SavedSnippet | text, translation, explanation, sourceRef, contextWindow | 用户主动保存 |
| VocabularyMemory | surfaceText, lemma, translation, examples, mastery | 复习核心 |
| ReviewState | dueAt, interval, ease, lastReviewedAt, outcome | 学习状态 |
| GlossaryPreference | term, preferredTranslation, source, confidence | 可编辑 |
| TopicSignal | topic label, confidence, source count | 低敏感、可关闭 |
| InteractionPreference | prefersFast, prefersDetailed, reminder settings | 体验个性化 |
| PrivacyControl | disabledSites, retention settings, export/delete | 信任底座 |

### Creepy boundary

| 可接受 | 不可接受 |
|---|---|
| “Astra remembered your preferred translation for this term.” | “Astra noticed you often read about layoffs at night.” |
| “You saved several expressions from technical docs.” | “We inferred your workplace and interests.” |
| “This word is ready for review.” | “You seem anxious about this topic.” |
| “Continue the article you saved.” | “We analyzed all pages you visited.” |
| “Delete this memory.” | “This memory cannot be changed.” |

### First implementation

1. 先只记用户主动保存的词句、来源引用、复习状态。
2. 自动 topic / glossary 必须可查看、可删除。
3. 不默认保存完整正文。
4. Library 显示“what Astra remembers”入口。
5. 提供导出和删除学习数据路径。
6. Privacy Mode 下减少或暂停学习图谱更新。

### Implementation status — 2026-05-28

- Done locally: Library now has a focused `memory` / “What Astra remembers” tab that is explicitly local-only. It reuses the learning-memory inventory, shows remembered terms, builds privacy-safe per-source timelines from local vocabulary / owned reading / reading history / study progress, and supports bulk local actions for digest exclusion, sync disablement, source-history-only removal, and source + saved-card deletion.
- Done locally: the row content boundary is title, source type, hostname, counts, coarse progress/control state, and coarse timeline events. It does not render full page text, transcripts, prompts, model output, URL query strings, URL hashes, or sensitive URL parameters. Internal action refs are for local controls only.
- Done locally: automatic local learning-memory writes now resolve the shared write policy before persisting page translation history, study progress, and owned article capture. Under Privacy Mode they keep only host-bucket / coarse continuity metadata (`Private page`, origin URL, counts/status) and mark reduced owned captures as local digest/sync excluded; personalization-excluded hosts no-op these automatic writes.
- Done locally: `LEARNING_MEMORY_WRITE_AUDIT_REGISTRY` is now an executable repo-side Privacy Mode audit harness for graph-writing surfaces. It covers automatic page translation source history, study progress, owned article capture, reading-history sync into owned reading, explicit vocabulary saves, review scheduling, remembered terms, future automatic topic signals, and future digest summaries; focused tests assert every registry entry's expected Privacy Mode policy decision and raw-content-free content boundary.
- Repo-side cloud/server foundation complete: authenticated `GET /v1/account/learning-memory/inventory` returns metadata-only counts/cursors/preferences/privacy boundary for sync collections plus weekly digest archive, and authenticated `DELETE /v1/account/learning-memory` clears Astra relay cloud learning-memory rows and returns a deterministic deletion receipt with per-collection counts, timestamp, schema, and explicit cloud-only boundary. Tests assert no saved sentence text, raw URLs/hostnames, email, device/session ids, or sync payload bodies are exposed.
- Focused account/settings UI slice complete: `src/utils/astra/account.ts` now exposes typed client helpers for cloud learning-memory inventory/deletion receipt, weekly digest status, and weekly digest preference updates. Astra Web Account renders a user-safe cloud learning-memory card with metadata-only counts, confirm-guarded cloud-only deletion receipt, and a weekly digest status/preference card with aggregate counts only. The UI explicitly avoids external provider deletion receipts, local-browser deletion claims, email scheduling promises, push/email delivery confirmation, provider/model details, prompts/text, raw URLs, emails, and device/session ids.
- Still deferred: external/cloud-provider deletion receipts, proactive digests/notifications, automated topic/glossary suggestions, email scheduling/delivery confirmation UI, and broader cross-surface polish beyond the focused Web Account settings card.

### Internal policy

- 用户主动保存 > 自动推断；
- 可见记忆 > 隐形画像；
- 可删除 > 不可控；
- 学习用途 > 广告用途；
- 最小必要上下文 > 全文存储；
- 个性化必须能解释给用户听。

### User-facing experience

| 场景 | 文案 |
|---|---|
| 术语偏好 | Astra remembered this term for future reading. |
| 删除记忆 | Forget this term |
| 隐私设置 | Choose what Astra can save for learning. |
| 导出 | Export your saved words, sentences, and review history. |
| 清除来源 | Remove this page from your learning history. |
| 个性化关闭 | Astra will stop using this preference. |

### Metrics

| 指标 | 验收 |
|---|---|
| 保存对象可删除 | 100% |
| 学习数据可导出 | V1 可用 |
| 用户可见 memory settings | 可用 |
| Privacy Mode 下图谱更新策略 | 明确 |
| glossary preference edit rate | 可见 |
| creepy/privacy complaint | 低且可追踪 |
| source return clicks | 可见 |
| review improvement by memory | 可见 |

### Risks

- 自动记忆让用户不适；
- topic inference 过度；
- 保存上下文触碰版权；
- 删除数据不彻底；
- 个性化错误导致翻译更差；
- 图谱数据被 prompt injection 利用。

### Non-goals

- 不做广告画像；
- 不默认收集完整浏览历史；
- 不默认保存表单输入；
- 不向网页暴露用户记忆；
- 不做不可解释的黑箱个性化。

---

## 14. Minimal Operations Console

### Operating question

Astra 团队需要什么最小后台，才能支持用户、控制成本、处理故障、管理会员，同时不默认查看用户正文？

### Strategic decision

Operations Console 的第一职责是保护用户体验、毛利和信任，不是让团队窥探用户内容。MVP 只做支持、成本、健康、风控和 kill switch。

### MVP modules

| Module | 字段 | 用途 |
|---|---|---|
| User lookup | user id, email hash, createdAt, locale, tier | 支持用户 |
| Membership status | free/trial/pro/canceled, renewal, refund status | 付费问题 |
| Usage category | light/normal/heavy/extreme | 成本和风控 |
| Recent task summary | task class counts, failure categories, latency buckets | 排障 |
| Support reports | report id, hostname, feature, category, status | 工单处理 |
| Known issues | hostname, issue type, affected versions, workaround | 降低重复支持 |
| Cost dashboard | daily cost bucket, cost/user, heavy users | 防亏损 |
| Model/provider health | success rate, latency, outage flag | 调度 |
| Feature flags | feature/site/tier/task kill switch | 风险控制 |
| Refund/cancel reasons | reason counts, plan, cohort | 产品反馈 |
| Privacy audit | content access events, consent flags | 信任与合规 |

### Access boundaries

| 操作 | 默认允许 | 说明 |
|---|---|---|
| 查看账号状态 | 是 | 不含正文 |
| 查看会员状态 | 是 | 支持账务 |
| 查看错误类别 | 是 | 排障 |
| 查看 hostname | 是 | 站点问题 |
| 查看完整 URL | 默认否 | 需要权限或 hash |
| 查看用户保存词句 | 默认否 | 用户明确授权或用户自己导出 |
| 查看页面正文 | 默认否 | 明确授权才可 |
| 查看截图 | 用户主动上传 | 支持排查 |
| 修改用户学习数据 | 默认否 | 风险高 |
| 手动切模型 | 默认否 | 应通过 policy/flag |
| 触发 refund | 受权限控制 | 财务记录 |
| kill switch | 受权限控制 | 需要审计 |

### Kill switch categories

| Switch | 用途 |
|---|---|
| disable_feature_globally | 全局关闭高风险功能 |
| disable_feature_for_site | 某站点关闭 |
| disable_task_class | 暂停 high / long-running |
| force_fast_mode | outage 时降级 |
| disable_provider_route | 供应商故障 |
| limit_free_high_cost | 成本峰值 |
| disable_digest | 邮件问题 |
| disable_share | 版权或滥用 |
| privacy_lockdown | 隐私事件应急 |

### First implementation

1. User lookup + membership + usage category。
2. Support report list + known issues。
3. Cost dashboard：按 taskClass 和 tier 聚合。
4. Provider/model health dashboard。
5. Feature flag / kill switch。
6. 操作审计日志。
7. 明确禁止默认查看用户正文。

### Implementation status — 2026-05-28

- Focused relay slice implemented: `POST /v1/translate` now reads persisted runtime `killSwitches` before provider spend and enforces `emergency.disable_managed_ai`, `emergency.disable_task_class`, and `emergency.limit_free_high_cost` hard blocks with metadata-only decision failures. `emergency.force_fast_mode` safely degrades managed translate requests to `serviceMode: "fast"` without changing provider selection. Background/content UI, billing, and full staff-console surfaces remain deferred.
- Focused repo-side ops-console maturity slice complete: existing operator-token-gated `GET /v1/ops/users/lookup` now returns a deterministic bounded `resultWindow` and explicit `snapshotBoundary` for exact staff lookup snapshots. The Web Account staff lookup card displays the bounded/metadata-only boundary and continues to avoid emails, raw query, device/session ids, provider/model rows, page text, email body, export, download, raw logs/content, membership edits, billing mutations, or broad admin CRUD. Full admin console, list/search dashboard pagination, CSV/export/download tooling, billing/entitlement mutation tools, and raw content access remain deferred/non-goals.
- Focused read-only ops cockpit slice complete: operator-token-gated `GET /v1/ops/cockpit/summary` now composes existing metadata-only summaries for cost usage, support SLA/triage, cancellation/refund reasons, weekly/mobile/analytics cohorts, weekly digest delivery, and role-scoped provider health into `astra-ops-cockpit-summary.v1`. `src/utils/operating-review.ts` now provides the pure cockpit builder using the operating-review cadence and experiment guardrails. Astra Web Account includes a read-only “Ops cockpit / operating review” card with aggregate risk flags and review evidence readiness. The slice intentionally excludes external BI/warehouse, CRM replies, payment/subscription mutation or truth-source work, legal/store/live-QA workflows, exact provider billing reconciliation, raw content, per-user rows, raw identifiers, and broad admin CRUD.

### Internal policy

- 后台访问必须按角色分级；
- 所有敏感查看必须记录审计；
- 正文访问必须用户明确授权；
- kill switch 优先于新功能；
- 任何退款/取消原因要进入产品反馈；
- 成本 dashboard 每周 review。

### User-facing experience

用户不会直接看到后台，但会感受到：

- 支持知道问题大类；
- 常见问题被快速识别；
- 故障时服务会优雅降级；
- 退款/取消流程清楚；
- 数据不会被默认查看。

### Metrics

| 指标 | 验收 |
|---|---|
| Support report 可在后台查询 | 100% |
| Cost by taskClass 可见 | 100% |
| Heavy user 可识别 | 是 |
| Kill switch 可在无需发版时生效 | 是 |
| Provider health 可见 | 是 |
| Provider outage 自动缓解基础 | 是（repo-side recent-health stable fallback；external monitors/full autonomous routing deferred） |
| 正文访问默认关闭 | 100% |
| 后台操作审计 | 100% |
| Known issues 可维护 | 是 |

### Risks

- 后台权限过大造成隐私风险；
- 成本 dashboard 只看总量不能定位；
- kill switch 误伤用户；
- 客服手动操作破坏一致性；
- 后台过早做复杂企业功能。

### Non-goals

- 不做企业管理后台；
- 不默认查看用户学习库；
- 不提供客服手动切模型；
- 不做复杂 CRM；
- 不让后台成为内容审查工具。

---

## 15. Privacy-Safe Analytics and Experimentation

### Operating question

Astra 如何用数据驱动激活、留存、成本和会员转化，同时不记录用户正文？

### Strategic decision

Analytics 记录的是事件、状态、性能和选择，不是用户内容。实验用于改善产品路径，不用于操纵用户。

### Event taxonomy

| Category | Events | Content allowed |
|---|---|---|
| Activation | onboarding_started, onboarding_completed, sample_started, first_value_seen | 否 |
| Usage | task_started, task_completed, task_failed, retry_clicked | 否 |
| Learning | saved_item_created, review_opened, review_completed, source_return_clicked | 否 |
| Membership | paywall_viewed, trial_started, subscribed, canceled, refund_requested | 否 |
| Cost | ai_task_cost_bucket, cache_hit, fallback_used, long_task_started | 否 |
| Quality | report_submitted, user_stopped, low_confidence_shown, faster_mode_used | 否 |
| Retention | digest_opened, continue_clicked, reminder_dismissed, reminder_disabled | 否 |
| Growth | share_card_created, referral_sent, referral_converted, landing_visited | 否 |
| Support | support_bundle_created, known_issue_seen, contact_support_clicked | 否 |
| Experiment | variant_assigned, conversion_event, guardrail_metric | 否 |

### Event property rules

| Property type | 允许 | 禁止 |
|---|---|---|
| featureSurface | page / video / selection / review | 正文 |
| sourceType | article / video / file | 完整内容 |
| hostname | 可选 | 敏感 URL 参数 |
| lengthBucket | short / medium / long | 原文字数精确到可还原 |
| latencyBucket | P50/P95 bucket | 原始日志全文 |
| tier | free/trial/pro | 支付细节 |
| outcome | success/failure/canceled | 失败内容 |
| errorCategory | timeout/protected/no-caption | 技术栈全文 |
| experimentVariant | A/B/C | 用户内容 |
| costBucket | low/medium/high | provider 价格明细可内用，不给用户 |

### Experimentation areas

| Area | Example tests | Guardrails |
|---|---|---|
| Onboarding | sample first vs current tab first | completion, first value, complaints |
| Paywall | trial timing, Pro copy | conversion, churn, refund |
| Review | 3 cards vs 5 cards | completion, return, opt-out |
| Save moment | “Saved” vs “Saved for review” | save→review |
| Digest | weekly timing/copy | open, unsubscribe |
| Free limits | soft warning vs hard stop | conversion, frustration |
| Share card | visual style | share, privacy complaints |
| Support | report copy | submission, useful reports |

### Decision cadence

| Cadence | Review |
|---|---|
| Daily | outage, error spike, cost spike, support volume |
| Weekly | activation, paywall, retention, top failures, heavy users |
| Monthly | pricing, gross margin, churn, trial conversion, refund reasons |
| Release | feature adoption, regression, support load, privacy issues |
| Quarterly | tier structure, roadmap priority, growth channel ROI |

### First implementation

1. 建立事件命名规范。
2. 默认不采集正文。
3. 建立 activation / cost / support / retention 四张 dashboard。
4. V0 实验只做 onboarding、paywall timing、review card count。
5. 每个实验必须定义成功指标和 guardrail。
6. 隐私模式减少或关闭非必要 analytics。

### Repo-side completion evidence — 2026-05-28

Completed a focused production/cohort analytics foundation without adding an external analytics vendor, warehouse, BI layer, tracking SDK, web beacon, ad/marketing pixel, or per-user export.

- Added metadata-only relay event intake/list endpoint: `POST/GET /v1/account/analytics-events`.
- Added operator-gated aggregate endpoint: `GET /v1/ops/analytics/cohort-summary?grain=day|week`.
- Added file-backed store: `src/server/analytics-event-store.ts`, persisted via `ASTRA_ANALYTICS_EVENT_STORE_PATH` / `data/server/analytics-events.json`.
- Canonical server taxonomy currently covers activation, learning, retention, membership, cost, and support event names.
- Safe properties are restricted to coarse metadata: timestamp, category, plan/tier/cohort/source type, task class/surface, outcome, and boolean flags.
- Intake rejects content/identifier-shaped fields and raw URL/email-shaped strings; unknown safe fields are stripped before persistence.
- Cohort summary returns aggregate counts only by day/week + category/event + plan/cohort, with no per-user rows, raw content, raw email, raw device ID, raw URL, prompt, or model output.
- Tests added in `src/server/index.test.ts` and `src/server/analytics-event-store.test.ts` for authenticated ingest/list, unsafe event rejection, store sanitization, and operator-gated cohort summary.

Explicit deferrals remain: no external warehouse, no production dashboards, no full BI surface, no experiment assignment engine, no marketing pixels, no ad tracking, no billing/provider-secret details, and no raw/per-user analytics export.

### Internal policy

- 无正文 telemetry；
- 实验不能影响数据删除权；
- 不做暗黑模式；
- 不用误导性 paywall；
- 决策必须看 guardrail；
- 用户可通过隐私设置减少 analytics。

### User-facing experience

隐私说明：

- “Astra records product events, not the text you read.”
- “Privacy Mode reduces product analytics.”
- “You can delete your learning data anytime.”

### Metrics

| 指标 | 验收 |
|---|---|
| 事件正文采集 | 0 |
| event schema coverage | 核心路径 100% |
| activation dashboard | V0 可用 |
| cost dashboard | V0 可用 |
| support dashboard | V0 可用 |
| experiment guardrails | 100% |
| privacy mode analytics behavior | 明确 |
| decision review cadence | 每周执行 |

### Risks

- analytics 过多影响信任；
- 实验过多影响产品一致性；
- event 命名混乱；
- cost 事件不可归因；
- guardrail 被忽视；
- 隐私模式没有实际效果。

### Non-goals

- 不记录正文；
- 不做广告画像；
- 不做跨站追踪营销；
- 不做无明确目标的 A/B；
- 不把实验作为绕过用户选择的手段。

---

## 16. Legal, Compliance, and Store Risk

### Operating question

Astra 作为浏览器扩展 + 托管 AI + 学习数据 + 会员服务，需要提前防哪些产品风险？

### Strategic decision

合规不是最后补文档，而是产品边界。Astra 的信任来自“说得准确、做得可控、用户可删除”。

### Risk checklist

| Risk area | 风险 | Product boundary | First implementation |
|---|---|---|---|
| Browser permissions | 商店审核、用户不信任 | 用普通语言解释页面访问用途 | Store permission copy |
| Privacy policy | 用户内容、学习数据、AI 处理 | 明确处理哪些数据、为何处理 | Policy checklist |
| Terms | 会员、取消、退款、限制 | 明确使用边界和 fair use | Terms checklist |
| AI disclaimer | 翻译/解释可能错误 | 不承诺完全准确 | AI notice |
| YouTube transcript | 版权/平台边界 | 保存片段和笔记优先，不鼓励完整再分发 | Export boundary |
| File content | 用户导入内容 | 用户主动导入才处理 | File processing notice |
| Data deletion | 删除账号/学习数据 | 明确删除路径和时效 | Delete data flow |
| Refund | 付费争议 | 清晰退款政策 | Refund policy |
| Email digest | 邮件合规 | 可退订 | Unsubscribe |
| Minors | 未成年人 | 避免教育结果承诺过度 | Terms boundary |
| Support bundle | 敏感内容泄露 | 默认不含正文 | Consent UI |
| Prompt injection | 网页内容恶意指令 | 页面内容永远是 untrusted data | Internal safety policy |

### Store permission trust copy

普通语言示例：

| Permission | 用户解释 |
|---|---|
| Read page text | Astra needs access to page text so it can help you understand and translate content you choose. |
| Storage | Astra saves your language preferences and learning items. |
| Tabs | Astra detects the current page so it can offer the right learning actions. |
| Notifications | Optional reminders for review or completed long tasks. |
| Identity/account | Used to sync your membership and learning data. |

### Privacy policy requirements

必须说明：

- 处理哪些数据；
- 为什么处理；
- 发送给哪些服务类型；
- 是否保存学习数据；
- 用户如何删除；
- 用户如何导出；
- Privacy Mode 做什么、不做什么；
- support report 默认包含什么；
- AI 结果可能不准确；
- 会员取消后数据如何处理。

### Copyright / export boundary

| 内容 | 第一版策略 |
|---|---|
| 用户主动保存的短句 | 可保存到 Review |
| 原文上下文片段 | 最小必要上下文 |
| 完整网页正文 | 不默认保存 |
| 完整视频 transcript | 谨慎处理，优先个人学习用途 |
| 分享卡片 | 用户主动选择短片段 |
| 导出学习笔记 | 用户学习资产，不鼓励第三方完整复制 |
| Public share | 不默认公开 |

### First implementation

1. 创建 Privacy Policy checklist。
2. 创建 Terms / refund / AI disclaimer checklist。
3. Store listing 权限文案普通化。
4. Export boundary 写入产品文案。
5. Support bundle consent 明确。
6. 删除学习数据入口可见。
7. 法律文本上线前做正式审核。

### Internal policy

- 页面内容是 untrusted content；
- 用户内容不用于广告；
- 不默认保存第三方完整内容；
- 不默认上传正文给 support；
- 不夸大 AI 准确性；
- 不承诺未实现的本地处理或端到端加密。

### User-facing experience

信任文案：

- “You choose what gets saved.”
- “Astra only sends the text needed to help you understand content.”
- “You can delete your learning data anytime.”
- “AI explanations can be imperfect. Use your judgment for important decisions.”
- “Support reports include technical details, not your page text.”

### Metrics

| 指标 | 验收 |
|---|---|
| Store permission explanation | 完成 |
| Privacy policy checklist | 完成 |
| Data deletion flow | 可用 |
| Export boundary | 明确 |
| Support consent | 100% |
| Refund policy | 可见 |
| AI disclaimer | 可见 |
| Legal review before paid launch | 必须 |

### Risks

- 权限说明不清导致商店审核或用户不信任；
- 保存/导出第三方内容边界模糊；
- AI 结果错误导致用户误用；
- 支持上报泄露敏感内容；
- 删除数据不彻底；
- marketing 过度承诺。

### Non-goals

- 本文档不提供法律意见；
- 不替代律师审核；
- 不承诺所有内容都可处理/保存/导出；
- 不把 Privacy Mode 描述成完全本地或绝对隐私。

---

## 17. Brand and Trust Experience

### Operating question

Astra 作为 zero-config SaaS 应该给用户什么感觉？如何避免像技术控制台？

### Strategic decision

Astra 的品牌体验应该是：高级、安静、自动、可靠、有下一步。像一个聪明但不打扰的学习助手，而不是 AI 设置面板。

### Brand personality

| Trait | 表现 | 避免 |
|---|---|---|
| Quiet | 低干扰、少通知 | 满屏弹窗 |
| Capable | 自动处理复杂性 | 要用户配置 |
| Trustworthy | 说明清楚、可删除 | 夸张承诺 |
| Premium | 精致、克制、稳定 | 廉价工具感 |
| Helpful | 总有下一步 | 冷冰冰错误 |
| Learning-first | 保存、复习、上下文 | 只做翻译 |
| Non-technical | 任务语言 | provider/model/token |
| Respectful | 取消和限制都体面 | 强迫、羞辱、焦虑 |

### Touchpoint principles

| Touchpoint | 应有体验 |
|---|---|
| Onboarding | 轻、快、无需配置 |
| Loading | 有进度，不焦虑 |
| Success | 成就感但不夸张 |
| Error | 短、可恢复 |
| Paywall | 解释价值，不强迫 |
| Settings | 极简，按任务分组 |
| Support | 尊重隐私 |
| Digest | 像学习总结，不像营销邮件 |
| Cancellation | 体面、清楚、不刁难 |
| Report | 用户知道不会默认上传正文 |

### Visual direction

| 原则 | 说明 |
|---|---|
| Low noise | 避免密集设置表格 |
| One primary action | 每个界面一个主动作 |
| Progressive disclosure | 低频功能折叠 |
| Calm status | pill / card / subtle progress |
| Learning artifacts | 保存卡、复习卡、digest 要精致 |
| Premium empty states | 空状态解释下一步 |
| Error cards with CTA | 错误不是 toast 消失 |
| Settings as preferences | 不像后台配置 |

### First implementation

1. 建立 Tone of Voice 文档。
2. 统一 error / paywall / support / onboarding 文案。
3. Settings 首屏只保留用户任务设置。
4. diagnostics 放二级入口。
5. 所有失败状态改为 card + CTA。
6. Weekly Digest 和 share card 作为品牌展示面。

### Internal policy

- 技术复杂性由 Astra 承担；
- 用户看到任务，不看到管线；
- premium 不等于复杂；
- 失败状态也要优雅；
- 限制和取消也要尊重用户；
- 视觉不为功能堆砌让路。

### User-facing experience

文案方向：

- “Astra handled it.”
- “Saved for review.”
- “Done for today.”
- “Continue where you left off.”
- “This content is long. Astra will process it in parts.”
- “Your saved items stay in your account.”

### Metrics

| 指标 | 验收 |
|---|---|
| 技术词 UI 暴露 | 0 |
| settings 首屏主动作清晰 | user test 通过 |
| error CTA 覆盖 | ≥ 95% |
| support privacy trust copy | 100% |
| paywall refund/cancel complaints | 可追踪 |
| onboarding completion | 不低于目标 |
| reminder opt-out | 低且可解释 |

### Risks

- 过度追求简洁导致高级用户找不到功能；
- 文案太抽象；
- 视觉高级但反馈不足；
- paywall 显得太营销；
- settings 隐藏太深影响控制感。

### Non-goals

- 不做复杂控制台；
- 不把所有高级功能放首屏；
- 不用品牌包装隐藏真实限制；
- 不牺牲可访问性追求审美。

---

## 18. Phased Roadmap

### Operating question

如何按阶段落地 zero-config SaaS operating model，而不是一次性做完全部运营系统？

### Strategic decision

先搭经营底座，再优化激活，再做留存和增长，最后成熟运营。顺序不能反过来；否则增长会放大成本和支持问题。

---

### V0：成本 / 模型 / 用量 / 支持基础

目标：Astra 可被经营。

| Workstream | Deliverable |
|---|---|
| Cost | task cost classes, cost ledger, cost dashboard |
| Routing | routing policy, fallback reason, provider health |
| Entitlement | Free/Trial/Pro matrix |
| Copy | technical-to-human dictionary |
| Support | report flow, support bundle |
| Console | user lookup, membership, reports, cost dashboard |
| Privacy | no-body telemetry, report consent |
| Flags | kill switch by feature/site/task |

验收：

- 所有 AI 任务有成本类别；
- 所有失败有普通文案；
- 所有 report 默认不含正文；
- 所有高成本任务可被限制或降级；
- 普通 UI 技术词为 0。

---

### V1：Activation + Trial + Support

目标：用户 10 分钟内成功，并理解 Pro 价值。

| Workstream | Deliverable |
|---|---|
| Onboarding | 3-question setup |
| Sample | sample page full path |
| First save | save → review handoff |
| Trial | trial start and Pro value moments |
| Paywall | value-based paywall |
| Support | known issues + support macro |
| Metrics | activation dashboard |

验收：

- onboarding completion ≥ 80%；
- first value P50 < 60s；
- first save rate 可见；
- trial cost 可计算；
- report 聚合可用。

---

### V2：Retention + Digest + Learning Graph

目标：用户开始回来复习，并看到学习资产价值。

| Workstream | Deliverable |
|---|---|
| Review | Today Review |
| Digest | Weekly Digest |
| Continue | Continue Reading/Watching |
| Memory | visible learning memory controls |
| Graph | saved words/sentences/mastery/source history |
| Privacy | export/delete |

验收：

- saved → review 可见；
- D7 retention 可见；
- Digest open 可见；
- memory delete/export 路径可用；
- reminder opt-out 可用。

---

### V3：Experimentation + Growth Loops

目标：用数据优化转化和增长。

| Workstream | Deliverable |
|---|---|
| Experiments | onboarding/paywall/review A/B |
| Share | sentence card |
| Referral | non-rewarding sample referral + anti-abuse readiness contract; Pro/trial rewards deferred |
| Public sample | share landing |
| SEO | 3–5 high-intent pages |
| Analytics | experiment guardrails |

验收：

- share → landing → install 可追踪；
- referral conversion 可追踪，但 reward grant count 必须保持 0；
- A/B decision cadence 执行；
- privacy-safe events 无正文。

---

### V4：Mature Operations

目标：进入稳定会员服务运营。

| Workstream | Deliverable |
|---|---|
| Cost | monthly margin review |
| Support | SLA and issue taxonomy |
| Routing | automatic outage mitigation |
| Premium | heavy user plan evaluation |
| Compliance | periodic privacy/store review |
| Growth | creator workflow and lifecycle campaigns |
| Quality | cohort-based quality review |

验收：

- Gross margin 可按 cohort 看；
- support top issues 每周进入 backlog；
- outage 可降级；
- cancellation reasons 进入 roadmap；
- feature flags 成熟。

---

## 19. Non-Goals

### Operating question

为了保持 zero-config SaaS 聚焦，Astra 第一阶段明确不做什么？

### Strategic decision

Astra 不应为了看起来强大而牺牲普通用户心智、成本健康和学习闭环。非目标和目标同样重要。

### Strategic non-goals

| Non-goal | 原因 |
|---|---|
| 不做 provider 控制台 | 破坏零配置心智 |
| 不默认 BYOK | 面向普通用户，不面向模型玩家 |
| 不做复杂模型选择 UI | 用户买体验，不买模型 |
| 不做无限制高成本 AI | 毛利不可控 |
| 不做社交社区 | 过早分散，且带审核/隐私风险 |
| 不做企业后台 | MVP 过重 |
| 不做课程平台 | Astra 核心是从真实内容学习 |
| 不做复杂 LMS | 与浏览器学习层定位不符 |
| 不做广告画像 | 破坏信任 |
| 不默认保存完整网页正文 | 隐私和版权风险 |
| 不默认上传 support 正文 | 支持必须隐私安全 |
| 不承诺所有网站/视频/文件都可处理 | 过度承诺带来退款和信任风险 |
| 不把 diagnostics 放普通首屏 | 普通用户不需要技术控制台 |
| 不用 token/模型当会员价值 | 用户价值是省心和学习结果 |
| 不用强打卡制造焦虑 | 留存靠价值，不靠压力 |

### First implementation

每次新提案必须回答：

| 问题 | 如果答案是否定，则不进入 V0/V1 |
|---|---|
| 是否支持 zero-config？ | 否则延后 |
| 是否能控制成本？ | 否则延后 |
| 是否能用普通语言解释？ | 否则延后 |
| 是否默认保护隐私？ | 否则延后 |
| 是否促进学习闭环或付费价值？ | 否则延后 |
| 是否可被 support 和 analytics 观测？ | 否则延后 |

### Metrics

| 指标 | 验收 |
|---|---|
| 普通 UI provider/model/API 暴露 | 0 |
| 高成本无限制能力 | 0 |
| 默认正文上报 | 0 |
| 新功能无成本类别 | 0 |
| 新功能无 support/report plan | 0 |
| 新功能无用户文案 | 0 |

### Risks

- 非目标不明确导致产品变成模型控制台；
- 高级用户需求牵引普通 UI 复杂化；
- 竞品功能焦虑导致无边界扩张；
- 运营系统没建好就做增长；
- 会员承诺超出成本能力。

---

## 20. First 30 / 60 / 90 Days Execution Plan

### Operating question

这份战略文档如何转成第一轮可执行计划？

### Strategic decision

前 90 天只做经营底座 + 激活闭环 + 最小留存，不追求大而全。

### First 30 days：经营底座

| Priority | Deliverable | Acceptance |
|---|---|---|
| P0 | Task cost class registry | 核心 AI 任务 100% 分类 |
| P0 | Free/Trial/Pro entitlement matrix | 产品、工程、运营共同确认 |
| P0 | Technical-to-human copy dictionary | 普通 UI 技术词替换 |
| P0 | Support bundle schema | 默认不含正文 |
| P0 | Cost dashboard MVP | 可按 tier/task 看 |
| P0 | Routing decision log | 不含正文 |
| P0 | Kill switch list | 可按 feature/site/task 关闭 |

### First 60 days：激活与试用

| Priority | Deliverable | Acceptance |
|---|---|---|
| P0 | 3-question onboarding | 完成率可观测 |
| P0 | Sample page path | 无真实网页也能 first value |
| P0 | First save → first review | 漏斗可观测 |
| P0 | Trial start and Pro value moments | 转化路径可观测 |
| P1 | Known issues page | report 可聚合 |
| P1 | Paywall copy variants | ✅ 本地 beta-safe value-copy A/B and paywall view → upgrade-intent visibility available; billing/trial remains deferred |
| P1 | Cancellation reasons | 可收集 |

### First 90 days：留存与增长

| Priority | Deliverable | Acceptance |
|---|---|---|
| P0 | Today Review | saved→review 可观测 |
| P0 | Weekly Digest MVP | open / opt-out 可观测 |
| P1 | Personal memory controls | 查看/删除基础记忆 |
| P1 | Share sentence card | share→landing 可追踪 |
| P1 | Referral MVP | readiness contract done; rewards still deferred and reward grants remain zero |
| P1 | Experiment cadence | 每周 review |
| P1 | Monthly unit economics review | 毛利风险可见 |

### Decision standard

只要出现以下情况，暂停增长，优先修运营底座：

| Trigger | Action |
|---|---|
| Pro AI cost/user 快速上升且无法归因 | 暂停高成本推广 |
| Support report 激增 | 优先 known issue 和降级 |
| 技术术语再次出现在普通 UI | 阻断 release |
| Trial 成本高但转化低 | 调整 trial 权益 |
| 用户隐私投诉 | 暂停相关数据流 |
| refund reason 集中于“not working” | 优先稳定性和 support |

---

## 21. Final Operating Thesis

Astra 不应该成为“更复杂的 AI 翻译插件”。

Astra 应该成为：

> 一个普通用户可以直接购买、直接使用、长期信任的零配置 AI 语言学习会员服务。

它的商业差异不是：

- 支持更多 provider；
- 暴露更多模型；
- 允许更多 prompt；
- 有更多高级设置。

它的商业差异是：

1. 用户不用懂 AI；
2. Astra 自动处理速度、质量、成本和 fallback；
3. 用户读过和看过的内容会沉淀为学习资产；
4. 用户每天知道该复习什么；
5. 用户遇到失败时有可懂的恢复路径；
6. 用户愿意为稳定、省心、长内容、同步、支持和长期学习价值付费；
7. Astra 的后台能持续控制成本、质量、支持和合规风险。

最终判断：

> Read Frog 可以是一个强大的开源工具；Astra 要成为一个用户愿意付费的托管式 AI 学习服务。  
> 用户不买 provider，不买 token，不买模型。用户买的是：Astra 帮我把外语世界变得可理解、可保存、可复习，而且我不用配置任何东西。
