# Astra Mobile Companion Review Plan

文件名：`astra-mobile-companion-review-plan-2026-05-27.md`  
日期：2026-05-27  
文档性质：移动端 companion app 产品方案 / 复习习惯 / 跨端学习闭环 / 设计系统  
适用范围：iOS、Android、PWA、移动端信息架构、Today Review、学习资产同步、App Store / Google Play 上架准备  
刻意不覆盖：网页翻译实现、YouTube 字幕工程、FloatBall、serviceMode、AI 成本控制、模型路由、客服运营后台、GTM 全局策略、长期平台宏观愿景。

---

## 0. 文档边界与核心判断

### 0.1 本文档解决什么

这份文档只回答一个问题：

> Astra 如何把用户在电脑网页、YouTube、PDF、文档中保存的真实词句，变成手机上可持续复习的每日习惯？

移动端第一阶段不是另一个浏览器翻译工具，也不是完整 Web Companion 的缩小版。移动端的第一阶段定位应该是：

> **Astra Mobile Review Companion：在电脑上保存真实网页里的词句，在手机上用碎片时间复习。**

### 0.2 与已有三份文档的边界

| 已有文档 | 已负责内容 | 本文档不重复 |
|---|---|---|
| Competitive Code Remediation | Read Frog / Immersive 对标、网页翻译、YouTube、FloatBall、代码整改、release proof | 不拆网页/YouTube/FloatBall 工程 |
| Macro Product Upgrade | 长期平台战略、学习闭环、Library、会员、GTM、Trust、Safety、OKR | 不重写平台愿景和宏观商业叙事 |
| Zero-Config SaaS Operating Model | AI 成本、模型路由、Free/Pro 用量、客服、运营、风控、analytics | 不设计 SaaS 成本和运营后台 |

本文档只专注：

- 手机端定位；
- iOS / Android / PWA 路线；
- Today Review；
- Word Card；
- Sentence Card；
- Source-backed learning；
- Mobile Library；
- Weekly Digest；
- Reminder；
- Offline review；
- Sync data model；
- App Store / Google Play 风险；
- 移动端视觉语言；
- 移动端可访问性；
- 移动端指标；
- 30/60/90 天路线图。

### 0.3 最高优先级判断

Astra 的跨端产品逻辑应该是：

> **Web is for capture. Mobile is for habit.**

桌面浏览器扩展负责在用户真实读网页、看视频、处理文件时捕获学习资产；手机端负责把这些资产变成每天 3–5 分钟的复习习惯。

### 0.4 移动端一句话定位

英文：

> Save real words and sentences on the web. Review them on your phone.

中文：

> 在电脑上保存真实网页里的词句，在手机上用碎片时间复习。

### 0.5 移动端产品原则

| 原则 | 说明 |
|---|---|
| Habit first | 手机端首要目标是复习习惯，不是功能覆盖 |
| Source-backed | 每张卡都尽量带回来源，让用户知道它来自真实内容 |
| Zero configuration | 不出现 provider / model / API / token / prompt |
| Low pressure | 不制造打卡焦虑，不用惩罚式 streak |
| Offline resilient | 复习、标记、查看已同步卡片应可离线 |
| Quiet premium | 视觉安静、高级、像纸张和墨迹，不像控制台 |
| Fast in 30 seconds | 用户打开 app 30 秒内应该能完成一次有效学习动作 |
| Capture elsewhere | 手机端不负责大规模捕获网页内容，至少 V0 不做 |

---

## 1. Mobile Product Positioning

### 1.1 问题

Astra 如果把移动端做成“手机版网页翻译工具”，会同时踩中三个问题：

1. 移动端浏览器扩展能力受平台限制，尤其 iOS；
2. 小屏幕不适合复杂网页翻译控制、字幕控制和文档分析；
3. 用户在手机上的碎片时间更适合复习，而不是管理大段内容。

真正的机会不是“把桌面功能搬到手机”，而是把 Astra 已经捕获的学习资产变成移动端每日习惯。

### 1.2 Strategic decision

移动端第一阶段定位为：

> **Review Companion，而不是 Mobile Translator。**

移动端成功标准不是“能不能翻译网页”，而是：

- 用户是否每天打开；
- 用户是否能快速复习；
- 用户是否感觉自己真的记住了网页里遇到的表达；
- 用户是否因为手机端复习而更愿意继续在 Web 上保存内容；
- 用户是否更理解 Astra Pro 的跨端价值。

### 1.3 First implementation

V0 只做五件事：

1. Today Review；
2. Web Words；
3. Saved Sentences；
4. Learning Library；
5. Weekly Digest。

不做：

- 手机浏览器整页翻译；
- 视频播放器字幕翻译；
- PDF 移动阅读器；
- 完整 Deep Read；
- 复杂设置页；
- AI provider / model 控制。

### 1.4 信息架构

移动端主 Tab 建议：

| Tab | 主要任务 | 首屏主动作 |
|---|---|---|
| Today | 今天复习 | Review now |
| Library | 查看学习资产 | Continue / Search |
| Digest | 周总结 | Read this week |
| Me | 账号、会员、设置 | Sync / Pro status |

V0 可以先做 3 个 Tab：

1. Today；
2. Library；
3. Me。

Digest 可以先作为 Today 顶部卡片或 Library 内卡片，V1 再独立 Tab。

### 1.5 产品原则

| 原则 | 具体执行 |
|---|---|
| 打开即复习 | App 冷启动默认进入 Today |
| 低心智负担 | 首屏只给一个主按钮 |
| 来源可见 | 卡片显示来源标题、来源类型、保存日期 |
| 轻目标 | 默认每日 5 张，不鼓励一口气刷几十张 |
| 不做技术设置 | 模型、provider、token 永不出现在普通 UI |
| 不复制网页端 | 移动端是习惯产品，不是扩展控制台 |

### 1.6 验收标准

| 指标 | V0 目标 |
|---|---:|
| 打开 App 到看到第一张卡 | < 2 秒，离线缓存下 < 1 秒 |
| 打开 App 到完成第一张复习 | < 30 秒 |
| 首次登录后看到来自 Web 的保存内容 | > 90% 已有资产用户 |
| 首次移动端 Review 完成率 | > 50% |
| Mobile D1 回访 | 作为核心 cohort 指标 |
| 普通 UI 技术词暴露 | 0 |

### 1.7 与已有文档边界

本文只定义移动端 companion。网页捕获、YouTube 捕获、PDF 捕获、模型调度、成本策略仍由前三份文档负责。

---

## 2. iOS / Android / PWA 路线选择

### 2.1 问题

Astra 需要尽快验证“手机复习是否能提升留存”，但 iOS / Android 原生开发、PWA、推送、离线、IAP、商店审核各有成本。

如果一开始同时追求完整 iOS、完整 Android、完整 PWA，会拖慢验证速度。正确策略是先验证复习习惯，再扩大平台覆盖。

### 2.2 Strategic decision

推荐路线：

> **PWA / Mobile Web 验证信息架构，iOS 原生优先建立高质量 habit，Android 紧随其后。**

原因：

- PWA / Mobile Web 适合快速验证 Today Review、Library、Digest；
- iOS 用户更适合 premium subscription 和高审美学习 app；
- Android 覆盖面更大，但设备差异和商店策略更复杂；
- 原生 App 才能更好做 push notification、offline storage、haptics、widget、App Store trust。

### 2.3 路线对比

| 路线 | 优点 | 缺点 | 适合阶段 | 决策 |
|---|---|---|---|---|
| PWA / Mobile Web | 快速上线、复用 Web companion、无需商店审核 | 推送/离线/系统集成弱，iOS 体验不够 premium | V0 validation | 必做，用于快速验证 |
| iOS Native | 高级体验、推送、widget、Apple Sign-In、IAP、留存强 | 审核/IAP/开发成本较高 | V1 public beta | 优先 |
| Android Native | 用户面广、Play Billing、通知灵活 | 设备碎片化、商店风险、通知权限差异 | V1/V2 | 紧随 |
| React Native / Expo | 跨平台效率高，适合 Review app | 需要处理原生细节、离线和通知质量 | V1 | 推荐技术方向，但本文不写代码 |
| Fully native Swift + Kotlin | 体验最佳 | 开发成本最高 | 成熟期 | 暂不作为 V0/V1 |

### 2.4 推荐发布路径

| 阶段 | 平台策略 | 目的 |
|---|---|---|
| Prototype | Mobile Web/PWA | 验证卡片 UX、信息架构、Review 反馈 |
| Private Beta | iOS TestFlight + PWA | 验证高质量移动体验和核心留存 |
| Public Beta | iOS App Store + Android closed/open testing | 验证商店转化和通知留存 |
| Full Launch | iOS + Android + PWA fallback | 完成跨端闭环 |
| Mature | Widget、Share Extension、Watch/Lock Screen later | 扩展 habit surface |

### 2.5 First implementation

第一版建议：

- 先做 PWA/mobile web 内部版本；
- 同时启动 iOS native companion 的设计和原型；
- Android 不延后战略设计，但工程上可比 iOS 晚一个里程碑；
- 所有平台共享同一套复习数据、卡片状态和同步模型；
- App Store 版先做 consumption/review companion，不在 V0 做复杂购买流。

### 2.6 平台能力矩阵

| 能力 | PWA | iOS App | Android App |
|---|---:|---:|---:|
| Today Review | 高 | 高 | 高 |
| Offline review | 中 | 高 | 高 |
| Push reminder | 中 | 高 | 高 |
| Widget | 低/中 | 高 | 高 |
| In-app subscription | 低/不建议 | 高但有 IAP 风险 | 高但有 Play Billing 风险 |
| Haptics | 低 | 高 | 高 |
| Share sheet | 中 | 高 | 高 |
| App Store trust | 无 | 高 | 高 |
| 快速迭代 | 高 | 中 | 中 |

### 2.7 风险

| 风险 | 缓解 |
|---|---|
| PWA 体验太弱，影响品牌 | PWA 只做验证，不作为最终 premium 体验 |
| iOS IAP 复杂 | V0 可做登录后消费已有 Pro；V1 再决定 IAP |
| Android 通知权限影响留存 | 默认产品内提醒，通知作为可选 |
| 跨平台不一致 | 建立统一 card object、design tokens、copy system |
| 原生开发拖慢 | V0 保持范围极小，只做 Review Companion |

### 2.8 验收标准

- PWA 4 周内能验证 Today Review 完成率；
- iOS Beta 8–10 周内可完成登录、同步、Review、离线、提醒；
- Android Beta 不晚于 iOS 公测后 4–6 周；
- 所有平台复习状态一致；
- 用户不会因为平台不同看到 provider/model/API 等技术概念。

### 2.9 与已有文档边界

平台选择只服务 mobile companion，不改变桌面扩展优先级，也不要求手机端承担网页翻译功能。

---

## 3. Core User Journey: Save on Web, Review on Phone

### 3.1 问题

Astra 的核心跨端闭环是：

> 用户在真实内容里遇到表达 → 保存 → 手机复习 → 回到来源继续学习。

如果手机端只是一个孤立背单词 app，Astra 会失去最大差异化。手机端必须持续强调：这些词句来自用户真实读过、看过、保存过的内容。

### 3.2 Strategic decision

移动端用户旅程必须以 source-backed learning 为核心：

> 不是“背随机词表”，而是“复习我真实遇到的表达”。

### 3.3 标准旅程

| 阶段 | 发生位置 | 用户动作 | Astra 动作 | 用户感知 |
|---|---|---|---|---|
| Encounter | 桌面网页/视频/文件 | 读到不懂词句 | 解释/翻译/推荐保存 | 我看懂了 |
| Save | 桌面 | 保存词或句 | 创建学习资产和 Review card | 这会进入复习 |
| Sync | 后台 | 无感 | 同步到移动端 | 不用手动导入 |
| Review | 手机 | 复习 3–5 张 | 记录掌握状态 | 我记住一点了 |
| Source return | 手机或桌面 | 打开来源 | 回跳网页/视频/文件位置 | 我知道它从哪来 |
| Digest | 手机 | 查看周总结 | 汇总本周学习 | 我看到积累 |

### 3.4 First implementation

V0 的标准路径：

1. 用户在桌面扩展保存一个句子；
2. 手机端收到或下次打开同步；
3. Today 显示 “3 cards from your web reading”；
4. 用户完成 3 张卡；
5. 结束页显示来源分布；
6. 用户可点击 “Open source on desktop later” 或 “View source details”。

### 3.5 关键状态

| 状态 | 文案 | 主动作 |
|---|---|---|
| 无账号 | Sign in to review your saved words | Sign in |
| 有账号但无资产 | Save words from the web to review here | Open sample |
| 有资产未同步 | Syncing your saved learning items | Retry sync |
| 有待复习 | 5 cards ready today | Start review |
| 今日完成 | Done for today | View library |
| 离线可复习 | Offline review ready | Review |
| 离线无卡 | Connect once to download your review cards | Retry |

### 3.6 产品原则

- 每个 Review session 都要带来源感；
- 保存后不要让用户手动选择 deck；
- 手机端不要求用户组织内容；
- 当天复习量默认小；
- 支持 “Not now” 和 “Too easy”；
- 复习结束比复习开始更重要：要让用户看到完成感。

### 3.7 验收标准

| 指标 | V0 目标 |
|---|---:|
| Web 保存后移动端可见延迟 | P95 < 60 秒，手动刷新 < 10 秒 |
| 有资产用户移动端首开看到 Review | > 90% |
| Review 完成后状态同步回 Web | > 99% |
| 用户能从卡片看到来源 | 100% 有来源资产 |
| 无来源资产也有合理 fallback | 100% |

### 3.8 与已有文档边界

桌面端如何捕获内容由已有文档负责。本文只定义保存后的移动复习体验和跨端状态。

---

## 4. Mobile V0 Scope

### 4.1 问题

移动端最容易失败的方式是 V0 做得太大：翻译、阅读器、聊天、PDF、视频、词典、社区、课程、设置全做，结果核心复习体验不够好。

V0 应该极度克制，只验证一个核心假设：

> 用户愿意在手机上复习自己在 Web 上真实保存的词句。

### 4.2 Strategic decision

V0 只服务三件事：

1. 让用户看到今天该复习什么；
2. 让用户快速完成一轮复习；
3. 让用户理解这些内容来自真实来源。

### 4.3 V0 功能清单

| 模块 | V0 功能 | 是否必须 |
|---|---|---|
| Login | 邮箱/Google/Apple 登录，和 Web 账号打通 | 必须 |
| Today Review | 今日待复习卡片、开始/完成/跳过 | 必须 |
| Word Card | 单词/短语、释义、例句、来源 | 必须 |
| Sentence Card | 原句、译文、解释、来源 | 必须 |
| Basic grading | Again / Good / Easy | 必须 |
| Source info | 来源标题、类型、保存日期、打开来源 | 必须 |
| Library | Saved words / sentences / sources 基础列表 | 必须 |
| Offline review | 已下载卡片离线复习，操作排队同步 | 必须 |
| Reminder | 轻量本地提醒设置 | 必须 |
| Pro status | 会员状态展示，不暴露技术 | 必须 |
| Digest preview | 本周学习小结卡片 | 可选但建议 |
| Search | 搜索保存的词句 | V0.5 |
| Share card | 分享漂亮句子卡 | V0.5 |
| Widget | 今日待复习 widget | V1 |

### 4.4 V0 首页结构

Today 首屏：

1. 轻量问候；
2. 今日目标；
3. Review 主按钮；
4. 来源摘要；
5. 最近保存；
6. 完成后显示 Digest teaser。

示例文案：

- `5 cards are ready from your web reading.`
- `Review for 3 minutes.`
- `Saved from 2 pages and 1 video.`
- `Done for today.`

### 4.5 V0 不做的功能

| 不做 | 原因 |
|---|---|
| 移动端整页翻译 | 偏离 habit，平台复杂 |
| 移动端 YouTube 字幕翻译 | 已由桌面/网页文档覆盖，移动 V0 不承担 |
| PDF/EPUB 移动阅读器 | 范围过大 |
| 完整 Deep Read | 小屏复杂，可先只读摘要 |
| AI Chat | 容易稀释定位 |
| 自定义 deck 管理 | 普通用户负担大 |
| 复杂 SRS 设置 | 默认算法即可 |
| 社交社区 | 风险高且非核心 |
| 多人课堂 | 后期再说 |
| 模型/API 设置 | 违背 zero-config |

### 4.6 风险

| 风险 | 缓解 |
|---|---|
| V0 太轻，用户觉得不值 | 强化来源感、完成感、跨端价值 |
| 没有足够保存内容 | 提供 sample deck 和桌面保存引导 |
| Review 卡质量不稳 | V0 支持用户标记“Not useful” |
| 用户不知道怎么在 Web 保存 | Onboarding 给 3 步说明和 sample |
| 离线状态混乱 | 明确显示 last synced 和离线提示 |

### 4.7 验收标准

- V0 用户打开 App 后不需要学习说明即可开始 Review；
- V0 首次体验不超过 3 个屏幕完成 onboarding；
- 已有保存内容用户首日移动端 Review 完成率 > 50%；
- 无保存内容用户能通过 sample deck 完成一次 Review；
- V0 范围内没有任何 provider/model/API/token 文案。

### 4.8 与已有文档边界

V0 不重新定义会员、Library 全局战略或 SaaS 用量；只定义移动端第一版体验边界。

---

## 5. What Not to Build on Mobile Yet

### 5.1 问题

移动端最危险的产品冲动是“既然有 App，就把所有功能都搬过来”。这样会让 Astra 变成一个复杂学习软件，而不是一个每天愿意打开的轻量 companion。

### 5.2 Strategic decision

移动端第一阶段要明确说“不”。

> Mobile should deepen habit, not duplicate desktop complexity.

### 5.3 暂不建设清单

| 功能 | 暂不做原因 | 可能阶段 |
|---|---|---|
| 手机浏览器整页翻译 | 平台限制多，和 V0 habit 无关 | V3+ 或不做 |
| 移动 YouTube 字幕覆盖 | 小屏和播放器限制，工程复杂 | V3+ |
| 完整移动 PDF 阅读器 | 范围过大，离线版权/渲染复杂 | V2+ |
| AI Chat tutor | 容易吞掉 Review 定位 | V2 以后谨慎 |
| 自建课程体系 | 不符合真实内容学习差异化 | 非目标 |
| 社区/好友排行榜 | 压力和审核风险高 | 非目标 |
| 复杂 Anki 级设置 | 普通用户心智负担大 | 高级导出 later |
| 手动 deck/folder 系统 | 管理负担大 | V2 轻量标签 |
| 复杂学习统计仪表盘 | 容易像后台 | V2 Digest 化 |
| Provider/model/API key | 违背 zero-config | 永不进入普通 UI |
| 开放 Prompt 编辑 | 违背普通用户定位 | 非普通路径 |
| 大规模内容导出 | 版权和商店风险 | later with limits |

### 5.4 决策标准

任何移动端新功能都必须通过 5 个问题：

| 问题 | 通过标准 |
|---|---|
| 是否帮助用户完成今日复习？ | 是 |
| 是否强化来源学习资产？ | 是 |
| 是否能在 30 秒内理解？ | 是 |
| 是否增加长期留存？ | 是 |
| 是否不依赖技术设置？ | 是 |

如果一个功能主要服务“更多配置、更复杂内容处理、更强工具感”，则不进入 V0/V1。

### 5.5 产品原则

- 小屏不做大工作；
- 手机端不做控制台；
- 不用通知逼迫学习；
- 不让用户整理文件夹；
- 不把桌面端失败转嫁给移动端；
- 不为 App Store 截图而做虚假功能。

### 5.6 验收标准

- V0 PRD 中不出现 mobile page translation；
- V0 App Store 描述不暗示手机端可翻译所有网页；
- V0 设置页不超过 6 个核心设置；
- V0 首页只有一个主动作；
- 任何新增功能都可映射到 habit / review / source-backed learning。

### 5.7 与已有文档边界

网页翻译、视频字幕、文件理解属于 capture/understanding 层，不属于移动 V0。移动端只消费这些层产生的学习资产。

---

## 6. Today Review UX

### 6.1 问题

Today Review 是移动端最重要的入口。如果这个入口不够简单，用户会把 Astra Mobile 当成“又一个需要管理的学习软件”。

### 6.2 Strategic decision

Today Review 应该像一张安静的每日学习纸条：

> 今天只复习少量、真实、来自自己阅读的视频/网页内容。

不要做成复杂的卡组仪表盘。

### 6.3 Today 首屏结构

| 区域 | 内容 | 目的 |
|---|---|---|
| Header | 日期、轻问候、同步状态 | 安心 |
| Goal card | 今日 3–5 张卡 | 降低负担 |
| Source summary | 来自哪些网页/视频/文档 | 强化真实来源 |
| Primary CTA | Start review | 明确动作 |
| Recent saves | 最近保存 2–3 项 | 连接 Web capture |
| Digest teaser | 本周学习进展 | 留存 |

示例首屏文案：

- `5 cards are ready today.`
- `From 2 pages and 1 video you saved this week.`
- `Review in about 3 minutes.`
- `No pressure — just keep the useful ones fresh.`

### 6.4 Review Session 流程

| 步骤 | 用户看到 | 动作 |
|---|---|---|
| Start | 今日目标和来源 | Start |
| Card front | 词/句 + 来源 hint | Show answer |
| Card back | 译文/解释/例句/来源 | Again / Good / Easy |
| Micro feedback | 轻 haptic / 纸张翻页动效 | 下一张 |
| Completion | Done for today | View Library / Continue |
| Optional | “Save more from web tonight” | Open guide |

### 6.5 复习按钮

建议只保留三个判断：

| 按钮 | 用户含义 | 内部含义 |
|---|---|---|
| Again | 还不熟 | 短间隔重现 |
| Good | 记得 | 正常推进 |
| Easy | 很熟 | 增加间隔或标记 familiar |

不要使用复杂术语：

- 不说 ease；
- 不说 interval；
- 不说 SRS；
- 不说 algorithm。

### 6.6 空状态

| 情况 | 文案 | 主动作 |
|---|---|---|
| 新用户无保存 | Save words from the web, then review them here. | Try sample cards |
| 已完成今日 | Done for today. Come back tomorrow for a quick refresh. | View Library |
| 同步中 | Bringing in your saved words. | Refresh |
| 离线无缓存 | Connect once to download your review cards. | Retry |
| Pro 过期 | Your saved cards are safe. Sync and new AI cards need Pro. | View options |

### 6.7 产品原则

- 默认目标小，不压迫；
- 完成页比开始页更有成就感；
- 卡片不连续弹付费；
- 允许跳过；
- 允许标记“不适合复习”；
- 复习时不打断，不插入设置提示；
- 今日完成后不继续诱导刷卡，除非用户主动。

### 6.8 验收标准

| 指标 | V0 目标 |
|---|---:|
| Today 页面加载 | P95 < 2s |
| Start Review 点击率 | > 55% 有待复习用户 |
| Session 完成率 | > 60% |
| 平均 session 时长 | 2–5 分钟 |
| Again/Good/Easy 操作理解 | 用户测试中 > 90% 能理解 |
| 今日完成页满意反馈 | 用户测试中 > 80% 正向 |

### 6.9 与已有文档边界

SRS 算法可由宏观学习系统决定；本文只定义移动端 Today Review 的用户体验和最小交互。

---

## 7. Word Card UX

### 7.1 问题

传统单词卡最大问题是脱离上下文。Astra 的优势是词来自真实网页、视频、PDF 或文档，因此 Word Card 不能只是“单词 + 中文”。

### 7.2 Strategic decision

Word Card 应该回答四个问题：

1. 这个词是什么意思？
2. 它在我看到的原句里是什么意思？
3. 它来自哪里？
4. 我是否已经掌握？

### 7.3 Word Card 信息结构

| 层级 | 内容 | V0 是否必须 |
|---|---|---|
| Front | 单词/短语、词性、来源小标签 | 必须 |
| Hint | 原句遮罩或部分上下文 | 必须 |
| Back meaning | 目标语言释义 | 必须 |
| Context sentence | 原句 + 译文 | 必须 |
| Source | 来源标题、网站/视频、保存日期 | 必须 |
| Audio | 发音 | 建议 |
| Examples | 1 个来自上下文的例子 | 建议 |
| Similar forms | 词形/搭配 | V1 |
| Mastery | New / Learning / Familiar / Mastered | 必须但可简化显示 |

### 7.4 卡片正面示例

```text
resilient
adjective

Saved from:
“The Future of Distributed Systems”
```

提示：

```text
“The system remained ____ after multiple node failures.”
```

### 7.5 卡片背面示例

```text
resilient
能恢复的；有韧性的；能承受冲击的

In your sentence:
“The system remained resilient after multiple node failures.”
这个系统在多个节点故障后仍然保持韧性。

Why it matters:
这里不是“坚强的人”，而是指系统在故障后仍能继续运行。
```

### 7.6 Word Card 动作

| 动作 | 位置 | 说明 |
|---|---|---|
| Again / Good / Easy | 底部主按钮 | Review 评分 |
| Play | 单词旁 | 发音 |
| Show source | 来源区 | 查看来源摘要 |
| Not useful | more menu | 从复习队列移除 |
| Edit meaning | more menu | V1 |
| Add to glossary | more menu | V1/Pro |
| Open on web | source card | 回到来源 |

### 7.7 词卡类型

| 类型 | 示例 | 特殊处理 |
|---|---|---|
| Single word | resilient | 词性、发音 |
| Phrase | carry over | 搭配和上下文释义 |
| Technical term | eventual consistency | 领域解释 |
| Proper noun | Kubernetes | 不强制翻译 |
| Idiom | take it with a grain of salt | 用法解释 |
| False friend | actually | 提醒常见误解 |

### 7.8 产品原则

- 优先上下文释义，不只给词典义；
- 不把一个词塞满过多知识点；
- 不让用户管理复杂词库；
- 来源信息必须轻量但可展开；
- 对技术术语不要强行口语化；
- 对熟悉词允许快速 Easy。

### 7.9 验收标准

| 指标 | V0 目标 |
|---|---:|
| 用户能理解词在原句中的意思 | 用户测试 > 80% |
| Word Card 完成率 | > 65% |
| Play 发音使用率 | 观察指标 |
| Not useful 比例 | < 10%，高于则说明卡片质量问题 |
| 来源可识别率 | 100% 有来源卡片 |
| 卡片首屏信息过载投诉 | 用户测试中低 |

### 7.10 与已有文档边界

词卡生成质量、模型任务和成本由 SaaS 文档负责；本文只定义移动端卡片 UX 和信息结构。

---

## 8. Sentence Card UX

### 8.1 问题

Astra 的强项不只是保存单词，而是保存“用户真实看不懂、后来理解了的句子”。Sentence Card 应该成为移动端的核心差异化。

### 8.2 Strategic decision

Sentence Card 应该像一张精致的双语摘录卡：

> 原句、译文、解释、来源，一起帮助用户记住表达。

### 8.3 Sentence Card 信息结构

| 层级 | 内容 | V0 是否必须 |
|---|---|---|
| Front | 原句，关键词轻高亮 | 必须 |
| Prompt | “What does this mean?” 或遮挡译文 | 必须 |
| Back translation | 目标语言译文 | 必须 |
| Back explanation | 简短解释/难点 | 必须 |
| Saved reason | 用户为何保存 / 自动推断 | 可选 |
| Source | 页面/视频/文件标题 | 必须 |
| Actions | Again / Good / Easy | 必须 |
| Deep link | 回到来源 | 建议 |
| Speak | 原句朗读 | 建议 |
| Copy/share | 分享句子卡 | V0.5 |

### 8.4 句卡正面

```text
“The catch is that consistency becomes a moving target.”

Saved from:
Designing Data-Intensive Applications notes
```

### 8.5 句卡背面

```text
问题在于，一致性会变成一个不断变化的目标。

Why this sentence is useful:
“The catch is...” 用来引出隐藏问题；
“a moving target” 指标准或目标不断变化，很难稳定达成。
```

### 8.6 Sentence Card 类型

| 类型 | 示例 | 卡片重点 |
|---|---|---|
| Useful expression | The catch is... | 可复用表达 |
| Difficult sentence | 长难句 | 结构拆解 |
| Technical sentence | 系统/论文语句 | 术语一致 |
| Video sentence | 口语字幕 | 听力/语气 |
| Writing correction | 用户写作修改 | 错误对比 |
| Quote-like sentence | 精彩句子 | 收藏和分享 |

### 8.7 交互原则

- 正面不要直接显示译文；
- 背面解释不超过 3 个要点；
- 长句允许折叠；
- 来源信息显示但不抢主视觉；
- 可以横向轻滑下一张，但评分必须明确；
- 不要让用户在复习中编辑大段内容。

### 8.8 Sentence Card 与 Word Card 的区别

| 维度 | Word Card | Sentence Card |
|---|---|---|
| 目标 | 记住词/短语 | 记住表达和句意 |
| 正面 | 词/短语 | 原句 |
| 背面 | 上下文释义 | 译文 + 难点解释 |
| 来源 | 支撑上下文 | 核心价值 |
| 分享性 | 中 | 高 |
| 适合 Digest | 中 | 高 |
| 用户成就感 | 学会一个词 | 学会一句真实表达 |

### 8.9 验收标准

| 指标 | V0 目标 |
|---|---:|
| Sentence Card 完成率 | > 60% |
| 用户认为“来源有帮助” | > 80% |
| 解释过长投诉 | < 10% |
| 用户愿意保存更多句子 | Review 后保存行为提升 |
| Share card 点击率 | V0.5 观察 |

### 8.10 与已有文档边界

移动端不负责桌面 selection toolbar 或保存机制；只负责句卡复习体验。

---

## 9. Source-backed Learning UX

### 9.1 问题

如果卡片看起来像随机词表，Astra 就会和 Anki/Quizlet/普通单词 App 混在一起。Astra 的独特点是：

> 每个学习资产都来自真实内容。

因此 mobile UX 必须不断但轻量地显示来源。

### 9.2 Strategic decision

每张卡都应尽量回答：

> 我当时在哪里遇到它？

来源不是 metadata，而是学习信任感。

### 9.3 来源类型

| Source type | 显示名称 | Card badge |
|---|---|---|
| Web page | 网页文章/页面 | Page |
| YouTube video | 视频 | Video |
| PDF | PDF 文档 | PDF |
| EPUB | 电子书 | Book |
| Document | 文档 | Doc |
| Selection only | 手动选择 | Saved |
| Writing assist | 写作修正 | Writing |

### 9.4 Source Card 结构

| 字段 | V0 是否必须 | 说明 |
|---|---|---|
| sourceId | 必须 | 内部 ID |
| title | 必须 | 来源标题 |
| type | 必须 | page/video/pdf/doc |
| hostname/channel | 建议 | 来源身份 |
| savedAt | 必须 | 保存时间 |
| originalUrl | 可选 | 隐私/版权边界 |
| deepLink | 可选 | 回跳来源 |
| timestamp | 视频必须 | 视频时间点 |
| text anchor | 可选 | 网页位置 |
| privacy state | 必须 | 是否可同步/可显示 |
| thumbnail | V1 | 视频/网页缩略图 |

### 9.5 UI 表达

卡片底部轻量显示：

```text
From: The Future of Distributed Systems · 2 days ago
```

可展开后显示：

- 来源摘要；
- 已保存的其他词句；
- 打开来源；
- 查看同一来源的所有卡片；
- 不再从这个来源复习；
- 删除来源记录。

### 9.6 Source Detail 页面

V0 可以做轻量 Source Detail：

| 区域 | 内容 |
|---|---|
| Header | 标题、类型、来源、日期 |
| Summary | 1–2 句摘要 |
| Saved items | 该来源保存的词句 |
| Review status | 已掌握 / 待复习 |
| Actions | Continue / Open source / Remove |

### 9.7 Source-backed 动作

| 动作 | 说明 |
|---|---|
| Review from this source | 只复习某篇文章/视频 |
| Open original | 回到原网页/视频/文件 |
| Hide source | 不在 Today 里显示该来源 |
| Delete source learning data | 删除此来源学习资产 |
| Continue later | 加入继续学习列表 |

### 9.8 风险边界

| 风险 | 边界 |
|---|---|
| 完整复制第三方内容 | 移动端只显示用户保存片段和必要上下文 |
| 敏感来源暴露 | 支持隐藏来源标题或隐私来源模式 |
| URL 泄露 | 可只显示 hostname 或用户可关闭 |
| 视频 transcript 版权 | 不默认导出完整 transcript |
| 用户尴尬内容 | 支持单来源删除和 private source |

### 9.9 验收标准

- 100% 保存来源的卡片显示来源；
- 用户可从卡片进入 Source Detail；
- 用户可删除某来源学习数据；
- 敏感来源可隐藏标题；
- 移动端不默认展示完整网页正文或完整 transcript。

### 9.10 与已有文档边界

版权、数据保留和合规大原则由宏观/SaaS 文档负责；本文只定义移动端来源展示和用户控制。

---

## 10. Library UX

### 10.1 问题

移动端 Library 很容易变成复杂数据库。普通用户不是来管理资料，而是想知道：

1. 我保存了什么？
2. 今天该学什么？
3. 我能继续哪里？

### 10.2 Strategic decision

Mobile Library 应该是“学习资产入口”，不是文件管理器。

### 10.3 Library 首页结构

| 区域 | 内容 | 目的 |
|---|---|---|
| Search | 搜索词句/来源 | 找回 |
| Continue | 最近未完成来源 | 回到学习 |
| Saved collections | Words / Sentences / Sources | 浏览 |
| Topics | 自动主题 | 轻组织 |
| Mastery | New / Learning / Familiar | 进度 |
| Recent | 最近保存 | 复习触发 |

### 10.4 V0 Library 分类

| 分类 | 内容 | V0 |
|---|---|---|
| Words | 保存的单词/短语 | 必须 |
| Sentences | 保存的句子 | 必须 |
| Sources | 页面/视频/文件来源 | 必须 |
| Review history | 最近复习 | 建议 |
| Topics | 自动主题 | V1 |
| Glossary | 用户术语 | V1 |
| Digest archive | 周总结历史 | V1 |

### 10.5 Library 列表卡

Word item：

```text
resilient
能恢复的；有韧性的
From: Distributed Systems · Learning
```

Sentence item：

```text
“The catch is that consistency becomes a moving target.”
From: Design Notes · Good
```

Source item：

```text
The Future of Distributed Systems
8 saved items · 3 due today
```

### 10.6 Library 动作

| 动作 | 适用对象 | 说明 |
|---|---|---|
| Review | word/sentence/source | 加入当前 session |
| Search | all | 本地 + 云端 |
| Delete | all | 支持撤销 |
| Hide from Today | source/item | 不进入每日复习 |
| Mark as mastered | item | 进入低频 |
| Open source | source/item | 回跳 |
| Share | sentence/source summary | V0.5 |

### 10.7 产品原则

- 默认自动组织；
- 不强迫用户创建文件夹；
- 搜索比分类更重要；
- 列表中显示掌握状态，但不做复杂统计；
- 删除明确且可撤销；
- Library 不应取代 Today Review；
- 每个 Library 页面都应该有一个复习 CTA。

### 10.8 验收标准

| 指标 | V0 目标 |
|---|---:|
| 用户能在 10 秒内找到最近保存内容 | 用户测试 > 80% |
| Library 到 Review 转化 | 观察指标 |
| Search 成功率 | > 80% 查询有结果时 |
| 删除/隐藏操作理解 | 用户测试 > 90% |
| 空状态引导到 Web 保存或 sample | 100% |

### 10.9 与已有文档边界

全局 Library 长期愿景由宏观文档负责；本文只定义 mobile Library 的轻量版本。

---

## 11. Weekly Digest UX

### 11.1 问题

学习类产品需要让用户看到积累，否则用户会觉得“我只是偶尔背了几张卡”。Weekly Digest 是移动端展示长期价值的关键方式。

### 11.2 Strategic decision

Weekly Digest 应该像一封安静的学习小结，而不是营销报告。

目标：

- 展示用户真实学习积累；
- 鼓励下周继续；
- 不制造焦虑；
- 不夸大学习成果；
- 不泄露敏感内容。

### 11.3 Digest 内容结构

| 区域 | 内容 | V0/V1 |
|---|---|---|
| Summary | 本周保存/复习概览 | V0 |
| Sources | 来自哪些页面/视频/文件 | V0 |
| Words | 本周重点词 | V0 |
| Sentences | 本周最佳句子 | V0 |
| Progress | Review 完成情况 | V0 |
| Pattern | 重复出现主题/术语 | V1 |
| Continue | 建议继续内容 | V1 |
| Share | 分享学习卡片 | V1 |

### 11.4 Digest 示例

```text
This week with Astra

You reviewed 24 cards from:
- 3 web pages
- 1 video
- 1 PDF

Most useful sentence:
“The catch is that consistency becomes a moving target.”

5 cards are ready for a quick refresh next week.
```

中文：

```text
本周你从 3 篇网页、1 个视频和 1 份 PDF 中复习了 24 张卡片。

你反复遇到的表达：
resilient · trade-off · moving target

下周有 5 张卡适合快速复习。
```

### 11.5 Digest 视觉

- 一页纸感；
- 温暖纸色背景；
- 墨黑正文；
- seal red 小印章表示 “week complete”；
- 少量数据，不做仪表盘；
- 最多 3 个高亮学习成果；
- 结尾一个主动作：Review next week / Continue learning。

### 11.6 发送与展示

| 渠道 | 策略 |
|---|---|
| App 内 | 默认开启，周末或周一展示 |
| Push | 默认关闭或轻提醒，用户选择 |
| Email | 可选，必须可退订 |
| Web companion | 同步展示 |
| Share card | V1 可分享，不含敏感来源默认全文 |

### 11.7 风险

| 风险 | 缓解 |
|---|---|
| Digest 像营销邮件 | 文案聚焦学习，不推销 |
| 数据太多像 dashboard | 限制为 3–5 个关键点 |
| 敏感来源曝光 | 默认只显示类型/标题可隐藏 |
| 用户没学习时尴尬 | 使用温和文案，不羞辱 |
| Share 泄露来源 | 分享前预览，可隐藏来源 |

### 11.8 验收标准

| 指标 | V0/V1 目标 |
|---|---:|
| Digest 打开率 | 观察 cohort |
| Digest 后 Review 点击率 | > 15% |
| 用户认为 Digest 有价值 | > 70% |
| 用户退订/关闭比例 | 低于通知关闭比例 |
| 敏感信息投诉 | 0 release blocker |

### 11.9 与已有文档边界

Digest 作为留存策略在宏观文档中存在；本文只定义移动端 Digest 的 UX 形态、信息结构和通知策略。

---

## 12. Reminder / Notification Strategy

### 12.1 问题

移动端留存不能靠骚扰。语言学习提醒如果太频繁，会让用户产生压力和卸载冲动。

### 12.2 Strategic decision

Astra 的通知策略应该是：

> 少、准、可控、有学习价值。

默认不做强 streak，不用 guilt copy，不做红点焦虑。

### 12.3 通知类型

| 类型 | 示例 | 默认 |
|---|---|---|
| Today Review | `5 cards are ready for a 3-minute review.` | 可选 onboarding |
| Weekly Digest | `Your weekly learning note is ready.` | 可选 |
| Continue | `Continue the sentence you saved yesterday.` | 默认关闭 |
| Sync issue | `Review cards will sync when you're online.` | 仅必要 |
| Pro status | `Your saved cards are safe. Sign in to keep syncing.` | 低频 |
| Win-back | `A few saved words are waiting when you’re ready.` | 非 V0 |

### 12.4 通知时间策略

| 用户类型 | 策略 |
|---|---|
| 新用户 | 首次移动端完成 Review 后再询问提醒 |
| 活跃用户 | 根据常用复习时间建议 |
| 低活跃用户 | 每周最多 1 次 |
| 已关闭提醒 | 不再反复询问 |
| Pro 用户 | 更偏 Digest，不用高频催促 |
| Free 用户 | 不用通知强推付费 |

### 12.5 文案原则

好的：

- `A quick review is ready.`
- `3 minutes to refresh what you saved.`
- `Your weekly learning note is ready.`
- `No rush — your cards are saved.`

避免：

- `Don't lose your streak!`
- `You failed today's goal.`
- `Your quota will expire.`
- `Come back now!`
- `Only Pro users can keep learning!`

### 12.6 通知权限请求时机

不要在首次打开 App 立即请求通知权限。

推荐时机：

1. 用户完成第一次 Review；
2. 完成页展示：`Want a gentle reminder tomorrow?`;
3. 用户选择时间；
4. 再请求系统权限。

### 12.7 Reminder Settings

设置项保持极简：

| 设置 | 选项 |
|---|---|
| Review reminder | Off / Daily / Weekdays / Custom |
| Preferred time | Morning / Lunch / Evening / Custom |
| Weekly Digest | On / Off |
| Quiet days | Weekends / Custom |
| Pause reminders | 1 week / 1 month |

### 12.8 风险

| 风险 | 缓解 |
|---|---|
| 通知导致卸载 | 默认轻量、用户主动开启 |
| 学习焦虑 | 不用失败文案 |
| 时区问题 | 使用设备本地时区 |
| 离线无卡还提醒 | 通知前检查本地 due count |
| 过度营销 | 通知不作为主要 paywall |

### 12.9 验收标准

| 指标 | V1 目标 |
|---|---:|
| 通知授权率 | 完成首次 Review 后观察 |
| 通知点击后 Review 完成率 | > 30% |
| 通知关闭率 | 低于行业负面基准 |
| 通知相关卸载投诉 | 0 release blocker |
| 每用户每周通知次数 | 默认 <= 3 |

### 12.10 与已有文档边界

移动端通知只服务 Review habit 和 Digest，不作为增长 spam 或付费逼迫工具。

---

## 13. Offline Review Strategy

### 13.1 问题

用户在地铁、飞机、碎片时间复习时可能没有稳定网络。如果 App 一离线就不可用，会破坏 mobile companion 的核心价值。

### 13.2 Strategic decision

移动端应采用 offline-resilient review：

> 已同步的 Review cards 可以离线复习；用户动作进入本地队列；联网后自动同步。

### 13.3 离线能力范围

| 能力 | V0 离线支持 |
|---|---|
| 查看 Today 已下载卡片 | 支持 |
| Review Again/Good/Easy | 支持，本地排队 |
| 查看已下载来源信息 | 支持 |
| 发音 | 可选，取决于本地 TTS |
| 搜索已下载内容 | 支持基础 |
| 查看完整 Library | 部分支持 |
| 生成新 AI 解释 | 不支持 |
| 打开原网页/视频 | 不支持或提示联网 |
| 删除/隐藏卡片 | 支持本地排队 |
| Digest | 最近一份可离线 |

### 13.4 本地缓存策略

| 数据 | 缓存策略 | 默认数量 |
|---|---|---|
| Due cards | 必缓存 | 今日 + 接下来 3 天 |
| Recent saved items | 缓存 | 最近 50–100 条 |
| Source metadata | 缓存 | 与卡片相关来源 |
| Audio | 可选缓存 | 常复习词 |
| Digest | 缓存 | 最近 4 周 |
| Full source text | 默认不缓存 | 除非用户明确保存片段 |

### 13.5 离线状态文案

| 状态 | 文案 |
|---|---|
| 离线但可复习 | `Offline review is ready.` |
| 离线操作已保存 | `Saved offline. Astra will sync later.` |
| 需要联网 | `Connect once to download more cards.` |
| 同步冲突 | `Astra kept your latest review progress.` |
| 登录过期 | `Sign in again when you're online to keep syncing.` |

### 13.6 同步队列

离线操作进入本地 pending queue：

| 操作 | 冲突策略 |
|---|---|
| review rating | append-only event，按时间排序 |
| mark mastered | last-write + event log |
| hide item | last-write |
| delete item | tombstone 优先 |
| edit note | V1，可能需要 conflict UI |
| reminder setting | device-local 优先 |

### 13.7 风险

| 风险 | 缓解 |
|---|---|
| 多设备复习冲突 | 复习事件 append-only，同步后重算状态 |
| 删除后又出现 | tombstone 同步优先 |
| 离线太久状态过旧 | 显示 last synced |
| 缓存敏感来源 | 支持清除离线数据 |
| 存储占用过大 | 限制缓存数量和自动清理 |

### 13.8 验收标准

| 指标 | V0 目标 |
|---|---:|
| 离线打开 Today 成功率 | > 95% 已缓存用户 |
| 离线 Review 操作丢失率 | 0 |
| 重新联网同步成功率 | > 99% |
| 同步冲突用户可见错误 | < 1% |
| 用户可清除本地数据 | 必须 |

### 13.9 与已有文档边界

SaaS 文档负责后台同步与运营；本文定义移动端离线体验和冲突策略原则。

---

## 14. Sync Data Model Requirements

### 14.1 问题

移动端成败很大程度取决于同步模型。如果 Web 保存和 Mobile Review 之间状态不一致，用户会失去信任。

### 14.2 Strategic decision

同步模型必须围绕“学习资产”和“复习事件”设计，而不是围绕 UI 页面设计。

核心原则：

- 保存内容是 asset；
- 复习动作是 event；
- 掌握状态是 derived state；
- 删除是 tombstone；
- 来源是 first-class object；
- 移动端可离线写入 event。

### 14.3 核心对象模型

#### UserLearningProfile

| 字段 | 说明 |
|---|---|
| userId | 用户 ID |
| targetLanguage | 目标语言 |
| nativeLanguage | 用户母语 |
| level | beginner/intermediate/advanced |
| dailyGoal | 默认 Review 数 |
| reminderPreference | 提醒设置 |
| privacyPreferences | 隐私设置 |
| lastSyncedAt | 同步时间 |

#### SourceContent

| 字段 | 说明 |
|---|---|
| sourceId | 来源 ID |
| type | page/video/pdf/doc/book/writing |
| title | 来源标题 |
| origin | hostname/channel/file label |
| url | 可选，受隐私设置控制 |
| deepLink | 可选 |
| thumbnail | 可选 |
| createdAt | 首次保存时间 |
| lastSavedAt | 最近保存时间 |
| hidden | 是否隐藏 |
| deletedAt | tombstone |

#### SavedItem

| 字段 | 说明 |
|---|---|
| itemId | 学习资产 ID |
| sourceId | 来源 ID |
| itemType | word/sentence/phrase/correction |
| text | 原文 |
| translation | 译文 |
| explanation | 解释 |
| contextBefore/contextAfter | 必要上下文，长度受限 |
| savedAt | 保存时间 |
| tags | 自动主题/用户标签 |
| sourcePosition | text anchor / video timestamp |
| privacyLevel | normal/private/local-only |
| deletedAt | tombstone |

#### ReviewCard

| 字段 | 说明 |
|---|---|
| cardId | 复习卡 ID |
| itemId | 关联 SavedItem |
| cardType | word/sentence/cloze/audio/correction |
| frontPayload | 正面展示所需内容 |
| backPayload | 背面展示所需内容 |
| dueAt | 下次复习 |
| state | new/learning/familiar/mastered/suspended |
| priority | 今日优先级 |
| createdAt | 创建时间 |
| updatedAt | 更新时间 |

#### ReviewEvent

| 字段 | 说明 |
|---|---|
| eventId | 事件 ID |
| cardId | 关联卡片 |
| userId | 用户 |
| rating | again/good/easy/skip |
| reviewedAt | 设备本地时间 + 服务器接收时间 |
| deviceId | 设备 ID |
| offline | 是否离线产生 |
| appVersion | App 版本 |
| resultingState | 可选，由服务器回填 |

#### DigestSnapshot

| 字段 | 说明 |
|---|---|
| digestId | Digest ID |
| periodStart/periodEnd | 周期 |
| reviewedCount | 复习数量 |
| savedCount | 保存数量 |
| sourceBreakdown | 来源分布 |
| highlightedWords | 高亮词 |
| highlightedSentences | 高亮句 |
| nextReviewCount | 下周/明日提醒 |
| generatedAt | 生成时间 |

### 14.4 同步策略

| 数据类型 | 同步策略 |
|---|---|
| SourceContent | server authoritative + tombstone |
| SavedItem | server authoritative，mobile 可删除/隐藏 |
| ReviewEvent | append-only，mobile 可离线写 |
| ReviewCard state | server derived，mobile 缓存 |
| Reminder settings | device-local + optional cloud |
| Digest | server generated，mobile cache |
| Search index | local subset + cloud fallback |

### 14.5 冲突策略

| 冲突 | 处理 |
|---|---|
| 同一卡多设备复习 | 保留所有 ReviewEvent，按时间重算 |
| 一端删除一端复习 | 删除 tombstone 优先，但保留匿名事件用于统计可选 |
| 来源被隐藏 | Today 不展示，但 Library 可恢复 |
| item 文案更新 | latest server version，用户可查看更新 |
| 离线过久 | 同步后重新计算 due queue |
| 多设备 reminder | 每设备本地提醒，不强同步 |

### 14.6 隐私要求

- 不默认同步完整网页正文；
- 不默认同步完整 transcript；
- 上下文字段限制长度；
- 支持 local-only item；
- 支持删除全部本地缓存；
- source title 可被用户隐藏；
- 移动端 analytics 不记录 card text；
- crash logs 不包含学习正文。

### 14.7 验收标准

| 指标 | V0 目标 |
|---|---:|
| Web save → mobile visible | P95 < 60s |
| Mobile review → Web state visible | P95 < 60s |
| 离线 event 同步丢失 | 0 |
| 删除数据重新出现 | 0 release blocker |
| 隐私模式下不显示敏感来源 | 必须 |
| 本地清除缓存 | 必须 |

### 14.8 与已有文档边界

此处定义移动端所需同步对象和体验约束，不设计完整后端实现、成本模型或运营后台。

---

## 15. Login / Membership / Pro Handling

### 15.1 问题

移动端会成为用户感知 Pro 价值的重要场景，但 App Store / Google Play 对数字订阅和应用内购买有严格规则。产品设计必须同时做到：

- 普通用户容易登录；
- 已有 Pro 用户能直接使用；
- 订阅状态清楚；
- 不暴露技术词；
- 不踩应用商店支付风险。

### 15.2 Strategic decision

移动端第一阶段采用：

> **登录后消费已有 Astra 账户权益；App 内购买可作为 V1/V2 审核后能力，不作为 V0 的核心阻塞。**

这可以让 V0 先验证 Review habit，并降低 IAP/Play Billing 风险。

### 15.3 登录方式

| 方式 | V0 建议 | 说明 |
|---|---|---|
| Sign in with Apple | iOS 必须优先 | 提升信任 |
| Google Sign-In | iOS/Android/PWA | 与浏览器用户一致 |
| Email magic link | 推荐 | 普通用户易懂 |
| Password login | 可选 | 降低复杂度 |
| QR link from desktop | 强烈建议 | 桌面扩展扫码登录 mobile |
| Anonymous mode | 只用于 sample review | 不同步 |

### 15.4 桌面到移动登录路径

推荐：

1. 用户在桌面 Astra Popup 看到 `Review on phone`；
2. 打开二维码；
3. 手机扫码；
4. 自动打开 App/PWA；
5. 登录并同步；
6. Today 显示 “Your saved words are here”。

### 15.5 Membership 展示

移动端只显示：

- `Free`;
- `Trial`;
- `Pro`;
- `Pro active`;
- `Sync paused`;
- `Your saved cards are safe`.

不显示：

- provider；
- model；
- quota；
- token；
- relay；
- API key；
- backend route。

### 15.6 Pro 权益在移动端的表达

| 权益 | 用户文案 |
|---|---|
| 跨设备同步 | `Keep your saved words across devices.` |
| 更多 Review 生成 | `Turn more saved sentences into review cards.` |
| Weekly Digest | `See what you learned each week.` |
| 离线复习 | `Review even without connection.` |
| 高级来源回顾 | `Continue from the pages and videos you saved.` |
| 长期学习历史 | `Keep your learning trail.` |

### 15.7 Free 用户体验

Free 用户应该能：

- 登录；
- 查看少量保存内容；
- 完成基础 Today Review；
- 使用 sample cards；
- 看到 Pro 如何增强跨端学习；
- 删除/导出自己的数据。

Free 用户不应被：

- 每张卡付费弹窗打断；
- 技术限制文案羞辱；
- 阻止查看自己已有数据；
- 强迫订阅才能删除数据。

### 15.8 App Store / Google Play 支付风险原则

移动端如果在 App 内解锁数字功能、订阅、高级内容或 Pro 能力，通常需要遵守 Apple IAP / Google Play Billing 规则。上线前必须以官方审核指南为准，并准备 reviewer account、清晰的订阅说明、可恢复购买、取消说明、隐私说明和可用后端服务。

### 15.9 推荐付款策略

| 阶段 | iOS | Android | PWA/Web |
|---|---|---|---|
| V0 private | 不做 App 内购买，只登录消费已有权益 | 不做 App 内购买 | 可管理订阅 |
| V1 public beta | 评估 IAP subscription 或 consumption-only | 评估 Play Billing 或 consumption-only | 继续作为账户管理 |
| V2 | 如 App 内卖 Pro，接入 IAP | 如 App 内卖 Pro，接入 Play Billing | 统一账户门户 |
| Mature | 支持 restore purchase、plan mapping | 支持 restore/sync entitlement | 统一 invoice/support |

### 15.10 风险

| 风险 | 缓解 |
|---|---|
| App 审核认为绕过 IAP | V0 不在 App 内引导外部购买，或按地区/规则接入 IAP |
| 用户已有 Web Pro 但 App 不识别 | 统一 entitlement service |
| 用户取消后数据担忧 | 明确 saved cards are safe |
| 订阅状态不同步 | purchase restore + server receipt validation |
| 免费用户觉得被锁 | 保留基础 Review 和数据访问 |
| App 内付费文案误导 | 清晰说明 Pro 包含内容 |

### 15.11 验收标准

- 已有 Pro 用户登录后能立即看到 Pro active；
- Free 用户能完成 sample/basic review；
- 订阅文案不出现技术词；
- V0 无 App Store / Play 购买审核阻塞；
- 删除数据不依赖 Pro；
- 取消会员后仍能访问/导出已有学习数据，除非服务条款明确说明同步限制。

### 15.12 与已有文档边界

SaaS 文档负责会员经济和用量；本文只定义移动端登录、Pro 展示和商店支付风险的产品处理。

---

## 16. App Store / Google Play / IAP Risks

### 16.1 问题

移动端 app 会进入平台审核体系。Astra 涉及 AI、学习记录、订阅、用户保存内容、可能的第三方来源片段。任何文案、权限、购买方式不清晰都可能导致审核延迟或拒绝。

### 16.2 Strategic decision

移动端上架策略应该先选择低风险版本：

> **Review Companion with account login and existing learning assets，避免第一版同时挑战完整 AI 生成、外部支付、内容导出和复杂权限。**

### 16.3 风险矩阵

| 风险 | 说明 | 第一版策略 |
|---|---|---|
| IAP / Play Billing | App 内解锁数字功能可能要求平台支付 | V0 只消费已有权益或接入官方购买 |
| External purchase CTA | App 内引导外部购买可能违规 | 避免外部购买按钮，按地区政策单独设计 |
| AI disclaimer | AI 解释可能错误 | 明确学习辅助，不作专业建议 |
| User-generated content | 用户保存内容可能含敏感/侵权内容 | 不做公开社区，默认私人内容 |
| Copyright | 保存网页/视频片段可能涉及版权 | 只保存用户主动保存片段和必要上下文 |
| Privacy | 同步学习内容和来源 | 明确隐私政策、删除、导出 |
| Children / education | 可能被儿童使用 | 不进入 Kids category，避免儿童定向营销 |
| App completeness | 登录后才可用需 reviewer 访问 | 提供 demo account / demo mode |
| Metadata accuracy | 商店截图不能夸大手机翻译能力 | 只展示 mobile review companion |
| Notifications | 过度通知或误导 | 可选、可关闭、非营销导向 |

### 16.4 App Review 准备清单

| 项目 | 要求 |
|---|---|
| Demo account | 可访问 Today Review、Library、Digest 示例 |
| Demo mode | 无账号也可看 sample cards |
| Review notes | 说明移动端是 companion review app |
| Subscription notes | 如有 IAP，说明权益和恢复购买 |
| Privacy policy | 说明学习内容、来源、同步、删除 |
| Support URL | 可联系支持 |
| Data deletion | App 内可找到删除/导出入口 |
| Content moderation | 不做公开 UGC；如 future share/public，需补 moderation |
| AI disclaimer | 说明 AI 辅助学习，可能不完美 |
| Screenshot accuracy | 不展示未发布的手机整页翻译能力 |

### 16.5 Permissions 最小化

| 权限 | V0 是否需要 | 说明 |
|---|---|---|
| Notifications | 可选 | 完成首次 Review 后请求 |
| Camera | 可选 | 桌面二维码登录才需要 |
| Microphone | 不需要 | V0 不做口语 |
| Photos | 不需要 | V0 不做图片导入 |
| Location | 不需要 | 禁止 |
| Contacts | 不需要 | 禁止 |
| Clipboard | 尽量不用 | 如果用，明确用户动作 |
| Background refresh | 可选 | 同步 Review cards |

### 16.6 商店文案边界

可以说：

- `Review words and sentences you saved with Astra.`
- `Learn from real web pages, videos, and documents.`
- `A quiet companion for daily language review.`
- `No API setup. No model settings.`

不要说：

- `Translate any mobile page`;
- `Works on every website`;
- `Download full YouTube transcripts`;
- `Guaranteed accurate AI teacher`;
- `Unlimited AI`;
- `Bypass platform limitations`.

### 16.7 验收标准

- App Store / Play listing 与 V0 功能一致；
- 审核账号能直接进入 sample review；
- V0 权限请求不超过 Notifications/Camera；
- Privacy policy 链接可访问；
- App 内可删除/导出账户数据路径清晰；
- 订阅/Pro 状态不会误导用户；
- 不在 App 内使用不合规外部支付 CTA。

### 16.8 与已有文档边界

这里不替代法律意见，也不展开全公司合规体系；只列 mobile app 上架前必须满足的产品风险边界。

---

## 17. Visual Design Direction Based on the Reference Video

### 17.1 参考说明

用户提供的设计方向是：

> warm paper, ink black, seal red, quiet premium learning cards

本文无法直接访问本地路径视频文件，因此视觉方案基于上述描述进行产品化，不做 1:1 复刻。目标是吸收气质，而不是复制具体画面。

### 17.2 Strategic decision

Astra Mobile 的视觉应该区别于开源工具、模型控制台和普通背单词 App：

> 像一套安静、高级、有纸感的私人学习卡片。

关键词：

- warm paper；
- ink black；
- seal red；
- quiet premium；
- soft depth；
- source-backed；
- tactile review；
- low chrome；
- calm completion。

### 17.3 视觉语言

| Token | 建议方向 | 用途 |
|---|---|---|
| Warm paper | 米白/暖纸色 | 背景、卡片底色 |
| Ink black | 柔和黑 | 正文 |
| Seal red | 印章红 | 完成、重点、主 CTA 小面积 |
| Soft graphite | 灰黑 | 次级文本 |
| Aged gold / sand | 淡金/砂色 | 分割、来源标签 |
| Paper shadow | 柔和阴影 | 卡片层级 |
| Fine grain | 极轻纹理 | premium 纸感 |
| Calm radius | 中等圆角 | 卡片 |

### 17.4 色彩原则

| 原则 | 说明 |
|---|---|
| 红色少用 | seal red 只用于完成、主动作、状态印章 |
| 黑不纯黑 | 避免刺眼，偏墨色 |
| 背景不纯白 | 使用暖纸色降低疲劳 |
| 状态不用彩虹色 | Again/Good/Easy 也保持克制 |
| Dark mode 不是反色 | 深色模式应像夜读纸张，不是技术黑屏 |

### 17.5 卡片视觉

卡片像一张可翻阅的学习纸条：

- 顶部来源小标签；
- 中间大字号词/句；
- 背面像批注；
- 完成时出现小红印章；
- 轻微 haptic；
- 翻页/滑动动效慢而短；
- 不使用夸张游戏动画。

### 17.6 Motion 原则

| 动效 | 用途 | 要求 |
|---|---|---|
| Card flip | Show answer | 150–220ms，克制 |
| Paper slide | 下一张 | 不眩晕 |
| Seal stamp | 完成一轮 | 轻量，不重复过多 |
| Sync pulse | 同步状态 | 低存在感 |
| Haptic tap | 评分 | 可关闭 |
| Progress settle | Done state | 温和 |

### 17.7 Typography

| 用途 | 方向 |
|---|---|
| Word front | 大字号、留白充足 |
| Sentence front | 可读性优先，行高大 |
| Translation | 稍小，但清晰 |
| Explanation | 批注感，不长篇 |
| Source label | 小字号，弱化 |
| Completion | 温暖、短句 |

### 17.8 UI 组件

| 组件 | 风格 |
|---|---|
| Review Card | warm paper card, soft shadow |
| Source Badge | 小胶囊，低饱和 |
| Seal CTA | seal red 小面积主按钮 |
| Completion Stamp | 红印章感 |
| Digest Sheet | 一页学习周记 |
| Empty State | 纸张插画/短文案 |
| Progress | 简单 dots 或 paper tabs |
| Settings | 极简列表，不像控制台 |

### 17.9 避免方向

- 不做仿古过重；
- 不做中国风/日式风格表演化；
- 不做满屏红色；
- 不做游戏化金币；
- 不做技术 dashboard；
- 不做过度拟物；
- 不复制参考视频具体构图；
- 不牺牲可读性追求氛围。

### 17.10 验收标准

| 指标 | 目标 |
|---|---:|
| 用户 5 秒内感觉是学习 app | > 80% |
| 用户感觉高级/安静 | > 70% |
| 卡片可读性 | WCAG 对比达标 |
| Review 过程中视觉干扰投诉 | 低 |
| 设计不被误解成技术控制台 | 用户测试中显著 |
| 完成页有成就感但不焦虑 | 用户测试 > 80% |

### 17.11 与已有文档边界

Brand and Trust Experience 已在 SaaS 文档中定义全局品牌；本文只把它落到移动端视觉系统和复习卡片体验。

---

## 18. Accessibility

### 18.1 问题

移动端 Review 是高频场景，必须适合不同视力、注意力、运动能力和学习状态的用户。可访问性不是上线后补丁，而是移动端核心体验的一部分。

### 18.2 Strategic decision

Astra Mobile 应该做到：

> 安静高级，但不牺牲可读性；动效精致，但可关闭；卡片美观，但屏幕阅读器可理解。

### 18.3 可访问性要求

| 领域 | 要求 |
|---|---|
| 字号 | 支持系统动态字体 |
| 对比度 | 文本和按钮符合 WCAG AA |
| 屏幕阅读器 | 卡片正反面、来源、按钮有清晰 label |
| 触控尺寸 | 主按钮 >= 44pt |
| 颜色依赖 | Again/Good/Easy 不只靠颜色区分 |
| 动效 | 支持 reduce motion |
| Haptics | 可关闭 |
| 单手操作 | 主操作位于可触达区域 |
| 横竖屏 | V0 竖屏优先，横屏不崩 |
| Dark mode | 支持，保持可读性 |
| 离线状态 | 文本说明，不只图标 |
| 错误状态 | 有可执行动作 |

### 18.4 Review Card Accessibility

| 元素 | Screen reader 行为 |
|---|---|
| Word front | 朗读词、词性、来源 |
| Sentence front | 朗读原句和提示 |
| Show answer | 明确按钮 |
| Back translation | 朗读译文 |
| Explanation | 可跳过或折叠 |
| Source | 朗读来源标题和类型 |
| Rating buttons | Again/Good/Easy 附说明 |
| Completion | 朗读完成状态和下一步 |

### 18.5 低视力模式

V1 可提供：

- Larger card text；
- Higher contrast；
- Hide paper texture；
- Always show translation；
- Reduce decorative elements；
- Extra spacing。

### 18.6 认知负担控制

- 每屏一个主动作；
- 文案短；
- 不在 Review 中弹出复杂解释；
- 不使用难懂术语；
- 错误状态给下一步；
- 完成后不堆叠 CTA。

### 18.7 验收标准

| 指标 | V0 目标 |
|---|---:|
| VoiceOver/TalkBack 可完成完整 Review | 必须 |
| 动态字体下 UI 不破 | 必须 |
| Reduce Motion 生效 | 必须 |
| 触控目标合规 | 必须 |
| Again/Good/Easy 不依赖颜色 | 必须 |
| 深浅色模式可读 | 必须 |

### 18.8 与已有文档边界

全局 Accessibility 可由平台规范管理；本文只定义移动端 Review 和 Library 的可访问性要求。

---

## 19. Metrics

### 19.1 问题

移动端不能只看安装量。Astra Mobile 的成功应该衡量它是否提升复习、留存和跨端闭环，而不是是否替代网页端。

### 19.2 Strategic decision

移动端北极星指标：

> **Weekly Mobile Review Completion**

定义：

> 一周内至少在移动端完成一次 Today Review 的活跃学习用户数或比例。

辅助北极星：

> **Web Save → Mobile Review Conversion**

定义：

> 用户在 Web 保存学习资产后，7 天内在移动端复习至少一张相关卡片的比例。

### 19.3 指标体系

#### Activation

| 指标 | 说明 |
|---|---|
| mobile_app_installed | 安装 |
| mobile_first_open | 首开 |
| mobile_signed_in | 登录 |
| mobile_linked_desktop_account | 与桌面账号关联 |
| mobile_first_cards_loaded | 首次加载卡片 |
| mobile_first_review_started | 首次开始复习 |
| mobile_first_review_completed | 首次完成复习 |

#### Review Habit

| 指标 | 说明 |
|---|---|
| today_review_viewed | 查看 Today |
| today_review_started | 开始 |
| card_answer_revealed | 查看答案 |
| card_rated_again/good/easy | 评分 |
| review_session_completed | 完成 |
| review_session_abandoned | 中断 |
| daily_goal_completed | 今日目标完成 |
| review_streak_soft | 非惩罚式连续完成 |

#### Cross-device Loop

| 指标 | 说明 |
|---|---|
| web_item_saved | Web 保存 |
| mobile_item_synced | Mobile 同步 |
| mobile_reviewed_web_item | Mobile 复习 Web 保存项 |
| source_opened_from_mobile | 从 mobile 打开来源 |
| continue_on_desktop_clicked | 回到桌面继续 |
| source_based_review_started | 按来源复习 |

#### Library

| 指标 | 说明 |
|---|---|
| library_opened | 打开 Library |
| library_search_used | 搜索 |
| saved_word_opened | 打开词 |
| saved_sentence_opened | 打开句 |
| source_detail_opened | 打开来源 |
| item_deleted_or_hidden | 删除/隐藏 |
| item_marked_mastered | 标记掌握 |

#### Retention

| 指标 | 说明 |
|---|---|
| D1/D7/D30 mobile retention | 移动端留存 |
| weekly_review_active | 周复习活跃 |
| reminder_enabled | 开启提醒 |
| reminder_clicked | 点击提醒 |
| digest_opened | 打开 Digest |
| digest_to_review | Digest 后复习 |

#### Quality / Trust

| 指标 | 说明 |
|---|---|
| card_marked_not_useful | 卡片无用 |
| source_hidden | 隐藏来源 |
| sync_failed | 同步失败 |
| offline_review_completed | 离线复习完成 |
| support_report_from_mobile | 移动端反馈 |
| data_delete_requested | 删除请求 |

### 19.4 隐私指标原则

- 不记录卡片正文；
- 不记录完整 URL；
- 来源只记录类型/hostname/category；
- 文本长度可 bucket 化；
- 复习评分可记录；
- 删除/隐私操作必须可记录为事件但不含内容；
- crash log 不含学习文本；
- 用户可关闭非必要 analytics。

### 19.5 成功标准

| 阶段 | 指标目标 |
|---|---|
| Prototype | 用户能完成 Review，定性反馈正向 |
| Private Beta | mobile first review completion > 50% |
| Public Beta | D7 mobile retention 明显高于无 mobile cohort |
| V1 | Web Save → Mobile Review Conversion > 25% |
| V2 | Mobile 用户 Pro retention 高于仅 Web 用户 |
| Mature | Mobile 成为 Review habit 主入口 |

### 19.6 决策标准

| 如果指标表现 | 决策 |
|---|---|
| 安装多但 Review 少 | 强化 onboarding 和 Today 首屏 |
| Review 开始多但完成少 | 减少卡片数量、优化卡片质量 |
| Not useful 高 | 回到卡片生成质量 |
| Mobile 登录流失高 | 增加桌面 QR 登录 |
| Digest 打开高但 Review 低 | Digest CTA 需要更明确 |
| 提醒点击低且关闭高 | 降低通知频率/改时机 |
| Library 使用低 | 不急着扩展 Library，先巩固 Today |

### 19.7 与已有文档边界

全局 OKR 和 SaaS analytics 已由其他文档覆盖；本文指标只评估 mobile companion 对 Review habit 和跨端闭环的贡献。

---

## 20. 30 / 60 / 90 Day Roadmap

### 20.1 目标

90 天内验证一个核心命题：

> 移动端 Today Review 能否显著提升 Astra 用户的复习完成率、跨端留存和 Pro 感知价值？

### 20.2 30 天：Product Definition + Prototype

#### 目标

完成移动端最小体验定义，做出可测试原型。

#### 交付

| 类别 | 交付物 |
|---|---|
| Product | Mobile IA、Today Review flow、Word/Sentence Card spec |
| Design | warm paper / ink black / seal red design direction |
| Data | Sync object requirements、offline event queue spec |
| Prototype | PWA 或 Figma clickable prototype |
| Research | 5–10 个用户测试 |
| Copy | mobile user-facing copy set |
| Risk | App Store / Play review checklist 初稿 |

#### 必须回答

- 用户是否理解 mobile app 的定位？
- 用户是否愿意在手机上复习 Web 保存内容？
- 卡片信息是否过载？
- 来源信息是否有帮助？
- 视觉方向是否 premium 且不影响可读性？

#### 30 天验收

| 验收项 | 标准 |
|---|---|
| Prototype 可完成一轮 Review | 是 |
| 用户 5 秒内理解主动作 | > 80% |
| 用户认为来源信息有价值 | > 80% |
| V0 scope 无功能膨胀 | 是 |
| Design direction 被确认 | 是 |

### 20.3 60 天：Private Beta Build

#### 目标

完成 iOS/PWA 私测版本，支持真实账号同步和离线复习。

#### 交付

| 类别 | 交付物 |
|---|---|
| Account | 登录、桌面 QR linking |
| Sync | Web saved item → mobile visible |
| Review | Today Review、Word Card、Sentence Card |
| Offline | 离线卡片和 review event queue |
| Library | Words/Sentences/Sources 基础列表 |
| Settings | reminder、privacy、sync、delete data |
| QA | VoiceOver/TalkBack 基础可用 |
| Beta | 20–50 个真实用户私测 |

#### 必须回答

- 真实保存内容同步是否稳定？
- 用户是否完成首次 mobile review？
- 离线复习是否可信？
- 用户是否愿意开启提醒？
- iOS 体验是否足够 premium？

#### 60 天验收

| 验收项 | 标准 |
|---|---|
| Web save → mobile visible | P95 < 60s |
| First review completion | > 50% |
| Offline review event loss | 0 |
| Sync critical bug | 0 release blocker |
| 用户测试中“不像控制台” | 明显正向 |
| 普通 UI 技术词 | 0 |

### 20.4 90 天：Public Beta Readiness

#### 目标

准备公开 beta，上架前完成商店、隐私、指标、提醒和 Digest 的最小闭环。

#### 交付

| 类别 | 交付物 |
|---|---|
| Store | App Store / Play listing draft、screenshots、review notes |
| Digest | Weekly Digest MVP |
| Notifications | 完成首次 Review 后请求提醒 |
| Metrics | mobile event taxonomy 接入 |
| Support | mobile feedback/report flow |
| Privacy | data delete/export/mobile cache clear |
| Android | Android beta plan or first build |
| Growth | 桌面端 `Review on phone` 入口 |
| Cohort | mobile vs non-mobile retention 分析 |

#### 必须回答

- mobile 是否提升 D7/D30 留存？
- Today Review 是否成为主要复习入口？
- Reminder 是否带来正向而不是骚扰？
- Digest 是否让用户看到长期价值？
- App Store / Play 风险是否可控？

#### 90 天验收

| 验收项 | 标准 |
|---|---|
| Public beta checklist | 完成 |
| D7 mobile retention | 高于仅 Web cohort |
| Weekly mobile review active | 建立基线 |
| Reminder opt-in 后点击质量 | 正向 |
| Store metadata 准确 | 是 |
| 删除/隐私入口 | 可用 |
| Android 路线 | 明确 |

### 20.5 90 天后路线

| 阶段 | 方向 |
|---|---|
| V1 | iOS public launch、Android beta、Weekly Digest、Share Card |
| V2 | Widget、better offline、topic grouping、source-based review |
| V3 | Mobile source reading snippets、light Deep Read summaries |
| V4 | Speaking/listening review、audio cards、watch/lock screen |
| V5 | Advanced personal learning graph surfaces |

### 20.6 路线风险

| 风险 | 处理 |
|---|---|
| 过早做完整移动阅读器 | 坚守 Review Companion |
| Store 审核拖慢 | PWA fallback 保持验证 |
| 移动留存不提升 | 先优化 Today/Card，不加功能 |
| 用户无保存资产 | 强化 Web 保存入口和 sample cards |
| 卡片质量不稳 | 增加 Not useful feedback loop |
| 视觉过度装饰 | 回到 readability/accessibility |

---

## 21. Mobile Design System Summary

### 21.1 核心组件

| 组件 | 用途 |
|---|---|
| Today Goal Card | 今日复习入口 |
| Review Card | Word/Sentence 复习 |
| Source Badge | 来源感 |
| Completion Stamp | 完成反馈 |
| Library Item | 保存内容列表 |
| Source Detail Card | 来源聚合 |
| Digest Sheet | 周总结 |
| Sync Status Pill | 同步状态 |
| Gentle Reminder Prompt | 提醒开启 |
| Privacy Control Row | 隐私/删除 |

### 21.2 核心文案

| 场景 | 文案 |
|---|---|
| Today ready | `5 cards are ready from your web reading.` |
| Start | `Review in 3 minutes.` |
| Complete | `Done for today.` |
| Save source | `Saved from your reading.` |
| Offline | `Offline review is ready.` |
| Sync | `Bringing in your saved words.` |
| No cards | `Save words from the web to review them here.` |
| Pro active | `Pro active — syncing your learning across devices.` |
| Reminder | `Want a gentle reminder tomorrow?` |
| Digest | `Your weekly learning note is ready.` |

### 21.3 禁止词

移动端普通 UI 不出现：

- provider；
- model；
- API key；
- token；
- prompt；
- quota；
- rate limit；
- relay；
- upstream；
- vector；
- embedding；
- content script；
- extension runtime；
- debug；
- batch；
- fallback。

---

## 22. Final Product Thesis

Astra Mobile 不应该问：

> 手机端能不能也翻译网页？

它应该问：

> 用户在真实网页和视频里保存的表达，能不能变成每天 3 分钟的长期语言能力？

最终判断：

> **Web is for capture. Mobile is for habit.**

桌面端让用户在真实内容中遇见、理解、保存；移动端让用户在碎片时间复习、回忆、巩固。只要这条闭环成立，Astra 就不再只是 Read Frog 或 Immersive Translate 的竞品，而会变成一个跨端个人语言学习系统。

一句话：

> 在电脑上保存真实世界的词句，在手机上把它们变成自己的语言能力。
