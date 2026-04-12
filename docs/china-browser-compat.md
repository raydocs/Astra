# China Browser Compatibility Guide

Astra provides two Chromium build profiles to support the diverse browser landscape in China.

## Build Profiles

| Profile | Command | Target Browsers | Permissions |
|---------|---------|-----------------|-------------|
| **chromium-full** | `pnpm build` | Chrome, Edge | Full (webNavigation, contextMenus, alarms, commands) |
| **chromium-compat** | `pnpm build:compat` | 360, QQ, Sogou, 2345, mobile Chromium | Conservative (storage, tabs, activeTab only) |
| **firefox** | `pnpm build:firefox` | Firefox | Full + Gecko settings |
| **safari** | `pnpm build:safari` | Safari / iOS | Full + Safari settings |

## PC Browser Market Share & Support Matrix (China)

Research data (2025-2026, approximate desktop share):

| Browser | ~Share | Chromium Version | Extension Support | MV3 | Recommended Profile |
|---------|--------|-----------------|-------------------|-----|-------------------|
| Chrome | 35-40% | Latest | Chrome Web Store / .crx | Yes | chromium-full |
| Edge | 15-18% | Latest | Edge Add-ons / .crx | Yes | chromium-full |
| 360 安全浏览器 | 10-15% | ~110-118 | 360 Extension Store / .crx sideload | Partial | chromium-compat |
| QQ 浏览器 | 5-8% | ~94-108 | QQ Extension Store / .crx sideload | No (MV2) | chromium-compat |
| 搜狗浏览器 | 3-5% | ~80-90 | .crx sideload | No (MV2) | chromium-compat |
| 2345 浏览器 | 2-4% | ~78-90 | .crx sideload | No (MV2) | chromium-compat |
| UC 浏览器 (PC) | 1-2% | Older | Minimal | No | chromium-compat |

> **Important:** QQ, Sogou, 2345 browsers use Chromium cores that are 20-50+ versions behind Chrome. They typically only support MV2. Astra's current architecture is MV3-only. If these browsers are a priority target, a separate MV2 build pipeline would be needed (not currently implemented). The compat build reduces permission friction but still requires MV3 service worker support.
>
> **Dual-engine mode:** 360/QQ/Sogou ship with both Chromium and Trident/IE cores. Extensions only run in Chromium mode. Users in IE compatibility mode will not see Astra at all.

## Mobile Browser Market Share & Support Matrix (China)

Research data (2025-2026, approximate mobile share):

| Browser | ~Share | Platform | Engine | Extension Support | Status |
|---------|--------|----------|--------|-------------------|--------|
| Safari | 25-30% | iOS | WebKit | Safari Web Extension | **Supported** (Astra Shell) |
| Chrome (Android) | 15-20% | Android | Blink | None on mobile | Not supported |
| UC 浏览器 | 10-15% | Both | U4 (Blink) | Proprietary plugins only | Not supported |
| QQ 浏览器 | 8-12% | Both | X5 (Blink) | Proprietary plugins only | Not supported |
| 360 手机浏览器 | 3-5% | Android | Blink | Own store (proprietary) | Not supported |
| 夸克浏览器 | 3-5% | Both | Blink | None (AI-focused) | Not supported |
| Via 浏览器 | 1-2% | Android | System WebView | **Userscript support** | Experimental (compat) |
| Kiwi Browser | <1% | Android | Blink | **Chrome extensions** | Experimental (compat) |
| Lemur Browser | <1% | Android | Blink | Chrome extensions | Experimental (compat) |

> **Key insight:** No mainstream Chinese mobile browser supports the WebExtension API. Safari iOS is the only fully supported mobile path. Kiwi/Via/Lemur are niche but extension-capable.
>
> **For broader mobile reach**, a userscript version or a standalone web app/PWA would be needed (future roadmap). The compat build + responsive UI currently covers Kiwi/Via/Lemur users.
>
> **X5 and U4 engines** (QQ and UC) are Blink forks with non-standard quirks — CSS injection, DOM API differences, and data compression proxies can break content scripts.

## Feature Degradation in Compat Build

The compat build omits optional permissions to maximize compatibility:

| Feature | Full | Compat | Notes |
|---------|------|--------|-------|
| Page translation | Yes | Yes | Core feature, always available |
| Selection toolbar | Yes | Yes | Touch-friendly on mobile |
| Hover translation | Yes | Desktop only | Disabled on touch-only devices |
| Input translation | Yes | Yes | With mobile viewport handling |
| Float ball | Yes | Yes | Touch-sized on mobile |
| Keyboard shortcuts | Yes | No | `commands` API omitted |
| Context menu | Yes | No | `contextMenus` API omitted |
| Multi-frame support | Yes | Top-frame only | `webNavigation` API omitted |
| Periodic badge refresh | Yes | Startup + on-change only | `alarms` API omitted |
| PDF/EPUB/Subtitle readers | Yes | Yes | Responsive mobile layout |

## Packaging for Chinese Browser Stores

### 360 Extension Store
1. Build: `pnpm build:compat`
2. Zip: `pnpm zip:compat`
3. Submit `.zip` to [360 Extension Open Platform](https://ext.se.360.cn/)
4. Use localized description from `store/description.md`

### QQ Browser Extension Store
1. Build: `pnpm build:compat`
2. Zip: `pnpm zip:compat`
3. Submit to QQ Browser extension platform
4. QQ may require additional review for `host_permissions`

### Manual Sideload (all Chromium browsers)
1. Build: `pnpm build` or `pnpm build:compat`
2. Open browser extensions page (usually `chrome://extensions/`)
3. Enable "Developer mode"
4. Click "Load unpacked" and select `.output/chrome-mv3/`

### Mobile Sideload (Kiwi/Via/Lemur)
1. Build: `pnpm zip:compat`
2. Transfer `.zip` to device
3. Open browser extensions page
4. Install from file

## Smoke Test Checklist

Before submitting to any store, verify:

- [ ] Service worker starts without errors
- [ ] Content script injects on web pages
- [ ] Popup opens and loads config
- [ ] Options page renders (check mobile layout too)
- [ ] Page translation start/stop works
- [ ] Selection toolbar appears on text selection
- [ ] Selection toolbar works with touch (on mobile)
- [ ] PDF reader opens and translates
- [ ] EPUB reader opens and renders
- [ ] Subtitle reader parses files

## Architecture Notes

### Runtime API Detection
Background script (`src/entrypoints/background/index.ts`) wraps all optional API calls in existence checks AND try/catch blocks. This handles both:
- APIs missing from the manifest (compat build)
- APIs present in namespace but throwing permission errors (browser quirks)

### Frame Coordination Fallback
`frame-coordinator.ts` attempts `webNavigation.getAllFrames()` first, then falls back to synthesizing a top-frame entry from `tabs.get()`. This ensures page commands work even without `webNavigation` permission.

### Touch/Pointer Detection
Content overlays use `(pointer: coarse)` and `(hover: none)` media queries to:
- Gate hover translation (disabled on touch-only)
- Size toolbar buttons (larger touch targets)
- Use `selectionchange` instead of `mouseup` for selection detection

### Responsive UI
All HTML pages use `viewport-fit=cover` for safe-area support. Popup uses fluid width (280-400px). Options page switches from sidebar to top nav on narrow viewports (<640px).
