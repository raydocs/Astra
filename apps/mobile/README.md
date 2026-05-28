# Astra Mobile Review Companion

This is the isolated native-mobile scaffold for Astra's iOS and Android review companion.
It intentionally lives under `apps/mobile/` so the existing root `ios/` Safari Web Extension host remains untouched.

## Product scope

V0 follows `docs/plans/astra-mobile-companion-review-plan-2026-05-27.md`:

- Web/desktop is for capture.
- Mobile is for habit.
- First native surfaces are Today, Library, and Me.
- No mobile full-page translation, YouTube overlay, provider/model/API settings, or complex control-plane UI.

## Commands

From the repo root after installing mobile dependencies:

```bash
pnpm mobile:dev
pnpm mobile:ios
pnpm mobile:android
pnpm mobile:verify
```

Runtime notes:

- Mobile state uses AsyncStorage so device id, saved cards, and offline review queue survive app restarts; session tokens are stored through Expo SecureStore.
- The API base URL comes from `EXPO_PUBLIC_ASTRA_API_BASE_URL`; local development falls back to the built-in localhost default. Preview/production builds must provide a deployed HTTPS relay URL.
- EAS preview/production profiles set `EXPO_PUBLIC_ASTRA_BUILD_PROFILE` so release-like endpoint checks run even when `EAS_BUILD_PROFILE` is unavailable at runtime. `EXPO_PUBLIC_*` values are bundled into the app, so use them only for non-secret public release metadata such as the deployed relay origin; provider/API secrets stay server-side in the relay.
- Use `http://10.0.2.2:8787/v1` for Android emulator development against a local relay, a LAN URL for physical devices, or a deployed HTTPS relay.
- Store release drafts live under `store/` and are checked by `pnpm mobile:verify`.

Or from this directory:

```bash
pnpm install
pnpm ios
pnpm android
```

The app is Expo-managed with native projects generated under `apps/mobile/ios` and `apps/mobile/android`. Do not run Expo prebuild from the repository root; the existing root `ios/` folder is the Safari Web Extension host.

Native verification used here:

```bash
pnpm --dir apps/mobile exec expo prebuild --platform ios --no-install
pnpm --dir apps/mobile exec expo prebuild --platform android --no-install
pnpm mobile:ios:pods
xcodebuild -list -project apps/mobile/ios/AstraReview.xcodeproj
pnpm mobile:ios:build:generic
pnpm mobile:android:assemble
```

`xcodebuild -list` should expose the `AstraReview` scheme. `pod install` was verified and creates `AstraReview.xcworkspace`; generic iOS build additionally requires the matching iOS platform component installed in Xcode. Android debug assembly needs a local JDK and Android SDK. On this machine Android was verified with Homebrew `openjdk@17` and Android command line tools at `/opt/homebrew/share/android-commandlinetools`; the helper script uses those defaults when `JAVA_HOME` / `ANDROID_HOME` are not already set.
