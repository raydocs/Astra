import { mkdtemp, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import type { LiveBenchRunOutcome } from "./index"
import { persistLiveBenchRunOutcome } from "./results"

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
})
