# Astra Web Landing Redesign UI System Plan

Last updated: 2026-05-12

## Goal

把 `Astra Web Landing Redesign - standalone.html` 转成可执行的设计续作清单：设计师接下来要补齐哪些 landing page、`/sign-in`、响应式、状态、组件、token、可访问性和交付物，才能让工程后续重做 `web/` 站点 UI 时少做临场决策。

本计划只规划设计与交付标准，不做实现。

## Background

- 独立 HTML 是一个打包后的设计画布；可行动内容在 `Astra Web Landing Redesign - standalone.html:179`，包含 `Diagnosis`、`A · Marginalia hero`、`B · Editorial sample`、`C · Dedicated sign-in`，并覆盖 Quiet Reader 与 Constellation 两个方向。
- 这份 redesign 的核心判断是：当前 public hero 过度依赖大号营销标题和嵌入式登录卡；新的首屏应该让产品样本自己解释 Astra，即「working marginalia demo + restrained serif headline + small CTA」；登录应移到独立 `/sign-in` 页面（`Astra Web Landing Redesign - standalone.html:179`）。
- 当前 `web/` 是一个单文件主应用：`AppRoute` 没有 `/sign-in`（`web/src/app.tsx:113`），`PublicLandingPage` 仍把 hero、Start free、完整 sign-in form、relay endpoint、product shot 和 feature grid 放在同一个 surface 里（`web/src/app.tsx:1313-1522`）。
- Web CSS 已经接入 Style 1：`web/src/styles.css` import `src/assets/astra-style1-tokens.css`，并桥接到 `--bg-*`、`--label-*`、`--accent-primary`、radius、shadow、focus ring 等 web alias（`web/src/styles.css:1-69`）。默认主题是 light（`web/src/main.tsx:8-10`）。
- 当前 public landing 已有 nav、hero、login panel、browser-frame product shot、feature grid、responsive breakpoints（`web/src/styles.css:144-443`, `web/src/styles.css:1089-1243`），但它们是 CSS class 层面的局部约定，不是完整 UI system。
- 既有 UI audit 仍然适用：Astra 缺少共享 Button/Card/Input/Badge primitives，字体/间距/圆角尺度不统一，可访问性与交互状态覆盖不足（`docs/analysis/ui-design-baseline-audit-2026-04-24.md:11-14`, `docs/analysis/ui-design-baseline-audit-2026-04-24.md:70-105`, `docs/analysis/ui-design-baseline-audit-2026-04-24.md:199-206`）。
- Web/PWA companion 的产品边界是 portable text、imported content、account access、synced assets；landing copy 不能暗示 web 端支持 extension-only 的 live page injection / hover overlay / browser command 等能力（`docs/specs/web-pwa-companion.md:3-35`, `docs/specs/web-pwa-companion.md:78-88`）。

## Recommended Direction

下一步设计范围应是 **Landing redesign + dedicated `/sign-in` + landing/auth UI-system subset**，不是一次性重做整个 web app。

推荐决策：

1. **Quiet Reader 作为生产范围**：完成 desktop / tablet / mobile 全量 artboards。
2. **Constellation 作为 token-ready exploration**：保留 desktop 级别探索和 token mapping，但不把 dark toggle 当作首轮上线阻塞项，除非产品明确追加范围。
3. **`/sign-in` 必须成为现有 SPA 的新 public route**：在当前 `AppRoute` 体系内新增页面，而不是另建独立静态入口；landing hero 不再承载完整登录表单。
4. **`Use instantly` 成功后默认进入现有 `/text` workspace**：本计划只要求 sign-in/landing 说明这个去向，不要求 redesign `/text`。
5. **必须交付小型 Web Landing Kit**：避免 landing 实现时继续堆一次性 CSS；但不要求现在重构 `/text`、`/articles`、`/assets`、`/account` 等已登录 workspace。

## What Still Needs Design

### 1. Landing page artboard set

设计师需要补齐以下生产 artboards：

| Viewport | Required | Purpose |
|---|---|---|
| Desktop 1440 full page | Yes | 主工程基准；对齐 standalone redesign 的 1440 artboards。 |
| Laptop 1280 full page | Spot-check | 只在 1440 方案定稿后检查 headline 与 nav 密度。 |
| Tablet 834 或 768 wide | Yes | 验证 marginalia sample 如何从双栏变为 stacked/offset。 |
| Mobile 390 wide | Yes | iPhone 主规格；验证首屏信息顺序、CTA、product sample。 |
| Small mobile 360 wide | Spot-check | 只压力测试 nav、按钮换行、feature card、登录入口。 |

Landing 必须包含：

- public nav：brand、Reader/Subtitles/Workspace 类入口、Sign in CTA。
- product-led marginalia hero：真实 bilingual reading sample，而不是纯营销插画。
- CTA cluster：`Start free` / `Open workspace` / `Install PWA` 的优先级和出现条件。
- proof/trust strip：少量可信信号，不要堆功能标签。
- one editorial sample：一个强产品样本即可，不要多张装饰 mockup。
- supporting features：只解释 web/PWA 能力边界内的能力。
- footer/final CTA：如果保留，要说明 extension 与 web 的边界。
- public message/banner state：对应当前 `props.message`（`web/src/app.tsx:1380-1388`）。

### 2. Marginalia hero and editorial sample

Standalone redesign 已经给出方向，设计师还需要把它变成工程可读规格：

- hero headline：desktop 约 64px，不回到 current 过大的 96px 语气；tablet 约 44–52px；mobile 约 34–40px。
- sample content：用 imported article / reading workspace 语境，不用“任意网页即时改写”语境。
- marginalia vocabulary：
  - 2px accent rail；
  - italic serif translation/gloss；
  - selected phrase underline；
  - saved-word chip；
  - one inline note aligned to a paragraph；
  - optional Keep/Save affordance：如果设计里出现，必须在 Open Questions 里确认它只是静态展示，还是会触发真实保存流程。
- editorial sample：展示 Deep Read / reading workspace 的完整感觉：正文、margin gloss、saved words rail、progress pill 或 learning-loop cue。
- mobile collapse：明确 rail、chips、note、progress pill 在 390/360 宽下的顺序和是否折叠。

不要设计多个“看起来像浏览器截图”的 product shots。当前 `web/src/app.tsx:1485-1512` 已有简单 browser frame；redesign 的价值是把它替换为一个可信、真实、可读的产品样本。

### 3. Dedicated `/sign-in` page

当前 sign-in 嵌在 landing hero（`web/src/app.tsx:1428-1479`）。设计师要产出独立 `/sign-in` 页面，并覆盖状态矩阵。

默认层级：

1. Astra brand。
2. 简短说明：例如 “Use Astra instantly, or sign in to sync your workspace.”
3. Primary `Use instantly`（anonymous Astra relay / preview path）。
4. Divider。
5. Email/password form。
6. Password show/hide state。
7. Advanced relay endpoint disclosure。
8. Preview/privacy/limits note。
9. Back to landing。

必须设计的状态：

| State | Required design detail |
|---|---|
| Default | Paper-card centered layout；primary anonymous start first。 |
| Boot loading | “Checking for an existing Astra session…” 对应当前 boot copy。 |
| Use instantly loading | Disabled controls + loading label。 |
| Email/password loading | Disabled controls + button loading label。 |
| Empty field validation | Field-level error；不要只放卡片顶部。 |
| Invalid credentials/server error | Card-level error + retry affordance。 |
| Relay error | Error copy + advanced disclosure affordance。 |
| Advanced collapsed | 默认只露出小 “Advanced” 行，不吓到普通用户。 |
| Advanced expanded | API base URL input、helper copy、invalid URL state。 |
| Signed-in visit | “You’re already signed in” + Open workspace + Back to landing。 |
| PWA install available | Secondary install affordance。 |
| PWA install unavailable | 不显示或弱化 install。 |
| Mobile | 390/360 宽完整表单与键盘安全布局。 |

导航与路由约定：未登录 public nav 的 “Sign in” 应进入现有 SPA 内的新 `/sign-in` route，而不是跳到 `/account` 后再处理登录语境。`Use instantly` 成功后进入现有 `/text` workspace；设计只需给登录页成功/跳转反馈，不要求重做 `/text` 空状态。

### 4. Web Landing Kit component inventory

这不是全站 UI library，而是 landing/auth 必须复用的最小 kit。每个组件都要给 default / hover / focus-visible / disabled / loading / mobile 行为（适用时）。导航、proof strip、feature cards、CTA group 等只需要在 artboard 上做 inline spec，不要膨胀成长期组件。

| Component | Variants/states | Current anchor |
|---|---|---|
| Button | primary, secondary, ghost/link, disabled, loading, full-width, large | `.button`, `.primary`, `.secondary`, `.ghost` in `web/src/styles.css:602-665` |
| Card/panel | paper, elevated, bordered, compact, product-sample | `.public-login-panel`, `.public-feature`, `.browser-frame` |
| Input/field | email, password, URL, error, disabled, helper, focus | `.field`, auth form |
| Password field | show/hide, focus order, accessible name | current show/hide button in `web/src/app.tsx:1447-1453` |
| Disclosure | advanced collapsed/expanded/error | `.advanced-login-settings` |
| Message/banner | info, success, error, dismissible | `.public-message` |
| Product sample frame | paper/marginalia, not only browser chrome | replaces current `.browser-frame` direction |
| Marginalia rail | source, target, note, saved chip, accent rail; scoped inside product sample unless later reused | new pattern from standalone HTML |
| Focus ring | all interactive states | `--focus-ring` alias |

设计交付物里应有 component spec table：组件名、用途、variants、states、token、responsive rule、工程备注。

### 5. Token and visual-system decisions

不要引入独立 landing-only 色彩系统。设计应映射到现有 Style 1 / web aliases：

- `--bg-primary`
- `--bg-secondary`
- `--bg-tertiary`
- `--label-primary`
- `--label-secondary`
- `--label-tertiary`
- `--accent-primary`
- `--accent-highlight`
- `--separator`
- `--separator-strong`
- `--shadow-sm/md/lg`
- `--focus-ring`

需要设计师明确的 token 表：

| Area | Decision needed |
|---|---|
| Typography | Serif for editorial headings/product reading, sans for UI, mono for endpoint/technical snippets。 |
| Type scale | Display/H1/H2/H3/body/small/caption desktop + mobile values。 |
| Spacing | 4/8/12/16/24/32/48/64/96 scale；section gaps 与 card internals。 |
| Radius | inputs/chips/cards/large panels/pills 对应现有 radius aliases。 |
| Elevation | nav blur、paper card、product sample、toast/banner 的 shadow rules。 |
| Accent rail | 2px rail、selected underline、saved chip fill、muted rail。 |
| Theme | Quiet production；Constellation mapping 是否只是 exploration。 |
| Motion | 初版建议 static-first；如有动画必须给 reduced-motion fallback。 |

### 6. Copy deck and positioning boundaries

设计师应交付一份 copy deck：headline、subhead、CTA、proof strip、feature cards、trust/preview note、extension-vs-web boundary sentence、pricing/relay placeholder。Deck 内必须带 do/don't 边界：

- 可以说：translate pasted text；import/read PDFs、EPUBs、subtitles、articles；save reading workspaces；sync/account/assets where available；managed relay during preview；install as PWA where supported。
- 不要说或必须限定：“Translate any website on mobile”、“Works on every page”、“Live page overlays in web”、“Live YouTube/streaming subtitles in web”、“Offline translation”、“Unlimited free AI translation”、未经确认的强隐私/不记录承诺。

可用的谨慎占位文案：

> Free preview includes managed relay access with usage limits. Use the browser extension for live page translation; Astra Web is for imported content, files, and portable reading workspaces.

### 7. Accessibility and responsive specs

设计 handoff 必须包含 landing-specific 可访问性规格，并引用既有 UI audit 的通用 a11y 风险（`docs/analysis/ui-design-baseline-audit-2026-04-24.md:109-139`）。本计划最关键的是：

- password show/hide 有明确 accessible name。
- advanced disclosure 的 expanded/collapsed、错误状态和 URL field 关联清楚。
- loading/error message 是否需要 aria-live。
- proof chips、selected phrase、accent rail 不能只靠颜色表达状态。
- mobile reading order 明确：nav → hero copy → primary CTA → product sample → trust/proof → editorial sample → features/final CTA。
- 如果 product sample 有动画，必须给 reduced-motion fallback。

## Ordered Work Items for Design

1. **Lock scope decisions**
   - Quiet Reader = production。
   - Constellation = token-ready exploration unless explicitly expanded。
   - `/sign-in` = existing SPA route, not a separate static page。
   - `Use instantly` success target = existing `/text` workspace。
   - Web Landing Kit subset = required；full authenticated workspace redesign = non-goal。

2. **Finalize landing desktop direction**
   - Use marginalia hero as the primary product explanation。
   - Remove embedded sign-in from hero。
   - Keep headline restrained and product sample visually dominant。
   - Keep copy inside Web/PWA companion boundary。

3. **Design the product samples**
   - Hero marginalia sample。
   - One editorial Deep Read / reading workspace sample。
   - Saved-word rail / chip / progress cue behavior。
   - Static-first sample specification with optional future motion notes。

4. **Design dedicated `/sign-in`**
   - Default, anonymous start, email/password, loading, validation, relay advanced, signed-in, PWA install, mobile。
   - Include exact copy and error placement。

5. **Complete responsive variants**
   - Required: 1440, 834/768, 390。
   - Spot-check: 1280, 360。
   - Define stacking, nav collapse, CTA wrapping, sample rail collapse, feature grid collapse。

6. **Specify Web Landing Kit**
   - Component table for Button, Card/panel, Input/field, Password field, Disclosure, Message/banner, Product sample frame, Marginalia rail, Focus ring。
   - Spec nav/proof strip/feature cards inline on artboards.
   - Include states and token mappings。

7. **Finalize token table**
   - Map Figma variables to existing CSS aliases。
   - Define type scale, spacing, radius, elevation, rail/highlight rules。
   - Mark Constellation as exploratory or production explicitly。

8. **Write copy deck**
   - Product-safe headline/subhead/CTAs。
   - Trust/preview/relay language。
   - Extension-vs-web boundary copy。
   - Feature cards tied to actual web routes/capabilities。

9. **Attach accessibility checklist**
   - Heading/landmark/form/focus/contrast/loading/reduced-motion/mobile target requirements。

10. **Prepare engineering handoff**
    - Figma links and exported PNGs.
    - Component/state/token tables.
    - Route expectation: add `/sign-in`; unauthenticated nav Sign in goes there.
    - Future engineering touchpoints: `web/src/app.tsx`, `web/src/styles.css`, `web/src/main.tsx` only if theme scope expands, and `docs/design-comparison/README.md` for follow-up visual QA.

## Open Questions

These are the only decisions that should block the designer before final handoff:

1. Should Constellation/dark override the recommended exploration-only scope and become launch scope?
2. If the marginalia sample shows Keep/Save, is it static illustration or a real saved-word action?
3. Which trust/preview/pricing sentence is product-approved for managed relay and future Pro limits?
4. Should advanced relay endpoint state survive navigation from landing to `/sign-in`, or stay local to the sign-in page?

## References

- `Astra Web Landing Redesign - standalone.html:179`
- `web/src/app.tsx:113`, `web/src/app.tsx:1313-1522`
- `web/src/styles.css:1-69`, `web/src/styles.css:144-443`, `web/src/styles.css:1089-1243`
- `web/src/main.tsx:8-10`
- `docs/analysis/ui-design-baseline-audit-2026-04-24.md:11-14`, `docs/analysis/ui-design-baseline-audit-2026-04-24.md:70-105`, `docs/analysis/ui-design-baseline-audit-2026-04-24.md:199-206`
- `docs/design-comparison/README.md:48-61`
- `docs/specs/web-pwa-companion.md:3-35`, `docs/specs/web-pwa-companion.md:78-88`
