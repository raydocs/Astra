import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const required = [
  "app.json",
  "eas.json",
  "android/app/build.gradle",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/debug/AndroidManifest.xml",
  "android/gradlew",
  "ios/AstraReview.xcodeproj/project.pbxproj",
  "ios/AstraReview.xcworkspace/contents.xcworkspacedata",
  "ios/AstraReview/AstraReview.entitlements",
  "ios/AstraReview/Info.plist",
  "ios/AstraReview/PrivacyInfo.xcprivacy",
  "ios/Podfile.lock",
  "package.json",
  "index.ts",
  "scripts/ensure-mobile-deps.mjs",
  "scripts/android-assemble-debug.mjs",
  "src/App.tsx",
  "src/domain/review.ts",
  "src/domain/review.test.ts",
  "src/domain/offlineQueue.ts",
  "src/domain/offlineQueue.test.ts",
  "src/domain/cloudVocabulary.ts",
  "src/domain/cloudVocabulary.test.ts",
  "src/domain/mobileAccessibility.ts",
  "src/domain/mobileAccessibility.test.ts",
  "src/domain/mobileMembership.ts",
  "src/domain/mobileMembership.test.ts",
  "src/domain/retentionAnalytics.ts",
  "src/domain/retentionAnalytics.test.ts",
  "src/api/astraClient.ts",
  "src/api/astraClient.test.ts",
  "src/runtime/mobileRuntime.ts",
  "src/runtime/mobileRuntime.test.ts",
  "src/runtime/mobileOAuth.ts",
  "src/runtime/mobileOAuth.test.ts",
  "src/runtime/mobileNotifications.ts",
  "src/runtime/mobileNotifications.test.ts",
  "src/runtime/mobileSpeech.ts",
  "src/runtime/mobileSpeech.test.ts",
  "src/state/asyncStorage.ts",
  "src/state/secureStorage.ts",
  "src/state/mobileAppState.ts",
  "src/state/mobileAppState.test.ts",
  "src/state/mobileStorage.ts",
  "src/screens/TodayScreen.tsx",
  "src/screens/SignInScreen.tsx",
  "src/screens/LibraryScreen.tsx",
  "src/screens/MeScreen.tsx",
  "store/README.md",
  "store/ios/app-store-connect.md",
  "store/android/play-listing.md",
  "store/privacy.md",
  "store/reviewer-notes.md",
  "store/screenshots/README.md",
  "store/signed-build-qa.md",
  "store/release-checklist.md",
]

const missing = required.filter((file) => !existsSync(join(root, file)))
if (missing.length > 0) {
  console.error(`Missing mobile scaffold files: ${missing.join(", ")}`)
  process.exit(1)
}

function source(file) {
  return readFileSync(join(root, file), "utf8")
}

function assertIncludes(file, terms, label = file) {
  const text = source(file)
  const missingTerms = terms.filter((term) => !text.includes(term))
  if (missingTerms.length > 0) {
    console.error(`Mobile ${label} is missing required terms: ${missingTerms.join(", ")}`)
    process.exit(1)
  }
  return text
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "10.0.2.2" || hostname === "::1" || hostname === "[::1]"
}

function isDeployedHttpsUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === "https:" && !isLocalHost(parsed.hostname)
  } catch {
    return false
  }
}

const appJson = JSON.parse(source("app.json"))
const packageJson = JSON.parse(source("package.json"))
const easJson = JSON.parse(source("eas.json"))
if (!appJson.expo?.ios?.bundleIdentifier || !appJson.expo?.android?.package) {
  console.error("Mobile scaffold must define both iOS bundleIdentifier and Android package.")
  process.exit(1)
}
if (appJson.expo?.scheme !== "astra-review") {
  console.error("Mobile app.json must keep the astra-review deep-link scheme.")
  process.exit(1)
}
const appConfigDefaultApiBaseUrl = appJson.expo?.extra?.defaultApiBaseUrl
if (typeof appConfigDefaultApiBaseUrl === "string" && !isDeployedHttpsUrl(appConfigDefaultApiBaseUrl)) {
  console.error("Mobile app.json must not ship a local, non-HTTPS, or malformed extra.defaultApiBaseUrl; use EXPO_PUBLIC_ASTRA_API_BASE_URL for release endpoints.")
  process.exit(1)
}
if (!easJson.build?.preview || !easJson.build?.production || !easJson.submit?.production) {
  console.error("Mobile release scaffold must define EAS preview/production build and production submit profiles.")
  process.exit(1)
}
if (easJson.build.preview.env?.EXPO_PUBLIC_ASTRA_BUILD_PROFILE !== "preview") {
  console.error("EAS preview builds must set EXPO_PUBLIC_ASTRA_BUILD_PROFILE=preview.")
  process.exit(1)
}
if (easJson.build.production.env?.EXPO_PUBLIC_ASTRA_BUILD_PROFILE !== "production") {
  console.error("EAS production builds must set EXPO_PUBLIC_ASTRA_BUILD_PROFILE=production.")
  process.exit(1)
}
const forbiddenEasEnvKeyPattern = /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|OPENAI_API_KEY|GOOGLE(?:_CLOUD|_GENERATIVE_AI)?_API_KEY|OPENROUTER_API_KEY)/i
for (const [profileName, profile] of Object.entries(easJson.build ?? {})) {
  const env = profile && typeof profile === "object" ? profile.env ?? {} : {}
  for (const [key, value] of Object.entries(env)) {
    if (forbiddenEasEnvKeyPattern.test(key)) {
      console.error(`EAS ${profileName} env must not commit secret-like key: ${key}`)
      process.exit(1)
    }
    if (key === "EXPO_PUBLIC_ASTRA_API_BASE_URL" && (!isDeployedHttpsUrl(String(value)) || isLocalHost(new URL(String(value)).hostname))) {
      console.error(`EAS ${profileName} EXPO_PUBLIC_ASTRA_API_BASE_URL must be a deployed HTTPS URL when committed.`)
      process.exit(1)
    }
  }
}

const androidPermissions = new Set(appJson.expo?.android?.permissions ?? [])
for (const permission of ["CAMERA", "POST_NOTIFICATIONS"]) {
  if (!androidPermissions.has(permission)) {
    console.error(`Mobile app.json must declare Android permission used by the release surface: ${permission}`)
    process.exit(1)
  }
}

const blockedAndroidPermissions = [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.WRITE_EXTERNAL_STORAGE",
]
const appBlockedAndroidPermissions = new Set(appJson.expo?.android?.blockedPermissions ?? [])
for (const permission of blockedAndroidPermissions) {
  if (!appBlockedAndroidPermissions.has(permission)) {
    console.error(`Mobile app.json must block unused Android permission: ${permission}`)
    process.exit(1)
  }
}

const androidManifestSource = source("android/app/src/main/AndroidManifest.xml")
const androidDebugManifestSource = source("android/app/src/debug/AndroidManifest.xml")
for (const permission of blockedAndroidPermissions) {
  const escapedPermission = permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const removalPattern = new RegExp(`<uses-permission\\b(?=[^>]*android:name="${escapedPermission}")(?=[^>]*tools:node="remove")[^>]*/>`)
  if (!removalPattern.test(androidManifestSource)) {
    console.error(`AndroidManifest must remove unused Android permission from release merge: ${permission}`)
    process.exit(1)
  }
}
if (!/<uses-permission\b(?=[^>]*android:name="android\.permission\.SYSTEM_ALERT_WINDOW")(?=[^>]*tools:node="remove")[^>]*\/>/.test(androidDebugManifestSource)) {
  console.error("Android debug manifest must not add overlay permission; it must remove SYSTEM_ALERT_WINDOW.")
  process.exit(1)
}
if (!androidManifestSource.includes('<data android:scheme="astra-review"/>')) {
  console.error("Android manifest must expose the astra-review deep-link scheme.")
  process.exit(1)
}

const iosInfoPlistSource = source("ios/AstraReview/Info.plist")
if (!iosInfoPlistSource.includes("<string>astra-review</string>")) {
  console.error("iOS Info.plist must expose the astra-review deep-link scheme.")
  process.exit(1)
}
if (iosInfoPlistSource.includes("NSMicrophoneUsageDescription")) {
  console.error("iOS Info.plist must not declare microphone usage; mobile release privacy copy says no microphone permission is used.")
  process.exit(1)
}

const iosCameraUsage = String(appJson.expo?.ios?.infoPlist?.NSCameraUsageDescription ?? "").toLowerCase()
for (const requiredCameraTerm of ["qr", "link", "account"]) {
  if (!iosCameraUsage.includes(requiredCameraTerm)) {
    console.error(`iOS camera usage copy must stay scoped to account QR linking; missing: ${requiredCameraTerm}`)
    process.exit(1)
  }
}

const iosPrivacyInfoSource = source("ios/AstraReview/PrivacyInfo.xcprivacy")
if (!/<key>NSPrivacyTracking<\/key>\s*<false\/>/.test(iosPrivacyInfoSource)) {
  console.error("iOS PrivacyInfo.xcprivacy must declare NSPrivacyTracking=false.")
  process.exit(1)
}
if (!/<key>NSPrivacyCollectedDataTypes<\/key>\s*<array>/.test(iosPrivacyInfoSource)) {
  console.error("iOS PrivacyInfo.xcprivacy must declare collected data types that match the signed-in mobile data surface.")
  process.exit(1)
}
for (const dataType of [
  "NSPrivacyCollectedDataTypeEmailAddress",
  "NSPrivacyCollectedDataTypeUserID",
  "NSPrivacyCollectedDataTypeDeviceID",
  "NSPrivacyCollectedDataTypeProductInteraction",
  "NSPrivacyCollectedDataTypeOtherUserContent",
  "NSPrivacyCollectedDataTypeCustomerSupport",
  "NSPrivacyCollectedDataTypeOtherUsageData",
]) {
  if (!iosPrivacyInfoSource.includes(dataType)) {
    console.error(`iOS PrivacyInfo.xcprivacy must include collected data type: ${dataType}`)
    process.exit(1)
  }
}
for (const privacyTerm of ["NSPrivacyCollectedDataTypeLinked", "NSPrivacyCollectedDataTypeTracking", "NSPrivacyCollectedDataTypePurposeAppFunctionality", "NSPrivacyCollectedDataTypePurposeAnalytics"]) {
  if (!iosPrivacyInfoSource.includes(privacyTerm)) {
    console.error(`iOS PrivacyInfo.xcprivacy must include privacy manifest term: ${privacyTerm}`)
    process.exit(1)
  }
}
for (const apiCategory of ["NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPICategorySystemBootTime"]) {
  if (!iosPrivacyInfoSource.includes(apiCategory)) {
    console.error(`iOS PrivacyInfo.xcprivacy must include accessed API category: ${apiCategory}`)
    process.exit(1)
  }
}
const iosProjectSource = source("ios/AstraReview.xcodeproj/project.pbxproj")
if (!iosProjectSource.includes("PrivacyInfo.xcprivacy in Resources")) {
  console.error("iOS Xcode project must include PrivacyInfo.xcprivacy in app resources.")
  process.exit(1)
}
const iosEntitlementsSource = source("ios/AstraReview/AstraReview.entitlements")
for (const entitlementKey of ["aps-environment", "com.apple.developer.applesignin"]) {
  if (!iosEntitlementsSource.includes(entitlementKey)) {
    console.error(`iOS entitlements must include ${entitlementKey}.`)
    process.exit(1)
  }
}

for (const dependency of ["@react-native-async-storage/async-storage", "expo-apple-authentication", "expo-application", "expo-auth-session", "expo-camera", "expo-constants", "expo-crypto", "expo-notifications", "expo-secure-store", "expo-speech", "expo-system-ui", "expo-web-browser"]) {
  if (!packageJson.dependencies?.[dependency]) {
    console.error(`Mobile native runtime dependency is missing: ${dependency}`)
    process.exit(1)
  }
}

const uiFiles = [
  "src/App.tsx",
  "src/screens/TodayScreen.tsx",
  "src/screens/LibraryScreen.tsx",
  "src/screens/MeScreen.tsx",
  "src/screens/SignInScreen.tsx",
  "src/domain/mobileMembership.ts",
]
for (const file of uiFiles) {
  const appSource = source(file)
  const stringLiterals = Array.from(appSource.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/gs))
    .map((match) => match[2].toLowerCase())
    .filter((value) => !value.startsWith("../") && !value.startsWith("./"))
  for (const forbidden of ["provider", "model", "api key", "token", "quota", "relay", "backend", "checkout", "purchase", "subscribe", "upgrade"]) {
    if (stringLiterals.some((value) => value.includes(forbidden))) {
      console.error(`Mobile ordinary UI source ${file} includes forbidden user-facing word: ${forbidden}`)
      process.exit(1)
    }
  }
}

const appSource = source("src/App.tsx")
if (appSource.includes("challenge.code")) {
  console.error("Mobile sign-in UI must not display development email-code echoes.")
  process.exit(1)
}

const privacySource = source("store/privacy.md")
if (/local-only[^\n]*(analytics|diagnostics)|(?:analytics|diagnostics)[^\n]*local-only/i.test(privacySource)) {
  console.error("Mobile privacy draft must not claim analytics are local-only while retention upload exists.")
  process.exit(1)
}

const storeFiles = [
  "store/README.md",
  "store/ios/app-store-connect.md",
  "store/android/play-listing.md",
  "store/privacy.md",
  "store/reviewer-notes.md",
  "store/screenshots/README.md",
  "store/signed-build-qa.md",
  "store/release-checklist.md",
]
for (const file of storeFiles) {
  const text = source(file)
  if (/\bTODO\b/.test(text)) {
    console.error(`Mobile store artifact ${file} must not contain inline TODO placeholders; track unresolved release work in the checklist/blocker section.`)
    process.exit(1)
  }
  if (/Likely answers|subject to legal review/i.test(text)) {
    console.error(`Mobile store artifact ${file} must not use tentative privacy-answer wording; keep current implementation answers separate from legal-review blockers.`)
    process.exit(1)
  }
}

const testExpectations = [
  ["src/api/astraClient.test.ts", [
    "requires deployed HTTPS session endpoints in non-dev bundles",
    "deletes an account with bearer auth and device header",
    "exports account data with bearer auth and device header",
    "requests cloud review data deletion with idempotency",
  ]],
  ["src/runtime/mobileRuntime.test.ts", [
    "uses the public Expo build profile marker when EAS_BUILD_PROFILE is unavailable",
    "rejects production builds that would fall back to the local development endpoint",
    "rejects non-dev bundles with a local explicit endpoint",
    "rejects preview builds with non-HTTPS endpoints",
  ]],
  ["src/runtime/mobileNotifications.test.ts", [
    "does not prompt or request a push token when permission prompt is not allowed",
    "requests permission after user action and returns an Expo push token",
  ]],
  ["src/runtime/mobileOAuth.test.ts", [
    "returns null when Google sign-in is not configured",
    "encodes nonce bytes as URL-safe base64 without padding",
    "requires enough random bytes for nonce creation",
  ]],
  ["src/state/mobileAppState.test.ts", [
    "requests cloud review data deletion and clears local review state",
    "does not clear local review state when cloud deletion is rejected",
  ]],
  ["src/domain/retentionAnalytics.test.ts", [
    "keeps event payloads privacy-safe",
    "builds a bounded privacy-safe upload batch",
  ]],
  ["src/domain/review.test.ts", [
    "builds privacy-safe share text from a review card",
    "builds front-only speech text from a review card",
    "builds front-only speech text from a saved Library item",
  ]],
  ["src/screens/LibraryScreen.test.tsx", [
    "wires saved Library item Speak to the selected saved item",
    "does not show saved Library item Speak when no speak handler is provided",
  ]],
  ["src/domain/mobileMembership.test.ts", [
    "does not expose the signed-in email address in membership copy",
  ]],
  ["src/domain/mobileAccessibility.test.ts", [
    "defines a 44 point touch baseline and reusable hit slop",
  ]],
]
for (const [file, terms] of testExpectations) {
  assertIncludes(file, terms, `test coverage ${file}`)
}

assertIncludes("src/App.tsx", [
  "buildMobileSavedItemSpeechText",
  "handleSpeakSavedItem",
  "onSpeakSavedItem",
], "Library saved-item Speak wiring")

assertIncludes("src/screens/LibraryScreen.tsx", [
  "onSpeakSavedItem",
  "accessibilityLabel={`Speak ${props.item.text}`",
  "accessibilityHint=\"Read this saved expression aloud\"",
  ">Speak<",
], "Library saved-item Speak UI")

const storeExpectations = [
  ["store/README.md", ["Store Release Pack", "reviewer-notes.md", "signed-build-qa.md", "privacy-safe sharing", "Play/Speak", "Library saved-item Speak", "Not useful", "source-title hiding", "Private source", "Weekly Digest email action", "account data export", "metadata-only help note", "pnpm --dir apps/mobile verify", "VoiceOver/TalkBack"]],
  ["store/ios/app-store-connect.md", ["App Store Connect", "TestFlight", "so.astra.review", "Learning guidance", "study aid", "Delete account", "privacy-safe sharing", "Play/Speak", "Library saved-item Speak", "Not useful", "source-title hiding", "account data export", "metadata-only help note"]],
  ["store/android/play-listing.md", ["Google Play", "so.astra.review", "Data safety", "reviewer-notes.md", "Learning guidance", "study aid", "delete the account", "privacy-safe sharing", "Play/Speak", "Library saved-item Speak", "Not useful", "source-title hiding", "account data export", "metadata-only help note"]],
  ["store/privacy.md", ["Camera", "user-initiated", "Notifications", "optional", "No microphone", "No external storage", "Data safety", "Privacy", "study aid", "account deletion", "mobile retention events", "signed-in", "bounded", "sanitized", "push token", "support help note", "account data export", "Weekly Digest", "PrivacyInfo.xcprivacy", "tracking remains disabled"]],
  ["store/reviewer-notes.md", ["Mobile Reviewer Notes Template", "Private console fields", "do not commit credentials", "Public production API origin", "companion app", "saved language-learning cards", "Today, Library, and Me", "Again, Good, Easy, or Skip", "privacy-safe sharing", "front-only Play/Speak", "Library saved-item Speak", "Not useful", "source-title", "Learning guidance", "study aid", "Camera access", "Notification permission", "does not sell or manage subscriptions", "Delete account", "Known limitation", "mobile capture"]],
  ["store/screenshots/README.md", ["Shot list", "App Store", "Google Play", "large accessibility text", "privacy-safe sharing", "Play/Speak", "Library saved-item Speak", "Not useful", "source-title hiding", "Private source", "account data export", "metadata-only help note", "email-code secrets"]],
  ["store/signed-build-qa.md", ["Mobile Signed-Build QA Evidence Template", "Build evidence header", "Functional smoke rows", "Accessibility smoke rows", "Store evidence rows", "Owner", "Environment", "Evidence", "Verdict", "VoiceOver Today", "TalkBack Today", "Large text", "Non-color-only labels", "privacy-safe sharing", "front-only Play/Speak", "Library saved-item Speak", "Not useful", "source-title hiding", "metadata-only help note", "Delete account", "Production endpoint"]],
  ["store/release-checklist.md", ["TestFlight", "closed testing", "EXPO_PUBLIC_ASTRA_API_BASE_URL", "EXPO_PUBLIC_ASTRA_BUILD_PROFILE", "public Expo env", "non-secret deployed relay origin", "Camera usage copy", "Notification behavior stays opt-in", "weekly learning-note actions", "No microphone/storage/overlay permissions", "privacy draft matches mobile API endpoints", "store/reviewer-notes.md", "store/signed-build-qa.md", "owner, environment, evidence, and verdict", "known mobile-capture limitation", "source-title hiding", "privacy-safe sharing", "Library saved-item Speak", "account data export", "metadata-only help note", "Accessibility V0", "VoiceOver/TalkBack"]],
]
for (const [file, terms] of storeExpectations) {
  assertIncludes(file, terms, `store artifact ${file}`)
}

console.log("Astra mobile companion scaffold verified.")
