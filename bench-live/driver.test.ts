import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { chromium } from "playwright"
import { describe, expect, it, vi } from "vitest"

import {
  LiveBrowserUnavailableError,
  prepareLiveArtifactDir,
  readFixtureHtml,
  resolveExtensionManifestPath,
  resolveLiveBrowserExecutablePath,
  withLiveBrowserPage,
} from "./driver"

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

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

  it("creates an artifact directory under ASTRA_BENCH_LIVE_ARTIFACT_ROOT", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "astra-live-artifacts-"))
    const originalArtifactRoot = process.env.ASTRA_BENCH_LIVE_ARTIFACT_ROOT
    process.env.ASTRA_BENCH_LIVE_ARTIFACT_ROOT = tempDir

    try {
      const artifactDir = await prepareLiveArtifactDir("driver-env-run")
      expect(artifactDir).toBe(path.join(tempDir, "driver-env-run"))
    } finally {
      restoreEnv("ASTRA_BENCH_LIVE_ARTIFACT_ROOT", originalArtifactRoot)
    }
  })

  it("reads fixture HTML from ASTRA_BENCH_FIXTURE_ROOT", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "astra-live-fixtures-"))
    const originalFixtureRoot = process.env.ASTRA_BENCH_FIXTURE_ROOT
    process.env.ASTRA_BENCH_FIXTURE_ROOT = tempDir
    await writeFile(path.join(tempDir, "custom-fixture.html"), "<article>Custom fixture</article>")

    try {
      const html = await readFixtureHtml("custom-fixture")
      expect(html).toContain("Custom fixture")
    } finally {
      restoreEnv("ASTRA_BENCH_FIXTURE_ROOT", originalFixtureRoot)
    }
  })

  it("resolves extension manifest path from ASTRA_BENCH_LIVE_EXTENSION_PATH", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "astra-live-extension-"))
    const originalExtensionPath = process.env.ASTRA_BENCH_LIVE_EXTENSION_PATH
    process.env.ASTRA_BENCH_LIVE_EXTENSION_PATH = tempDir
    await mkdir(tempDir, { recursive: true })
    await writeFile(path.join(tempDir, "manifest.json"), "{}")

    try {
      const manifestPath = await resolveExtensionManifestPath()
      expect(manifestPath).toBe(path.join(tempDir, "manifest.json"))
    } finally {
      restoreEnv("ASTRA_BENCH_LIVE_EXTENSION_PATH", originalExtensionPath)
    }
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

  it("normalizes launch failures as LiveBrowserUnavailableError", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "astra-live-driver-launch-"))
    const fakeBrowserPath = path.join(tempDir, "fake-chromium")
    await writeFile(fakeBrowserPath, "")

    const launchSpy = vi.spyOn(chromium, "launch").mockRejectedValueOnce(new Error("launch failed"))
    const originalBrowserPath = process.env.ASTRA_BENCH_LIVE_BROWSER_PATH
    process.env.ASTRA_BENCH_LIVE_BROWSER_PATH = fakeBrowserPath

    try {
      const error = await withLiveBrowserPage(async () => "ok").catch((caughtError) => caughtError)

      expect(launchSpy).toHaveBeenCalledOnce()
      expect(error).toBeInstanceOf(LiveBrowserUnavailableError)
      expect((error as Error).message).toContain(fakeBrowserPath)
      expect((error as Error).message).toContain("launch failed")
    } finally {
      restoreEnv("ASTRA_BENCH_LIVE_BROWSER_PATH", originalBrowserPath)
      launchSpy.mockRestore()
    }
  })
})
