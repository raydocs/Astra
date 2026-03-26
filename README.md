# ✦ Astra

**AI-powered language learning software, extension-first.**

Astra 想做的不是另一个“把网页翻成中文”的工具，而是一层运行在真实互联网之上的语言学习软件。

它先从浏览器插件切入，让用户在每天正常上网时即时读懂外语内容；再把这些瞬时理解沉淀成长期学习资产，最终连接成一个完整的语言学习生态。

当前 Astra 的第一目标很明确：**帮助中文用户在日常浏览英文网页时，更自然地理解、思考，并逐步学会英语。**

## 现在能做什么

当前仓库已经具备一套可日常使用的网页翻译与阅读增强能力：

- **整页翻译**：渐进式批处理、视口优先、尽量减少对页面布局的破坏
- **双语对照 / 仅译文模式**：既能对照学习，也能更流畅地阅读
- **翻译样式主题**：默认、下划线、高亮三种呈现方式
- **划词工具栏**：对选中文本进行即时翻译与解释
- **悬停翻译**：支持可配置触发方式，减少阅读打断
- **输入框翻译**：在日常输入场景中辅助表达
- **文章模式**：优先提取正文内容，减少噪音区域干扰
- **站点级规则**：支持站点启用/禁用、自动翻译、目标语言、悬停方式、范围与展示样式
- **字幕翻译**：处理页面可访问的字幕或 caption track
- **内置 Astra provider 路径**：当前支持 OpenAI 与 Gemini，经 Astra relay 调用
- **Chrome / Safari 构建链路**：仓库内还带有 **iOS Safari 壳工程骨架**

当前能力真值表见 [docs/capability-matrix.md](/Users/ruirui/Downloads/GitHub/Astra/docs/capability-matrix.md)。

## 为什么 Astra 不只是另一个翻译插件

大多数翻译插件优化的是一件事：**把看不懂的内容翻成看得懂。**

Astra 想优化的是更长的一条链路：

- **理解**：先把页面、句子、词组、输入内容变得可理解
- **解释**：再补足上下文和语言解释，让用户知道“为什么是这个意思”
- **记住**：最后把一次次理解沉淀成词汇、句子、阅读历史和复习材料

现在这个仓库最强的是前两层，也就是“理解”和“解释”。“记住”是下一阶段要补齐的产品层，而不是 README 里假装已经成熟的能力。

## 为什么先从插件开始

语言学习最大的问题，不是缺课程，而是缺少**每天自然发生的输入**。

浏览器就是这种输入最密集的地方：

- 新闻、博客、文档、论坛、GitHub、Reddit、X、YouTube 字幕
- 不是“专门找时间学习”，而是“边浏览边理解”
- 同一种语言结构会在真实场景里反复出现

所以从插件切入不是因为愿景小，而是因为这是最现实的起点：

- 它是进入用户日常行为的**最低摩擦入口**
- 它把学习嵌入**真实浏览行为**，而不是要求用户再养成一个独立 App 习惯
- 只有先建立高频使用，后续词库、复习、阅读器、视频、同步、移动端才有产品基础

## 产品路线

高层路线分成四层：

- **Now: daily-use translation**
  先把 Astra 做成用户愿意整天开着的浏览器工具，重点是稳定翻译、低打扰交互、文章模式、站点规则和日常体验。
- **Next: learning loop**
  把“看懂了这页”变成“从这页里学到了东西”，重点是保存词句、上下文解释、阅读历史和轻量复习。
- **Later: owned reading/video surfaces**
  扩展到网页之外的自有学习面板，逐步覆盖网页导入、PDF、EPUB、视频字幕和跨端连续性。
- **Ecosystem: multi-surface learning system**
  最终把浏览器、阅读、视频、词汇、进度、同步和订阅连接成一个完整的语言学习软件系统。

更详细的产品规划见 [docs/product-roadmap.md](/Users/ruirui/Downloads/GitHub/Astra/docs/product-roadmap.md)。

## Quick Start

```bash
pnpm install

# Chrome 开发模式
pnpm dev

# Safari 开发模式
pnpm dev:safari

# Chromium 生产构建
pnpm build

# Astra relay 本地开发
pnpm relay:start

# Safari 构建
pnpm build:safari

# 准备 iOS Safari 壳工程资源
pnpm ios:prepare

# 质量检查
pnpm type-check
pnpm lint
pnpm test
```

## Install / Build

### Chromium 浏览器

先构建：

```bash
pnpm build
```

然后在浏览器扩展管理页中加载 `.output/chrome-mv3/` 作为 unpacked extension。

### Safari 与 iOS Safari

桌面 Safari 开发：

```bash
pnpm dev:safari
```

仓库内 iOS Safari 壳工程流程：

```bash
pnpm ios:prepare
open ios/AstraShell.xcodeproj
```

iOS 目录只是打包和宿主壳，不是 Astra 的核心产品面。详细接入说明见 [ios/README.md](/Users/ruirui/Downloads/GitHub/Astra/ios/README.md)，验证清单见 [docs/ios-safari-smoke-test.md](/Users/ruirui/Downloads/GitHub/Astra/docs/ios-safari-smoke-test.md)。

## Privacy 与 AI Provider

- Astra 通过 `browser.storage.local` 保存 provider 配置
- 当前 provider 路径是 **Astra-managed relay**
- 插件端不再要求用户直接填写 OpenAI / Gemini 的 provider key；正确路径是插件持有 Astra access token，然后调用你的内部 API
- `relayBaseURL` 属于你的服务信任边界，应指向你自己的 Astra backend / relay
- 当前 popup 已内置 Astra 账号登录流，session 与产品配置分开存储
- 扩展需要较宽的 host 权限，因为整页翻译必须访问页面内容

当前配置以版本化对象存储：

- `astra.config.v1`

同时兼容旧版平铺 key，如 `apiKey`、`baseURL`、`model`、`targetLang`，迁移时会归并到新的 relay 配置结构。

## Architecture 与开发说明

```text
src/
  entrypoints/
    background/               # service worker、请求编排、命令入口
    content/                  # 页面翻译、悬停、划词、输入框、字幕
    popup/                    # 设置与当前标签页控制
  types/                      # config、messages、translation state
  utils/
    dom/                      # 内容提取与 DOM 注入
    extension/                # runtime messaging helpers
    providers/                # provider 路由与 Astra relay client
    storage/                  # 配置持久化与迁移
ios/
  AstraShell.xcodeproj/       # iOS Safari shell project
  AstraShell/                 # host app
  AstraShell Extension/       # Safari Web Extension target
  scripts/                    # Safari 资源同步脚本
```

Astra 当前在翻译安全性上采取保守策略：

- 优先处理段落、标题、列表项、表格单元等稳定文本块
- 跳过按钮、表单、可编辑区域、导航以及 Astra 自己注入的节点
- 优先做视口内翻译，而不是页面一加载就全量翻译
- 对“新增节点”的处理优于“原地改字不换节点”的极动态页面

这意味着 Astra 有时会“少翻一些”，但更不容易把宿主页面搞坏。

## Contributing

欢迎贡献，但产品方向是明确且收敛的：

- Astra 要做的是**语言学习产品**，不是单纯的模型操作面板
- 短期重点是把浏览器插件这个入口打透
- 长期目标是形成完整的软件生态，而不是不断叠加彼此割裂的功能

如果你想先理解当前能力和方向，再决定提什么改动，建议先读：

- [docs/capability-matrix.md](/Users/ruirui/Downloads/GitHub/Astra/docs/capability-matrix.md)
- [docs/bench-harness.md](/Users/ruirui/Downloads/GitHub/Astra/docs/bench-harness.md)
- [docs/product-roadmap.md](/Users/ruirui/Downloads/GitHub/Astra/docs/product-roadmap.md)
- [docs/adr/0002-astra-managed-auth-relay.md](/Users/ruirui/Downloads/GitHub/Astra/docs/adr/0002-astra-managed-auth-relay.md)
- [docs/relay-server.md](/Users/ruirui/Downloads/GitHub/Astra/docs/relay-server.md)
- [ios/README.md](/Users/ruirui/Downloads/GitHub/Astra/ios/README.md)

## License

MIT
