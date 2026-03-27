import os from "node:os"
import path from "node:path"
import { mkdtemp, rm, writeFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { buildPatchContextPack, renderPatchContextMarkdown } from "./patch-context"
import type { PatchContextFile, PatchContextPack, PatchTask } from "../types"

interface PatchContextSlice {
  startLine: number
  endLine: number
  reason: string
  strategy: "symbol" | "keyword" | "fallback-head" | "fallback-tail"
}

interface PatchContextFileWithSlices extends PatchContextFile {
  slices: PatchContextSlice[]
}

interface PatchContextPackWithSlices extends PatchContextPack {
  files: PatchContextFileWithSlices[]
}

type CandidateFile = PatchTask["candidateFiles"][number]

async function createTempFixture(lines: string[], filename = "fixture.ts") {
  const dir = await mkdtemp(path.join(os.tmpdir(), "astra-patch-context-"))
  const filePath = path.join(dir, filename)
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8")

  return {
    dir,
    filePath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

function createTask(
  filePath: string,
  overrides: Partial<PatchTask> = {},
): PatchTask {
  return {
    schemaVersion: 2,
    runId: "run-5",
    generatedAt: "2026-03-26T00:00:00.000Z",
    sourceArtifacts: {
      latestLoop: "bench-results/latest.loop.json",
      latestHandoff: "bench-results/latest.handoff.json",
      latestFeedback: "bench-results/latest.feedback.md",
      latestJson: "bench-results/latest.json",
    },
    focus: {
      primaryScenarioId: "hover/alt-success",
      primarySurface: "hover",
      scenarioIds: ["hover/alt-success"],
      scenarioCount: 1,
    },
    candidateFiles: [
      {
        path: filePath,
        reasons: ["test fixture"],
        symbols: [],
        keywords: [],
        priority: 10,
      },
    ],
    relevantFiles: [filePath],
    validationCommands: ["pnpm bench", "pnpm test"],
    instructions: ["Keep the patch focused."],
    prompt: "Fix hover.",
    ...overrides,
  }
}

describe("patch context reporter", () => {
  it("captures slices from candidate symbols and keywords", async () => {
    const fixture = await createTempFixture(
      Array.from({ length: 60 }, (_, index) => {
        const lineNumber = index + 1
        if (lineNumber === 10) {
          return "export function focusSymbol() {"
        }
        if (lineNumber === 11) {
          return "  return \"alpha\""
        }
        if (lineNumber === 12) {
          return "}"
        }
        if (lineNumber === 50) {
          return "const hoverSuppressed = true"
        }
        if (lineNumber === 51) {
          return "console.log(hoverSuppressed)"
        }
        return `line ${lineNumber}`
      }),
    )

    try {
      const pack = await buildPatchContextPack(
        createTask(fixture.filePath, {
          candidateFiles: [
            {
              path: fixture.filePath,
              reasons: ["test candidate"],
              symbols: ["focusSymbol"],
              keywords: ["hoverSuppressed"],
              priority: 100,
            },
          ],
        }),
        {
          latestPatchTask: "bench-results/latest.patch-task.json",
          latestLoop: "bench-results/latest.loop.json",
          latestHandoff: "bench-results/latest.handoff.json",
          latestFeedback: "bench-results/latest.feedback.md",
          latestJson: "bench-results/latest.json",
        },
        {
          maxLinesPerFile: 80,
        },
      )

      const typedPack = pack as PatchContextPackWithSlices
      const markdown = renderPatchContextMarkdown(pack)
      const file = typedPack.files[0]

      expect(file?.exists).toBe(true)
      expect(file?.slices).toHaveLength(2)
      expect(file?.content).toContain("focusSymbol")
      expect(file?.content).toContain("hoverSuppressed")
      expect(file?.content).not.toContain("   1 | line 1")
      expect(file?.content).toContain("  10 | export function focusSymbol() {")
      expect(file?.content).toContain("  50 | const hoverSuppressed = true")
      expect(markdown).toContain("Slice count: 2")
      expect(markdown).toContain("matched symbol: focusSymbol")
      expect(markdown).toContain("matched keyword: hoverSuppressed")
    } finally {
      await fixture.cleanup()
    }
  })

  it("falls back to head and tail slices when no hints match", async () => {
    const fixture = await createTempFixture(
      Array.from({ length: 100 }, (_, index) => `line ${index + 1}`),
    )

    try {
      const pack = await buildPatchContextPack(
        createTask(fixture.filePath, {
          candidateFiles: [
            {
              path: fixture.filePath,
              reasons: ["test candidate"],
              symbols: ["missingSymbol"],
              keywords: ["missingKeyword"],
              priority: 100,
            },
          ],
        }),
        {
          latestPatchTask: "bench-results/latest.patch-task.json",
          latestLoop: "bench-results/latest.loop.json",
          latestHandoff: "bench-results/latest.handoff.json",
          latestFeedback: "bench-results/latest.feedback.md",
          latestJson: "bench-results/latest.json",
        },
        {
          maxLinesPerFile: 40,
        },
      )

      const typedPack = pack as PatchContextPackWithSlices
      const file = typedPack.files[0]
      const markdown = renderPatchContextMarkdown(pack)

      expect(file?.exists).toBe(true)
      expect(file?.slices).toHaveLength(2)
      expect(file?.slices[0]?.strategy).toBe("fallback-head")
      expect(file?.slices[1]?.strategy).toBe("fallback-tail")
      expect(file?.content).toContain("   1 | line 1")
      expect(file?.content).toContain(" 100 | line 100")
      expect(file?.content).not.toContain("  50 | line 50")
      expect(markdown).toContain("fallback: file head")
      expect(markdown).toContain("fallback: file tail")
    } finally {
      await fixture.cleanup()
    }
  })

  it("preserves missing-file behavior", async () => {
    const missingPath = path.join(os.tmpdir(), `astra-patch-context-missing-${Date.now()}.ts`)
    const pack = await buildPatchContextPack(
      createTask(missingPath),
      {
        latestPatchTask: "bench-results/latest.patch-task.json",
        latestLoop: "bench-results/latest.loop.json",
        latestHandoff: "bench-results/latest.handoff.json",
        latestFeedback: "bench-results/latest.feedback.md",
        latestJson: "bench-results/latest.json",
      },
      {
        maxLinesPerFile: 40,
      },
    )

    const typedPack = pack as PatchContextPackWithSlices
    const markdown = renderPatchContextMarkdown(pack)
    const file = typedPack.files[0]

    expect(file?.exists).toBe(false)
    expect(file?.lineCount).toBe(0)
    expect(file?.includedLines).toBe(0)
    expect(file?.truncated).toBe(false)
    expect(file?.content).toBe("")
    expect(file?.slices).toHaveLength(0)
    expect(markdown).toContain("Missing file")
  })

  it("keeps hinted anchor lines when multiple slices exceed the budget", async () => {
    const fixture = await createTempFixture(
      Array.from({ length: 100 }, (_, index) => {
        const lineNumber = index + 1
        if (lineNumber === 10) {
          return "export function firstSymbol() {"
        }
        if (lineNumber === 11) {
          return "  return 1"
        }
        if (lineNumber === 12) {
          return "}"
        }
        if (lineNumber === 80) {
          return "export function secondSymbol() {"
        }
        if (lineNumber === 81) {
          return "  return 2"
        }
        if (lineNumber === 82) {
          return "}"
        }
        return `line ${lineNumber}`
      }),
    )

    try {
      const pack = await buildPatchContextPack(
        createTask(fixture.filePath, {
          candidateFiles: [
            {
              path: fixture.filePath,
              reasons: ["test candidate"],
              symbols: ["firstSymbol", "secondSymbol"],
              keywords: [],
              priority: 100,
            },
          ],
        }),
        {
          latestPatchTask: "bench-results/latest.patch-task.json",
          latestLoop: "bench-results/latest.loop.json",
          latestHandoff: "bench-results/latest.handoff.json",
          latestFeedback: "bench-results/latest.feedback.md",
          latestJson: "bench-results/latest.json",
        },
        {
          maxLinesPerFile: 50,
        },
      )

      const typedPack = pack as PatchContextPackWithSlices
      const file = typedPack.files[0]
      const markdown = renderPatchContextMarkdown(pack)

      expect(file?.exists).toBe(true)
      expect(file?.slices.length).toBe(2)
      expect(file?.content).toContain("  10 | export function firstSymbol() {")
      expect(file?.content).toContain("  80 | export function secondSymbol() {")
      expect(markdown).toContain("matched symbol: firstSymbol")
      expect(markdown).toContain("matched symbol: secondSymbol")
    } finally {
      await fixture.cleanup()
    }
  })
})
