import path from "node:path"

export const DEFAULT_LIVE_ARTIFACT_ROOT = path.resolve(process.cwd(), "data/bench-live-results")
export const DEFAULT_EXTENSION_PATH = path.resolve(process.cwd(), ".output/chrome-mv3")
export const DEFAULT_BENCH_FIXTURE_ROOT = path.resolve(process.cwd(), "test/fixtures/pages")

function parseOptionalPath(raw: string | null | undefined): string | undefined {
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

export function resolveLiveArtifactRoot(rootDir?: string | null): string {
  return path.resolve(
    parseOptionalPath(rootDir)
      ?? parseOptionalPath(process.env.ASTRA_BENCH_LIVE_ARTIFACT_ROOT)
      ?? "data/bench-live-results",
  )
}

export function resolveLiveExtensionPath(extensionPath?: string | null): string {
  return path.resolve(
    parseOptionalPath(extensionPath)
      ?? parseOptionalPath(process.env.ASTRA_BENCH_LIVE_EXTENSION_PATH)
      ?? ".output/chrome-mv3",
  )
}

export function resolveBenchFixtureRoot(fixtureRoot?: string | null): string {
  return path.resolve(
    parseOptionalPath(fixtureRoot)
      ?? parseOptionalPath(process.env.ASTRA_BENCH_FIXTURE_ROOT)
      ?? "test/fixtures/pages",
  )
}
