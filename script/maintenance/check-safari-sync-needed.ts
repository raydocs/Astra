import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

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

function fetchRemoteBase(base: string): void {
  if (process.env.CI !== "true") return
  tryGit(["fetch", "--no-tags", "--depth=1", "origin", `${base}:refs/remotes/origin/${base}`])
}

function bestDiffBase(ref: string): string {
  return tryGit(["merge-base", "HEAD", ref])?.trim() || ref
}

function resolveBaseRef(): string | null {
  const explicitBase = process.env.ASTRA_SAFARI_SYNC_BASE?.trim()
  if (explicitBase) {
    return explicitBase
  }

  const githubBase = process.env.GITHUB_BASE_REF?.trim()
  if (githubBase) {
    fetchRemoteBase(githubBase)
    const remoteBase = `origin/${githubBase}`
    if (tryGit(["rev-parse", "--verify", remoteBase])?.trim()) return bestDiffBase(remoteBase)
  }

  const upstream = tryGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])?.trim()
  if (upstream) {
    return bestDiffBase(upstream)
  }

  if (tryGit(["rev-parse", "--verify", "origin/main"])?.trim()) return bestDiffBase("origin/main")

  const parent = tryGit(["rev-parse", "--verify", "HEAD^1"])?.trim()
  if (parent) return parent

  return null
}

function changedFilesFromGit(baseRef: string | null): string[] {
  if (baseRef) {
    return splitFiles(tryGit(["diff", "--name-only", "-z", `${baseRef}..HEAD`]))
  }

  return splitFiles(tryGit(["diff", "--name-only", "-z", "HEAD"]))
}

function localWorkingTreeFiles(): string[] {
  if (process.env.CI === "true") return []
  const stagedAndUnstaged = splitFiles(tryGit(["diff", "--name-only", "-z", "HEAD"]))
  const untracked = splitFiles(tryGit(["ls-files", "--others", "--exclude-standard", "-z"]))
  return [...stagedAndUnstaged, ...untracked]
}

const baseRef = resolveBaseRef()
const changedFiles = unique([...changedFilesFromGit(baseRef), ...localWorkingTreeFiles()])

const safariResourcesPrefix = "ios/AstraShell Extension/Resources/"

const dependencySections = ["dependencies", "optionalDependencies", "peerDependencies"]
const developmentDependencySections = ["devDependencies"]
const extensionBuildDevDependencies = new Set([
  "@vitejs/plugin-react",
  "vite",
  "wxt",
])

type PackageJson = Partial<Record<string, Record<string, string>>>

function readPackageJsonAt(ref: string | null): PackageJson | null {
  try {
    const content = ref ? git(["show", `${ref}:package.json`]) : readFileSync("package.json", "utf8")
    return JSON.parse(content) as PackageJson
  } catch {
    return null
  }
}

function changedDependencyNames(before: PackageJson | null, after: PackageJson | null, sections: string[]): string[] {
  if (!before || !after) return []

  const changed = new Set<string>()
  for (const section of sections) {
    const beforeDeps = before[section] ?? {}
    const afterDeps = after[section] ?? {}
    const names = new Set([...Object.keys(beforeDeps), ...Object.keys(afterDeps)])
    for (const name of names) {
      if (beforeDeps[name] !== afterDeps[name]) changed.add(name)
    }
  }
  return [...changed].sort()
}

function packageChangesCanAffectSafariBundle(): string[] {
  if (!changedFiles.includes("package.json") && !changedFiles.includes("pnpm-lock.yaml")) return []

  const before = readPackageJsonAt(baseRef)
  const after = readPackageJsonAt(null)
  const runtimeChanges = changedDependencyNames(before, after, dependencySections)
  const devChanges = changedDependencyNames(before, after, developmentDependencySections).filter((name) =>
    extensionBuildDevDependencies.has(name),
  )

  return [...runtimeChanges, ...devChanges].sort()
}

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

const packageDependencyInputs = packageChangesCanAffectSafariBundle().map((name) => `package.json dependency: ${name}`)
const extensionInputs = [...changedFiles.filter(isExtensionBuildInput), ...packageDependencyInputs]
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
