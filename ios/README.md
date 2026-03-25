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

## Suggested Next Step

After this skeleton lands, the next practical step is a real device / simulator smoke test pass and then fixing only the Safari-specific runtime gaps that are actually reproduced.
