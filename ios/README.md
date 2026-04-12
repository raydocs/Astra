# iOS Safari Shell Integration

Astra 的 iOS 目录只负责 **Safari Web Extension 宿主壳** 与 **Xcode 打包**。
Web Extension 业务代码仍然来自仓库根目录的 `src/`，并通过 WXT 的 Safari 构建产物接入。

> 这次提交解决的是 **壳工程骨架 + 接入流程**，不代表 iOS Safari 运行时已经完成设备验证。

## 当前结论：现有 code base 已经可以开始做

当前仓库已经具备以下开工条件：

- 已有 `pnpm build:safari` 构建链路
- 已有 Safari 目标配置（`wxt.config.ts`）
- popup / content / background / storage / messaging 已完整成型
- 已成功用 Xcode 自带的 `safari-web-extension-converter` 生成 iOS-only 壳工程

当前还需要持续验证的点：

- iOS Safari 对 MV3 background `type: "module"` 的实际兼容性
- service worker 生命周期在真机上的稳定性
- popup / content / runtime messaging 在 iOS Safari 下的行为差异

所以结论是：**可以开始做，而且这次提交已经把最小壳工程骨架落进仓库。**

## Directory Layout

```text
ios/
  AstraShell.xcodeproj/          # Xcode project
  AstraShell/                    # iOS host app
  AstraShell Extension/          # Safari Web Extension target
  scripts/sync-safari-build.sh   # .output/safari-mv3 -> Extension resources
  README.md
```

## Prerequisites

- macOS + Xcode
- iOS 16.4+
- Node.js + pnpm
- Apple Developer signing capability for real-device testing

## First Run

```bash
pnpm install
pnpm ios:prepare
open ios/AstraShell.xcodeproj
```

Then in Xcode:

1. Select the `AstraShell` scheme
2. Set your Team for both `AstraShell` and `AstraShell Extension`
3. Replace the placeholder bundle identifiers if needed
4. Run the app on simulator or device
5. Enable the extension in **Settings > Apps > Safari > Extensions > AstraShell**
6. Open Safari and verify popup / page translation flow

## Daily Update Flow

Whenever the Web Extension code changes:

```bash
pnpm build:safari
pnpm ios:sync-extension
```

Or use the one-shot helper:

```bash
pnpm ios:prepare
```

The Xcode project also includes a build phase that re-syncs `.output/safari-mv3` into `ios/AstraShell Extension/Resources` before packaging the extension target.

## Resource Sync Contract

- Source: `.output/safari-mv3/`
- Destination: `ios/AstraShell Extension/Resources/`
- Owner: `ios/scripts/sync-safari-build.sh`

Do not manually edit files inside `ios/AstraShell Extension/Resources` unless you are debugging the generated bundle layout.
The directory is committed as a generated bootstrap snapshot, but the authoritative source remains `.output/safari-mv3`.

## Smoke Test Checklist

- [ ] Host app launches successfully
- [ ] Safari extension can be enabled from iOS Settings
- [ ] Popup opens inside Safari
- [ ] Astra Web / PWA sign-in succeeds through the shared front-door `POST /v1/auth/session` contract on mobile Safari
- [ ] `GET /v1/auth/session` and `DELETE /v1/auth/session` behave correctly after that sign-in on mobile Safari/PWA
- [ ] API key can be saved
- [ ] `browser.storage.local` persists config after reload
- [ ] Page translation can start and stop
- [ ] Content scripts inject correctly on normal pages
- [ ] Background translation requests complete successfully

## Known Caveats

### 1. MV3 background module warning

When the shell project was generated with Xcode's `safari-web-extension-converter`, it reported that the manifest key `background.type` may not be supported by the current Safari runtime.

Astra currently outputs:

```json
"background": {
  "type": "module",
  "service_worker": "background.js"
}
```

Treat this as a **validation item**, not a reason to block the shell skeleton work. If iOS Safari proves incompatible in device testing, handle that as a focused follow-up change in the Safari build path.

### 2. iOS behavior is not identical to desktop Safari

Desktop-oriented capabilities such as keyboard shortcuts should not be treated as required on iOS.

## Minimal Host Bridge (Deep Link + Bootstrap Handoff)

The iOS shell includes a **thin host bridge** for launch/open/handoff validation:

- `SceneDelegate` + `AppDelegate` accept deep links in the form `astra-shell://bootstrap?...`
- Host bootstrap state is stored in-memory (`HostBridgeBootstrapStore`) with a short history buffer
- `ViewController` shows latest state + recent history and publishes:
  - `window.AstraHostBootstrap`
  - `window.AstraHostBootstrapHistory`
- `SafariWebExtensionHandler` supports native-message bridge commands:
  - `sessionBootstrap` → returns `sessionBootstrapAck` with generated `launchURL`
  - `bootstrapStatus` → returns latest bridge snapshot
  - `bootstrapHistory` → returns recent bridge events for replay UX

This remains launcher/handoff scope only. It does **not** implement shared keychain sync, full native auth, or full mobile account management.

### Launch / Open / Handoff narrative

1. User opens popup/onboarding in iOS Safari.
2. Extension sends `sessionBootstrap` through the native bridge.
3. Handler returns `astra-shell://bootstrap?...` launch URL.
4. Extension opens that URL (`Open in Astra App`).
5. Host consumes deep link and surfaces bridge status/history.

### Install + Open-in-app path

1. Install `AstraShell` from Xcode build.
2. Enable extension in **Settings → Apps → Safari → Extensions → AstraShell**.
3. Open Safari and open Astra popup/onboarding.
4. Tap **Open in Astra App**.
5. Optional: use **Replay last handoff** from popup/onboarding if a prior bridge event exists.

### Responsibility split (Host / Extension / Web)

- **Host app (`ios/AstraShell`)**
  - Accept deep links
  - Hold in-memory bootstrap state + history for visibility
  - Render host-side bridge status UI
- **Safari extension (`src` + `ios/AstraShell Extension`)**
  - Trigger bootstrap handshake
  - Show bridge availability, history, and replay/open actions in popup/onboarding
  - Continue to own translation/session logic in extension runtime
- **Web app (`web/`)**
  - Not the bridge state owner for iOS host launch/open/handoff
  - Acts as the portable cloud/control-plane surface for sign-in/session validation plus account summary, export, delete, and manual sync repair
  - Reuses the shared front-door auth/session contract, but does not take over native launch/open/handoff UI or imply full native auth/session materialization

### Example native message (extension -> handler)

```json
{ "type": "sessionBootstrap", "sessionId": "abc123", "source": "popup" }
```

### Example ack payload

```json
{
  "ok": true,
  "type": "sessionBootstrapAck",
  "sessionId": "abc123",
  "source": "popup",
  "launchURL": "astra-shell://bootstrap?sessionId=abc123&source=popup&issuedAt=..."
}
```

### Example history payload

```json
{
  "ok": true,
  "type": "bootstrapHistory",
  "events": [
    {
      "sessionId": "abc123",
      "source": "popup-open-in-app",
      "issuedAt": "2026-04-11T00:00:00Z",
      "launchURL": "astra-shell://bootstrap?..."
    }
  ]
}
```

## Current stage boundary

This phase stays **bridge-first / Web-PWA-first**:

- use the iOS shell to validate launch/open/handoff behavior
- use Astra Web on mobile Safari/PWA for portable sign-in/session + cloud control-plane tasks
- do **not** reinterpret that portable web coverage as Android work, native parity, or full mobile account/session ownership

## Suggested Next Step

Run the iOS smoke test checklist with bridge history/replay checks plus the mobile web control-plane checkpoint, then fix only reproduced Safari-runtime gaps.
