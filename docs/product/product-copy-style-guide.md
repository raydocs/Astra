# Astra Product Copy Style Guide

Astra copy should make the product feel like a managed learning assistant, not a developer tool.

## Copy principles

1. **Say what the user can do next.** Prefer action guidance over system explanation.
2. **Hide implementation.** Ordinary users should not learn provider/model/API/token/quota/relay concepts.
3. **Be precise about support.** Use supported webpages/videos, not universal claims.
4. **Emphasize learning progress.** Save → review → source context is the core product promise.
5. **Use calm, warm language.** Astra should feel reliable, not technical.

## Preferred product terms

| Concept | English | Chinese |
|---|---|---|
| Managed AI | Astra AI | Astra AI |
| Automatic mode | Auto | 自动 |
| Fast mode | Faster | 快速理解 |
| Balanced mode | Balanced | 精准阅读 |
| Study mode | Study mode | 学习模式 |
| Save action | Save for review | 保存到复习 |
| Review surface | Today Review | 今日复习 |
| Video scope | supported videos | 受支持视频 |
| Source context | source context | 来源上下文 |
| No setup | no API setup / zero-config | 无需 API 设置 / 无需配置 |

## Avoid in ordinary UI

Do not show these terms to ordinary users unless the surface is explicitly advanced, dev, operator, or support diagnostics:

- provider
- model
- API key
- token
- quota
- relay
- OpenRouter
- OpenAI
- Gemini
- request failed
- provider error
- invalid token

## Safer replacements

| Avoid | Prefer |
|---|---|
| quota exceeded | Free is best for trying Astra. Pro supports longer webpages, more supported videos, and synced review. |
| provider failed | Astra could not finish this right now. You can keep reading and retry in a moment. |
| invalid token | Please sign in again to continue syncing. |
| relay timeout | Astra is taking longer than usual. We will keep the page usable while you retry. |
| model unavailable | Astra could not finish this explanation right now. Try the shorter selection first. |
| all videos | supported videos |
| all websites | supported webpages |
| no uploads | no unnecessary uploads |
| local-only | saved on this device / not synced unless you sign in, if strictly true |
| unlimited | more / longer / higher limits |

## Error templates

### Page cannot be translated

English:

> This page limits what Astra can read. Select a sentence and Astra can explain that part first.

Chinese:

> 这个页面限制了 Astra 读取内容。你可以先选中一句英文，让 Astra 解释这一段。

### Long page / partial success

English:

> This page is long. Astra will start with the visible part so you can keep reading.

Chinese:

> 这页内容比较长。Astra 会先处理当前可见部分，让你可以继续阅读。

### Video has no captions

English:

> This video does not have usable captions yet. Paste a short excerpt and Astra can still help you study it.

Chinese:

> 这个视频暂时没有可用字幕。你可以粘贴一小段文字，Astra 仍然可以帮你学习。

### Save success

English:

> Saved to today’s review.

Chinese:

> 已加入今日复习。

### Review completion

English:

> You finished today’s review. Keep reading or watch a supported video to create more cards.

Chinese:

> 你完成了今天的复习。继续读一篇文章或看一个受支持视频，就能创建更多学习卡片。

### Free value prompt

English:

> Pro helps with longer webpages, more supported videos, synced learning history, and deeper review.

Chinese:

> Pro 支持更长网页、更多受支持视频、跨设备学习记录和更深入复习。

## Tone examples

Good:

- “Astra saved this for review.”
- “You can keep reading while Astra finishes the rest.”
- “This video has no usable captions. Paste a short excerpt to study it.”

Bad:

- “Provider request failed.”
- “Quota exceeded.”
- “Configure your API key.”
- “Model unavailable.”

## Review checklist

Before merging user-facing copy:

- [ ] Does it tell the user the next action?
- [ ] Does it avoid implementation vocabulary?
- [ ] Does it avoid universal support claims?
- [ ] Does it preserve the zero-config promise?
- [ ] Does it reinforce read/watch → save → review?
