# Astra 追赶 + 超越计划

## 战略判断

Astra 当前 Phase 1 核心翻译功能已稳定（bench 20/20 at 100, 319 tests passing），但与 Immersive Translate 和 Read Frog 相比存在 **功能面差距**。

**核心定位差异：**
- Immersive Translate = 翻译工具（做大做全）
- Read Frog = 学习助手（AI 解释 + 词汇积累）
- **Astra = 翻译入口 → 学习系统**（先赢工具场景，再建学习闭环）

**优先级逻辑：** 先补齐用户每天都会碰到的功能缺失（YouTube 字幕、错误恢复、快捷键），再补扩展功能（PDF、ePub），最后建差异化优势（词汇系统、学习闭环）。

---

## Sprint 1: 日常使用基础补齐 (预计 2-3 天)

### S1.1 — YouTube 字幕双语翻译 ⭐ 最高优先

**为什么：** 这是 Immersive 的杀手级功能，也是用户流失的第一原因。

**实现方案（参考 Read Frog 的 interceptor.content 架构）：**

Read Frog 的做法（开源可参考）：
- `src/entrypoints/interceptor.content/inject-player-api.ts` — 注入脚本拦截 YouTube player API
- `src/entrypoints/interceptor.content/timedtext-observer.ts` — 监听 YouTube 的 timedtext DOM 变化
- `src/entrypoints/interceptor.content/utils.ts` — 工具函数

**Astra 实现路径：**

```
src/entrypoints/content/youtube-subtitle.ts   — YouTube 字幕检测 + 翻译注入
src/entrypoints/content/video-platforms.ts     — 平台适配层（YouTube/Bilibili/Netflix）
```

**技术要点：**
1. **YouTube 字幕获取方式：**
   - 方法 A（推荐）：MutationObserver 监听 `.ytp-caption-segment` DOM 节点变化
   - 方法 B：拦截 YouTube 的 timedtext API (`/api/timedtext?...`) 获取完整字幕数据
   - 方法 C：监听 `window.ytInitialPlayerResponse` 获取字幕 track 列表

2. **双语显示注入：**
   - 在原字幕 DOM 下方插入翻译行
   - 使用 CSS `position: relative` 保持布局不跳动
   - 跟随原字幕的显示/隐藏切换

3. **翻译策略：**
   - 预加载整个字幕文件，批量翻译（减少 API 调用）
   - 按时间窗口分批（每 20 条 cue 一批）
   - 缓存翻译结果，seek 回退时直接复用

**关键文件：**
- 新建 `src/entrypoints/content/youtube-subtitle.ts`
- 修改 `src/entrypoints/content/index.tsx` — 检测 YouTube 页面时启动字幕翻译
- 修改 `wxt.config.ts` — 添加 YouTube content script 注入规则

**验收标准：**
- 打开 YouTube 视频，开启字幕后，翻译字幕显示在原字幕下方
- 暂停/seek/切换视频时字幕正确同步
- 新增 bench 场景验证

---

### S1.2 — Gemini 直连 provider

**为什么：** 用户说 "有 chatgpt 和 gemini 就够了"，但 Gemini 目前只有 relay 模式。

**实现方案：**

```typescript
// src/utils/providers/gemini.ts — 新建
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"
// 复用 openai.ts 的 buildTranslationPrompt + parseTranslationsResponse
```

**关键文件：**
- 新建 `src/utils/providers/gemini.ts`
- 修改 `src/utils/providers/router.ts` — 添加 Gemini 直连路由
- 修改 `src/types/config.ts` — 添加 Gemini API key 配置字段
- 修改 `src/entrypoints/popup/App.tsx` — Gemini API key 输入 UI

**验收标准：**
- 用户输入 Gemini API key 后可以直连翻译
- 不依赖 Astra relay
- 新增 provider test 覆盖

---

### S1.3 — 错误恢复 + 重试机制

**为什么：** 当前 page translation 遇到第一个错误就停止，Immersive 可以 "重试所有失败段落"。

**实现方案：**

1. **Page Translation 单批重试：**
   - 修改 `page-translate.ts` drain loop：失败的 block 重新入队（最多重试 2 次）
   - 超过重试次数的 block 标记为 `failed` 并跳过，继续翻译其他 block
   - 不再 fail-fast 停止整个 session

2. **FloatBall "重试失败" 按钮：**
   - 当存在 failed blocks 时，FloatBall 显示 "重试" 按钮
   - 点击后将所有 failed blocks 重新入队

3. **Provider fallback（可选）：**
   - 如果配置了多个 provider，第一个失败后尝试第二个

**关键文件：**
- `src/entrypoints/content/page-translate.ts` — 添加重试逻辑
- `src/entrypoints/content/page-translate-registry.ts` — 添加 `retryCount` 到 block state
- `src/entrypoints/content/components/FloatBall.tsx` — 重试按钮 UI

---

### S1.4 — 快捷键系统

**为什么：** 只有 Alt+A，与 Immersive 的 Alt+A / Alt+W / Shift+Hover / Space×3 差距大。

**实现方案：**

```typescript
// src/types/config.ts — 添加快捷键配置
shortcuts: {
  toggleTranslation: "Alt+A",      // 已有
  translatePage: "Alt+W",          // 新增：翻译整页
  toggleArticleMode: "Alt+R",      // 新增：切换文章模式
  toggleHoverMode: "Alt+H",        // 新增：切换悬停模式
}
```

**实现路径：**
- 修改 `src/entrypoints/background/index.ts` — 注册更多 commands
- 修改 `wxt.config.ts` — 在 manifest.commands 中声明
- 新建 `src/utils/shortcuts.ts` — 快捷键处理统一入口

---

## Sprint 2: 视频平台扩展 + 站点适配 (预计 2-3 天)

### S2.1 — Bilibili / Netflix 字幕翻译

**Bilibili 实现：**
- 监听 `.bpx-player-subtitle-panel-text` DOM 变化
- 或拦截 `api.bilibili.com/x/player/v2/subtitle` API

**Netflix 实现：**
- 监听 `.player-timedtext-text-container` DOM 变化
- Netflix 使用 TTML 格式字幕，需要适配解析器

**架构：**
```
src/entrypoints/content/video-platforms/
  ├── types.ts           — 通用字幕平台接口
  ├── youtube.ts         — YouTube 适配器
  ├── bilibili.ts        — Bilibili 适配器
  ├── netflix.ts         — Netflix 适配器
  └── index.ts           — 平台检测 + 路由
```

### S2.2 — 站点适配规则系统增强

**参考 Immersive 的规则系统：**
- `selectorMatches` — CSS 选择器匹配
- `excludeSelectors` — 排除特定元素
- `translationRange` — 限定翻译范围
- 规则优先级：site rule > general rule > default

**Astra 实现：**
```typescript
// src/types/config.ts — 增强 SiteSettings
interface SiteRule {
  matches: string[]                    // URL pattern
  selectors?: string[]                 // 翻译范围限定
  excludeSelectors?: string[]          // 排除元素
  paragraphMinLength?: number          // 最小段落长度
  blockElements?: string[]             // 额外 block 元素
  inlineElements?: string[]            // 额外 inline 元素
}
```

### S2.3 — 右键菜单 "用 Astra 翻译"

**实现：**
- `browser.contextMenus.create()` 注册右键菜单项
- 选中文本 → 右键 → "Translate with Astra" → 弹出翻译结果
- 修改 `src/entrypoints/background/index.ts` 添加 contextMenus handler

---

## Sprint 3: PDF 翻译 + ePub 支持 (预计 3-4 天)

### S3.1 — PDF 双语翻译

**实现方案：**

Immersive 使用远程服务端处理 PDF，但 Astra 可以做 **纯客户端方案**：

1. **使用 pdf.js 解析 PDF：**
   - 提取文本 block 和位置信息
   - 保留原始 PDF 渲染层
   - 在文本层上方叠加翻译层

2. **架构：**
```
src/entrypoints/content/pdf-translate/
  ├── detector.ts        — 检测当前页面是否是 PDF
  ├── extractor.ts       — pdf.js 文本提取
  ├── renderer.ts        — 翻译结果渲染（覆盖层 or 侧栏）
  └── index.ts           — 入口
```

3. **渲染模式：**
   - 模式 A：在 PDF 文本旁显示翻译（类似 Immersive）
   - 模式 B：侧栏双语对照（更简单，先实现）

**依赖：** `pdfjs-dist` (PDF.js)

### S3.2 — ePub 阅读器

**实现方案：**
- 使用 `epubjs` 库解析 ePub 文件
- 在 extension popup 或新标签页中打开阅读器
- 复用 page-translate 的逻辑进行翻译

**架构：**
```
src/entrypoints/reader/
  ├── EpubReader.tsx     — ePub 阅读器组件
  ├── epub-parser.ts     — ePub 解析
  └── index.html         — 阅读器页面
```

---

## Sprint 4: 学习功能（Phase 2 核心）(预计 3-4 天)

### S4.1 — 词汇系统（已有基础）

**当前状态：** 已有 `vocabulary.ts` 存储 + SelectionToolbar "收藏" 按钮。

**扩展：**
1. **词汇面板 UI：**
   - 新建 `src/entrypoints/vocabulary/` — 词汇本页面
   - 显示所有收藏的词汇，按时间/来源/频率排序
   - 导出为 CSV/Anki 格式

2. **Hover 收藏：**
   - HoverTranslate 也添加 "收藏" 按钮
   - 收藏时自动保存翻译结果 + 解释

3. **词汇统计：**
   - Popup 显示 "今日收藏 X 个词"
   - 按周统计学习量

### S4.2 — 阅读历史

**实现：**
```typescript
// src/utils/storage/reading-history.ts
interface ReadingHistoryEntry {
  url: string
  hostname: string
  title: string
  wordsTranslated: number
  timeSpentMs: number
  visitedAt: number
}
```

- 每次翻译完成后记录
- Popup 显示最近阅读历史
- 可以重访之前翻译的页面

### S4.3 — AI 难度分级解释（参考 Read Frog）

**Read Frog 的做法：**
- 用户设置自己的语言水平（beginner/intermediate/advanced）
- AI 解释根据水平调整用词和深度

**Astra 实现：**
```typescript
// src/types/config.ts
languageLevel: "beginner" | "intermediate" | "advanced"  // 默认 intermediate
```

- 修改 `openai.ts` 的 explain prompt，根据 level 调整
- beginner：用最简单的中文解释，给出音标和例句
- intermediate：解释含义和用法，给出同义词
- advanced：解释语境、语气、文化背景

---

## Sprint 5: UX 打磨 + 差异化 (预计 2-3 天)

### S5.1 — TTS 朗读

**参考 Read Frog 的 Edge TTS 实现：**
- `src/entrypoints/background/edge-tts.ts`
- `src/entrypoints/background/tts-playback.ts`

**Astra 实现：**
- 使用 Web Speech API (`speechSynthesis`) 或 Edge TTS
- HoverTranslate / SelectionToolbar 添加 "朗读" 按钮
- 支持朗读原文和翻译

### S5.2 — 翻译样式增强

**目标：** 追平 Immersive 的样式丰富度。

- 添加更多 presentation themes（半透明、下划线变体、背景高亮变体）
- 翻译字体大小可调
- 翻译文本颜色可自定义
- 参考 Read Frog 的 `translation-node-preset.css`

### S5.3 — Smart Context（Immersive 的杀手级功能）

**Immersive 做法：** 翻译前先分析整篇文章，生成术语表和摘要，后续翻译保持术语一致。

**Astra 实现：**
- 在 page translation 开始前，用 LLM 生成 `contentSummary`（已有字段）
- 扩展为 `terminologyGlossary` — 术语表
- 翻译时将术语表注入 system prompt

### S5.4 — i18n 国际化

**当前状态：** UI 全中文硬编码。

**实现：**
- 使用 WXT 的 `browser.i18n` API
- 创建 `public/_locales/zh_CN/messages.json` 和 `en/messages.json`
- 替换所有硬编码中文字符串

---

## 功能对照表：追赶进度

| 功能 | Immersive | Read Frog | Astra 当前 | Sprint | 追赶后 |
|------|-----------|-----------|------------|--------|--------|
| 全页翻译 | ✓ 成熟 | ✓ | ✓ | — | ✓ |
| 双语对照 | ✓ 多模式 | ✓ | ✓ 3 主题 | S5.2 | ✓ |
| 悬停翻译 | ✓ 段落级 | ✓ 选词级 | ✓ | — | ✓ |
| 输入框翻译 | ✓ | ✗ | ✓ | — | ✓ ✨ |
| YouTube 字幕 | ✓ 60+ 平台 | ✓ | ✗ | **S1.1** | ✓ |
| Netflix/Bilibili | ✓ | ✗ | ✗ | S2.1 | ✓ |
| PDF 翻译 | ✓ Pro | ✗ | ✗ | S3.1 | ✓ |
| ePub 阅读 | ✓ | ✗ | ✗ | S3.2 | ✓ |
| 多引擎 | ✓ 20+ | ✓ 20+ | ✗ 仅 OpenAI | **S1.2** | ChatGPT + Gemini |
| 错误恢复 | ✓ 优雅 | ✓ | ✗ 静默失败 | **S1.3** | ✓ |
| 快捷键 | ✓ 丰富 | ✓ | 仅 Alt+A | **S1.4** | ✓ |
| 右键菜单 | ✓ | ✓ | ✗ | S2.3 | ✓ |
| 站点规则 | ✓ 完整 | ✓ CSS 规则 | ✓ 基础 | S2.2 | ✓ |
| TTS 朗读 | ✗ | ✓ 150+ voices | ✗ | S5.1 | ✓ |
| AI 自定义 action | ✗ | ✗ | ✓ | — | ✓ ✨ |
| 词汇收藏 | ✗ | ✓ 计划中 | ✓ 基础 | S4.1 | ✓ ✨ |
| 阅读历史 | ✗ | ✗ | ✗ | S4.2 | ✓ ✨ |
| 难度分级 | ✗ | ✓ | ✗ | S4.3 | ✓ |
| Smart Context | ✓ Pro | ✗ | ✗ | S5.3 | ✓ ✨ |
| Frame 翻译 | ✗ | ✗ | ✓ | — | ✓ ✨ |
| 隐私模式 | ✗ | ✗ | ✓ | — | ✓ ✨ |
| Bench 评测 | ✗ | ✗ | ✓ 20 场景 | — | ✓ ✨ |
| i18n | ✓ 50+ | ✓ | ✗ | S5.4 | ✓ |

✨ = Astra 差异化优势

---

## 执行顺序建议

```
Sprint 1 (优先级最高，2-3 天)
├── S1.1 YouTube 字幕双语翻译 ← 最高优先
├── S1.2 Gemini 直连 provider
├── S1.3 错误恢复 + 重试
└── S1.4 快捷键系统

Sprint 2 (高优先级，2-3 天)
├── S2.1 Bilibili / Netflix 字幕
├── S2.2 站点适配规则增强
└── S2.3 右键菜单

Sprint 3 (中优先级，3-4 天)
├── S3.1 PDF 翻译
└── S3.2 ePub 阅读器

Sprint 4 (差异化，3-4 天)
├── S4.1 词汇系统扩展
├── S4.2 阅读历史
└── S4.3 AI 难度分级

Sprint 5 (打磨，2-3 天)
├── S5.1 TTS 朗读
├── S5.2 翻译样式增强
├── S5.3 Smart Context 术语一致性
└── S5.4 i18n 国际化
```

---

## 参考资源

### Read Frog 源码（同栈，可直接参考）
- YouTube 字幕拦截：`apps/extension/src/entrypoints/interceptor.content/`
  - `inject-player-api.ts` — Player API 注入
  - `timedtext-observer.ts` — 字幕 DOM 监听
- 翻译控制：`apps/extension/src/entrypoints/host.content/translation-control/`
  - `page-translation.ts` — 全页翻译
  - `node-translation.ts` — 节点级翻译
  - `bind-translation-shortcut.ts` — 快捷键绑定
- AI 集成：`apps/extension/src/entrypoints/background/`
  - `llm-generate-text.ts` — LLM 调用
  - `translation-queues.ts` — 翻译队列管理
  - `tts-playback.ts` / `edge-tts.ts` — TTS 实现
- 错误处理：`apps/extension/src/components/translation/error/`
  - `error-button.tsx` — 错误按钮
  - `retry-button.tsx` — 重试按钮

### Immersive Translate（闭源，参考文档 + 反编译）
- 配置系统：https://github.com/immersive-translate/config
- 高级配置文档：https://immersivetranslate.com/docs/advanced/
- 规则系统文档：https://immersivetranslate.com/docs/js-sdk/
- 字幕功能文档：https://immersivetranslate.com/docs/features/video-subtitles/
- PDF 功能文档：https://immersivetranslate.com/docs/features/pdf/

### 技术文章
- Immersive 翻译原理：https://manateelazycat.github.io/2023/05/06/the-principle-of-immersive-translation/
- 功能架构分析：https://immersivetranslate.com/blog/test-immersivetranslate001/
