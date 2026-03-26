# A1 (Revised): Astra 托管模式 — 傻瓜式免费体验

## 产品决策

**不做 Google Translate 免费引擎。不做本地模型。不暴露底模选择。**

Astra 的模式类似 Typeless：
- 用户不需要知道底层用什么模型
- 安装即用，零配置
- 免费用户每天 ~$0.20 额度（约 200k tokens，GPT-5.4-nano）
- 付费用户更高额度 + 更强模型
- 模型选择由 Astra 后端控制，前端不暴露

**与 Immersive/Read Frog 的根本差异：**
- 他们：BYOK（Bring Your Own Key）为核心，用户自己管 API key
- 我们：Astra 托管为核心，用户只管用，我们管模型和成本

## 架构变更

### 去掉什么
- ❌ 删除 "Free (Google Translate)" provider 选项
- ❌ 删除 popup 中的 API Key 输入框（移到高级设置/Options 页面，面向开发者）
- ❌ 删除模型选择 dropdown（后端决定用什么模型）
- ❌ 删除 provider 选择 dropdown（默认就是 Astra，高级用户可在 Options 切换）

### 加什么
- ✅ 新用户注册自动获得免费额度（通过 Astra relay）
- ✅ Popup 简化为：翻译按钮 + 状态 + 额度显示
- ✅ 额度用尽 → 提示升级，不是完全不能用
- ✅ Options 页面保留 BYOK 入口（面向高级用户/开发者）

## 用户体验流程

### 新用户（零配置）
```
安装 → 自动创建匿名 Astra 账号 → 获得每日 $0.20 免费额度
→ 打开任意网页 → 点击 FloatBall → 翻译立即开始
→ 用完额度 → 提示 "今日额度已用完，明日重置" 或 "升级 Pro"
```

### 付费用户
```
登录 Astra 账号 → 绑定订阅 → 更高额度 + 更强模型
→ 使用体验完全一样，只是更快更准
```

### 开发者/高级用户
```
Options 页面 → 高级设置 → 切换到 "自定义 Provider"
→ 输入 OpenAI/Gemini API key → 使用自己的额度
```

## 具体文件变更

### Phase 1: Popup 简化

#### `src/entrypoints/popup/App.tsx`
**大幅简化**。当前 popup 有 600+ 行，充满了 provider 配置。新 popup 应该是：

```
┌─────────────────────────────┐
│  Astra                  ⚙️  │  ← 设置图标打开 Options
├─────────────────────────────┤
│  [翻译此页面] 按钮          │  ← 一键翻译
│                             │
│  ● 已连接 · 免费版          │  ← 状态指示
│  今日额度: ██████░░ 67%     │  ← 额度进度条
│  已翻译 1,247 词            │  ← 今日统计
├─────────────────────────────┤
│  目标语言: [简体中文 ▾]     │  ← 唯一需要配置的
│  翻译模式: [双语对照 ▾]     │  ← 简单选项
├─────────────────────────────┤
│  最近翻译                   │
│  · example.com (3m ago)     │
│  · docs.rs (1h ago)         │
├─────────────────────────────┤
│  Settings · Vocabulary      │  ← 底部链接
│  Astra v0.1.0               │
└─────────────────────────────┘
```

**关键改变：**
- 删除 GlobalSettingsSection 中的 provider/apiKey/relay/model 字段
- 这些移到 Options 页面的 "高级设置" 区域
- Popup 只保留：目标语言、翻译模式、额度显示

#### `src/entrypoints/popup/components/QuotaBar.tsx` (新建)
```typescript
interface QuotaBarProps {
  used: number      // tokens used today
  limit: number     // daily token limit
  plan: "free" | "pro" | "custom"
}

export default function QuotaBar({ used, limit, plan }: QuotaBarProps)
// 渲染进度条 + "67% used today" 文本
// 免费版: 绿 → 黄 → 红 随使用量变化
// Pro: 总是绿色
// Custom (BYOK): 不显示（用自己的 key）
```

#### `src/entrypoints/popup/components/SimpleControls.tsx` (新建)
```typescript
// 只有两个控件：目标语言 + 翻译模式
// 取代 GlobalSettingsSection 在 popup 中的角色
```

### Phase 2: Astra Relay 增强

#### `server/` — Relay 后端变更

当前 relay 已有基础架构。需要增加：

1. **匿名账号自动创建**
   - 首次安装时，background script 调用 relay: `POST /v1/auth/anonymous`
   - 返回 `{ sessionToken, plan: "free", dailyLimit: 200000 }` (200k tokens ≈ $0.20)
   - Token 存入 `browser.storage.local`

2. **额度检查 API**
   - `GET /v1/quota` → `{ used: 45000, limit: 200000, resetsAt: "2026-03-27T00:00:00Z" }`
   - Popup 每次打开时查询
   - 翻译请求前 background 不需要检查（relay 端控制）

3. **额度超限响应**
   - Relay 返回 `429` + `{ error: { code: "QUOTA_EXCEEDED", message: "Daily free limit reached", upgradeUrl: "https://astra.app/pricing" } }`
   - Content script 显示友好提示，不是技术错误

#### `src/utils/astra/quota.ts` (新建)
```typescript
export interface QuotaInfo {
  used: number
  limit: number
  plan: "free" | "pro" | "custom"
  resetsAt: string
}

export async function getQuotaInfo(): Promise<QuotaInfo>
export async function isQuotaAvailable(): Promise<boolean>
```

#### `src/entrypoints/background/index.ts`
- `onInstalled` 增加匿名账号注册流程
- 翻译失败时检查是否 `QUOTA_EXCEEDED`，设置特殊状态

### Phase 3: Options 页面重构

#### `src/entrypoints/options/OptionsApp.tsx`

重新组织为：

```
左侧导航:
├── General          ← 语言、模式、主题（用户关心的）
├── Account          ← Astra 账号、额度、订阅管理
├── Actions          ← 自定义 AI actions
├── Sites            ← 站点规则
├── Vocabulary       ← 词汇管理
├── Advanced         ← ⚠️ 开发者区域：BYOK provider 配置
└── About            ← 版本、隐私政策、反馈
```

**Advanced 区域** (折叠，默认隐藏):
- Provider 选择: Astra (默认) / OpenAI / Gemini
- API Key 输入（仅 OpenAI/Gemini）
- Relay URL（仅高级用户）
- 模型覆盖（仅高级用户）
- Test Connection 按钮

### Phase 4: 额度超限 UI

#### `src/entrypoints/content/components/QuotaExceededBanner.tsx` (新建)
当翻译因额度不足失败时，在页面顶部显示 banner：

```
┌─────────────────────────────────────────────┐
│ ⚠️ Today's free translation limit reached.  │
│ Resets in 6h 23m · [Upgrade to Pro →]       │
└─────────────────────────────────────────────┘
```

#### 错误处理链路
```
relay 返回 429 QUOTA_EXCEEDED
→ background handleTranslate catch
→ 返回 RuntimeTranslateBatchErrorResponse { code: "QUOTA_EXCEEDED" }
→ page-translate drain loop catch
→ stopSession with QUOTA_EXCEEDED error
→ FloatBall 显示特殊颜色（橙色）
→ 显示 QuotaExceededBanner
```

### Phase 5: Config Schema 简化

#### `src/types/config.ts`
- 保留 `ProviderIdSchema = z.enum(["openai", "gemini"])` — 但这些是高级选项
- 新增 `connectionMode: z.enum(["astra", "custom"]).default("astra")`
  - `"astra"`: 使用 Astra relay，用户不配置任何东西
  - `"custom"`: 使用用户自己的 API key

#### `src/types/translation.ts`
- 新增 `"QUOTA_EXCEEDED"` 到 TranslationErrorCode

## 与之前 spec 的冲突

| 之前的 Spec | 新决策 | 处理 |
|------------|--------|------|
| `a1-free-engine.md` (Google Translate) | **废弃** | 不做免费引擎，用 Astra relay 免费额度替代 |
| Provider dropdown in popup | **移到 Options** | Popup 极简化 |
| API Key in popup | **移到 Options Advanced** | 面向开发者 |
| Model selection | **删除** | 由后端控制 |
| `hasProviderAccess` 逻辑 | **简化** | Astra 模式下总是返回 true（relay 端控制额度） |

## Relay 后端额度控制（伪代码）

```typescript
// server/middleware/quota.ts
const FREE_DAILY_LIMIT = 200_000 // tokens
const PRO_DAILY_LIMIT = 2_000_000

async function checkQuota(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const usage = await db.getUsage(userId, today)
  const limit = user.plan === "pro" ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT
  return { allowed: usage < limit, remaining: limit - usage }
}

// In translate endpoint:
app.post("/v1/translate", async (req, res) => {
  const quota = await checkQuota(req.userId)
  if (!quota.allowed) {
    return res.status(429).json({
      error: { code: "QUOTA_EXCEEDED", message: "Daily limit reached", remaining: 0 }
    })
  }
  // ... proceed with translation using internally-managed model
  await db.recordUsage(req.userId, tokensUsed)
})
```

## 验证标准

- [ ] 新安装 → 自动有 Astra 账号 → 可以立即翻译 → 不需要任何配置
- [ ] Popup 只有：翻译按钮 + 语言选择 + 额度条
- [ ] 额度用完 → 友好提示 + 升级链接，不是技术错误
- [ ] Options Advanced 区域 → BYOK 依然可用
- [ ] 现有 BYOK 用户升级后 → 自动进入 custom 模式，不受影响
