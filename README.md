# ✦ Astra

AI-powered bilingual web translation for desktop browsers, with an iOS Safari shell project skeleton included in-repo.

## Features

- 🌐 **双语对照翻译** — 原文下方显示译文，尽量不破坏页面布局
- 🤖 **AI 翻译引擎** — 当前内置 OpenAI 兼容配置（支持自定义 Base URL）
- 📱 **iOS Safari 壳工程骨架** — 仓库内置 Xcode shell project，可把 WXT Safari 构建产物接入 iPhone/iPad
- 🎨 **多种翻译样式** — 默认 / 下划线 / 高亮
- ⚡ **渐进式翻译** — 视口优先、批量请求、并发控制、动态内容监听
- 🧩 **划词翻译** — 选中文本后弹出工具栏即时翻译

## Quick Start

```bash
# 安装依赖
pnpm install

# Chrome 开发模式
pnpm dev

# Safari 开发模式
pnpm dev:safari

# 生产构建（Chrome）
pnpm build

# Safari 构建
pnpm build:safari

# 准备 iOS Safari 壳工程资源
pnpm ios:prepare

# 质量检查
pnpm type-check
pnpm lint
pnpm test
```

## iOS Safari 部署

> 当前仓库已包含 **iOS Safari 壳工程骨架与接入流程**，但 **iOS Safari 运行时兼容性仍需真机 / 模拟器验证**。

仓库已经包含基础 iOS shell project：

1. `pnpm ios:prepare`
2. 打开 `ios/AstraShell.xcodeproj`
3. 在 Xcode 中为 `AstraShell` 和 `AstraShell Extension` 配置 Team / Bundle Identifier
4. 运行宿主 App，并在 iOS 设置中启用 Safari 扩展
5. 详细步骤与注意事项见 `ios/README.md`

## Architecture

```text
src/
  entrypoints/
    background/               # Service worker：翻译请求、快捷键入口
    content/
      components/             # 浮球、划词工具栏
      translation-state.ts    # 内容页内的翻译状态源
      page-translate.ts       # 渐进式页面翻译控制器
    popup/                    # 弹窗 UI：配置 + 当前页控制
  types/
    config.ts                 # 配置 schema / defaults
    messages.ts               # 运行时消息协议
    translation.ts            # 翻译状态与错误模型
  utils/
    storage/config.ts         # 配置读写、迁移、兼容旧 key
    extension/messages.ts     # runtime / tabs messaging helpers
    dom/traversal.ts          # 安全的文本块提取
    dom/inject.ts             # 翻译 DOM 注入与清理
    translate/translate.ts    # 批次拆分与并发调度
    providers/openai.ts       # OpenAI JSON 输出解析
ios/
  AstraShell.xcodeproj/      # iOS Safari shell project
  AstraShell/                # 宿主 App
  AstraShell Extension/      # Safari Web Extension target
  scripts/                   # iOS 接入辅助脚本
```

## Config Storage

Astra 现在使用 `browser.storage.local` 中的单一版本化配置对象：

- `astra.config.v1`

同时会兼容旧版本的平铺 key：

- `apiKey`
- `baseURL`
- `model`
- `targetLang`

首次读取时会自动把旧结构迁移到 `astra.config.v1`，并继续双写一段时间，便于回滚旧构建。

## Translation Safety Notes

为降低页面破坏风险，Astra 当前策略是：

- 优先翻译段落、标题、列表项、表格单元等稳定文本块
- 跳过按钮、输入框、可编辑区域、导航等交互元素
- 跳过 Astra 自己注入的翻译节点，避免重复采集和重复翻译
- 采用视口优先翻译，而不是页面一加载就全量请求
- 动态内容目前优先处理**新增节点**；少数“原地改字不换节点”的页面仍可能需要手动重新触发翻译

这意味着某些高度自定义站点可能会“少翻一些”，但整体上比误翻/破坏宿主页面更安全。

## Security Notes

- API Key 保存在扩展本地存储 `browser.storage.local` 中
- 默认需要网页访问权限：`*://*/*`
- 建议使用**受限权限**或**代理层**的 key，而不是高权限主账号 key
- 如果你使用自定义 `baseURL`，请确认其服务端可信且具备适当的日志/密钥保护策略

## Roadmap

- [x] 双语对照网页翻译
- [x] OpenAI 翻译引擎
- [x] Chrome & Safari 构建
- [x] 划词翻译
- [x] Xcode iOS 壳项目骨架 / 接入文档
- [ ] 更多翻译引擎（DeepSeek, Gemini, DeepL）
- [ ] PDF 双语翻译
- [ ] 视频字幕翻译

## License

MIT
