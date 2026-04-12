# Astra Product Roadmap

_Last updated: 2026-04-09_

## Summary

Astra 的定位是：**AI-powered language learning layer for the web**。

平台支持等级与对外 claim 边界以 `docs/investigations/support-matrix-2026-q2.md` 为 canonical 口径（Supported/Beta/Experimental/Not supported）。

它先从浏览器插件开始，因为这是进入用户日常语言输入场景的最低摩擦方式。长期目标不是停留在“网页翻译工具”，而是把日常浏览中的理解、解释、记忆、复习和跨端连续性连接成一套完整的软件系统。

当前的核心用户假设是：

- **中文用户，通过真实网页内容学习英语**

## Positioning

### Astra 是什么

- 一个语言学习产品，而不只是翻译功能
- 一个 extension-first 的产品，因为浏览器就是最真实的输入场
- 一个先从真实阅读流切入，再逐步扩展的系统

### Astra 不是什么

- 不是单纯的通用翻译插件
- 不是一上来就做 LingQ 式内容库
- 不是第一阶段就做 Lingopie 式媒体平台
- 不是模型配置面板换一层产品包装

### 核心战略判断

- 先进入用户已经存在的浏览行为
- 先用翻译和解释提供即时价值
- 再把这些即时价值沉淀成长期学习资产

也就是说，Astra 必须先赢下“日常网页阅读”这个入口，再扩展成更完整的学习系统。

## Current Reality Checkpoint

截至 **2026-04-09**，仓库现实已经比“只有网页翻译”更宽：

- 网页翻译、文章提取、站点自动化、划词/悬停/输入框翻译已经是当前核心面
- PDF、EPUB、字幕文件、YouTube 双语字幕已经有第一版产品面和 benchmark 覆盖
- provider routing 的 direct → relay fallback、active-session restart、routing metadata 已经进入 benchmark 可验证范围
- privacy-mode 已经不只是口头承诺，而是已在部分 live / holdout lane 中进入可验证范围；但它还没有达到 system-wide benchmark / proof gate

但这 **不等于** Astra 现在就应该把路线图改成“同时扩十几个新面”。更准确的判断是：

- 核心 wedge 仍然是 **日常网页阅读 + 低打扰交互 + 学习增强**
- 已经做出来的 PDF / EPUB / subtitle-file 更像是 **Phase 3 的技术前置**，还不是完整的 owned learning surface
- 近阶段最重要的，不是继续铺很多新 beta 面，而是把现有核心翻译栈、provider resilience、quality-control、privacy gate 打牢

## Product Principles

- **Daily utility before platform ambition**：先成为用户愿意长期开着的工具，再谈平台想象力
- **Context before flashcards**：先保存带上下文的词句，再做重背诵系统
- **Real content before curated content**：先让用户从自己真实会读的网页中学习
- **Asset accumulation over one-off sessions**：词汇、句子、历史、进度都应该持续积累
- **BYOK is a bridge, not the center**：自带 key 可以存在，但不应该成为产品中心
- **Protocol before claims**：任何“已经做成”的能力，都应该先经过 deterministic / live / holdout / proof 的验证

## Phases

### Phase 1: Daily Utility Wedge

**目标**

让 Astra 成为中文用户在阅读英文网页时愿意长期打开的默认工具。

**核心能力**

- 稳定的整页翻译
- 双语对照与仅译文模式
- 低打扰的划词、悬停、输入框翻译
- 面向正文的文章提取
- 站点规则与自动翻译
- 稳定的 provider routing / fallback / restart 行为
- 基础隐私模式与可验证的 request sanitization

**成功门槛**

- 用户把 Astra 当成日常工具，而不是偶尔演示的 AI 插件
- 在普通网页上稳定解决阅读摩擦
- 高频重复使用比“新奇功能”更重要
- provider / privacy / routing 问题不再成为高频失效点

**本阶段不做**

- 不做重内容库
- 不做完整学习仪表盘
- 不做会分散资源的平台化扩张
- 不把图片/漫画 beta 当成当前主线

### Phase 2: Learning Loop

**目标**

把“我看懂了”变成“我学会了”。

**核心能力**

- 保存来自真实网页的单词和句子
- 与原文绑定的上下文解释
- 面向不同水平的解释模式
- 阅读历史
- 个人词库
- 轻量复习与回看
- 文章摘要与句级讲解

**产品原则**

不要一开始就做脱离上下文的机械背词。先做保存、回看、复现，再决定如何复习。

### Phase 3: Owned Reading And Video Surfaces

**目标**

从“网页里的学习层”扩展到“用户自己的学习面板”。

**核心能力**

- 导入网页、PDF、EPUB、字幕文件等自有内容
- 字幕驱动的视频学习流程
- 稍后阅读与回看队列
- 浏览器与移动 companion 之间的同步
- 个人学习档案与资产视图

**关键说明**

这个 phase 在技术上已经部分启动：仓库里已经有 PDF / EPUB / subtitle-file / subtitle 的基础实现和 benchmark 覆盖。

但它还没有真正完成，因为目前还缺：

- 统一的 owned reading entry model
- 跨 surface 的学习资产视图
- 真正的阅读队列 / 回看队列
- 跨端同步与连续性

也就是说，**“有 reader 子系统” 不等于 “Phase 3 已经完成”。**

### Phase 4: Ecosystem

**目标**

成为一套完整、连贯的语言学习软件生态，而不是功能堆叠。

**核心能力**

- 统一账号与同步
- 跨场景共享的词汇与句子资产
- 跨设备连续性
- 个性化学习路径
- 阅读与视频之间的联动
- 围绕长期学习价值建立订阅闭环

**有意延后**

- 社区课程
- 学校或企业产品
- 重内容版权与平台化

这些都不是第一阶段要抢着做的事情。

## Near-Term Execution Order

这是 **2026-03-28** 之后更合适的执行顺序，不是永久 roadmap，而是当前阶段的资源排序。

### 1. Provider breadth / routing depth

先把当前翻译主干做稳，再谈更大的能力扩张。

已经验证的一层包括：

- direct → relay fallback
- routing metadata 暴露
- failure-class policy
- active-session restart consistency

下一步应该继续补：

- 更广的 provider roster
- per-surface preferred provider / fallback chain
- operator-visible failure / fallback history
- 用户可理解的 provider capability 呈现

### 2. AI translation quality-control stack

Astra 不能只证明“它调用了模型并返回了一段文字”，还要证明：

- 它能拒绝明显坏输出
- 它能保留 glossary / terminology / context intent
- 它能在异常情况下提供可解释的 failure reason

这是当前比继续加新 surface 更高杠杆的工作。

### 3. Privacy full gate + rules-system UX

这两项不一定是最 flashy 的新增功能，但它们会直接影响 Astra 是否像一个成熟产品。

其中 privacy full gate 不应该被当成最后再补的 polish，而应该和 provider routing / quality-control **并行推进**，并作为继续扩更多 surface 的阻断条件。

具体来说：

- 规则系统要从“专家开关”变成“普通用户看得懂的工具”
- privacy-mode 要从 partial capability 变成 release-blocking product property
- 新 surface 上线前，要先补 should-not-leak 与 deterministic privacy assertions

### 4. Video AI subtitles + broader platform coverage

视频值得继续做，但更合理的顺序是：

- 先把现有 subtitle 基础扩成更完整的产品面
- 再补更广的平台 coverage
- 最后再考虑 AI-generated subtitle fallback 的产品化

也就是说，视频是近阶段值得扩张的方向，但不应反客为主变成 Astra 的主入口。

### 5. Document surface expansion

文档不是从零开始，而是从“已有 PDF / EPUB / subtitle-file 基础”继续往前推：

- 统一入口模型
- 更清晰的支持格式矩阵
- layout-preservation contract
- scanned-PDF OCR decision path
- 可能的 Markdown / HTML / plain-text import/export

### 6. Image translation / comic translation

这是重要的竞争面，但属于更大的 subsystem bet。

执行原则：

- 不能在核心翻译栈还脆弱时抢着扩
- 必须带着 OCR / overlay / holdout / beta-threshold 一起设计
- 应该被当成明确 beta track，而不是现在的主叙事


## Strategic Positioning Against References

### 从 Immersive Translate 拿什么

- 低摩擦入口
- 双语阅读
- 网页内容优先
- 站点适配思路
- 向 PDF、字幕、图片等场景扩展的可能性

但 Astra 不能停在这里。翻译只是入口，不是终点。

### 从 Read Frog 拿什么

- AI 解释
- 文章分析
- 插件内的学习增强
- 浏览器即学习场

这是 Astra 第一阶段最接近的产品邻居。

### 从 LingQ 拿什么

- 长期留存来自学习资产积累，而不是单次翻译
- 学习进度应该持续复利

但不要过早复制“内容库先行”的产品形态。

### 从 Lingopie 拿什么

- 视频是后期很强的学习场景

但它不适合作为 Astra 第一阶段入口。第一入口仍然应该是网页浏览本身。

### 从 Sentia Read 拿什么

- “AI reader / tutor” 这层产品包装

但 Astra 不能只停留在“模型调用体验更漂亮”。真正的护城河是工作流、资产和习惯。

## Business Model Guardrails

### 免费层

- 先解决第一次使用时的真实阅读价值
- 保持低门槛体验
- 强到足以形成习惯

### 付费层

- 卖便利性，而不是卖配置复杂度
- 卖同步、连续性和学习资产
- 卖复习、进度和长期陪伴

### 约束

BYOK 可以保留，但不应成为未来商业模式的中心。

## Explicit Non-Goals For This Wave

当前这波不应该重新打开已经基本收敛、只需防回归的工作：

- rich-text placeholder preservation
- malformed placeholder fallback
- site-rule restart correctness
- invalid selector handling
- rapid SPA restart dedupe

如果这些地方回退，应该按 regression 处理，而不是当成新的主线 epic。

## Execution Checkpoints

之后每做一个新功能，都应该先问：

- 它有没有让 Astra 在真实浏览时更有用？
- 它有没有帮助用户保存或回看刚刚理解的内容？
- 它有没有形成可复用的学习资产？
- 它是在强化插件入口，还是在分散注意力？
- 它是在建设生态，还是只是在叠一个孤立功能？
- 它有没有进入 benchmark / live / holdout / proof 的可验证范围？

建议和下面这些文档一起读：

- `docs/capability-matrix-v2.md`
- `docs/bench-harness.md`
- `docs/investigations/competitive-gap-backlog-2026-03-28.md`
- `docs/investigations/p1a-provider-routing-issues-2026-03-28.md`
