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
    const resolved = await resolveLiveBrowserExecutablePath({
      overridePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      candidates: [],
    })

    expect(resolved).toBe("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
  })
})
