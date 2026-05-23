# China Browser Compatibility Guide

Astra provides Chromium build profiles that can help test China-market desktop browsers, but public launch claims must follow the canonical support matrix in `docs/investigations/support-matrix-2026-q2.md`.

## Claim boundary for public launch

| Platform family | Public launch status | Allowed wording | Do not claim |
|---|---|---|---|
| Chrome / standard Chromium desktop | Supported primary path | Chrome/Chromium is Astra's main validated desktop path. | Full parity across every Chromium fork or device profile. |
| Firefox desktop | Beta | Firefox has a build/release path and narrower beta validation. | Same maturity/performance as Chrome. |
| Desktop Safari | Beta | Desktop Safari has an active packaging/build path. | Chrome parity or iOS runtime proof. |
| iOS Safari shell | Experimental | iOS Safari shell exists for testing and iterative validation. | Fully supported mobile product or desktop parity. |
| Android / China mobile browsers | Not supported for launch, except niche experimental testing where extension support exists | No mainstream China mobile browser is a supported Astra launch target. | Mobile browser support, userscript support, or broad mobile compatibility. |

## Build Profiles

| Profile | Command | Intended use | Permissions |
|---------|---------|--------------|-------------|
| **chromium-full** | `pnpm build` | Chrome and standard Chromium-family desktop testing | Full extension profile (`webNavigation`, `contextMenus`, `alarms`, commands where available) |
| **chromium-compat** | `pnpm build:compat` | Conservative desktop Chromium-fork testing; not a support-parity claim | Conservative (`storage`, `tabs`, `activeTab` only) |
| **firefox** | `pnpm build:firefox` | Firefox beta package path | Gecko settings |
| **safari** | `pnpm build:safari` | Desktop Safari beta package path and iOS shell resource sync | Safari settings |

> **Important:** “Buildable” is not the same as “supported.” The compat build reduces optional API usage, but it is still a Manifest V3 extension path and does not make older MV2-only browsers supported.

## PC Browser Compatibility Notes (China)

These notes are operational guidance, not market-share claims or launch approval.

| Browser | Expected extension reality | Recommended profile | Launch-safe status |
|---------|----------------------------|---------------------|-------------------|
| Chrome | Modern MV3 extension support | `chromium-full` | Supported primary path |
| Edge | Modern Chromium extension support | `chromium-full` | Chromium-family desktop, but not a separate parity claim |
| 360 安全浏览器 | Chromium fork; MV3/API behavior can vary by version and mode | `chromium-compat` for exploratory testing | Compatibility testing only until store/device evidence is recorded |
| QQ 浏览器 | Often older Chromium core / MV2-oriented extension behavior | `chromium-compat` only if MV3 works in the tested version | Not supported for launch |
| 搜狗浏览器 | Older Chromium core likely; extension APIs can be incomplete | `chromium-compat` only if MV3 works in the tested version | Not supported for launch |
| 2345 浏览器 | Older Chromium core likely; extension APIs can be incomplete | `chromium-compat` only if MV3 works in the tested version | Not supported for launch |
| UC 浏览器 (PC) | Older/non-standard extension behavior | Exploratory only | Not supported for launch |

> **Dual-engine mode:** Some China desktop browsers ship both Chromium and Trident/IE modes. Astra content scripts can only run in Chromium/WebExtension-compatible mode. IE compatibility mode is out of scope.

## Mobile Browser Compatibility Notes (China)

No mainstream China mobile browser is a supported Astra public-launch target. The iOS Safari shell remains **experimental** under the canonical support matrix, and Android browsers that support Chrome extensions are niche testing targets rather than launch-supported platforms.

| Browser | Platform | Extension support reality | Launch-safe status |
|---------|----------|---------------------------|-------------------|
| Safari | iOS | Safari Web Extension shell path exists | Experimental, not supported parity |
| Chrome (Android) | Android | Chrome extensions are not supported on standard mobile Chrome | Not supported |
| UC 浏览器 | Android/iOS | Proprietary/non-standard plugin behavior | Not supported |
| QQ 浏览器 | Android/iOS | Proprietary/non-standard plugin behavior | Not supported |
| 360 手机浏览器 | Android | Proprietary store/plugin behavior | Not supported |
| 夸克浏览器 | Android/iOS | No WebExtension launch path | Not supported |
| Via 浏览器 | Android | Userscript-oriented path, not Astra WebExtension support | Not supported for launch |
| Kiwi Browser | Android | Chrome-extension capable but niche and not in the canonical support matrix | Experimental testing only |
| Lemur Browser | Android | Chrome-extension capable but niche and not in the canonical support matrix | Experimental testing only |

> **For broader mobile reach:** a userscript, native app, or standalone mobile web/PWA path would need its own product plan, evidence, privacy review, and store/legal claims. The current compat build and responsive UI do not create a public mobile support claim.

## Feature Degradation in Compat Build

The compat build omits optional permissions to maximize the chance of running on stricter Chromium-family browsers. This table describes expected degradation only; each browser/store still needs evidence before external claims are made.

| Feature | Full profile | Compat profile | Notes |
|---------|--------------|----------------|-------|
| Page translation | Yes | Expected, if MV3 content scripts run | Core feature; still depends on browser API compatibility |
| Selection toolbar | Yes | Expected, if content scripts run | Touch behavior is not a mobile support claim |
| Hover translation | Yes | Desktop only | Disabled or impractical on touch-only devices |
| Input translation | Yes | Expected, if content scripts run | Sensitive-input suppression still applies heuristically |
| Float ball | Yes | Expected, if content scripts run | Touch-sized UI does not imply mobile support |
| Keyboard shortcuts | Yes | No | `commands` API omitted |
| Context menu | Yes | No | `contextMenus` API omitted |
| Multi-frame support | Yes | Narrower | `webNavigation` API omitted; fallback is top-frame oriented |
| Periodic badge refresh | Yes | Startup + on-change only | `alarms` API omitted |
| PDF/EPUB/subtitle-file readers | Beta/controlled reader surfaces | Expected only if extension pages and file access work | Do not claim universal document/video support from compat behavior |

## Packaging for Chinese Browser Stores

Chinese browser-store submission is not part of the Chrome-first free public beta unless a separate evidence record and store/legal review are completed.

### 360 Extension Store (future / conditional)
1. Build: `pnpm build:compat`
2. Zip: `pnpm zip:compat`
3. Submit to the 360 Extension Open Platform only after MV3 runtime smoke evidence is recorded for the target version.
4. Use launch-safe localized copy from `store/description.md` and this compatibility guide.

### QQ Browser Extension Store (future / conditional)
1. Confirm the target QQ Browser version supports the required MV3 extension model.
2. Build: `pnpm build:compat`
3. Zip: `pnpm zip:compat`
4. Submit only after target-version smoke evidence is recorded.

### Manual Sideload (developer/testing only)
1. Build: `pnpm build` or `pnpm build:compat`
2. Open the browser extensions page (usually `chrome://extensions/` or the browser-specific equivalent)
3. Enable developer mode
4. Load the generated extension output for testing

### Mobile sideload (experimental testing only)

Mobile sideloading on Kiwi/Lemur-style browsers is an experimental testing activity, not a public support path. Do not use mobile sideload success as store-copy evidence without a separate review.

## Smoke Test Checklist

Before any China-browser store submission or external compatibility claim, record browser name, version, OS, build profile, artifact SHA, and screenshots/logs for:

- [ ] Service worker starts without errors
- [ ] Content script injects on public web pages
- [ ] Popup opens and loads config
- [ ] Options page renders
- [ ] Page translation start/stop works
- [ ] Selection toolbar appears on text selection
- [ ] Privacy Mode/request-context behavior is still accurate for the tested path
- [ ] Provider routing works through the intended direct or managed beta relay path
- [ ] PDF reader opens and translates if the submission copy mentions PDF
- [ ] EPUB reader opens and renders if the submission copy mentions EPUB
- [ ] YouTube/Bilibili subtitle paths are smoke-tested if any subtitle claim is included

## Architecture Notes

### Runtime API Detection
Background script (`src/entrypoints/background/index.ts`) wraps optional API calls in existence checks and try/catch blocks. This handles both:
- APIs missing from the manifest (compat build)
- APIs present in the namespace but throwing permission errors (browser quirks)

### Frame Coordination Fallback
`frame-coordinator.ts` attempts `webNavigation.getAllFrames()` first, then falls back to synthesizing a top-frame entry from `tabs.get()`. This helps page commands work even without `webNavigation` permission, but it is not a full multi-frame parity guarantee.

### Touch/Pointer Detection
Content overlays use `(pointer: coarse)` and `(hover: none)` media queries to:
- Gate hover translation on touch-only devices
- Size toolbar buttons for coarse pointers
- Use selection-change oriented behavior where appropriate

These responsive affordances are useful for testing but do not create a mobile support claim.

### Responsive UI
Extension pages use responsive layout patterns for narrow viewports. This improves portability but does not change the canonical support tier for mobile or niche browsers.
