import { spawnSync } from "node:child_process"

type LintMessage = {
  _type?: string
  code?: string
  message?: string
  description?: string
  file?: string
  line?: number
  column?: number
}

type LintReport = {
  summary?: {
    errors?: number
    notices?: number
    warnings?: number
  }
  errors?: LintMessage[]
  notices?: LintMessage[]
  warnings?: LintMessage[]
}

const DEFAULT_SOURCE_DIR = ".output/firefox-mv3"
const IGNORED_CODES = new Set(["DANGEROUS_EVAL", "UNSAFE_VAR_ASSIGNMENT"])
const IGNORED_PREFIXES = ["assets/", "chunks/", "content-scripts/"]

function parseArgs(argv: string[]): string {
  let sourceDir = DEFAULT_SOURCE_DIR

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === "--") {
      continue
    }

    if (arg === "--source-dir") {
      const next = argv[index + 1]

      if (!next) {
        throw new Error("Missing value for --source-dir")
      }

      sourceDir = next
      index += 1
      continue
    }

    if (!arg.startsWith("-")) {
      sourceDir = arg
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return sourceDir
}

function normalizeFile(file: string | undefined): string {
  return (file ?? "").replaceAll("\\", "/")
}

function isIgnoredWarning(message: LintMessage): boolean {
  const file = normalizeFile(message.file)

  return (
    message._type === "warning" &&
    IGNORED_CODES.has(message.code ?? "") &&
    IGNORED_PREFIXES.some(prefix => file.startsWith(prefix))
  )
}

function formatMessage(message: LintMessage): string {
  const location = [message.file, message.line, message.column]
    .filter(part => part !== undefined && part !== "")
    .join(":")

  const suffix = location ? ` (${location})` : ""
  const description = message.description ? `\n  ${message.description}` : ""
  return `- ${message.code ?? "UNKNOWN"}: ${message.message ?? "Unknown lint issue"}${suffix}${description}`
}

function collectActionableMessages(report: LintReport): LintMessage[] {
  const errors = report.errors ?? []
  const notices = report.notices ?? []
  const warnings = (report.warnings ?? []).filter(message => !isIgnoredWarning(message))
  return [...errors, ...notices, ...warnings]
}

const sourceDir = parseArgs(process.argv.slice(2))
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"

const result = spawnSync(
  pnpmCommand,
  ["exec", "web-ext", "lint", "--source-dir", sourceDir, "--output", "json", "--boring"],
  {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  },
)

if (result.error) {
  throw result.error
}

const stdout = result.stdout?.trim()

if (!stdout) {
  process.stderr.write(result.stderr ?? "")
  throw new Error("web-ext lint did not return JSON output")
}

const report = JSON.parse(stdout) as LintReport
const actionableMessages = collectActionableMessages(report)
const ignoredWarnings = (report.warnings ?? []).filter(message => isIgnoredWarning(message))

if (actionableMessages.length > 0) {
  console.error("Firefox extension lint failed with actionable findings:")

  for (const message of actionableMessages) {
    console.error(formatMessage(message))
  }

  if (ignoredWarnings.length > 0) {
    console.error(`Ignored generated-bundle warnings: ${ignoredWarnings.length}`)
  }

  process.exit(1)
}

const summary = report.summary ?? {}
const ignoredSummary = ignoredWarnings.length > 0 ? ` Ignored generated warnings: ${ignoredWarnings.length}.` : ""

console.log(
  `Firefox extension lint passed. Errors: ${summary.errors ?? 0}, notices: ${summary.notices ?? 0}, warnings: ${summary.warnings ?? 0}.${ignoredSummary}`,
)
