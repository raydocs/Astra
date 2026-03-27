import os from "node:os"
import path from "node:path"
import { mkdtemp, rm, writeFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

import { loadResolvedOptimizerConfig } from "./optimizer-config"
import { buildPatchTask } from "./reporters/patch-task"
import { buildPatchContextPack } from "./reporters/patch-context"
import { buildPatchPass } from "./reporters/patch-pass"
import { buildExecutorAttempt } from "./reporters/executor"
import type { GeneratorHandoffItem, LoopPlan } from "./types"

const sourceArtifacts = {
  latestLoop: "bench-results/latest.loop.json",
  latestHandoff: "bench-results/latest.handoff.json",
  latestFeedback: "bench-results/latest.feedback.md",
  latestJson: "bench-results/latest.json",
}

function makeItem(id: string, filePath: string): GeneratorHandoffItem {
  return {
    id,
    title: id,
    surface: "hover",
    status: "regressed",
    priority: "critical",
    total: 82,
    previousTotal: 97,
    delta: -15,
    pass: false,
    issueCount: 1,
    issues: [{ severity: "high", message: `${id} issue` }],
    nextActions: [`Fix ${id}`],
    scoreDeltas: [],
    suggestedPrompt: `Fix ${id}.`,
    repairHints: {
      suspectedFiles: [filePath],
      suspectedSymbols: [`${id.replace(/[^\w]/g, "_")}Symbol`],
      suspectedKeywords: [`${id.replace(/[^\w]/g, "_")}Keyword`],
      confidence: "high",
      risk: "local",
      failingSignals: [`${id} failing`],
    },
  }
}

async function createFixtureFiles(count: number) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "astra-optimizer-"))
  const files = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const filePath = path.join(dir, `fixture-${index + 1}.ts`)
      await writeFile(filePath, `export const fixture${index + 1} = ${index + 1}\n`, "utf8")
      return filePath
    }),
  )

  return {
    dir,
    files,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

async function createOptimizerReportFile() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "astra-optimizer-report-"))
  const reportPath = path.join(dir, "latest.json")
  await writeFile(
    reportPath,
    JSON.stringify({
      summary: {
        bestCandidateId: "prompt/minimal-direct+context/minimal-task",
      },
    }),
    "utf8",
  )

  return {
    dir,
    reportPath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

async function createResolvedOptimizerConfigFile() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "astra-optimizer-resolved-"))
  const configPath = path.join(dir, "latest.resolved.json")
  await writeFile(
    configPath,
    JSON.stringify({
      schemaVersion: 1,
      runId: "run-resolved",
      generatedAt: "2026-03-26T00:00:00.000Z",
      sourceArtifacts: {
        baselineReport: "bench-results/latest.json",
        candidateFiles: [],
      },
      selection: {
        candidateId: "prompt/minimal-direct+context/minimal-task",
        promptCandidateId: "prompt/minimal-direct",
        contextCandidateId: "context/minimal-task",
        rank: 1,
        score: 26,
        breakdown: {
          baselineHealth: 24,
          promptClarity: 4,
          contextCoverage: 0,
          artifactAlignment: 0,
          structuralSignals: 6,
          penalties: 8,
          total: 26,
        },
        alignmentMatches: [],
      },
      prompt: {
        id: "prompt/minimal-direct",
        label: "Minimal direct instruction",
        description: "Short task prompt optimized for concise execution and low prompt overhead.",
        prompt: "Solve the benchmark task using the smallest safe change.",
        policy: {
          analysisMode: "minimal",
          toolPolicy: "default",
          writeScopeMode: "strict",
        },
        tags: ["phase-1", "baseline", "direct"],
        surfaces: [],
      },
      context: {
        id: "context/minimal-task",
        label: "Minimal task context",
        description: "Compact context pack with only the core task inputs needed for execution.",
        slots: ["task", "surface", "fixture", "codeHint"],
        policy: {
          rankingMode: "balanced",
          maxFiles: 4,
          maxLinesPerFile: 80,
          preferHistory: false,
        },
        tags: ["phase-1", "baseline", "compact"],
        surfaces: [],
        lines: ["prompt candidate: prompt/minimal-direct"],
      },
      worktree: {
        repositoryRoot: "/tmp/astra",
        baseRef: "HEAD",
        branchName: "codex/bench-opt/prompt-minimal-direct-context-minimal-task",
        path: "/tmp/astra/.bench-opt/worktrees/prompt-minimal-direct-context-minimal-task",
        command: ["git", "worktree", "add", "--detach", "/tmp/astra/.bench-opt/worktrees/prompt-minimal-direct-context-minimal-task", "HEAD"],
        dryRun: true,
      },
      downstream: {
        benchLoop: {
          candidateId: "prompt/minimal-direct+context/minimal-task",
          promptCandidateId: "prompt/minimal-direct",
          contextCandidateId: "context/minimal-task",
          prompt: "Solve the benchmark task using the smallest safe change.",
          contextLines: ["prompt candidate: prompt/minimal-direct"],
          repositoryRoot: "/tmp/astra",
          baseRef: "HEAD",
          branchName: "codex/bench-opt/prompt-minimal-direct-context-minimal-task",
          worktreePath: "/tmp/astra/.bench-opt/worktrees/prompt-minimal-direct-context-minimal-task",
          command: ["git", "worktree", "add", "--detach", "/tmp/astra/.bench-opt/worktrees/prompt-minimal-direct-context-minimal-task", "HEAD"],
        },
      },
      notes: ["phase-1 registry candidate pair"],
    }),
    "utf8",
  )

  return {
    dir,
    configPath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describe("optimizer config integration", () => {
  it("threads the resolved phase 1 config through loop, task, context, and executor output", async () => {
    const reportFixture = await createOptimizerReportFile()
    const filesFixture = await createFixtureFiles(5)

    try {
      const optimizer = await loadResolvedOptimizerConfig(reportFixture.reportPath)
      expect(optimizer).toBeTruthy()
      expect(optimizer?.prompt?.id).toBe("prompt/minimal-direct")
      expect(optimizer?.context?.id).toBe("context/minimal-task")
      expect(optimizer?.context?.slots).not.toContain("history")
      expect(optimizer?.context?.slots).not.toContain("candidateFiles")
      expect(optimizer?.prompt?.policy).toEqual({
        analysisMode: "minimal",
        toolPolicy: "default",
        writeScopeMode: "strict",
      })
      expect(optimizer?.context?.policy).toEqual({
        rankingMode: "balanced",
        maxFiles: 4,
        maxLinesPerFile: 80,
        preferHistory: false,
      })

      const selectedItems = filesFixture.files.map((filePath, index) => makeItem(`hover/${index + 1}`, filePath))
      const plan: LoopPlan = {
        schemaVersion: 1,
        runId: "run-opt",
        generatedAt: "2026-03-26T00:00:00.000Z",
        optimizer: optimizer ?? undefined,
        sourceArtifacts,
        selection: {
          maxItems: 3,
          includeMedium: false,
          selectedCount: selectedItems.length,
          mode: "critical-high",
        },
        drill: {
          enabled: false,
          scenarioId: null,
          reason: null,
        },
        summary: {
          failedScenarios: 5,
          regressedScenarios: 5,
          imperfectPasses: 0,
        },
        selectedItems,
      }

      const task = buildPatchTask(plan, sourceArtifacts, { optimizer: optimizer ?? undefined })
      expect(task.prompt).toContain("Optimizer prompt candidate: prompt/minimal-direct")
      expect(task.prompt).toContain("Ranked candidate files: omitted by optimizer context candidate.")
      expect(task.prompt).not.toContain("History signals:")

      const contextPack = await buildPatchContextPack(task, {
        latestPatchTask: "bench-results/latest.patch-task.json",
        latestLoop: "bench-results/latest.loop.json",
        latestHandoff: "bench-results/latest.handoff.json",
        latestFeedback: "bench-results/latest.feedback.md",
        latestJson: "bench-results/latest.json",
      }, {
        optimizer: optimizer ?? undefined,
      })
      expect(contextPack.budget.maxFiles).toBe(4)
      expect(contextPack.budget.maxLinesPerFile).toBe(80)
      expect(contextPack.files).toHaveLength(4)

      const pass = buildPatchPass(task, contextPack, {
        latestPatchTask: "bench-results/latest.patch-task.json",
        latestPatchContext: "bench-results/latest.patch-context.json",
        latestLoop: "bench-results/latest.loop.json",
        latestHandoff: "bench-results/latest.handoff.json",
        latestFeedback: "bench-results/latest.feedback.md",
        latestJson: "bench-results/latest.json",
      })
      const attempt = buildExecutorAttempt(plan, task, contextPack, pass, {
        latestPatchPass: "bench-results/latest.patch-pass.json",
        latestPatchTask: "bench-results/latest.patch-task.json",
        latestPatchContext: "bench-results/latest.patch-context.json",
        latestLoop: "bench-results/latest.loop.json",
        latestHandoff: "bench-results/latest.handoff.json",
        latestFeedback: "bench-results/latest.feedback.md",
        latestJson: "bench-results/latest.json",
      }, {
        optimizer: optimizer ?? undefined,
      })

      expect(attempt.prompt).toContain("Optimizer configuration:")
      expect(attempt.prompt).toContain("prompt/minimal-direct")
      expect(attempt.prompt).toContain("context/minimal-task")
      expect(attempt.prompt).toContain("prompt policy: analysis=minimal, tools=default, write-scope=strict")
      expect(attempt.prompt).not.toContain("Analysis-first policy:")
    } finally {
      await reportFixture.cleanup()
      await filesFixture.cleanup()
    }
  })

  it("loads the concrete resolved optimizer config artifact directly", async () => {
    const fixture = await createResolvedOptimizerConfigFile()

    try {
      const optimizer = await loadResolvedOptimizerConfig(fixture.configPath)
      expect(optimizer).toEqual({
        sourcePath: fixture.configPath,
        sourceKind: "direct-config",
        prompt: {
          id: "prompt/minimal-direct",
          label: "Minimal direct instruction",
          description: "Short task prompt optimized for concise execution and low prompt overhead.",
          text: "Solve the benchmark task using the smallest safe change.",
          policy: {
            analysisMode: "minimal",
            toolPolicy: "default",
            writeScopeMode: "strict",
          },
        },
        context: {
          id: "context/minimal-task",
          label: "Minimal task context",
          description: "Compact context pack with only the core task inputs needed for execution.",
          slots: ["task", "surface", "fixture", "codeHint"],
          policy: {
            rankingMode: "balanced",
            maxFiles: 4,
            maxLinesPerFile: 80,
            preferHistory: false,
          },
        },
      })
    } finally {
      await fixture.cleanup()
    }
  })
})
