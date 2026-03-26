# Astra 质量差距分析：站在 Immersive Translate + Read Frog 肩膀上

## 当前真实状态

**构建**: 0 TS 错误, 378 测试全绿, 生产包 2.97MB
**功能**: 核心翻译 + 5 个新 surface (PDF/ePub/字幕文件/词汇/视频字幕) 均有真实实现
**诚实评估**: 75-80% 完成度 — 技术基础扎实，但 UI 暴露不完整，部分功能断路

---

## 第一层差距：功能已实现但未连通（Astra 内部问题）

这些是"代码存在但用户碰不到"的问题，修复它们是最高 ROI。

| 问题 | 现状 | Immersive/Read Frog 怎么做 | 修复难度 |
|------|------|---------------------------|----------|
| `languageLevel` 无 UI 入口 | schema+provider 都支持，但 popup 没有 dropdown | Read Frog 有 beginner/intermediate/advanced 选择器 | S — 加一个 select |
| `languageLevel` 未传入翻译链路 | background handleTranslate 不读 config.languageLevel | Read Frog 在每次请求时从 config 读取 level | S — 传参 |
| Reading history 无 UI | 后端 recordPageTranslation 工作正常，popup 不显示 | Immersive 没有此功能，Read Frog 有基础历史 | M — popup 加列表组件 |
| i18n 只替换了 GlobalSettingsSection | 大部分 UI 仍硬编码中文 | Immersive 50+ 语言，Read Frog 中英 | M — 逐文件替换 |
| apiKey 在 App.tsx handleSaveConfig 中未传递 | GlobalSettingsSection 能输入，但 save 时丢失 | Read Frog 的 provider config 完整保存 | S — 加字段 |

---

## 第二层差距：功能质量（Astra 有但不够好）

| 领域 | Astra 现状 | Immersive Translate | Read Frog | 差距 |
|------|-----------|--------------------|-----------|----|
| **全页翻译稳定性** | viewport 优先 + 渐进批处理 + 重试, 35 bench 场景 | 成熟, 段落级智能分割, 站点规则丰富 | 基于 Readability 提取正文 | Astra 基础好，但缺少站点规则 UI |
| **字幕翻译** | MutationObserver 监听 DOM 变化 | 拦截 API + 预加载整个字幕文件批量翻译 | 拦截 player API + timedtext observer | **Astra 是逐条翻译（实时），Immersive/Read Frog 是预加载批量翻译** — 实时方式延迟高 |
| **PDF 翻译** | pdf.js 提取 + 顺序翻译 + 双语显示 | OCR + 版面保持 + Pro 版识别公式/表格 | 无 | Astra 基础可用但不保持原始版面 |
| **错误处理** | 重试 2 次 + FloatBall 状态 + InputTranslate 错误显示 | 切换引擎重试 + "重试所有失败段落" 按钮 | 错误按钮 + 重试按钮 UI 组件 | Astra 缺少显式的 "重试失败" UI 按钮 |
| **双语排版** | 3 主题 + fontSize/color 可配 | 多种排版模式 + CSS 注入 + 站点级样式 | 预设样式 + 自定义 CSS | Astra 缺少用户可编辑 CSS |
| **缓存** | hover/video 有内存缓存, 无持久化 | 段落级持久缓存 30 天 TTL | TanStack Query + IndexedDB | **Astra 没有持久化翻译缓存** — 刷新页面翻译全丢 |
| **Provider 切换** | 支持 OpenAI/Gemini + relay, 手动选择 | 20+ 引擎, 实时切换不中断, fallback chain | 20+ 引擎, Ollama 本地 | Astra 只有 2 个直连 + relay |

---

## 第三层差距：Astra 完全没有的功能

| 功能 | Immersive | Read Frog | 对 Astra 的重要性 | 实现难度 |
|------|-----------|-----------|-------------------|----------|
| **持久化翻译缓存** | ✓ 段落级, 30 天 TTL | ✓ IndexedDB | **极高** — 这是性能和成本的核心 | M |
| **站点规则 UI** | ✓ 完整的规则编辑器 | ✓ 自定义 DOM 规则 | 高 — 用户需要为特殊网站调整 | M |
| **翻译缓存复用** | ✓ 同一段落不重复翻译 | ✓ | **极高** — 用户回访页面不应重新翻译 | M |
| **字幕预加载批量翻译** | ✓ | ✓ | 高 — 当前逐条翻译延迟太高 | M |
| **自定义 CSS 样式** | ✓ per-site CSS 注入 | ✓ CSS 代码编辑器 | 中 — 高级用户需要 | M |
| **Ollama/本地模型** | ✗ | ✓ | 中 — 离线翻译, 隐私敏感用户 | M |
| **字幕文件导入到视频播放器** | ✓ 实时双语字幕覆盖 | ✗ | 中 — 目前字幕文件翻译是离线工具 | L |
| **单词级悬停翻译** | ✗ (段落级) | ✓ (核心特色) | 方向差异 — Astra 是段落级 | L |
| **Spaced repetition / 闪卡** | ✗ | ✓ (计划中) | 高 — Phase 2 学习闭环的核心 | L |
| **Edge TTS 语音选择** | ✗ | ✓ 150+ voices | 低 — 当前 Web Speech API 够用 | S |
| **翻译质量验证** | ✗ | ✗ | 中 — Immersive 用 token ratio 检测异常翻译 | S |
| **会议翻译** | ✓ Zoom/Meet/Teams | ✗ | 低 — 特殊场景 | L |

---

## 第四层差距：工程质量

| 维度 | Astra | Immersive | Read Frog | 改进方向 |
|------|-------|-----------|-----------|---------|
| **测试覆盖** | 378 tests, bench 35 场景, 但 UI 组件 0% | 不公开 | Vitest + testing-library | 补 popup + reader UI tests |
| **CI/CD** | type-check + test + bench + build (Chrome+Safari) | 不公开 | GitHub Actions | 加 coverage gate, lint step |
| **状态管理** | React useState + refs, 无全局状态管理 | 不公开 | Jotai (原子化状态) | 考虑 Jotai/Zustand |
| **错误边界** | 无 React ErrorBoundary | 不公开 | RecoveryBoundary 组件 | 加 ErrorBoundary |
| **性能监控** | 无 | 不公开 | 无 | 加 performance marks |
| **代码分割** | WXT 自动分割 | 不公开 | WXT + Nx monorepo | 够用 |

---

## 优先修复建议（站在两个项目肩膀上）

### P0: 必须修（用户会直接碰到的断路）

1. **连通 languageLevel**: popup 加 select + background 传参 → 30 分钟
2. **连通 reading history UI**: popup 加最近翻译列表 → 1 小时
3. **连通 apiKey save**: App.tsx handleSaveConfig 传 apiKey → 15 分钟

### P1: 翻译缓存（这是最大的质量差距）

**学习 Immersive 的段落级缓存 + Read Frog 的 IndexedDB 方案。**

```
src/utils/cache/translation-cache.ts
- 用 IndexedDB (Dexie.js) 存储翻译结果
- Key: hash(sourceText + targetLang + provider)
- Value: translation string
- TTL: 30 天自动清理
- 在 translateTexts() 中先查缓存，命中则跳过 API 调用
- 在 translateWithProvider() 成功后写入缓存
```

这一个功能能将 API 调用量降低 60-80%，同时让回访页面秒加载。

### P2: 字幕预加载（学习 Read Frog 的做法）

当前方式：MutationObserver 监听每条字幕 → 逐条翻译 → 延迟 1-2 秒
目标方式：检测到视频 → 一次性获取完整字幕数据 → 批量翻译 → 按时间码显示

Read Frog 的 `YoutubeSubtitlesFetcher` 就是这个模式：
1. 通过 MAIN world 注入脚本获取 `player.getPlayerResponse().captions`
2. 用 timedtext API URL 一次性下载全部字幕
3. 批量翻译后按时间码匹配显示

### P3: 站点规则 UI + 自定义 CSS

Immersive 的规则系统是它最成熟的部分。Astra 已有 schema 支持 selectors/excludeSelectors，但用户无法通过 UI 设置。需要：
- popup 中站点设置区域增加 "高级规则" 折叠面板
- 允许用户输入 CSS 选择器
- 参考 Read Frog 的 CodeMirror CSS 编辑器

### P4: React ErrorBoundary + 状态管理升级

Read Frog 用 `RecoveryBoundary` 组件包裹所有 UI，崩溃时显示恢复界面而不是白屏。
Astra 目前任何 React 组件抛错都会导致整个内容脚本 UI 消失。

### P5: Popup 完整性（学习 Read Frog 的 Options 页面）

Read Frog 有独立的 Options 页面，包含：
- 侧边栏导航
- API provider 完整配置表单
- 字幕样式预览
- 快捷键自定义
- 自定义 prompt 编辑器
- 命令面板搜索

Astra 的 popup 太简陋 — 应该升级为独立的 Options 页面。

---

## Astra 的差异化优势（保持并强化）

这些是 Immersive 和 Read Frog 都没有的：

| 优势 | 说明 | 如何强化 |
|------|------|---------|
| **AI Action Pipeline** | summarize/rewrite/grammar 自定义 action | 允许用户创建自定义 action（Read Frog 有 prompt configurator，可参考） |
| **Frame-aware 翻译** | 跨 iframe 协调翻译 | 这是技术壁垒，保持 |
| **Bench 评测体系** | 35 场景自动化评分 | 持续扩展场景，作为质量门槛 |
| **隐私模式** | 上下文脱敏 + URL 清洗 | 明确为卖点，在 UI 中突出 |
| **词汇收藏 + 导出** | 带上下文的词汇保存 | 加闪卡复习 → 成为学习闭环核心 |

---

## 总结：做到 "更好" 的路径

**不是追求功能数量，而是追求功能质量。** Immersive 赢在广度（60+ 视频平台、20+ 引擎），Read Frog 赢在学习深度（难度分级、TTS、句法分析）。

**Astra 应该赢在：**

1. **翻译缓存 + 增量翻译** — 回访页面秒加载，不重复花钱翻译
2. **学习闭环** — 从 "看懂了" 到 "学会了"（词汇 → 复习 → 进度跟踪）
3. **质量保障** — bench 驱动开发，每个功能都有评测场景
4. **AI action 可扩展性** — 用户自定义 prompt，不只是翻译和解释

做到这 4 点，Astra 就能在 "翻译+学习" 这个交叉定位上超越两个对手。
