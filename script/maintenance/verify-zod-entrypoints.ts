import { access, readdir, readFile } from "node:fs/promises"
import path from "node:path"

const REQUIRED_FIRST_IMPORT = "@/utils/zod-config"
const ENTRYPOINTS_ROOT = path.join("src", "entrypoints")

type CheckFailureReason = "missing_file" | "missing_import" | "wrong_first_import"

type CheckResult = {
  file: string
  ok: boolean
  reason?: CheckFailureReason
  firstImport?: string
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function discoverMainEntrypoints(): Promise<string[]> {
  const entries = await readdir(ENTRYPOINTS_ROOT, { withFileTypes: true })
  const discovered: string[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const mainPath = path.join(ENTRYPOINTS_ROOT, entry.name, "main.tsx")
    if (await fileExists(mainPath)) {
      discovered.push(mainPath)
    }
  }

  return discovered.sort((a, b) => a.localeCompare(b))
}

async function checkEntrypoint(filePath: string): Promise<CheckResult> {
  if (!(await fileExists(filePath))) {
    return { file: filePath, ok: false, reason: "missing_file" }
  }

  const source = await readFile(filePath, "utf8")
  const importMatches = [...source.matchAll(/^\s*import\s+(?:[^"']+\s+from\s+)?["']([^"']+)["'];?/gm)]

  if (importMatches.length === 0) {
    return { file: filePath, ok: false, reason: "missing_import" }
  }

  const firstImport = importMatches[0]?.[1]
  if (firstImport !== REQUIRED_FIRST_IMPORT) {
    return {
      file: filePath,
      ok: false,
      reason: "wrong_first_import",
      firstImport,
    }
  }

  return { file: filePath, ok: true, firstImport }
}

async function main(): Promise<void> {
  const discoveredMainEntrypoints = await discoverMainEntrypoints()
  const filesToCheck = [
    path.join(ENTRYPOINTS_ROOT, "background", "index.ts"),
    path.join(ENTRYPOINTS_ROOT, "content", "index.tsx"),
    ...discoveredMainEntrypoints,
    path.join("src", "web", "src", "main.tsx"),
  ]

  const results = await Promise.all(filesToCheck.map((filePath) => checkEntrypoint(filePath)))
  const failures = results.filter((result) => !result.ok)

  if (failures.length === 0) {
    console.log(`✅ Zod entrypoint guardrail passed for ${filesToCheck.length} bundles.`)
    return
  }

  console.error("❌ Zod entrypoint guardrail failed.")
  for (const failure of failures) {
    if (failure.reason === "missing_file") {
      console.error(`- ${failure.file}: missing file`)
      continue
    }

    if (failure.reason === "missing_import") {
      console.error(`- ${failure.file}: no import statements found`)
      continue
    }

    console.error(
      `- ${failure.file}: first import is '${failure.firstImport ?? "<none>"}', expected '${REQUIRED_FIRST_IMPORT}'`,
    )
  }

  process.exitCode = 1
}

await main()
