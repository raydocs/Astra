# Firefox AMO Listing Copy

Firefox Add-ons (AMO) uses a slightly different format from the Chrome Web Store. Key differences: AMO has a **Summary** field (250 chars max) instead of Chrome's short description (132 chars), and the full description supports limited HTML/Markdown.

---

## English

### Name

```
Astra -- AI Language Learning Assistant
```

### Summary (250 characters max)

```
AI webpage translator for bilingual reading, selection/hover explanations, PDF/EPUB reading, scoped YouTube/Bilibili subtitles, vocabulary flashcards. Free public beta with anonymous-session managed translation or bring-your-own-key direct mode.
```

(237 characters)

### Description

```
Astra helps turn web reading into language-learning practice. Translate pages, explain selected text, save vocabulary, and review with flashcards -- all powered by AI provider requests.

<b>Free public beta</b>
Astra is currently a free public beta. Chrome/Chromium is the primary validated desktop path. Firefox is available as a narrower beta path and should not be described as full feature/parity with Chrome.

<b>Full-page bilingual translation</b>
Translate supported web pages with one click. The original text can be shown alongside translations for parallel reading. Display modes include bilingual side-by-side, translation only, underline, and highlight, depending on page behavior.

<b>Selection toolbar</b>
Select text to reveal a toolbar with Translate, Explain, Grammar, Save, Speak, and Share buttons. AI explanations and grammar analysis appear inline near the selected text.

<b>Hover translation</b>
Hold Alt and hover over readable paragraphs for a translation tooltip. Configurable per site: always on, Alt+hover, or disabled.

<b>Video subtitle translation</b>
Best-effort YouTube subtitles and a narrower beta/best-effort Bilibili adapter. Netflix and other commercial video services are not claimed as supported for this launch.

<b>PDF & EPUB reader</b>
Open documents in Astra reader surfaces for bilingual reading workflows. Reader and owned-reading features remain under active beta development.

<b>Study Hub & vocabulary</b>
A structured learning loop in the popup: Read → Guided Read → Explain → Save Words → Review. Save words to your vocabulary notebook and review with spaced repetition flashcards.

<b>Usage dashboard</b>
Local translation usage stats in the popup: request counts, token estimates, and routing information when available.

<b>AI provider options</b>
Use your own provider keys for direct translation where configured, or use Astra's managed beta relay where available. Direct-to-relay fallback can occur only when both paths are configured and a fallback-eligible provider failure happens.

<b>Privacy boundary</b>
Astra does not include product analytics or advertising tracking. Translation text can leave your device through direct provider or Astra relay paths. Privacy Mode sanitizes request context, such as URL parameters and richer page metadata, before translation requests; it is not a local-only AI guarantee. Local vocabulary, settings, reading history, and translation cache stay in browser storage unless you enable an account/sync surface.

<b>Per-site customization</b>
Configure translation mode, hover trigger, target language, content scope, CSS selectors, and presentation style per site.

Supports 8 target languages: Chinese (Simplified/Traditional), English, Japanese, Korean, French, German, Spanish.

Free public beta. Managed translation uses an anonymous Astra session or optional account; bring-your-own-key/direct mode is available where configured.
```

### Categories

- Primary: **Dictionaries & Encyclopedias** or **Other**  
  (AMO does not have a direct "Productivity" category; the closest relevant ones are "Dictionaries & Encyclopedias" for translation tools, or "Other")

### Tags

`translator`, `language-learning`, `bilingual`, `AI`, `vocabulary`, `flashcards`, `PDF`, `subtitles`

### Homepage URL

```
https://github.com/nicepkg/astra
```

### Support URL

```
https://github.com/nicepkg/astra/issues
```

---

## Chinese (zh-CN)

### Name

```
Astra -- AI 语言学习助手
```

### Summary (250 characters max)

```
AI 网页翻译与语言学习工具：双语阅读、划词/悬停解释、PDF/EPUB 阅读、YouTube/Bilibili 范围内字幕、生词闪卡。免费公开测试版，托管翻译使用匿名会话或可选账号，也可自带密钥直连。
```

(92 characters)

### Description

```
Astra 帮助你把网页阅读变成语言学习练习：翻译页面、解释选中文本、积累词汇，并用闪卡复习。相关功能依赖 AI 提供方请求。

<b>免费公开测试版</b>
Astra 目前是免费公开测试版。Chrome/Chromium 是主要验证过的桌面路径；Firefox 属于范围更窄的 Beta 路径，不应描述为与 Chrome 完全同等成熟或全功能一致。

<b>整页双语翻译</b>
一键翻译受支持的网页，原文与译文可并排显示。支持双语对照、仅译文、下划线、高亮等显示模式，具体效果取决于页面行为。

<b>划词工具栏</b>
选中文本后弹出工具栏，提供翻译、解释、语法分析、收藏、朗读、分享。AI 解释和语法拆解会在选中文本附近展示。

<b>悬停翻译</b>
按住 Alt 悬停在可读段落上即可获得翻译提示。可按站点配置为始终开启、Alt+悬停或关闭。

<b>视频字幕翻译</b>
YouTube 字幕为 best-effort 支持路径，Bilibili 是范围更窄的 Beta/best-effort 适配。Netflix 和其他商业视频服务，本次发布不宣称支持。

<b>PDF 与 EPUB 阅读器</b>
可在 Astra 阅读器中打开文档，进行双语阅读。阅读器和 owned-reading 功能仍处于 Beta 开发中。

<b>学习中心与词汇表</b>
弹窗中的学习中心提供结构化学习流程：阅读 → 引导阅读 → 讲解 → 保存生词 → 复习。生词保存到词汇本，稍后用间隔重复闪卡复习。

<b>用量面板</b>
在弹窗中查看本地翻译用量：请求数、token 估算，以及可用时的路由信息。

<b>AI 提供方选项</b>
你可以在配置后使用自己的提供方密钥进行直连翻译，也可以在可用时使用 Astra 托管 Beta 中继。仅当直连和中继都已配置、且出现符合回退条件的提供方失败时，才可能发生直连到中继的回退。

<b>隐私边界</b>
Astra 不包含产品分析或广告追踪代码。翻译文本可能通过直连提供方或 Astra 中继离开设备。隐私模式会在翻译请求前清理请求上下文，例如 URL 参数和更丰富的页面元数据；它不是“AI 完全本地处理”的保证。词汇、设置、阅读历史和翻译缓存默认保存在浏览器本地，除非你启用账号/同步相关功能。

<b>按站点自定义</b>
可按站点配置翻译模式、悬停触发、目标语言、内容范围、CSS 选择器和展示样式。

支持 8 种目标语言：简体中文、繁体中文、英语、日语、韩语、法语、德语、西班牙语。

免费公开测试版。托管翻译使用匿名 Astra 会话或可选账号；自带密钥/直连模式可在配置后使用。
```

### Categories

- **Dictionaries & Encyclopedias** or **Other**

### Tags

`翻译`, `语言学习`, `双语`, `AI`, `词汇`, `闪卡`, `PDF`, `字幕`
