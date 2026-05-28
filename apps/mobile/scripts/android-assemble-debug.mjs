import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

const root = new URL("..", import.meta.url).pathname
const androidDir = join(root, "android")
const homebrewJdk = "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
const homebrewSdk = "/opt/homebrew/share/android-commandlinetools"

const env = { ...process.env }
env.NODE_ENV ??= "development"
if (!env.JAVA_HOME && existsSync(homebrewJdk)) {
  env.JAVA_HOME = homebrewJdk
  env.PATH = `${homebrewJdk}/bin:${env.PATH ?? ""}`
}
if (!env.ANDROID_HOME && existsSync(homebrewSdk)) {
  env.ANDROID_HOME = homebrewSdk
}
if (!env.ANDROID_SDK_ROOT && env.ANDROID_HOME) {
  env.ANDROID_SDK_ROOT = env.ANDROID_HOME
}

const gradle = spawnSync("./gradlew", [":app:assembleDebug"], {
  cwd: androidDir,
  env,
  stdio: "inherit",
})

process.exit(gradle.status ?? 1)
