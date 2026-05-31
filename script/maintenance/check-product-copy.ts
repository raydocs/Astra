import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

type Rule = {
  id: string
  pattern: RegExp
  message: string
  allowedPath?: RegExp
}

const PUBLIC_SURFACE_PATHS = [
  /^README\.md$/,
  /^src\/web\/index\.html$/,
  /^src\/web\/public\/manifest\.webmanifest$/,
  /^docs\/gtm\/demos\.md$/,
  /^store\/(description|listing-copy|amo-listing)\.md$/,
  /^docs\/gtm\//,
  /^docs\/help\//,
  /^public\/_locales\//,
  /^ios\/AstraShell Extension\/Resources\/_locales\//,
]

const DEFAULT_SKIP_PATHS = [
  /^docs\/reviews\//,
  /^docs\/plans\//,
  /^docs\/investigations\//,
  /^docs\/analysis\//,
  /^docs\/specs\//,
  /^docs\/runbooks\//,
  /^\.claude\//,
  /^dist\//,
  /^\.output\//,
]

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".mp4",
  ".mov",
])

const RULES: Rule[] = [
  {
    id: "universal-websites",
    pattern: /\b(all|every|any)\s+(websites?|pages?|sites?)\b/i,
    message: "Avoid universal website claims. Prefer 'supported webpages' or explain limitations.",
  },
  {
    id: "universal-videos",
    pattern: /\b(all|every|any)\s+((youtube|video)\s+)?videos?\b|every\s+youtube\s+video/i,
    message: "Avoid universal video claims. Prefer 'supported videos' or 'best-effort'.",
  },
  {
    id: "no-upload-overclaim",
    pattern: /\b(no uploads?|never uploads?|does not upload|doesn't upload)\b/i,
    message: "Avoid no-upload overclaims when managed AI may send necessary text. Prefer 'no unnecessary uploads'.",
  },
  {
    id: "local-only-overclaim",
    pattern: /\b(local[- ]only|only local|stays on your device)\b/i,
    message: "Avoid local-only overclaims unless the feature truly never uses the relay.",
  },
  {
    id: "unlimited-overclaim",
    pattern: /\bunlimited\b/i,
    message: "Avoid unlimited claims on bounded Free/Pro paths.",
  },
  {
    id: "technical-ai-copy",
    pattern: /\b(provider|model|api key|quota|token|relay|openrouter|openai|gemini)\b/i,
    message: "Ordinary public copy should not expose provider/model/API/quota/relay terminology.",
    allowedPath: /^docs\/help\//,
  },
]

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" })
}

function gitMaybe(args: string[]): string | null {
  try {
    return git(args)
  } catch {
    return null
  }
}

function isProbablyText(file: string): boolean {
  const lower = file.toLowerCase()
  for (const extension of BINARY_EXTENSIONS) {
    if (lower.endsWith(extension)) return false
  }
  return true
}

function lineForIndex(text: string, index: number): number {
  return text.slice(0, index).split("\n").length
}

const repoRoot = git(["rev-parse", "--show-toplevel"]).trim()
const trackedFiles = git(["-C", repoRoot, "ls-files", "-z"])
  .split("\0")
  .filter(Boolean)
const trackedFileSet = new Set(trackedFiles)

const allMode = process.argv.includes("--all")
const baseRef = process.env.ASTRA_PRODUCT_COPY_BASE ?? "origin/main"
const changedFiles = allMode
  ? trackedFiles
  : (gitMaybe(["-C", repoRoot, "diff", "--name-only", "--diff-filter=ACMRTUXB", `${baseRef}...HEAD`]) ??
      gitMaybe(["-C", repoRoot, "diff", "--name-only", "--diff-filter=ACMRTUXB", `${baseRef}..HEAD`]) ??
      "")
      .split("\n")
      .filter((file) => file.length > 0 && trackedFileSet.has(file))

const candidateFiles = changedFiles.filter((file) => {
  if (!PUBLIC_SURFACE_PATHS.some((pattern) => pattern.test(file))) return false
  if (DEFAULT_SKIP_PATHS.some((pattern) => pattern.test(file))) return false
  if (!isProbablyText(file)) return false
  return existsSync(join(repoRoot, file))
})

const findings: string[] = []

for (const file of candidateFiles) {
  const text = readFileSync(join(repoRoot, file), "utf8")

  for (const rule of RULES) {
    if (rule.allowedPath?.test(file)) continue

    for (const match of text.matchAll(new RegExp(rule.pattern, `${rule.pattern.flags.includes("i") ? "i" : ""}g`))) {
      if (typeof match.index !== "number") continue
      findings.push(`${file}:${lineForIndex(text, match.index)} [${rule.id}] ${rule.message} Matched: ${JSON.stringify(match[0])}`)
    }
  }
}

if (findings.length > 0) {
  console.error("Product-copy guardrail failed.")
  console.error(
    allMode
      ? "Review these public/user-facing copy claims:"
      : `Review these public/user-facing copy claims in files changed since ${baseRef}:`,
  )
  for (const finding of findings) {
    console.error(`  - ${finding}`)
  }
  console.error("")
  console.error("If a hit is intentionally internal/advanced, move it out of public copy or run the broader audit with --all before adding an exception.")
  process.exit(1)
}

console.log(
  allMode
    ? `Product-copy guardrail passed: scanned ${candidateFiles.length} public/user-facing text files.`
    : `Product-copy guardrail passed: scanned ${candidateFiles.length} changed public/user-facing text files since ${baseRef}.`,
)
