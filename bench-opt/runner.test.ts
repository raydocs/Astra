import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import os from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { runBenchOpt } from "./runner.ts"

function createBaselineReport() {
  return {
    runId: "2026-03-26T00-00-00-000Z",
    generatedAt: "2026-03-26T00:00:00.000Z",
    summary: {
      totalScenarios: 1,
      passedScenarios: 1,
      failedScenarios: 0,
      averageTotal: 100,
      surfaces: [
        {
          surface: "page-translation",
          scenarioCount: 1,
          passed: 1,
          failed: 0,
          averageTotal: 100,
        },
      ],
    },
    comparison: {
      regressions: 0,
      improvements: 0,
      unchanged: 1,
      added: 0,
    },
    scenarios: [
      {
        id: "page-translation/example",
        title: "Example",
        task: "Example task",
        surface: "page-translation",
        evaluation: {
          total: 100,
          pass: true,
        },
      },
    ],
  }
}

function createVerificationBaselineReport() {
  return {
    runId: "2026-03-26T01-00-00-000Z",
    generatedAt: "2026-03-26T01:00:00.000Z",
    summary: {
      totalScenarios: 3,
      passedScenarios: 1,
      failedScenarios: 2,
      averageTotal: 30,
      surfaces: [
        {
          surface: "page-translation",
          scenarioCount: 3,
          passed: 1,
          failed: 2,
          averageTotal: 30,
        },
      ],
    },
    comparison: {
      regressions: 2,
      improvements: 0,
      unchanged: 1,
      added: 0,
    },
    scenarios: [
      {
        id: "alpha",
        title: "Alpha",
        task: "Alpha task",
        surface: "page-translation",
        fixture: "alpha.md",
        evaluation: {
          total: 20,
          pass: false,
        },
      },
      {
        id: "beta",
        title: "Beta",
        task: "Beta task",
        surface: "page-translation",
        fixture: "beta.md",
        evaluation: {
          total: 30,
          pass: false,
        },
      },
      {
        id: "gamma",
        title: "Gamma",
        task: "Gamma task",
        surface: "page-translation",
        fixture: "gamma.md",
        evaluation: {
          total: 40,
          pass: true,
        },
      },
    ],
  }
}

function initGitRepo(root: string) {
  execFileSync("git", ["init"], { cwd: root, stdio: "ignore" })
  execFileSync("git", ["config", "user.email", "astra@example.com"], { cwd: root, stdio: "ignore" })
  execFileSync("git", ["config", "user.name", "Astra Test"], { cwd: root, stdio: "ignore" })
}

describe("bench-opt runner", () => {
  it("writes a resolved config artifact for the best phase-1 candidate pair", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const result = await runBenchOpt([
      "--write",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
    ])

    expect(result.paths).not.toBeNull()
    expect(result.paths?.latestJsonPath).toBe(path.join(outputDir, "latest.json"))
    expect(result.paths?.latestMarkdownPath).toBe(path.join(outputDir, "latest.md"))
    expect(result.paths?.latestResolvedJsonPath).toBe(path.join(outputDir, "latest.resolved.json"))
    expect(result.paths?.latestResolvedMarkdownPath).toBe(path.join(outputDir, "latest.resolved.md"))
    expect(result.paths?.latestStatusJsonPath).toBe(path.join(outputDir, "latest.status.json"))
    expect(result.paths?.latestStatusMarkdownPath).toBe(path.join(outputDir, "latest.status.md"))
    expect(result.paths?.latestOrchestrationJsonPath).toBeNull()
    expect(result.paths?.latestOrchestrationMarkdownPath).toBeNull()
    expect(result.paths?.experimentPath).toContain("/store/experiments/")
    expect(result.paths?.championPath).toContain("/store/champions/")
    expect(result.paths?.storeIndexPath).toBe(path.join(outputDir, "store", "index.json"))
    expect(result.orchestration).toBeNull()

    const resolvedRaw = await readFile(result.paths!.latestResolvedJsonPath!, "utf8")
    const statusRaw = await readFile(result.paths!.latestStatusJsonPath!, "utf8")
    const statusMarkdown = await readFile(result.paths!.latestStatusMarkdownPath!, "utf8")
    const resolved = JSON.parse(resolvedRaw) as {
      schemaVersion: number
      selection: {
        candidateId: string
        promptCandidateId: string
        contextCandidateId: string
        rank: number
        score: number
      }
      prompt: {
        id: string
        label: string
        description: string
        prompt: string
        policy: {
          analysisMode: string
          toolPolicy: string
          writeScopeMode: string
        }
      }
      context: {
        id: string
        label: string
        description: string
        slots: string[]
        policy: {
          rankingMode: string
          maxFiles: number
          maxLinesPerFile: number
          preferHistory: boolean
        }
        lines: string[]
      }
      worktree: {
        repositoryRoot: string
        baseRef: string
        branchName: string
        path: string
        command: string[]
        dryRun: boolean
      }
      downstream: {
        benchLoop: {
          candidateId: string
          promptCandidateId: string
          contextCandidateId: string
          prompt: string
          contextLines: string[]
          repositoryRoot: string
          baseRef: string
          branchName: string
          worktreePath: string
          command: string[]
        }
      }
      experiment?: {
        experimentId: string
        championTrialId: string | null
      }
      champion?: {
        championTrialId: string | null
        candidateId: string
        status: string
        resolvedConfigPath: string | null
      }
      store?: {
        experimentPath: string | null
        championPath: string | null
        indexPath: string | null
      }
    }
    const status = JSON.parse(statusRaw) as {
      overallState: string
      summary: {
        bestCandidateId: string | null
        selectedPromptCandidateId: string | null
        selectedContextCandidateId: string | null
      }
    }

    expect(resolved.schemaVersion).toBe(1)
    expect(resolved.selection.rank).toBe(1)
    expect(resolved.selection.candidateId).toBe(result.report.summary.bestCandidateId)
    expect(resolved.selection.promptCandidateId).toBe(resolved.prompt.id)
    expect(resolved.selection.contextCandidateId).toBe(resolved.context.id)
    expect(resolved.selection.score).toBe(result.report.summary.bestScore)
    expect(resolved.prompt.id).toMatch(/^prompt\//)
    expect(resolved.prompt.policy.analysisMode.length).toBeGreaterThan(0)
    expect(resolved.prompt.policy.toolPolicy.length).toBeGreaterThan(0)
    expect(resolved.prompt.policy.writeScopeMode.length).toBeGreaterThan(0)
    expect(resolved.prompt.label.length).toBeGreaterThan(0)
    expect(resolved.prompt.description.length).toBeGreaterThan(0)
    expect(resolved.prompt.prompt.length).toBeGreaterThan(0)
    expect(resolved.context.id).toMatch(/^context\//)
    expect(resolved.context.policy.maxFiles).toBeGreaterThan(0)
    expect(resolved.context.policy.maxLinesPerFile).toBeGreaterThan(0)
    expect(resolved.context.label.length).toBeGreaterThan(0)
    expect(resolved.context.description.length).toBeGreaterThan(0)
    expect(resolved.context.lines.length).toBeGreaterThan(0)
    expect(resolved.worktree.path).toContain(".bench-opt/worktrees/")
    expect(resolved.worktree.branchName).toMatch(/^codex\/bench-opt\//)
    expect(resolved.worktree.command).toEqual([
      "git",
      "worktree",
      "add",
      "--detach",
      resolved.worktree.path,
      "HEAD",
    ])
    expect(resolved.downstream.benchLoop).toEqual({
      candidateId: resolved.selection.candidateId,
      promptCandidateId: resolved.selection.promptCandidateId,
      contextCandidateId: resolved.selection.contextCandidateId,
      prompt: resolved.prompt.prompt,
      contextLines: resolved.context.lines,
      repositoryRoot: resolved.worktree.repositoryRoot,
      baseRef: resolved.worktree.baseRef,
      branchName: resolved.worktree.branchName,
      worktreePath: resolved.worktree.path,
      command: resolved.worktree.command,
    })
    expect(resolved.experiment?.experimentId.length).toBeGreaterThan(0)
    expect(resolved.champion?.candidateId).toBe(resolved.selection.candidateId)
    expect(resolved.store?.indexPath).toBe(path.join(outputDir, "store", "index.json"))

    expect(result.report.summary.bestCandidateId).toBe(resolved.selection.candidateId)
    expect(result.report.summary.evaluatedSplit).toBe("holdout")
    expect(result.report.summary.promotionSplits).toEqual(["validation", "holdout"])
    expect(result.experiment?.summary.bestTrialId).toBe(resolved.experiment?.championTrialId)
    expect(result.experiment?.summary.evaluatedSplit).toBe("holdout")
    expect(result.experiment?.summary.promotionGate.requiredSplits).toEqual(["validation", "holdout"])
    expect(result.experiment?.summary.promotionGate.observedSplits).toEqual(["holdout", "validation", "train"])
    expect(result.experiment?.summary.promotionGate.qualified).toBe(true)
    expect(result.experiment?.summary.promotionGate.missingSplits).toEqual([])
    expect(result.champion?.candidateId).toBe(resolved.selection.candidateId)
    expect(result.champion?.status).toBe("promoted")
    const championTrial = result.experiment?.trials.find((trial) => trial.trialId === result.experiment?.championTrialId)
    expect(championTrial?.artifacts.resolvedConfigPath).toBe(result.paths?.latestResolvedJsonPath)
    expect(status.overallState).toBe("idle")
    expect(status.summary.bestCandidateId).toBe(resolved.selection.candidateId)
    expect(status.summary.selectedPromptCandidateId).toBe(resolved.prompt.id)
    expect(status.summary.selectedContextCandidateId).toBe(resolved.context.id)
    expect(statusMarkdown).toContain("# Astra Bench Opt Status")
    expect(statusMarkdown).toContain("## Summary")
  })

  it("writes an orchestration artifact for the selected candidate when explicitly enabled", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-orchestration-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const orchestrationObjective = "Bounded orchestration for the selected candidate."
    const result = await runBenchOpt([
      "--write",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
    ], {
      orchestration: {
        objective: orchestrationObjective,
        constraints: ["Stay bounded to one planner/generator/evaluator pass."],
      },
    })

    expect(result.orchestration).not.toBeNull()
    expect(result.orchestrationLoop).not.toBeNull()
    expect(result.orchestrationIterations).toHaveLength(1)
    expect(result.paths?.latestOrchestrationJsonPath).toBe(path.join(outputDir, "latest.orchestration.json"))
    expect(result.paths?.latestOrchestrationMarkdownPath).toBe(path.join(outputDir, "latest.orchestration.md"))
    expect(result.paths?.latestOrchestrationLoopJsonPath).toBe(path.join(outputDir, "latest.orchestration-loop.json"))
    expect(result.paths?.latestOrchestrationLoopMarkdownPath).toBe(path.join(outputDir, "latest.orchestration-loop.md"))
    expect(result.paths?.orchestrationIterationsDirPath).toBe(path.join(outputDir, "orchestration-iterations"))

    const orchestrationRaw = await readFile(result.paths!.latestOrchestrationJsonPath!, "utf8")
    const orchestrationLoopRaw = await readFile(result.paths!.latestOrchestrationLoopJsonPath!, "utf8")
    const orchestration = JSON.parse(orchestrationRaw) as {
      schemaVersion: number
      runId: string
      generatedAt: string
      objective: string
      bounded: boolean
      iteration: {
        index: number
        max: number
        terminal: boolean
      }
      planner: {
        candidateScope: {
          candidateId: string | null
          split: string
          worktreePath: string | null
        }
      }
      generator: {
        editScope: {
          worktreePath: string | null
          branchName: string | null
          files: string[]
        }
      }
      evaluator: {
        score: number
        verdict: string
        recommendation: {
          action: string
          bounded: boolean
        }
        handoff: {
          kind: string
        }
      }
      decision: {
        action: string
        bounded: boolean
      }
      handoff: {
        kind: string
      }
    }
    const orchestrationLoop = JSON.parse(orchestrationLoopRaw) as {
      schemaVersion: number
      completedIterations: number
      maxIterations: number
      terminationReason: string
      finalDecision: {
        action: string
      } | null
      iterations: Array<{
        index: number
        terminal: boolean
        orchestration: {
          decision: {
            action: string
          }
        }
      }>
    }

    expect(orchestration.schemaVersion).toBe(1)
    expect(orchestration.objective).toBe(orchestrationObjective)
    expect(orchestration.bounded).toBe(true)
    expect(orchestration.iteration).toEqual({
      index: 1,
      max: 1,
      terminal: true,
    })
    expect(orchestration.planner.candidateScope.candidateId).toBe(result.report.summary.bestCandidateId)
    expect(orchestration.planner.candidateScope.split).toBe(result.report.summary.evaluatedSplit)
    expect(orchestration.planner.candidateScope.worktreePath).toContain(".bench-opt/worktrees/")
    expect(orchestration.generator.editScope.worktreePath).toContain(".bench-opt/worktrees/")
    expect(orchestration.generator.editScope.branchName).toMatch(/^codex\/bench-opt\//)
    expect(orchestration.evaluator.score).toBe(result.report.summary.bestScore)
    expect(orchestration.evaluator.recommendation.bounded).toBe(true)
    expect(orchestration.decision.bounded).toBe(true)
    expect(orchestration.handoff.kind).toBe(orchestration.evaluator.handoff.kind)
    expect(orchestrationLoop.schemaVersion).toBe(1)
    expect(orchestrationLoop.completedIterations).toBe(1)
    expect(orchestrationLoop.maxIterations).toBeGreaterThanOrEqual(1)
    expect(orchestrationLoop.finalDecision?.action).toBe(orchestration.decision.action)
    expect(orchestrationLoop.iterations).toHaveLength(1)
    expect(orchestrationLoop.iterations[0]?.orchestration.decision.action).toBe(orchestration.decision.action)
    await expect(readFile(path.join(result.paths!.orchestrationIterationsDirPath!, "iteration-1.json"), "utf8")).resolves.toContain("\"schemaVersion\": 1")
    expect(result.text).toContain("Opt-in orchestration")
    expect(result.text).toContain("Opt-in orchestration loop")
    expect(result.text).toContain("Opt-in orchestration artifacts")
  })

  it("emits loop handoff/session artifacts when orchestration requests rerun at the iteration cap", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-orchestration-loop-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const result = await runBenchOpt([
      "--write",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
    ], {
      orchestration: {
        objective: "Force a bounded rerun handoff.",
        forcedFollowUp: "rerun",
        maxIterations: 1,
      },
      session: {
        objective: "Track orchestration loop state for rerun handoff.",
      },
    })

    expect(result.orchestrationLoop).not.toBeNull()
    expect(result.orchestrationLoop?.completedIterations).toBe(1)
    expect(result.orchestrationLoop?.terminationReason).toContain("iteration cap reached")
    expect(result.orchestrationLoop?.finalDecision?.action).toBe("rerun")
    expect(result.session).not.toBeNull()
    expect(result.session?.state.phase).toBe("handoff")
    expect(result.session?.handoff).not.toBeNull()
    expect(result.paths?.latestOrchestrationLoopJsonPath).toBe(path.join(outputDir, "latest.orchestration-loop.json"))
    expect(result.paths?.latestSessionJsonPath).toBe(path.join(outputDir, "latest.session.json"))
    expect(result.paths?.latestHandoffJsonPath).toBe(path.join(outputDir, "latest.handoff.json"))
    await expect(readFile(result.paths!.latestOrchestrationLoopJsonPath!, "utf8")).resolves.toContain("\"terminationReason\"")
    await expect(readFile(result.paths!.latestSessionJsonPath!, "utf8")).resolves.toContain("\"phase\": \"handoff\"")
    await expect(readFile(result.paths!.latestHandoffJsonPath!, "utf8")).resolves.toContain("\"kind\": \"resume\"")
  })

  it("loads a saved session, checkpoint, and handoff and continues from the loaded state", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-resume-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const first = await runBenchOpt([
      "--write",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
    ], {
      orchestration: {
        objective: "Create a resumable orchestration handoff.",
        forcedFollowUp: "rerun",
        maxIterations: 1,
      },
      session: {
        objective: "Initial session lifecycle for resume coverage.",
      },
    })

    expect(first.session?.handoff).not.toBeNull()

    const second = await runBenchOpt([
      "--write",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
    ], {
      orchestration: {
        objective: "Resume and complete the same orchestration chain.",
        forcedFollowUp: "keep",
        maxIterations: 1,
      },
      session: {
        objective: "Resumed session lifecycle for resume coverage.",
        resumeSessionPath: first.paths!.latestSessionJsonPath,
        resumeCheckpointPath: first.paths!.latestCheckpointJsonPath,
        resumeHandoffPath: first.paths!.latestHandoffJsonPath,
      },
    })

    expect(second.session).not.toBeNull()
    expect(second.session?.state.sessionId).toBe(first.session?.state.sessionId)
    expect(second.session?.state.runId).not.toBe(first.session?.state.runId)
    expect(second.session?.state.progress.iteration).toBe(2)
    expect(second.session?.state.progress.completedIterations).toBe(2)
    expect(second.session?.state.resume.checkpointId).not.toBe(first.session?.handoff?.checkpointId)
    expect(second.session?.state.resume.checkpointId).toBe(second.session?.checkpoint.checkpointId)
    expect(second.session?.state.resume.handoffId).toBe(first.session?.handoff?.handoffId)
    expect(second.session?.state.history.checkpointIds).toContain(first.session?.checkpoint.checkpointId)
    expect(second.session?.state.history.handoffIds).toContain(first.session?.handoff?.handoffId)
    expect(second.session?.state.history.artifactPaths).toContain(first.paths?.latestSessionJsonPath)
    expect(second.orchestrationLoop?.completedIterations).toBe(1)
    expect(second.orchestrationLoop?.finalDecision?.action).toBe("keep")
    expect(second.text).toContain(`Resumed session: ${first.session?.state.sessionId}.`)
  })

  it("writes a resolved config artifact for explicit JSON candidates using default runtime policy", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-explicit-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    const candidatePath = path.join(tempRoot, "explicit-candidate.json")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))
    await writeFile(candidatePath, JSON.stringify({
      id: "explicit/manual-candidate",
      prompt: "Apply the smallest safe prompt-only change.",
      context: ["task", "candidateFiles", "history"],
      notes: ["explicit test candidate"],
    }, null, 2))

    const result = await runBenchOpt([
      "--write",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
      "--candidate",
      candidatePath,
    ])

    expect(result.paths?.latestResolvedJsonPath).toBe(path.join(outputDir, "latest.resolved.json"))
    const resolvedRaw = await readFile(result.paths!.latestResolvedJsonPath!, "utf8")
    const resolved = JSON.parse(resolvedRaw) as {
      selection: {
        candidateId: string
        promptCandidateId: string
        contextCandidateId: string
      }
      prompt: {
        id: string
        label: string
        policy: {
          analysisMode: string
          toolPolicy: string
          writeScopeMode: string
        }
      }
      context: {
        id: string
        label: string
        lines: string[]
        policy: {
          rankingMode: string
          maxFiles: number
          maxLinesPerFile: number
          preferHistory: boolean
        }
      }
    }

    expect(resolved.selection.candidateId).toBe("explicit/manual-candidate")
    expect(resolved.selection.promptCandidateId).toBe("prompt/explicit/explicit/manual-candidate")
    expect(resolved.selection.contextCandidateId).toBe("context/explicit/explicit/manual-candidate")
    expect(resolved.prompt.label).toBe("Explicit prompt candidate")
    expect(resolved.context.label).toBe("Explicit context candidate")
    expect(resolved.context.lines).toEqual(["task", "candidateFiles", "history"])
    expect(resolved.prompt.policy.analysisMode).toBe("minimal")
    expect(resolved.prompt.policy.toolPolicy).toBe("default")
    expect(resolved.prompt.policy.writeScopeMode).toBe("strict")
    expect(resolved.context.policy.rankingMode).toBe("balanced")
    expect(result.report.summary.evaluatedSplit).toBe("train")
    expect(result.report.summary.promotionSplits).toEqual(["train"])
    expect(result.experiment?.summary.promotionGate.qualified).toBe(true)
    expect(result.champion?.status).toBe("retained")
    expect(result.experiment?.trials[0]?.artifacts.resolvedConfigPath).toBe(result.paths?.latestResolvedJsonPath)
  })

  it("promotes the champion when the required promotion split is satisfied", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-promote-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify({
      ...createBaselineReport(),
      filter: {
        surface: null,
        split: "holdout",
      },
    }, null, 2))

    const result = await runBenchOpt([
      "--write",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
      "--evaluated-split",
      "holdout",
      "--promotion-splits",
      "holdout",
    ])

    expect(result.report.summary.evaluatedSplit).toBe("holdout")
    expect(result.report.summary.promotionSplits).toEqual(["holdout"])
    expect(result.experiment?.summary.promotionGate.qualified).toBe(true)
    expect(result.experiment?.summary.promotionGate.missingSplits).toEqual([])
    expect(result.champion?.status).toBe("promoted")
  })

  it("materializes the selected explicit candidate worktree and applies structured edits when enabled", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-execute-"))
    const repoRoot = path.join(tempRoot, "repo")
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(repoRoot, { recursive: true })
    await mkdir(baselineDir, { recursive: true })

    initGitRepo(repoRoot)
    const sourceFile = path.join(repoRoot, "file.ts")
    await writeFile(sourceFile, "export const value = 1\n", "utf8")
    execFileSync("git", ["add", "file.ts"], { cwd: repoRoot, stdio: "ignore" })
    execFileSync("git", ["commit", "-m", "initial"], { cwd: repoRoot, stdio: "ignore" })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const candidatePath = path.join(tempRoot, "explicit-execution-candidate.json")
    await writeFile(candidatePath, JSON.stringify({
      id: "explicit/execution-candidate",
      prompt: "Apply the smallest safe edit inside an isolated worktree.",
      context: ["task", "candidateFiles"],
      notes: ["explicit execution path"],
      edits: [
        {
          path: "file.ts",
          justification: "update the exported value",
          kind: "replace",
          search: "1",
          replace: "2",
        },
      ],
      worktree: {
        root: repoRoot,
        baseRef: "HEAD",
      },
    }, null, 2))

    const result = await runBenchOpt([
      "--write",
      "--materialize",
      "--apply-edits",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
      "--candidate",
      candidatePath,
    ])

    expect(result.execution).not.toBeNull()
    expect(result.execution?.candidateId).toBe("explicit/execution-candidate")
    expect(result.execution?.materialization.executed).toBe(true)
    expect(result.execution?.edits.enabled).toBe(true)
    expect(result.execution?.edits.applied).toBe(true)
    expect(result.execution?.edits.files).toHaveLength(1)

    const worktreePath = result.execution?.materialization.materializedPath
    expect(worktreePath).toContain(path.join(repoRoot, ".bench-opt", "worktrees"))
    await expect(readFile(path.join(worktreePath!, "file.ts"), "utf8")).resolves.toBe("export const value = 2\n")
    expect(result.text).toContain("Opt-in candidate execution")
    expect(result.text).toContain("Structured edits applied: yes")
  })

  it("runs verification and keep/reject comparison after materialized execution", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-verify-run-"))
    const repoRoot = path.join(tempRoot, "repo")
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    const fakePackageManager = path.join(tempRoot, "fake-pnpm")
    await mkdir(repoRoot, { recursive: true })
    await mkdir(baselineDir, { recursive: true })

    initGitRepo(repoRoot)
    await writeFile(path.join(repoRoot, "file.ts"), "export const value = 1\n", "utf8")
    execFileSync("git", ["add", "file.ts"], { cwd: repoRoot, stdio: "ignore" })
    execFileSync("git", ["commit", "-m", "initial"], { cwd: repoRoot, stdio: "ignore" })

    await writeFile(fakePackageManager, "#!/bin/sh\nexit 0\n", "utf8")
    await chmod(fakePackageManager, 0o755)

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createVerificationBaselineReport(), null, 2))

    const candidatePath = path.join(tempRoot, "explicit-verification-candidate.json")
    await writeFile(candidatePath, JSON.stringify({
      id: "explicit/verification-candidate",
      prompt: "Apply the smallest safe edit inside an isolated worktree.",
      context: ["task", "candidateFiles"],
      notes: ["explicit verification path"],
      edits: [
        {
          path: "file.ts",
          justification: "update the exported value",
          kind: "replace",
          search: "1",
          replace: "2",
        },
      ],
      worktree: {
        root: repoRoot,
        baseRef: "HEAD",
      },
    }, null, 2))

    const result = await runBenchOpt([
      "--write",
      "--materialize",
      "--apply-edits",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
      "--candidate",
      candidatePath,
    ], {
      verification: {
        packageManager: fakePackageManager,
        includeTests: false,
        benchSplits: ["train", "holdout"],
      },
    })

    expect(result.execution).not.toBeNull()
    expect(result.execution?.candidateId).toBe("explicit/verification-candidate")
    expect(result.execution?.materialization.executed).toBe(true)
    expect(result.execution?.edits.applied).toBe(true)
    expect(result.execution?.verification).not.toBeNull()
    expect(result.execution?.verification?.plan.commands.map((command) => command.id)).toEqual([
      "type-check",
      "bench-train",
      "bench-holdout",
    ])
    expect(result.execution?.verification?.plan.commands[0]?.command[0]).toBe(fakePackageManager)
    expect(result.execution?.verification?.execution.status).toBe("passed")
    expect(result.execution?.verification?.execution.execution.commandCount).toBe(3)
    expect(result.execution?.verification?.execution.execution.passedCount).toBe(3)
    expect(result.execution?.verification?.trialReport.scenarios?.map((scenario) => scenario.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ])
    expect(result.execution?.verification?.trialReport.summary?.averageTotal).toBe(100)
    expect(result.execution?.keepReject?.decision).toBe("promote")
    expect(result.execution?.keepReject?.comparison.summary.comparableScenarios).toBe(3)
    expect(result.execution?.keepReject?.signals.averageDelta).toBe(70)
    expect(result.text).toContain("Opt-in verification")
    expect(result.text).toContain("Keep/reject comparison")
    expect(result.text).toContain("Keep/reject decision: promote")
  })

  it("emits bounded session artifacts when session output is explicitly enabled", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-session-run-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const result = await runBenchOpt([
      "--write",
      "--session",
      "--session-force-handoff",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
    ])

    expect(result.session).not.toBeNull()
    expect(result.session?.state.sessionId).toContain("bench-opt-")
    expect(result.session?.checkpoint.kind).toBe("snapshot")
    expect(result.session?.handoff).not.toBeNull()
    expect(result.session?.state.phase).toBe("handoff")
    expect(result.paths?.latestSessionJsonPath).toBe(path.join(outputDir, "latest.session.json"))
    expect(result.paths?.latestCheckpointJsonPath).toBe(path.join(outputDir, "latest.checkpoint.json"))
    expect(result.paths?.latestHandoffJsonPath).toBe(path.join(outputDir, "latest.handoff.json"))
    expect(result.paths?.latestStatusJsonPath).toBe(path.join(outputDir, "latest.status.json"))
    await expect(readFile(result.paths!.latestSessionJsonPath!, "utf8")).resolves.toContain("\"bounded\": true")
    await expect(readFile(result.paths!.latestCheckpointJsonPath!, "utf8")).resolves.toContain("\"checkpointId\"")
    await expect(readFile(result.paths!.latestHandoffJsonPath!, "utf8")).resolves.toContain("\"handoffId\"")
    await expect(readFile(result.paths!.storeIndexPath!, "utf8")).resolves.toContain("\"latestSessionArtifacts\"")
    await expect(readFile(result.paths!.latestStatusJsonPath!, "utf8")).resolves.toContain("\"overallState\": \"handoff\"")
    expect(result.text).toContain("Opt-in session lifecycle")
    expect(result.text).toContain("Opt-in session artifacts")
  })

  it("emits promotion, publish, and rollback artifacts when promotion planning is enabled", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-promotion-run-"))
    const repoRoot = path.join(tempRoot, "repo")
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    const fakePackageManager = path.join(tempRoot, "fake-pnpm")
    await mkdir(repoRoot, { recursive: true })
    await mkdir(baselineDir, { recursive: true })

    initGitRepo(repoRoot)
    await writeFile(path.join(repoRoot, "file.ts"), "export const value = 1\n", "utf8")
    execFileSync("git", ["add", "file.ts"], { cwd: repoRoot, stdio: "ignore" })
    execFileSync("git", ["commit", "-m", "initial"], { cwd: repoRoot, stdio: "ignore" })
    await writeFile(fakePackageManager, "#!/bin/sh\nexit 0\n", "utf8")
    await chmod(fakePackageManager, 0o755)

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createVerificationBaselineReport(), null, 2))

    const candidatePath = path.join(tempRoot, "explicit-promotion-candidate.json")
    await writeFile(candidatePath, JSON.stringify({
      id: "explicit/promotion-candidate",
      prompt: "Apply the smallest safe edit inside an isolated worktree.",
      context: ["task", "candidateFiles"],
      notes: ["explicit promotion path"],
      edits: [
        {
          path: "file.ts",
          justification: "update the exported value",
          kind: "replace",
          search: "1",
          replace: "2",
        },
      ],
      worktree: {
        root: repoRoot,
        baseRef: "HEAD",
      },
    }, null, 2))

    const result = await runBenchOpt([
      "--write",
      "--materialize",
      "--apply-edits",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
      "--candidate",
      candidatePath,
    ], {
      verification: {
        packageManager: fakePackageManager,
        includeTests: false,
        benchSplits: ["train", "holdout"],
      },
      promotion: {
        liveEvaluatorPassed: true,
        allowPromotion: true,
      },
    })

    expect(result.execution?.keepReject?.decision).toBe("promote")
    expect(result.promotion).not.toBeNull()
    expect(result.promotion?.status).toBe("promoted")
    expect(result.publishPlan).not.toBeNull()
    expect(result.publishPlan?.status).toBe("planned")
    expect(result.rollbackPlan).not.toBeNull()
    expect(result.rollbackPlan?.status).toBe("idle")
    expect(result.paths?.latestPromotionJsonPath).toBe(path.join(outputDir, "latest.promotion.json"))
    expect(result.paths?.latestPublishJsonPath).toBe(path.join(outputDir, "latest.publish.json"))
    expect(result.paths?.latestRollbackJsonPath).toBe(path.join(outputDir, "latest.rollback.json"))
    expect(result.paths?.latestStatusJsonPath).toBe(path.join(outputDir, "latest.status.json"))
    await expect(readFile(result.paths!.latestPromotionJsonPath!, "utf8")).resolves.toContain("\"status\": \"promoted\"")
    await expect(readFile(result.paths!.latestPublishJsonPath!, "utf8")).resolves.toContain("\"status\": \"planned\"")
    await expect(readFile(result.paths!.latestRollbackJsonPath!, "utf8")).resolves.toContain("\"status\": \"idle\"")
    await expect(readFile(result.paths!.latestStatusJsonPath!, "utf8")).resolves.toContain("\"overallState\": \"promoted\"")
    expect(result.text).toContain("Opt-in promotion planning")
    expect(result.text).toContain("Opt-in promotion artifacts")
  })

  it("writes live evaluator artifacts and surfaces live status in the operator summary", async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "astra-bench-opt-live-run-"))
    const baselineDir = path.join(tempRoot, "bench-results")
    const outputDir = path.join(tempRoot, "bench-opt-results")
    await mkdir(baselineDir, { recursive: true })

    const baselinePath = path.join(baselineDir, "latest.json")
    await writeFile(baselinePath, JSON.stringify(createBaselineReport(), null, 2))

    const result = await runBenchOpt([
      "--write",
      "--live",
      "--live-scenario",
      "bench-live/placeholder",
      "--baseline",
      baselinePath,
      "--output",
      outputDir,
    ])

    expect(result.live).not.toBeNull()
    expect(result.live?.scenario.id).toBe("bench-live/placeholder")
    expect(result.live?.status).toBe("skipped")
    expect(result.live?.pass).toBe(false)
    expect(result.paths?.latestLiveJsonPath).toBe(path.join(outputDir, "latest.live.json"))
    expect(result.paths?.latestLiveMarkdownPath).toBe(path.join(outputDir, "latest.live.md"))
    expect(result.paths?.latestStatusJsonPath).toBe(path.join(outputDir, "latest.status.json"))
    await expect(readFile(result.paths!.latestLiveJsonPath!, "utf8")).resolves.toContain("\"status\": \"skipped\"")
    await expect(readFile(result.paths!.latestStatusJsonPath!, "utf8")).resolves.toContain("\"liveStatus\": \"skipped\"")
    expect(result.text).toContain("## Opt-in live evaluator")
    expect(result.text).toContain("## Opt-in live artifacts")
  })
})
