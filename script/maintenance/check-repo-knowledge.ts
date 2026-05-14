import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

const legacyRoots = [
  "server/",
  "web/",
  "platform/",
  "bench/",
  "bench-live/",
  "bench-opt/",
  "agent-config/",
  "scripts/",
  "plans/",
]

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" })
}

const repoRoot = git(["rev-parse", "--show-toplevel"]).trim()
const trackedFiles = git(["-C", repoRoot, "ls-files", "-z"])
  .split("\0")
  .filter(Boolean)

const violations = trackedFiles.filter((file) => {
  if (!legacyRoots.some((root) => file.startsWith(root))) return false
  return existsSync(join(repoRoot, file))
})

if (violations.length > 0) {
  console.error("Repo-knowledge guardrail failed.")
  console.error("Tracked files remain under legacy roots that should stay removed:")
  for (const file of violations) {
    console.error(`  - ${file}`)
  }
  console.error("")
  console.error("Move these files to the canonical src/, script/, docs/, or data/ location; do not add compatibility implementation shims under old roots.")
  process.exit(1)
}

console.log("Repo-knowledge guardrail passed: no tracked files remain under legacy roots.")
