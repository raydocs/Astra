# Astra 超越 Read Frog 整改策略（网页翻译 + YouTube 重点版）

日期：2026-05-27  
目标产品：Astra 浏览器扩展 + Astra Relay/Web 会员服务  
竞品参考：Read Frog 官网与开源仓库 `mengxi-ream/read-frog`  
核心目标：在完成度、可用性、网页翻译体验、YouTube/视频学习体验上，至少达到并尽快超过 Read Frog。

---

## 1. 一句话定位

Astra 不应该做成“Read Frog 的另一个开源配置面板”，而应该做成：

> **Read Frog 的网页/YouTube 能力 + Amp 风格的高级审美与自动配置 + 托管 AI 会员服务 + 学习闭环。**

用户不需要知道 provider、API key、model、base URL、relay、路由、fallback。用户只需要：

1. 安装 Astra；
2. 登录/购买会员；
3. 选择目标语言和阅读偏好；
4. 在网页或 YouTube 上直接阅读、翻译、保存、复习。

我们和 Read Frog 的根本差异不是“支持更多 AI 提供商”，而是：

- Read Frog 更像面向 AI 工具用户/开源用户的可配置翻译器；
- Astra 要成为面向普通付费用户的托管式语言学习阅读助手。

---

## 2. 竞品基线：Read Frog 做得好的地方

### 2.1 网页翻译能力

Read Frog 的核心网页翻译能力主要包括：

- Popup 大按钮触发整页翻译；
- 浮动按钮触发整页翻译；
- 快捷键触发；
- 右键菜单触发；
- hover/click-and-hold 单节点翻译；
- 选择文本后出现 toolbar，可翻译、朗读、自定义 AI action；
- `IntersectionObserver` 懒加载翻译视口附近内容；
- `MutationObserver` 处理动态内容、SPA、无限滚动；
- Shadow DOM / iframe 递归处理；
- 文档标题翻译；
- 站点白名单/黑名单、自动翻译 URL pattern；
- 网页上下文感知翻译；
- 翻译样式、模式、批量、速率、缓存等可配置项。

### 2.2 YouTube/字幕能力

Read Frog 的 YouTube 能力比较完整：

- 仅匹配 YouTube / youtube-nocookie；
- 注入播放器控制栏按钮；
- 获取 YouTube caption tracks；
- 支持 human captions / ASR captions / 当前选中字幕优先；
- 处理 YouTube timedtext/POT 相关情况；
- 支持 bilingual / translation-only / original-only；
- 字幕位置 above/below；
- 字幕块可拖拽；
- 播放时 look-ahead 批量翻译；
- seek 后继续调度；
- 可下载源语言 SRT；
- 可选 AI segmentation；
- 可选 video summary 作为翻译上下文；
- in-player settings panel。

### 2.3 Read Frog 的明显弱点

这些是 Astra 必须抓住的超越点：

1. **Provider/API key 配置门槛高**  
   Read Frog 强依赖用户理解 provider、API key、model、base URL。普通用户很容易卡住。

2. **YouTube 字幕功能偏工具化**  
   它能翻译字幕，但没有完整 transcript 学习面板、逐句笔记、视频摘要、词汇保存、复习闭环。

3. **学习闭环弱**  
   Read Frog 有语言学习定位，但核心更像“翻译 + AI action”。Astra 已有 Deep Read、Vocabulary、Review、Owned Reading、Study Loop 的基础，应该主打闭环。

4. **普通用户心智复杂**  
   Read Frog 的设置很多，功能强但像工程控制台。Astra 应该默认替用户做好。

5. **商业服务体验不足**  
   Read Frog 是开源项目，Astra 作为付费产品必须在稳定性、支持、零配置、质量兜底、视觉统一、学习结果上明显更好。

---

## 3. Astra 当前基础与差距

### 3.1 Astra 已有优势

代码与产品已有不少可利用资产：

- WXT 浏览器扩展架构；
- 托管 Astra Relay / session / membership 方向；
- Popup、Options、Onboarding 已开始去 provider 化；
- `serviceMode` 已新增为用户可懂的服务偏好：`Automatic / Fast / Balanced / Best quality`；
- FloatBall 已从单按钮升级为网页内控制中心，包含：Translate、Stop、Deep Read、Review/Settings、Auto on site、Hide here；
- Page translation 已有 deterministic/live bench；
- Deep Read 页面；
- Vocabulary / Review / SRS 复习；
- Reading queue / Owned reading；
- PDF / EPUB / subtitle-file reader；
- YouTube/Bilibili/generic subtitle 相关 adapter 与 subtitle quality snapshot；
- Video Notes 基础链路；
- Popup 内已有 learning closure primer 和学习闭环入口。

### 3.2 Astra 主要差距

#### 网页翻译差距

- 触发入口还不如 Read Frog 丰富和统一；
- FloatBall 刚升级，仍需从“快捷菜单”进化成真正可拖拽/吸边/状态明确的网页控制台；
- 对动态网页、iframe、Shadow DOM、文档标题翻译的用户可感知稳定性需要专项验证和补齐；
- 缺少“网页翻译完成度评分/可见问题自修复”的普通用户反馈；
- Popup 仍有一些高级诊断区域，普通用户路径需要继续收敛。

#### YouTube 差距

- 需要明确一个“超过 Read Frog 的 YouTube 核心体验”，不能只做字幕替换；
- 需要播放器内按钮 + transcript side panel + summary + saved sentences + review handoff；
- 需要逐词/逐句交互：点击字幕词查释义、保存、朗读、生成例句；
- 需要视频笔记体验与现有 Video Notes/Deep Read/Vocabulary 打通；
- 需要明确 YouTube 支持边界并建立 live proof，避免过度声明 Netflix/全平台视频。

---

## 4. 产品原则

### 4.1 零配置原则

普通用户不应该看到：

- provider；
- API key；
- model；
- relay；
- base URL；
- routing/fallback；
- token/rate/batch；
- “OpenAI/Gemini/DeepL” 这类技术选择。

普通用户只应该看到：

- 目标语言；
- 阅读模式：双语 / 只看译文；
- Astra AI style：Automatic / Fast / Balanced / Best quality；
- 当前站点是否自动翻译；
- 是否隐藏此站点；
- 学习偏好：解释深度、词汇保存、复习提醒。

### 4.2 会员托管原则

用户购买会员后：

- Astra 自动选择后台模型；
- Astra 自动做质量/速度调度；
- Astra 自动重试/降级/切换路径；
- Astra 自动保护配额与成本；
- 用户不需要自己申请 API key。

### 4.3 完成度原则

“超过 Read Frog”不能只靠 UI 文案，必须在关键路径上完成：

- 安装后 60 秒内完成首次网页翻译；
- 安装后 90 秒内完成首次 YouTube 双语字幕；
- 任何核心路径失败时，用户看到的是“下一步怎么做”，不是技术错误；
- 每个核心能力都要有 deterministic test + extension-loaded live bench；
- 公开宣传必须和证据等级匹配。

---

## 5. 北极星体验

### 5.1 网页阅读北极星

用户打开英文网页：

1. 页面右下角出现低干扰 Astra pill；
2. 点击 `Translate`，页面开始双语翻译；
3. 顶部出现优雅进度 pill，显示翻译进度与 Stop；
4. 悬停 Astra pill 可选择：
   - Translate / Stop；
   - Deep Read；
   - Review；
   - Auto on site；
   - Hide here；
5. 翻译完成后，用户可直接进入 Deep Read；
6. 在 Deep Read 或选择 toolbar 里保存句子/词汇；
7. Popup/Review 告诉用户下一步复习什么。

### 5.2 YouTube 北极星

用户打开 YouTube 英文视频：

1. 播放器控制栏出现 Astra 按钮；
2. 默认提示“Translate subtitles”，一键开启；
3. 字幕显示双语，默认不遮挡 YouTube 原控件；
4. 右侧或下方出现 Astra transcript panel：
   - 视频摘要；
   - 章节/时间轴；
   - 双语 transcript；
   - 当前播放句高亮；
   - 点击句子跳转播放时间；
   - 选中词/句可解释、保存、朗读；
5. 视频结束或中途点击 `Save learning notes`：
   - 生成 video note；
   - 保存重点句；
   - 加入 Review；
   - 可在 Web/Extension 中继续复习。

这才是超过 Read Frog 的关键：Read Frog 是“字幕翻译器”，Astra 要是“视频语言学习工作台”。

---

## 6. 详细整改路线图

## Phase 0 — 收尾当前去技术化改造（1–2 天）

目标：确保普通用户路径不再暴露 provider/API/model，并且新 `serviceMode` 完整接入。

### P0.1 配置链路收口

- [x] 新增 `serviceMode` config 字段；
- [x] Options Astra AI 页显示服务偏好；
- [x] Popup Learning preferences 显示 Astra AI style；
- [x] Relay/provider router 接收 `serviceMode`，并映射到后台策略；
- [x] Telemetry 记录 serviceMode 对延迟/失败率/满意度的影响；
- [x] Sync/Account 远端数据 schema 检查，确保老用户迁移默认 `automatic`。

验收标准：

- 普通 UI 搜索不到 `API key`、`OpenAI`、`Gemini`、`model`、`provider`；
- `serviceMode` 从 Popup/Options 保存后，重启扩展仍保留；
- 后台请求能看到 `serviceMode`，但用户看不到技术细节。

补充（2026-05-27）：Options 保存失败 toast 已接入共享安全文案，`Relay unavailable.` 等内部诊断不再直接显示给普通用户；回归测试覆盖 `Settings update failed` alert 不包含 `relay` 原始术语。

补充（2026-05-27）：Relay `/v1/translate` 已改为 managed-service/serviceMode-first contract：普通客户端可只发送 `texts` / `targetLang` / `task` / `serviceMode` / context，不再要求或发送 provider/model；server 会根据 session entitlement 与 serviceMode 解析 provider/model，legacy advanced payload 仍兼容。`AGENTS.md` hello-world curl 与 `docs/adr/0002-astra-managed-auth-relay.md` API example 已同步为 providerless request。

补充（2026-05-27）：补齐非网页翻译 AI 请求面的 `serviceMode` 透传：Deep Read digest/句子解释、Popup study action/句子解释、Vocabulary entry explanation、Image/OCR translation、Subtitle Reader runtime batch 与解释请求均已读取当前 config 的 `serviceMode` 并透传；对应单测覆盖这些入口，避免 managed-service 只在 page translation/selection 生效。

补充（2026-05-28）：普通 UI/i18n 技术词收口追加覆盖 Safari/iOS extension resources。`public/_locales/*` 与 `ios/AstraShell Extension/Resources/_locales/*` 的可见 message 已从 API/provider/model/relay/cost 语言改为 Astra service / service access / cloud path / reading estimate 等普通文案；Options 文案中的 “without API setup” 改为 “without technical setup”，TTS 下拉中的 “Web Speech API” 改为 “Browser speech”。验证：`pnpm exec vitest run src/entrypoints/options/OptionsApp.test.tsx src/entrypoints/popup/App.test.tsx` — 2 files / 104 tests passed；`python3` JSON parse + message-value scan for public + iOS locale files — OK / 0 technical copy offenders；`pnpm type-check` — EXIT 0。

### P0.2 Popup 信息架构再压缩

当前 Popup 已去技术化，但还需要继续压缩：

- [x] 把诊断/用量/站点 explainability 默认放入 `More details`；
- [x] 首屏只保留：
  - 当前页面状态；
  - Translate / Stop；
  - Deep Read；
  - Review next；
  - Sign in / membership；
  - Learning preferences 折叠入口；
- [x] Video note 只在 YouTube/Bilibili tab 被检测到时露出。

验收标准：

- 新用户第一次打开 Popup，3 秒内能理解主按钮；
- 不需要读任何技术状态就能开始。

---

## Phase 1 — 网页翻译超过 Read Frog（1–2 周）

目标：网页翻译至少具备 Read Frog 同级完成度，并在普通用户易用性上明显超过。

### P1.1 FloatBall 升级为页面控制中心

当前已有 `Translate / Stop / Deep Read / Review / Auto on site / Hide here`，下一步：

- [x] 拖拽 + 自动吸边；
- [x] 记忆位置；
- [x] Hover 展开，离开自动收起；
- 当前状态文案：
  - [x] `Astra · Ready`；
  - [x] `Astra · Translating 14/38`；
  - [x] `Astra · Done`；
  - [x] `Astra · Review 8 cards`；
  - [x] `Astra · Hidden here`；
- [x] 一键切换阅读模式：Bilingual / Translation only；
- [x] 一键切换 Astra AI style：Automatic / Fast / Balanced / Best quality；
- [x] 一键“Translate only this paragraph/section”；
- [x] 位置锁定/解锁：用户可防止误拖拽，锁定状态持久化；
- [x] 快捷动作结构化为 keyboard menu：`role="menu"` / `role="menuitem"`，支持方向键在动作之间移动焦点；
- [x] 错误状态显示用户可懂动作：`Retry`、`Use simpler mode`、`Open Deep Read`。

本轮补充验证（2026-05-27）：`pnpm exec vitest run src/entrypoints/content/components/FloatBall.test.ts` — 1 file / 26 tests passed（含 hidden third-party iframe false-positive 过滤、visible protected frame 计数、iframe load 刷新、左侧吸边菜单不出屏）。2026-05-27 追加：FloatBall quick-action menu 新增页面 surface mode 控制，用户可直接在 `Immersive` / `Full page` 间切换并持久化 `contentScope`。2026-05-28 追加：`Use simpler mode` 会把 active retry 覆盖为 `serviceMode: "fast"`，避免只保存配置但当前失败批次仍沿用旧模式；`pnpm exec vitest run src/entrypoints/content/components/FloatBall.test.ts` 已纳入回归。

超过 Read Frog 的点：

- Read Frog floating button 主要是 toggle；Astra FloatBall 是完整阅读控制中心；
- Read Frog 需要很多 Options 设置；Astra 在页面内直接解决常用动作。

### P1.2 网页翻译稳定性专项

对标 Read Frog 的 `IntersectionObserver + MutationObserver + iframe + shadow DOM + title`，建立 Astra 自己的稳定性矩阵。

必须覆盖：

1. [x] 静态文章；
2. [x] 新闻页；
3. [x] 文档站；
4. [x] Reddit/论坛类动态评论；
5. [x] SPA 路由切换；
6. [x] 无限滚动；
7. [x] Shadow DOM 组件；
8. [x] same-origin iframe；
9. [x] cross-origin iframe 可见边界；
10. [x] 页面标题翻译；
11. [x] accordion/tab 展开后翻译；
12. [x] lazy-loaded article body；
13. [x] 翻译过程中切换站点规则；
14. [x] 隐私模式不泄漏上下文；
15. [x] `immersive` / legacy `page` 与 `full_page` 的 DOM 范围语义区分：默认沉浸式跳过 header/nav/footer/aside，`full_page` 覆盖导航、页眉、侧栏、页脚但仍跳过 unsafe/code/editable/ad 区域。

技术任务：

- [x] 审查 `src/entrypoints/content/page-translate.ts` 的采集/注入/重试逻辑；
- [x] 明确 block registry，避免重复翻译与错位；
- [x] 对动态新增 block 做去抖和优先级队列；
- [x] 对大页面采用 viewport priority：当前视口 > 下方 1.5 屏 > 其余；
- [x] 失败 block 局部 retry，不重翻全页；
- [x] 保留原文结构，不破坏页面 layout；
- [x] 对 editable/input/code/pre/math/canvas/广告区域做默认跳过策略。
- [x] 增加命名采集 API `collectTextBlocksFromRoot(root: Document | ShadowRoot | HTMLElement)`，并让 page translation mutation observer 注册 open shadow roots，覆盖动态新增 shadow host。
- [x] 增加 `TranslationSurfaceMode` 与 `resolveTranslationSurfaceMode`，将 legacy `page` 兼容映射到 `immersive`，Options/Popup 使用用户可理解的 `Immersive page / Full page / Article only`。
- [x] 背景触发入口统一走 frame coordinator：context menu、`translatePage` 快捷键、omnibox auto-translate 不再只给 top frame 发 `tabs.sendMessage`，而是通过 `executeTabCommand` 扇出到可翻译 iframe。
- [x] frame coordinator 记录 active tab translation intent，并监听 `webNavigation.onCompleted`：翻译进行中/已开启后 late-arriving HTTP(S) child iframe 会自动收到同一个 `content/start-translation`；stop、top-frame navigation、tab close 会清理 active tracking，避免 stale iframe 继续翻译。

本轮补充验证（2026-05-27）：

补充（2026-05-27）：新增 `bench-live/page-translation-full-page-title-shadow-source`，使用真实 page-translation source module 显式跑 `full_page`，并证明 title、nav/footer、open shadow root 均进入请求并完成翻译；`source-core` required lane 同时纳入 `frame-coordination-basic` 与 `frame-coordination-cross-origin-fallback`，补齐 same-origin iframe/frame coordinator 与 cross-origin iframe graceful-boundary 的 release proof。

补充（2026-05-27）：新增 `bench-live/frame-coordination-cross-origin-fallback`，用两个本地 HTTP origin（不同端口）加载真实 cross-origin iframe；证明 top frame 仍注入翻译 marker、cross-origin child 不可被 top DOM 直接访问、visible boundary notice 出现，aggregate frame state 不被 child failure 破坏。追加 runtime UI guard：FloatBall 现在在活动翻译中把 protected embedded frame boundary 用 `Protected frame skipped` 普通文案展示给用户。

- 2026-05-28 追加：`pnpm exec vitest run src/entrypoints/content/page-translate.test.ts src/entrypoints/content/components/FloatBall.test.ts src/entrypoints/options/OptionsApp.test.tsx src/entrypoints/popup/App.test.tsx` — 4 files / 172 tests passed。覆盖 open shadow root 内部后续 append 的 mutation guard、动态新增 open shadow host、title translation、full_page landmark 采集、FloatBall fast retry override、Options/Popup 普通文案回归；`pnpm type-check` — EXIT 0。
- `pnpm exec vitest run src/utils/dom/traversal.test.ts src/utils/dom/extraction.test.ts src/types/config.test.ts src/entrypoints/content/page-translate.test.ts` — 4 files / 90 tests passed。
- `pnpm exec vitest run src/entrypoints/background/index.test.ts src/entrypoints/background/frame-coordinator.test.ts` — 2 files / 46 tests passed。
- `pnpm bench:live -- --scenario bench-live/page-translation-full-page-title-shadow-source` — pass / score 100。
- `pnpm bench:live -- --scenario bench-live/frame-coordination-cross-origin-fallback` — pass / score 100（run `live-20260527T223850-xoq6xg`；`childContentDocumentAccessible=false`，`boundaryNoticeVisible=true`）。
- `pnpm exec vitest run script/bench-live/index.test.ts` — 1 file / 5 tests passed。
- `pnpm type-check` — `TYPECHECK_EXIT:0`；本轮追加验证也分别跑通 `pnpm exec tsc --noEmit --pretty false --noErrorTruncation` 与 `pnpm exec tsc -p src/web/tsconfig.json --noEmit --pretty false --noErrorTruncation`。

验收标准：

- `bench-live:lane:source-core` green；
- 新增动态网页/Shadow DOM/iframe live scenarios；
- 用户可见失败率 < 2%；
- 翻译完成后 layout shift 可接受，无大面积闪烁。

### P1.3 网页翻译质量体验

Read Frog 有 AI smart context，但用户需要配置。Astra 应该自动做：

- [x] 页面摘要只生成一次；
- [x] 对短句/标题使用快速路径；
- [x] 对长段/术语密集内容使用高质量路径；
- [x] 自动 glossary：页面标题、站点名、重复术语、用户保存词汇；
- [x] 一致性记忆：同一页面相同术语一致翻译；
- [x] `Best quality` 模式自动开启更强上下文；
- [x] `Fast` 模式减少上下文，只保证可读速度。

验收标准：

- 同一页面关键术语一致；
- 用户不需要配置 prompt；
- 翻译速度与质量有清晰档位，但不暴露模型。

### P1.4 选择/hover/上下文菜单补齐

Read Frog 的触发面很多，Astra 需要达到同级但更简单：

- [x] 选中文本 toolbar：Translate / Explain / Save / Speak；
- [x] Hover 翻译：默认 Alt + Hover，避免打扰；
- [x] 右键菜单：Translate page / Explain selection / Save selection；
- [x] 快捷键：Translate page / toggle original；
- [x] 对新手默认隐藏高级触发说明，只在 Tips 或 Settings 中展示。

验收标准：

- 触发入口不少于 Read Frog，但普通用户首屏只看到最必要的；
- selection toolbar 与 FloatBall 不冲突；
- 输入框/可编辑区域不会误触。

状态（2026-05-27 追加）：[x] 选择/右键保存到 Review 已补 live proof。新增 `bench-live/selection-save-review-loop`，在真实 extension-loaded 浏览器里发送与右键 `Save selection to Astra Review` 相同的 `content/save-selection` 命令，验证 `astra.vocabulary.v1` 写入、`sourceContext.surface=selection_toolbar`、页面标题/选中文本保留，并打开 `vocabulary.html?tab=review&entryId=...` 证明 Review 能显示该卡片。该场景已加入 required `bench:live:lane:learning-loop`，并由 `script/bench-live/index.test.ts` 保护 lane wiring。

验证：

- `pnpm build` — EXIT 0；
- `pnpm bench:live -- --scenario bench-live/selection-save-review-loop` — pass / score 100（run `live-20260527T221358-w5y8b7`）；
- `pnpm exec vitest run script/bench-live/index.test.ts` — 5 passed；
- `pnpm type-check` — EXIT 0。

---

## Phase 2 — YouTube 超过 Read Frog（2–4 周）

目标：不只是“也能翻译 YouTube 字幕”，而是做出明显更适合付费用户的视频学习体验。

### P2.1 YouTube 播放器内 Astra 按钮

对标 Read Frog 的 player controls button，Astra 必须有：

- [x] YouTube player 控制栏 Astra icon；
- [x] 状态 badge：Off / Translating / On / Retry；
- [x] 一键开启双语字幕；
- [x] 一键关闭并恢复原生字幕；
- [x] 全屏模式下仍可用；
- [x] theater mode / mini player / embed 下位置正确；
- [x] YouTube SPA 导航后自动重新初始化。

体验原则：

- [x] 用户不应该先去 Options 开启；
- [x] 第一次进入 YouTube 时可以显示轻量提示：`Translate subtitles with Astra`；
- [x] 不强行打扰，只给一键入口。

验收标准：

- [x] YouTube watch page 可见 Astra 按钮；
- [x] embed 播放器可用；
- [x] fullscreen 可用；
- [x] SPA 切换视频后按钮不丢失、不重复。

### P2.2 字幕翻译引擎增强

必须达到 Read Frog 同级：

- [x] 当前 track 优先：除默认 heuristic 外，会读取 YouTube player 菜单中 `aria-checked`/`aria-selected` 的 caption menu item，匹配实际选中的 caption track。
- [x] human captions 优先于 ASR；
- [x] ASR fallback；
- [x] caption track change 监听；
- [x] seek 后继续 look-ahead / 复用已预取 cues；
- [x] batch/look-ahead 翻译；
- [x] 原文/译文/双语三模式；
- [x] 字幕位置、字号、背景透明度；
- [x] 翻译失败显示原文 + player control `Retry`，不阻塞播放。

必须超过 Read Frog：

- [x] 自动根据播放速度/网络/字幕密度调整 look-ahead；
- [x] serviceMode 决定字幕策略：
  - [x] Fast：更大 batch，更少上下文；
  - [x] Balanced：默认；
  - [x] Best quality：sentence-window 分组 + 视频上下文；
- [x] 翻译缓存按 videoId + targetLang + serviceMode + captionTrack hash；
- [x] 长视频按章节/时间窗口缓存，避免重复花费；
- [x] 错误自动降级，不让用户看到技术错误；
- [x] batch 翻译失败或返回条数不足时，先按 cue 单独 retry，只有逐句 retry 仍失败才进入 player control `Retry`。

本轮验证：`pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts`（66 passed）和 `pnpm type-check` 均通过。2026-05-27 追加：`pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts --testNamePattern "selected YouTube caption track|authored YouTube tracks|per cue|subtitle batch|transcript copy"`（6 passed / 62 skipped）覆盖实际选中 caption track、human-vs-ASR heuristic、per-cue retry、batch failure Retry、transcript export 下载；`pnpm type-check`（EXIT:0）。

### P2.3 Transcript Panel：超过 Read Frog 的关键

Read Frog 没有完整 transcript panel。Astra 必须做。

功能：

- [x] 右侧或下方 Astra Transcript panel；
- [x] 当前播放句自动高亮；
- [x] 点击句子跳转时间；
- [x] 搜索 transcript；
- [x] bilingual transcript；
- [x] `Copy sentence`；
- [x] `Explain sentence`；
- [x] `Save sentence`；
- [x] `Add word to review`；
- [x] `Open in Deep Read`；
- [x] `Export bilingual transcript`：生成 `.txt` 下载，同时复制到剪贴板作为 fallback/convenience；
- [x] `Export SRT`：按 YouTube cue timestamp 生成 bilingual `.srt` 下载，同时复制到剪贴板作为 fallback/convenience；
- [x] `Export learning notes`：生成 `.txt` 下载，同时复制到剪贴板作为 fallback/convenience。

默认布局：

- [x] 普通 YouTube 页面：右侧 panel，类似聊天/笔记侧栏；
- [x] 小窗口/窄屏：折叠为底部 drawer；
- [x] 全屏：半透明 mini transcript，只显示当前句和前后句。

验收标准：

- [x] 用户能从视频字幕直接进入学习闭环；
- [x] 点击 transcript 行跳转误差 < 500ms；
- [x] 搜索结果可跳转；
- [x] 保存句子后 Review 可找到。

本轮验证：`pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts`（64 passed）和 `pnpm type-check` 均通过。2026-05-27 追加：`pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts --testNamePattern "transcript copy|searchable bilingual YouTube transcript panel"`（2 passed / 64 skipped）覆盖 transcript export 下载 + clipboard 双路径，`pnpm type-check`（EXIT:0）。2026-05-27 再追加：YouTube Transcript panel 新增 `Export SRT`，测试 `pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts --testNamePattern "transcript copy|export actions"`（1 passed / 67 skipped）验证 `.srt` timestamp、原文+译文和 clipboard/download 双路径，`pnpm type-check`（EXIT:0）。2026-05-27 再追加：`Open in Deep Read` 不再只打开空页面，会先把当前 YouTube transcript 保存为 Deep Read session（含 bilingual lines / summary / video URL），再以 `pageUrl` 打开 Deep Read；验证 `pnpm exec vitest run src/entrypoints/content/video-platforms/transcript-panel.test.ts src/entrypoints/content/video-platforms/index.test.ts src/entrypoints/content/video-platforms/video-platforms.test.ts src/entrypoints/deep-read/DeepReadApp.test.tsx` — 4 files / 77 tests passed；`pnpm type-check` — EXIT 0。

### P2.4 Video Summary + Chapter Learning

Read Frog 已有内部 summary 但不展示。Astra 应该产品化：

- [x] 自动生成用户可见视频摘要；
- [x] 按章节/时间段总结；
- [x] 提取关键词；
- [x] 生成“本视频值得掌握的 10 个表达”；
- [x] 生成 quiz；
- [x] 生成复习卡片；
- [x] 支持 `Explain current segment`。

UI：

- [x] `Summary` tab；
- [x] `Transcript` tab；
- [x] `Words` tab；
- [x] `Notes` tab；
- [x] `Review` CTA。

验收标准：

- [x] 15 分钟视频可在 30–60 秒内给出初版 summary；
- [x] 用户可保存 summary 到 video note；
- [x] 至少 3 个重点句/词可进入 Review。

本轮验证：`pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts`（65 passed）和 `pnpm type-check` 均通过。

### P2.5 逐词/逐句交互

Read Frog 字幕文本基本不可交互。Astra 要补齐：

- [x] 点击字幕词：mini dictionary；
- [x] hover 字幕词：简短释义；
- [x] 选中字幕句：Explain / Save / Speak；
- [x] 对学习语言支持：
  - [x] English：音标/词性/例句；
  - [x] Japanese：假名/词形；
  - [x] Chinese：拼音；
  - [x] Korean：罗马音可选；
- [x] 保存词自动带视频上下文、时间戳、原句。

验收标准：

- [x] 字幕词保存后 Review 卡片能回到对应视频时间点；
- [x] 用户能从“看视频”自然进入“复习”。

本轮验证：`pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts`（65 passed）和 `pnpm type-check` 均通过。

### P2.6 Video Notes 打通

现有 `video-note` 能力要成为 YouTube 竞争优势：

- [x] 当前 YouTube tab 检测后 Popup/FloatBall/Player panel 均显示 `Create video note`；
- [x] Video note 包含：
  - [x] video metadata；
  - [x] transcript；
  - [x] bilingual transcript；
  - [x] summary；
  - [x] saved sentences；
  - [x] saved words；
  - [x] watch progress；
  - [x] review status；
- [x] Web companion 可打开 video note；
- [x] Review 完成后可回跳视频时间点。

超过 Read Frog 的点：

- Read Frog 只翻字幕；Astra 把视频变成可持续学习资产。

本轮验证：

- `pnpm exec vitest run src/entrypoints/content/components/FloatBall.test.ts`（26 passed）；
- `pnpm exec vitest run src/entrypoints/popup/App.test.tsx`（67 passed）；
- `pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts src/server/index.test.ts --testNamePattern "video-note|video summary|transcript panel|word"`（9 passed / 89 skipped）；
- `pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts src/entrypoints/vocabulary/ReviewMode.test.tsx --testNamePattern "transcript copy|focused video|video review|timestamp"`（2 passed / 72 skipped）；
- `pnpm type-check`（EXIT:0）。

### P2.7 YouTube live proof 与声明边界

必须谨慎：

- [x] 可以强声明：YouTube bilingual subtitles；
- [x] 可以强声明：YouTube transcript learning workspace（完成后）；
- [x] Bilibili 可作为 beta；
- [x] Netflix/Prime/Disney/Udemy/Coursera 不应在未完成 proof 前强声明。

需要新增 live/bench：

- [x] `bench-live/youtube-subtitle-player-button`；
- [x] `bench-live/youtube-subtitle-in-player-settings`；
- [x] `bench-live/youtube-subtitle-basic-bilingual`；
- [x] `bench-live/youtube-subtitle-seek-recovery`；
- [x] `bench-live/youtube-subtitle-track-switch`；
- [x] `bench-live/youtube-transcript-panel`；
- [x] `bench-live/youtube-transcript-search-jump`；
- [x] `bench-live/youtube-save-sentence-review-loop`；
- [x] `bench-live/youtube-video-note-create`；
- [x] holdout：字幕 race、SPA navigation、no captions、ASR-only、long video、fullscreen。
  - 已有 browser-backed `bench-live/holdout/youtube-subtitle-race`、`bench-live/holdout/youtube-no-captions`、`bench-live/holdout/youtube-asr-only`、`bench-live/holdout/youtube-long-video`、`bench-live/holdout/youtube-fullscreen`、`bench-live/holdout/youtube-spa-navigation`；本轮新增 P2.7 YouTube proof lane覆盖 player button、in-player settings（mode/size/background/position/retry/restore native captions）、basic bilingual、seek recovery、track switch、transcript panel、transcript search/jump、save sentence review loop、video note create。YouTube 无 caption track 且无 DOM 字幕时现在进入 `no-captions` 状态，显示 `No captions available for this video.`，并证明无 loading/translation 残留，避免普通用户看到泛化 Retry。
  - 2026-05-27 追加 release gate：`.github/workflows/ci.yml` 的 `live-browser` job 现在把 `pnpm bench:live:lane:youtube-proof` 与 `pnpm bench:live:lane:youtube-holdout` 都作为 required lane（同 source-core / extension-core / learning-loop 一样最多重试 2 次）；`.github/workflows/bench-live.yml` 手动 lane 新增 `youtube-holdout`；`package.json` 新增 `bench:live:lane:youtube-holdout`，显式跑字幕 race + no captions / ASR-only / long video / fullscreen / YouTube SPA holdout IDs，当前 6/6 browser-backed holdouts green。

本轮验证：

- `pnpm exec vitest run script/bench-live/index.test.ts script/bench-live/evaluator.test.ts`（7 passed；2026-05-27 追加 package-level YouTube proof/holdout lane ID guard）；
- `pnpm bench:live -- --list | grep -E 'youtube-subtitle-player-button|youtube-subtitle-in-player-settings|youtube-subtitle-basic-bilingual|youtube-subtitle-seek-recovery|youtube-subtitle-track-switch|youtube-transcript-panel|youtube-transcript-search-jump|youtube-save-sentence-review-loop|youtube-video-note-create'`（9 个 YouTube proof ID 均列出）；
- `pnpm bench:live -- --scenario bench-live/youtube-transcript-search-jump`（pass / score 100，run `live-20260527T222240-tgbi2b`；验证 transcript search result + timestamp jump Δ≤500ms）；
- `pnpm bench:live -- --scenario bench-live/holdout/youtube-no-captions`（pass / score 100，run `live-20260527T225228-iwtg22`；`noticeVisible=true`、copy 为 `No captions available for this video.`、`translationNodeCount=0`、`loadingNodeCount=0`、`captionSegmentCount=0`）；
- `pnpm bench:live:lane:youtube-holdout`（6/6 pass，runs `live-20260527T225930-rv6w17`、`live-20260527T225932-4550fd`、`live-20260527T225934-b0idme`、`live-20260527T225935-ym1gfe`、`live-20260527T225937-mzbyby`、`live-20260527T225939-8alivd`；覆盖 race、no captions、ASR-only、long-video window cache、fullscreen、SPA no-duplicate/stale-row）。
- `pnpm bench:live:lane:youtube-proof`（9/9 pass，runs `live-20260527T231556-o36gp8`、`live-20260527T231558-0ydg6g`、`live-20260527T231600-tclyap`、`live-20260527T231602-pb1t61`、`live-20260527T231603-2wxz1i`、`live-20260527T231605-bim55n`、`live-20260527T231607-tqhm30`、`live-20260527T231609-d0z5pe`、`live-20260527T231610-fyshwg`；新增 settings proof 信号 `translation-only`、`larger`、`top`、`mask`、retry、restore native captions 均为 true）；
- `pnpm type-check`（EXIT:0）。

声明边界同步：`docs/investigations/support-matrix-video-addendum-2026-04-15.md` 已更新为 2026-05-27 P2.7 evidence / claim boundary；2026-05-27 追加对齐 subtitle-file reader 状态为 `Controlled supported file-reader surface`，保持与 `support-matrix-2026-q2.md` 一致但仍明确它不是 in-page video adapter parity 证据。

补充（2026-05-27）：`bench:live:lane:release-proof` 现在是完整 release live gate，聚合 `source-core`、`extension-core`、`learning-loop`、`document-proof`、`youtube-proof`、`youtube-holdout`；`.github/workflows/bench-live.yml` 默认 lane 因此与 CI required live gate 语义一致。`AGENTS.md` 与 `docs/bench-harness.md` 已同步该合同。旧 `docs/capability-matrix.md` 已降级为 legacy redirect，避免与 `capability-matrix-v2` / support matrix 的当前证据冲突。

---

## Phase 3 — 商业会员体验（并行，1–3 周）

目标：让用户感觉 Astra 是高级付费产品，而不是需要自己配置的开源工具。

### P3.1 会员状态与错误文案

所有 AI 不可用情况统一为：

- `Sign in to use Astra AI`；
- `Your membership is active. Astra is reconnecting.`；
- `Astra is temporarily busy. Retry in a moment.`；
- `This page is protected. Try selection translation or Deep Read.`

禁止普通用户看到：

- provider request failed；
- model unavailable；
- relay unavailable；
- API key missing；
- token limit；
- upstream provider。

技术错误只能进入 diagnostics / logs。

状态（2026-05-27）：[x] 完成。新增 `getSafeAiUnavailableCopy` 作为统一文案边界，并接入 Page Translation、FloatBall、Popup status/study actions、Selection Toolbar、Input Translate、Deep Read、Image Translate、Subtitle Reader 与 OCR helper；inline paragraph title/aria 也会二次清洗，原始错误仅通过 diagnostics/logs 保留。

验证：

- `pnpm exec vitest run src/utils/copy-dictionary.test.ts src/entrypoints/content/page-translate.test.ts src/entrypoints/content/inline-actions.test.ts src/entrypoints/content/components/FloatBall.test.ts src/entrypoints/popup/components/TranslationStatusCard.test.tsx` — 5 files / 71 tests passed。
- `pnpm exec vitest run src/entrypoints/popup/App.test.tsx src/entrypoints/deep-read/DeepReadApp.test.tsx src/entrypoints/image-translate/ImageTranslateApp.test.tsx src/entrypoints/subtitle-reader/SubtitleReaderApp.test.tsx src/entrypoints/content/components/SelectionToolbar.test.tsx` — 5 files / 107 tests passed。
- `pnpm type-check` — EXIT 0。

### P3.2 自动模型调度策略

`serviceMode` 后台映射建议：

| 用户选择 | 后台策略 | 适用场景 |
|---|---|---|
| Automatic | 动态选择速度/质量 | 默认全部用户 |
| Fast | 快速低延迟、小上下文、大 batch | 普通网页、短字幕 |
| Balanced | 稳定质量、适中上下文 | 默认阅读 |
| Best quality | 强模型/更长上下文/术语一致性 | 学术文章、法律、技术、视频笔记 |

调度信号：

- 页面长度；
- 段落平均长度；
- 字幕密度；
- 用户网络延迟；
- 上游失败率；
- 用户会员等级；
- 是否 Deep Read / Review / Video Note；
- 是否开启 privacy mode。

状态（2026-05-27）：[x] 完成首版。新增共享 `service-mode-scheduler`，把 `automatic/balanced` 从纯配置值升级为可执行调度：短 batch / 字幕密集走 `fast`，中等阅读走 `balanced`，长内容 / 术语表 / learner-facing explain/custom 走 `best_quality`，privacy mode 下的非短 automatic 走 `balanced`。Background 翻译、cache context、usage telemetry 均使用调度后的 serviceMode；Relay 侧在执行前再次解析 managed request，并按 serviceMode 选择托管模型（OpenAI fast=`gpt-4.1-nano`、balanced=`gpt-4.1-mini`、best 保留强模型；Gemini fast=`gemini-3.1-flash-lite-preview`、balanced=`gemini-3.0-flash`、best 保留请求强模型）。Server usage/failure metadata 记录调度后的 model/serviceMode。

验证：

- `pnpm exec vitest run src/utils/service-mode-scheduler.test.ts src/server/providers.test.ts src/entrypoints/background/index.test.ts src/server/index.test.ts` — 4 files / 79 tests passed。
- `pnpm exec vitest run src/platform/cloudflare/src/lib/proxy.test.ts src/platform/cloudflare/src/handlers/auth-session.test.ts src/platform/cloudflare/src/handlers/account-summary.test.ts` — 3 files / 25 tests passed。
- `pnpm type-check` — EXIT 0。

补充（2026-05-27）：Operator `cost/usage-summary` 现在额外输出 `byServiceMode` 聚合，按 `Automatic/Fast/Balanced/Best quality` 统计 event/request/character、success/failure、fallback/retry proxy，并基于 server `durationMs` 样本给出 latency P50/P95，补齐托管服务按服务风格调优的发布指标。

补充（2026-05-27）：Cloudflare/platform parity proof 已补强：proxy 测试覆盖 `/v1/translate` body 原样转发 `serviceMode`；native D1 `auth/session` 与 `account/summary` 测试覆盖 mirrored `recentEvents` 中 `serviceMode/model/taskClass/costBucket/providerRoute/fallbackUsed/success/durationMs` 的 roundtrip，且不包含源文本。

后续可继续增强：引入跨请求滚动 provider health / latency score，把“用户网络延迟、上游失败率”从 telemetry-only 推进到长期自适应调度。

### P3.3 成本与配额体验

普通用户不看 token，但可以看：

- `Daily reading included`；
- `Heavy video analysis may take longer`；
- `Upgrade for longer videos / more pages`；
- `Astra saved this translation for faster reuse`。

内部要有：

- 请求去重；
- 页面/字幕缓存；
- translation memory；
- failure fallback；
- suspicious abuse throttling。

状态（2026-05-27）：[x] 完成首版。Popup 配额与使用洞察已从 token/cost 心智改为会员友好的 reading-included 心智：每日额度显示为 approximate words，使用洞察显示 `Reading work` / `Included` / `Words`，缓存诊断改为 `Saved translations` / reuse rate / saved-reuse copy，并移除普通用户可见的估算成本展示。

已确认现有内部护栏覆盖 P3.3 的核心要求：Hover 翻译对同一元素 pending 请求去重并带失败 cooldown；后台翻译使用 `translation-cache` / `translation-cache-context` 做页面级缓存；页面翻译 session 内维护 translation memory；provider router 已实现 direct → relay fallback 与 fallback reason；Relay user store / anonymous bootstrap 具备 daily quota、per-minute limit 与注册限流。

验证：

- `pnpm exec vitest run src/entrypoints/popup/App.test.tsx` — 1 file / 67 tests passed。
- `pnpm type-check` — EXIT 0。

### P3.4 Immersive-style 文档入口与支持边界

原始整改文档还要求补齐 Immersive Translate 的高频“文件/文档也能读”心智，但不夸大 OCR、Docx、漫画、100+ 视频平台等未 proof 的能力。

状态（2026-05-27）：[x] 完成首版。Popup 首屏 Reading card 新增 `Open file` 轻入口，副标题明确 `PDF · EPUB · Subtitle`，直接打开 `document-intake.html`；诊断区仍保留 Document Intake Hub 详细说明，强调 PDF/EPUB/SRT/VTT route 到已有 reader、短时本地 handoff、文件 bytes 不同步。Web companion 与 README 已保留导入/reader surfaces 和支持边界文案，不把 PDF OCR、Docx 排版、Netflix/Prime/Disney 或 100+ 平台作为 launch claim。

补充（2026-05-27）：README 对外能力文案已从 “Provider routing / direct→relay fallback” 收敛为 “Astra-managed AI access”；隐私边界改写为“翻译/解释内容会离开设备”，self-hosted/backend URL 仅作为开发者/运营信任边界，不再把 provider routing 当普通用户卖点。

补充（2026-05-27）：新增 `bench:live:lane:document-proof` 并接入 CI required live lane，覆盖 Document Intake PDF+EPUB+VTT 与 unsupported-format boundary、local-file handoff、PDF reader、EPUB reader、subtitle-file reader。2026-05-27 追加修复 stale proof 文案：`document-intake-basic` / `document-intake-local-file-handoff` 现在断言当前 UI 的 `Open a reading file` 与 `Local file handoff:`，并处理 ready card 出现后两个 `Open reading queue` 按钮导致的 Playwright strict-mode ambiguity；`document-intake-basic` 进一步使用等待式 reader-tab 断言，避免 `browser.tabs.create` materialization timing 误报。

补充（2026-05-27）：同步对外证据边界文档与普通文案。`docs/investigations/support-matrix-2026-q2.md` 与 `docs/capability-matrix-v2.md` 已更新到 2026-05-27 evidence，引用 `bench:live:lane:document-proof` / `bench:live:lane:youtube-proof`，并继续限制 PDF OCR、Docx 排版、漫画/图片、100+ 视频平台、Netflix/Prime/Disney 等未证明 claim。`README.md` Quick Start 将本地 relay 标成 Developer/operator only，路线图把 PDF/EPUB/subtitle-file/YouTube 学习工作台改为 proof-backed surfaces。`public/_locales/en/messages.json` 与 `public/_locales/zh_CN/messages.json` 的普通/诊断标签已从 provider/API/model/relay/routing 改为 Astra service、reading activity、service routes 等用户可懂文案。

补充（2026-05-28）：补齐 store packet 的稳定文件名 artifact：`store/screenshots/01-page-translation.png`、`02-selection-toolbar.png`、`03-popup-control-center.png`、`04-options-settings.png`、`05-pdf-reader.png` 现在均为 1280x800 PNG。`store/screenshots/README.md` 记录每个文件的来源与 claim 边界；其中 `04-options-settings.png` 明确标为临时 derived artifact，正式商店提交前仍需替换成真实 Options/Settings 截图。项目 `README.md` Preview 改为引用根目录 launch-candidate artifacts，不再直接引用深层 parity capture 路径。

验证：

- `pnpm exec vitest run src/entrypoints/popup/App.test.tsx` — 1 file / 69 tests passed。
- `pnpm exec vitest run script/bench-live/index.test.ts` — 1 file / 5 tests passed。
- `pnpm bench:live -- --scenario bench-live/document-intake-basic` — pass / score 100，run `live-20260527T234812-q2eq98`（PDF+EPUB+VTT intake、unsupported DOCX boundary、reader handoff、Reading queue continuity）。
- `pnpm bench:live -- --scenario bench-live/document-intake-local-file-handoff` — pass / score 100，run `live-20260527T231807-i6yl6w`。
- `python3` JSON parse and message-value scan for `public/_locales/en/messages.json`, `public/_locales/zh_CN/messages.json`, `ios/AstraShell Extension/Resources/_locales/en/messages.json`, and `ios/AstraShell Extension/Resources/_locales/zh_CN/messages.json` — OK / 0 technical copy offenders。
- `python3` PIL dimension check for `store/screenshots/0*.png` — all five launch-candidate files are 1280x800 PNG。
- `pnpm type-check` — EXIT 0。

---

## Phase 4 — UI/审美超过 Read Frog（并行）

目标：用户一眼觉得 Astra 是更高级、更可信、更像 Amp 的产品。

### 4.1 视觉原则

- 低噪音；
- 高留白；
- 圆角卡片；
- 精致阴影；
- 少颜色但状态清晰；
- 文案短；
- 不堆设置；
- 默认 light theme；
- 使用 `--accent-primary`，不要继续新增 legacy accent alias。

### 4.2 核心界面升级

| 界面 | 改造方向 |
|---|---|
| FloatBall | 类 Amp command palette 的轻量操作中心 |
| Popup | 首页只做任务流，不做控制台 |
| Options | 从技术设置页变成账户/偏好/服务状态页 |
| YouTube Panel | 像一个优雅视频学习侧栏，不像字幕调试器 |
| Deep Read | 作为文章/视频学习的核心工作台 |
| Review | 明确告诉用户“今天复习这些就够了” |

状态（2026-05-27）：[x] 完成首版。已补上 FloatBall 关键交互回归保护：quick-action pointerdown 不再启动父级拖拽 pointer capture，服务风格快捷切换覆盖 `Automatic → Fast → Balanced`，避免用户在 FloatBall 中丢失 Balanced。已补上通用字幕 track 的 serviceMode 回归保护：同 targetLang 但不同 serviceMode 的 Astra track 会被视为 stale 并重新生成，避免 Fast/Best/Balanced 切换后沿用旧字幕。YouTube Transcript Panel 已从深色调试面板视觉改为 light/default、低噪音、高留白的学习侧栏，并用测试固定 light surface contract。

验证：

- `pnpm exec vitest run src/entrypoints/content/components/FloatBall.test.ts src/entrypoints/content/subtitle-translate.test.ts` — 2 files / 37 tests passed。
- `pnpm exec vitest run src/entrypoints/content/video-platforms/video-platforms.test.ts` — 1 file / 66 tests passed。
- `pnpm type-check` — EXIT 0。

---

## 7. 竞争矩阵：Astra 应该如何超过 Read Frog

| 维度 | Read Frog | Astra 目标 |
|---|---|---|
| 安装后可用 | 部分免费 provider 可用，AI 需配置 | 登录/会员后零配置可用 |
| Provider 设置 | 强展示 | 普通用户完全隐藏 |
| 网页翻译入口 | 很多，偏配置 | 同样多，但默认只露最简单入口 |
| 浮动按钮 | 主要 toggle | 页面内阅读控制中心 |
| 动态网页 | 强 | 必须同级并有 live proof |
| YouTube 字幕 | 强 | 同级字幕 + transcript + notes + review |
| Transcript | 无完整产品化 | 必须成为核心功能 |
| 视频摘要 | 内部使用，不展示 | 用户可见、可保存、可复习 |
| 逐词学习 | 弱/无 | 字幕/网页词句都可保存复习 |
| 学习闭环 | 弱 | Astra 核心差异化 |
| UI 审美 | 开源工具感 | 高级、轻、可信、Amp 风格 |
| 商业服务 | 开源自配 | 托管会员服务 |

---

## 8. 优先级总表

### P0 必做

1. 完成 provider/API/model 普通 UI 隐藏；
2. `serviceMode` 贯通后台调度；
3. Popup 首页继续压缩；
4. FloatBall 状态与站点动作打磨；
5. 网页翻译动态 DOM/SPA/iframe/Shadow DOM 证明矩阵；
6. YouTube player button；
7. YouTube 双语字幕基础稳定；
8. YouTube transcript panel MVP；
9. YouTube 保存句子到 Review；
10. 对应 live bench。

### P1 强烈建议

1. 视频摘要 + chapter notes；
2. 字幕逐词点击释义；
3. bilingual transcript export；
4. video note 与 Web companion 打通；
5. page translation 自动术语一致性；
6. selection toolbar 与 Deep Read/Review 深度打通。

### P2 可延后

1. Bilibili 从 beta 升级到 supported；
2. Coursera/Udemy/TED adapters；
3. Anki export；
4. Team/classroom plan；
5. Mobile/Safari 深度体验。

---

## 9. 具体工程任务拆分

### 9.1 网页翻译工程包

涉及路径：

- `src/entrypoints/content/page-translate.ts`；
- `src/entrypoints/content/index.tsx`；
- `src/entrypoints/content/components/FloatBall.tsx`；
- `src/entrypoints/content/components/SelectionToolbar.tsx`；
- `src/entrypoints/popup/App.tsx`；
- `src/types/config.ts`；
- `src/utils/storage/config.ts`；
- `script/bench-live/scenarios/*`。

任务：

- 增强 FloatBall 拖拽/吸边/状态；
- 增加 per-page reading mode 快捷切换；
- 增加 section-only translation；
- 增加 dynamic DOM live scenarios；
- 增加 iframe/shadow DOM scenarios；
- 增加 title translation 如确认为缺口；
- 建立 page translation quality snapshot。

### 9.2 YouTube 工程包

涉及路径：

- `src/entrypoints/content/video-platforms/youtube.ts`；
- `src/entrypoints/content/video-platforms/youtube-subtitles.ts`；
- `src/entrypoints/content/video-platforms/index.ts`；
- `src/entrypoints/content/subtitle-translate.ts`；
- `src/entrypoints/content/components/*`；
- `src/types/video-notes.ts`；
- `src/utils/astra/video-notes.ts`；
- `src/entrypoints/popup/App.tsx`；
- `src/entrypoints/deep-read/DeepReadApp.tsx`；
- `src/entrypoints/vocabulary/*`；
- `script/bench-live/scenarios/*youtube*`。

任务：

- Player button 注入；
- Subtitle overlay UI；
- Transcript panel；
- transcript search/jump；
- summary/chapter；
- save sentence/word；
- video note creation；
- review return-to-timestamp；
- YouTube live proof。

### 9.3 Relay/调度工程包

涉及路径：

- `src/server/`；
- `src/utils/providers/router.ts`；
- `src/utils/translate/*`；
- `src/types/config.ts`；
- `src/platform/cloudflare/src/*`。

任务：

- 请求携带 `serviceMode`；
- 后台模型策略配置；
- 失败自动切换；
- 成本/质量 telemetry；
- 字幕/页面缓存 key 加上 serviceMode；
- 后台可热切换模型，不需要客户端发布。

---

## 10. 验收指标

### 10.1 网页翻译指标

- 首次翻译启动时间：P50 < 1.5s；P95 < 4s；
- 首屏可读翻译出现：P50 < 3s；P95 < 8s；
- 动态内容漏翻率：< 3%；
- 重复翻译/错位率：< 1%；
- 用户可见失败：< 2%；
- layout 破坏严重问题：0 个 release blocker；
- live bench green。

### 10.2 YouTube 指标

- Astra player button 出现：P95 < 2s；
- 双语字幕首句翻译：P50 < 2s；P95 < 6s；
- seek 后恢复：< 1s；
- transcript 行跳转误差：< 500ms；
- 10 分钟视频 transcript 初步可用：< 20s；
- 保存句子到 Review 成功率：> 99%；
- no-captions 状态用户可懂；
- live bench green。

### 10.3 商业体验指标

- 新用户安装到首次网页翻译：< 60s；
- 新用户安装到首次 YouTube 字幕：< 90s；
- 普通用户 UI 中 provider/API/model 暴露次数：0；
- 登录后无需配置即可完成核心路径；
- 失败文案中技术术语暴露：0。

---

## 11. 发布顺序建议

### Release A：零配置网页翻译完成版

范围：

- Popup/Options 去技术化完成；
- FloatBall 控制中心完成；
- serviceMode 保存与后台透传；
- 网页翻译稳定性 proof；
- 站点 Auto/Hide 完成。

对外宣传：

> “Install, sign in, and read. Astra handles the AI automatically.”

### Release B：YouTube 双语字幕 MVP

范围：

- YouTube player button；
- 双语字幕；
- 字幕模式/大小/位置；
- seek/track switch/SPA 稳定；
- no-captions fallback；
- live proof。

对外宣传：

> “Watch YouTube with bilingual subtitles — no API setup.”

### Release C：YouTube Learning Workspace

范围：

- Transcript panel；
- video summary；
- save sentence/word；
- video note；
- review handoff；
- bilingual transcript export。

对外宣传：

> “Turn YouTube videos into reviewable language lessons.”

### Release D：质量与平台扩展

范围：

- Bilibili supported；
- TED/Coursera/Udemy beta；
- stronger glossary/translation memory；
- better privacy evidence；
- SRS/video learning analytics。

---

## 12. 风险与反风险策略

### 风险 1：YouTube DOM/播放器结构变化

策略：

- adapter 层隔离；
- 多 selector fallback；
- live smoke 定期跑；
- no button/no captions 都给用户可懂 fallback；
- 不把 YouTube internal 依赖散落在 UI 层。

### 风险 2：字幕翻译延迟影响观看

策略：

- look-ahead；
- cache；
- Fast mode；
- 未翻译时先显示原文；
- 避免 spinner 挡字幕。

### 风险 3：模型成本过高

策略：

- serviceMode 调度；
- 页面/字幕缓存；
- 长视频章节化；
- 先快速翻译，后后台高质量修正；
- 会员等级限制 video summary 长度。

### 风险 4：功能太多导致 UI 复杂

策略：

- 默认只露主路径；
- 高级功能折叠；
- YouTube panel 分 tab；
- Options 不做工程控制台；
- 用户任务优先：读、看、保存、复习。

---

## 13. 最终判断

如果 Astra 只补齐 Read Frog 的网页翻译和 YouTube 字幕，那么最多是“同类产品”。

要让用户愿意付费，Astra 必须在以下三点明显超过：

1. **省心**：无需 provider/API/model 配置；
2. **完整**：网页 + YouTube + Deep Read + Vocabulary + Review 是一条闭环；
3. **高级**：UI、文案、错误处理、自动调度都像成熟会员服务，而不是开源设置面板。

真正的胜负手是 YouTube：

> Read Frog 做 YouTube 字幕翻译；Astra 要做 YouTube 语言学习工作台。

只要 Release A/B/C 按顺序完成，Astra 在普通用户可用性、付费价值、学习闭环上就会明显超过 Read Frog。
