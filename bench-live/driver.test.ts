import { mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { prepareLiveArtifactDir, readFixtureHtml, resolveLiveBrowserExecutablePath } from "./driver"

describe("bench-live driver", () => {
  it("reads fixture HTML from the shared fixture directory", async () => {
    const html = await readFixtureHtml("article-basic")
    expect(html).toContain("<article>")
    expect(html).toContain("Astra turns long-form reading")
  })

  it("creates an artifact directory under a provided root", async () => {
    const artifactDir = await prepareLiveArtifactDir("driver-test-run", "bench-live-results-test")
    expect(artifactDir.endsWith("/bench-live-results-test/driver-test-run")).toBe(true)
  })

  it("returns the override browser path when it exists", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "astra-live-driver-"))
    const fakeBrowserPath = path.join(tempDir, "fake-chromium")
    await writeFile(fakeBrowserPath, "")

    const resolved = await resolveLiveBrowserExecutablePath({
      overridePath: fakeBrowserPath,
      candidates: [],
    })

    expect(resolved).toBe(fakeBrowserPath)
  })
})
