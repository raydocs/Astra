import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import type { LiveBenchRunOutcome } from "./index"
import { persistLiveBenchRunOutcome } from "./results"

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

describe("persistLiveBenchRunOutcome", () => {
  it("writes per-run and latest result artifacts", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "astra-live-results-"))
    const outcome: LiveBenchRunOutcome = {
      mode: "run",
      text: "result text",
      scenario: {
        id: "bench-live/test",
        title: "Test",
        surface: "page-translation",
        fixture: "page:test",
        tags: [],
        run: async () => ({ status: "completed" }),
      },
      context: {
        id: "bench-live/test",
        title: "Test",
        surface: "page-translation",
        fixture: "page:test",
        description: null,
        tags: [],
        runId: "live-test-run",
      },
      execution: {
        status: "completed",
      },
      result: {
        runId: "live-test-run",
        scenario: {
          id: "bench-live/test",
          title: "Test",
          surface: "page-translation",
          fixture: "page:test",
          description: null,
          tags: [],
        },
        status: "pass",
        pass: true,
        score: 100,
        summary: "ok",
        issues: [],
        nextActions: [],
        notes: [],
        rubrics: [],
        artifacts: {
          scenario: {
            id: "bench-live/test",
            title: "Test",
            surface: "page-translation",
            fixture: "page:test",
            description: null,
            tags: [],
          },
          execution: {},
          runtime: {
            scenarioId: "bench-live/test",
            scenarioTitle: "Test",
            status: "completed",
            startedAt: null,
            finishedAt: null,
            events: [],
            artifacts: {},
          },
          evaluation: {},
          rubrics: [],
          manifest: {
            schema: "astra.bench-live.result",
            version: 1,
            runId: "live-test-run",
            scenario: {
              id: "bench-live/test",
              title: "Test",
              surface: "page-translation",
              fixture: "page:test",
              description: null,
              tags: [],
            },
            execution: {
              status: "completed",
              summary: "ok",
              startedAt: null,
              finishedAt: null,
              noteCount: 0,
              artifactKeys: [],
            },
            evaluation: {
              status: "pass",
              pass: true,
              score: 100,
              issueCount: 0,
              nextActionCount: 0,
              rubricCount: 0,
            },
            runtime: {
              status: "completed",
              startedAt: null,
              finishedAt: null,
              eventCount: 0,
              artifactKeys: [],
            },
          },
        },
        runtime: {
          scenarioId: "bench-live/test",
          scenarioTitle: "Test",
          status: "completed",
          startedAt: null,
          finishedAt: null,
          events: [],
          artifacts: {},
        },
        manifest: {
          schema: "astra.bench-live.result",
          version: 1,
          runId: "live-test-run",
          scenario: {
            id: "bench-live/test",
            title: "Test",
            surface: "page-translation",
            fixture: "page:test",
            description: null,
            tags: [],
          },
          execution: {
            status: "completed",
            summary: "ok",
            startedAt: null,
            finishedAt: null,
            noteCount: 0,
            artifactKeys: [],
          },
          evaluation: {
            status: "pass",
            pass: true,
            score: 100,
            issueCount: 0,
            nextActionCount: 0,
            rubricCount: 0,
          },
          runtime: {
            status: "completed",
            startedAt: null,
            finishedAt: null,
            eventCount: 0,
            artifactKeys: [],
          },
        },
        text: "result text",
      },
      exitCode: 0,
    }

    const artifacts = await persistLiveBenchRunOutcome(outcome, rootDir)
    const latestJson = JSON.parse(await readFile(artifacts.latestJsonPath, "utf8")) as { runId: string }
    const runMarkdown = await readFile(artifacts.runMarkdownPath, "utf8")

    expect(artifacts.runJsonPath).toBe(path.join(rootDir, "live-test-run", "result.json"))
    expect(latestJson.runId).toBe("live-test-run")
    expect(runMarkdown).toBe("result text")
  })

  it("writes artifacts under ASTRA_BENCH_LIVE_ARTIFACT_ROOT when rootDir is omitted", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "astra-live-results-env-"))
    const originalArtifactRoot = process.env.ASTRA_BENCH_LIVE_ARTIFACT_ROOT
    process.env.ASTRA_BENCH_LIVE_ARTIFACT_ROOT = rootDir

    const outcome = {
      context: { runId: "live-env-run" },
      result: {
        runId: "live-env-run",
        text: "env result text",
      },
    } as LiveBenchRunOutcome

    try {
      const artifacts = await persistLiveBenchRunOutcome(outcome)
      const latestJson = JSON.parse(await readFile(artifacts.latestJsonPath, "utf8")) as { runId: string }
      const runMarkdown = await readFile(artifacts.runMarkdownPath, "utf8")

      expect(artifacts.runJsonPath).toBe(path.join(rootDir, "live-env-run", "result.json"))
      expect(latestJson.runId).toBe("live-env-run")
      expect(runMarkdown).toBe("env result text")
    } finally {
      restoreEnv("ASTRA_BENCH_LIVE_ARTIFACT_ROOT", originalArtifactRoot)
    }
  })
})
