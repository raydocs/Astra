import { execFileSync } from "node:child_process"

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
}

function tryGit(args: string[]): string | null {
  try {
    return git(args)
  } catch {
    return null
  }
}

function splitFiles(output: string | null): string[] {
  if (!output) return []
  return output
    .split("\0")
    .map((file) => file.trim())
    .filter(Boolean)
}

function unique(files: string[]): string[] {
  return [...new Set(files)].sort()
}

function changedFilesFromGit(): string[] {
  const explicitBase = process.env.ASTRA_SAFARI_SYNC_BASE?.trim()
  if (explicitBase) {
    return splitFiles(tryGit(["diff", "--name-only", "-z", `${explicitBase}...HEAD`]))
  }

  const githubBase = process.env.GITHUB_BASE_REF?.trim()
  if (githubBase) {
    const remoteBase = `origin/${githubBase}`
    const mergeBase = tryGit(["merge-base", "HEAD", remoteBase])?.trim()
    if (mergeBase) {
      return splitFiles(tryGit(["diff", "--name-only", "-z", `${mergeBase}...HEAD`]))
    }
  }

  const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])?.trim()
  if (upstream) {
    const mergeBase = tryGit(["merge-base", "HEAD", upstream])?.trim()
    if (mergeBase) {
      return splitFiles(tryGit(["diff", "--name-only", "-z", `${mergeBase}...HEAD`]))
    }
  }

  const mainMergeBase = tryGit(["merge-base", "HEAD", "origin/main"])?.trim()
  if (mainMergeBase) {
    return splitFiles(tryGit(["diff", "--name-only", "-z", `${mainMergeBase}...HEAD`]))
  }

  const parent = tryGit(["rev-parse", "--verify", "HEAD^1"])?.trim()
  if (parent) {
    return splitFiles(tryGit(["diff", "--name-only", "-z", `${parent}..HEAD`]))
  }

  return splitFiles(tryGit(["diff", "--name-only", "-z", "HEAD"]))
}

function localWorkingTreeFiles(): string[] {
  if (process.env.CI === "true") return []
  const stagedAndUnstaged = splitFiles(tryGit(["diff", "--name-only", "-z", "HEAD"]))
  const untracked = splitFiles(tryGit(["ls-files", "--others", "--exclude-standard", "-z"]))
  return [...stagedAndUnstaged, ...untracked]
}

const changedFiles = unique([...changedFilesFromGit(), ...localWorkingTreeFiles()])

const safariResourcesPrefix = "ios/AstraShell Extension/Resources/"

function isSafariResource(file: string): boolean {
  return file.startsWith(safariResourcesPrefix)
}

function isExtensionBuildInput(file: string): boolean {
  if (isSafariResource(file)) return false
  if (file.startsWith("src/web/")) return false
  if (file.startsWith("src/server/")) return false
  if (file.startsWith("src/platform/")) return false
  if (file.startsWith("apps/mobile/")) return false
  if (file.startsWith("docs/")) return false
  if (file.startsWith("store/")) return false
  if (file.startsWith("ios/")) return false

  if (file === "wxt.config.ts") return true
  if (file.startsWith("public/")) return true
  if (file.startsWith("src/")) return true

  return false
}

const extensionInputs = changedFiles.filter(isExtensionBuildInput)
const safariResources = changedFiles.filter(isSafariResource)

if (extensionInputs.length === 0) {
  console.log("Safari sync guardrail passed: no changed extension build inputs detected.")
  process.exit(0)
}

if (safariResources.length > 0) {
  console.log(
    `Safari sync guardrail passed: ${extensionInputs.length} extension build input(s) and ${safariResources.length} Safari resource file(s) changed.`,
  )
  process.exit(0)
}

console.error("Safari sync guardrail failed.")
console.error("Changed extension build inputs can change the Safari MV3 output, but this diff does not include synced iOS Safari resources.")
console.error("")
console.error("Detected extension build inputs:")
for (const file of extensionInputs.slice(0, 20)) {
  console.error(`  - ${file}`)
}
if (extensionInputs.length > 20) {
  console.error(`  ...and ${extensionInputs.length - 20} more`)
}
console.error("")
console.error("Run and commit the sync when the resources really changed:")
console.error("  pnpm build:safari")
console.error("  pnpm ios:sync-extension")
console.error("  bash ios/scripts/verify-safari-build-sync.sh")
console.error('  git add "ios/AstraShell Extension/Resources"')
console.error('  git commit -m "chore(ios): sync Safari resources for <change>"')
console.error("")
console.error("If your change is truly web/server/mobile/docs-only, keep it outside extension build input paths so this guard does not trigger.")
process.exit(1)
