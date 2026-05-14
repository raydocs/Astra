import { describe, expect, it } from "vitest"

import { buildPatchTask, renderPatchTaskMarkdown } from "./patch-task"
import type { LoopPlan } from "../types"

const sourceArtifacts = {
  latestLoop: "data/bench-results/latest.loop.json",
  latestHandoff: "data/bench-results/latest.handoff.json",
  latestFeedback: "data/bench-results/latest.feedback.md",
  latestJson: "data/bench-results/latest.json",
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "hover/alt-success",
    title: "Hover alt",
    surface: "hover",
    status: "regressed",
    priority: "critical",
    total: 82,
    previousTotal: 97,
    delta: -15,
    pass: false,
    issueCount: 1,
    issues: [
      {
        severity: "high",
        message: "Hover translation should not stay independent from the float ball.",
      },
    ],
    nextActions: ["Inspect interaction coordination", "Check float ball mounting"],
    scoreDeltas: [
      {
        key: "correctness",
        previous: 100,
        current: 85,
        delta: -15,
      },
    ],
    suggestedPrompt: "Fix hover alt.",
    ...overrides,
  }
}

function createBasePlan(selectedItems = [makeItem(), makeItem({ id: "hover/disabled-suppressed", title: "Hover disabled", status: "unchanged", priority: "high", total: 97, previousTotal: 97, delta: 0, pass: true, issueCount: 0, issues: [], nextActions: [], scoreDeltas: [], suggestedPrompt: "Polish hover disabled." })]) {
  return {
    schemaVersion: 1,
    runId: "run-4",
    generatedAt: "2026-03-26T00:00:00.000Z",
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
      failedScenarios: 0,
      regressedScenarios: 0,
      imperfectPasses: 2,
    },
    selectedItems,
  } as LoopPlan
}

describe("patch task reporter", () => {
  it("prioritizes regression and severity signals over otherwise comparable hints", () => {
    const plan = createBasePlan([
      makeItem({
        id: "hover/critical-regression",
        title: "Hover critical regression",
        status: "regressed",
        priority: "critical",
        total: 68,
        previousTotal: 93,
        delta: -25,
        pass: false,
        issueCount: 2,
        issues: [
          { severity: "critical", message: "Critical hover regression" },
          { severity: "high", message: "Follow-on hover failure" },
        ],
        scoreDeltas: [
          { key: "correctness", previous: 100, current: 75, delta: -25 },
          { key: "stability", previous: 95, current: 85, delta: -10 },
        ],
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/FloatBall.tsx"],
          suspectedSymbols: ["mountFloatBall"],
          suspectedKeywords: ["floatBallMounted"],
          confidence: "high",
          risk: "local",
          failingSignals: ["float ball should stay independent"],
        },
      }),
      makeItem({
        id: "input/stable-medium",
        title: "Input stable",
        surface: "input-translation",
        status: "unchanged",
        priority: "high",
        total: 94,
        previousTotal: 94,
        delta: 0,
        pass: true,
        issueCount: 1,
        issues: [
          { severity: "medium", message: "Minor hover polish issue" },
        ],
        scoreDeltas: [],
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/InputTranslate.tsx"],
          suspectedSymbols: ["mountInputTranslate"],
          suspectedKeywords: ["inputOverlayVisible"],
          confidence: "high",
          risk: "local",
          failingSignals: ["input overlay should remain mounted"],
        },
      }),
    ])

    const task = buildPatchTask(plan, sourceArtifacts)
    const regressedCandidate = task.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))
    const stableCandidate = task.candidateFiles.find((candidate) => candidate.path.endsWith("InputTranslate.tsx"))

    expect(regressedCandidate).toBeTruthy()
    expect(stableCandidate).toBeTruthy()
    expect(regressedCandidate?.priority ?? 0).toBeGreaterThan(stableCandidate?.priority ?? 0)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: item status=regressed"))).toBe(true)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: max issue severity=critical"))).toBe(true)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: item pass=false"))).toBe(true)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: overall delta=-25"))).toBe(true)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: 2 negative score deltas"))).toBe(true)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: hint confidence=high"))).toBe(true)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: hint risk=local"))).toBe(true)
    expect(regressedCandidate?.reasons.some((reason) => reason.includes("score: failing signals=1"))).toBe(true)
    expect(task.relevantFiles.some((file) => file.endsWith("FloatBall.tsx"))).toBe(true)
    expect(task.relevantFiles.some((file) => file.endsWith("InputTranslate.tsx"))).toBe(true)

    const markdown = renderPatchTaskMarkdown(task)
    expect(markdown).toContain("Ranked Candidate Files")
    expect(markdown).toContain("score: item status=regressed")
    expect(markdown).toContain("score: max issue severity=critical")
    expect(markdown).toContain("FloatBall.tsx")
  })

  it("uses confidence, risk, and failing signal counts to order equally ranked hint sources", () => {
    const plan = createBasePlan([
      makeItem({
        id: "hover/high-confidence-local",
        title: "Hover high confidence",
        status: "unchanged",
        priority: "high",
        total: 90,
        previousTotal: 90,
        delta: 0,
        pass: true,
        issueCount: 1,
        issues: [{ severity: "low", message: "Minor hover cleanup" }],
        scoreDeltas: [],
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/FloatBall.tsx"],
          suspectedSymbols: ["mountFloatBall"],
          suspectedKeywords: ["floatBallMounted"],
          confidence: "high",
          risk: "local",
          failingSignals: ["ball should stay visible", "ball should stay isolated"],
        },
      }),
      makeItem({
        id: "selection/low-confidence-cross-module",
        title: "Selection low confidence",
        surface: "selection-explain",
        status: "unchanged",
        priority: "high",
        total: 90,
        previousTotal: 90,
        delta: 0,
        pass: true,
        issueCount: 1,
        issues: [{ severity: "low", message: "Minor hover cleanup" }],
        scoreDeltas: [],
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/InputTranslate.tsx"],
          suspectedSymbols: ["mountInputTranslate"],
          suspectedKeywords: ["inputOverlayVisible"],
          confidence: "low",
          risk: "cross-module",
          failingSignals: [],
        },
      }),
    ])

    const task = buildPatchTask(plan, sourceArtifacts)
    const highConfidenceCandidate = task.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))
    const lowConfidenceCandidate = task.candidateFiles.find((candidate) => candidate.path.endsWith("InputTranslate.tsx"))

    expect(highConfidenceCandidate).toBeTruthy()
    expect(lowConfidenceCandidate).toBeTruthy()
    expect(highConfidenceCandidate?.priority ?? 0).toBeGreaterThan(lowConfidenceCandidate?.priority ?? 0)
    expect(highConfidenceCandidate?.reasons.some((reason) => reason.includes("score: hint confidence=high"))).toBe(true)
    expect(highConfidenceCandidate?.reasons.some((reason) => reason.includes("score: hint risk=local"))).toBe(true)
    expect(highConfidenceCandidate?.reasons.some((reason) => reason.includes("score: failing signals=2"))).toBe(true)
    expect(lowConfidenceCandidate?.reasons.some((reason) => reason.includes("score: hint confidence=low"))).toBe(true)
    expect(lowConfidenceCandidate?.reasons.some((reason) => reason.includes("score: hint risk=cross-module"))).toBe(true)

    const markdown = renderPatchTaskMarkdown(task)
    expect(markdown).toContain("score: hint confidence=high")
    expect(markdown).toContain("score: hint confidence=low")
    expect(markdown).toContain("score: hint risk=local")
    expect(markdown).toContain("score: hint risk=cross-module")
  })

  it("uses recurring failure history to boost otherwise comparable candidates", () => {
    const plan = createBasePlan([
      makeItem({
        id: "hover/alt-success",
        title: "Hover recurring",
        status: "unchanged",
        priority: "high",
        total: 90,
        previousTotal: 90,
        delta: 0,
        pass: true,
        issueCount: 1,
        issues: [{ severity: "low", message: "Minor hover cleanup" }],
        scoreDeltas: [],
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/FloatBall.tsx"],
          suspectedSymbols: ["mountFloatBall"],
          suspectedKeywords: ["floatBallMounted"],
          confidence: "medium",
          risk: "local",
          failingSignals: [],
        },
      }),
      makeItem({
        id: "selection/plain-history",
        title: "Selection without history",
        surface: "selection-explain",
        status: "unchanged",
        priority: "high",
        total: 90,
        previousTotal: 90,
        delta: 0,
        pass: true,
        issueCount: 1,
        issues: [{ severity: "low", message: "Minor selection cleanup" }],
        scoreDeltas: [],
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/SelectionToolbar.tsx"],
          suspectedSymbols: ["mountSelectionToolbar"],
          suspectedKeywords: ["selection"],
          confidence: "medium",
          risk: "local",
          failingSignals: [],
        },
      }),
    ]) as LoopPlan & { history?: LoopPlan["history"] }

    plan.history = {
      sourceJsonPath: "data/bench-results/latest.history.json",
      sourceMarkdownPath: "data/bench-results/latest.history.md",
      totalRuns: 12,
      notes: ["Loaded 12 historical runs."],
      weakestSurfaces: [],
      recurringFailures: [
        { id: "hover/alt-success", surface: "hover", issueCount: 4, latestTotal: 82, worstTotal: 40 },
      ],
    }

    const baseTask = buildPatchTask({ ...plan, history: undefined }, sourceArtifacts)
    const task = buildPatchTask(plan, {
      ...sourceArtifacts,
      latestHistoryJson: "data/bench-results/latest.history.json",
      latestHistoryMarkdown: "data/bench-results/latest.history.md",
    })

    const baseRecurringCandidate = baseTask.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))
    const recurringCandidate = task.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))

    expect(baseRecurringCandidate).toBeTruthy()
    expect(recurringCandidate).toBeTruthy()
    expect(recurringCandidate?.priority ?? 0).toBeGreaterThan(baseRecurringCandidate?.priority ?? 0)
    expect(recurringCandidate?.reasons.some((reason) => reason.includes("history recurring"))).toBe(true)
  })

  it("boosts recurring history failures ahead of otherwise similar candidates", () => {
    const plan = createBasePlan([
      makeItem({
        id: "hover/alt-success",
        status: "unchanged",
        priority: "high",
        total: 90,
        previousTotal: 90,
        delta: 0,
        pass: true,
        issueCount: 1,
        issues: [{ severity: "low", message: "Minor hover issue" }],
        scoreDeltas: [],
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/FloatBall.tsx"],
          suspectedSymbols: ["mountFloatBall"],
          suspectedKeywords: ["floatBallMounted"],
          confidence: "high",
          risk: "local",
          failingSignals: ["ball should stay visible"],
        },
      }),
      makeItem({
        id: "hover/disabled-suppressed",
        title: "Hover disabled",
        status: "unchanged",
        priority: "high",
        total: 90,
        previousTotal: 90,
        delta: 0,
        pass: true,
        issueCount: 1,
        issues: [{ severity: "low", message: "Minor hover issue" }],
        scoreDeltas: [],
        suggestedPrompt: "Polish hover disabled.",
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/HoverTranslate.tsx"],
          suspectedSymbols: ["mountHoverTranslate"],
          suspectedKeywords: ["hoverSuppressed"],
          confidence: "high",
          risk: "local",
          failingSignals: ["hover should stay suppressed"],
        },
      }),
    ]) as LoopPlan & {
      history?: {
        sourceJsonPath: string
        sourceMarkdownPath: string
        totalRuns: number
        notes: string[]
        weakestSurfaces: Array<{ surface: "hover"; averageTotal: number; direction: "improving" | "regressing" | "flat"; failureRuns: number }>
        recurringFailures: Array<{ id: string; surface: "hover"; issueCount: number; latestTotal: number; worstTotal: number }>
      }
    }
    plan.history = {
      sourceJsonPath: "data/bench-results/latest.history.json",
      sourceMarkdownPath: "data/bench-results/latest.history.md",
      totalRuns: 8,
      notes: ["Loaded 8 historical runs."],
      weakestSurfaces: [{ surface: "hover", averageTotal: 93, direction: "regressing", failureRuns: 2 }],
      recurringFailures: [{ id: "hover/alt-success", surface: "hover", issueCount: 3, latestTotal: 82, worstTotal: 40 }],
    }

    const baseTask = buildPatchTask({ ...plan, history: undefined }, sourceArtifacts)
    const task = buildPatchTask(plan, {
      ...sourceArtifacts,
      latestHistoryJson: "data/bench-results/latest.history.json",
      latestHistoryMarkdown: "data/bench-results/latest.history.md",
    })

    const baseRecurringCandidate = baseTask.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))
    const recurringCandidate = task.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))

    expect(baseRecurringCandidate).toBeTruthy()
    expect(recurringCandidate).toBeTruthy()
    expect((recurringCandidate?.priority ?? 0)).toBeGreaterThan(baseRecurringCandidate?.priority ?? 0)
    expect(recurringCandidate?.reasons.some((reason) => reason.includes("history recurring"))).toBe(true)
  })

  it("includes history signals in the patch task prompt and markdown when available", () => {
    const plan = createBasePlan() as LoopPlan & {
      history?: {
        sourceJsonPath: string
        sourceMarkdownPath: string
        totalRuns: number
        notes: string[]
        weakestSurfaces: Array<{ surface: "hover"; averageTotal: number; direction: "improving" | "regressing" | "flat"; failureRuns: number }>
        recurringFailures: Array<{ id: string; surface: "hover"; issueCount: number; latestTotal: number; worstTotal: number }>
      }
    }
    plan.history = {
      sourceJsonPath: "data/bench-results/latest.history.json",
      sourceMarkdownPath: "data/bench-results/latest.history.md",
      totalRuns: 8,
      notes: ["Loaded 8 historical runs."],
      weakestSurfaces: [{ surface: "hover", averageTotal: 93, direction: "improving", failureRuns: 2 }],
      recurringFailures: [{ id: "hover/alt-success", surface: "hover", issueCount: 3, latestTotal: 82, worstTotal: 40 }],
    }

    const task = buildPatchTask(plan, {
      ...sourceArtifacts,
      latestHistoryJson: "data/bench-results/latest.history.json",
      latestHistoryMarkdown: "data/bench-results/latest.history.md",
    })

    expect(task.history?.totalRuns).toBe(8)
    expect(task.prompt).toContain("History signals:")
    expect(task.prompt).toContain("Recurring failure: hover/alt-success")
    const markdown = renderPatchTaskMarkdown(task)
    expect(markdown).toContain("## History Signals")
    expect(markdown).toContain("Latest history JSON")
  })

  it("prefers explicit mappings more aggressively when the optimizer context policy is explicit-first", () => {
    const plan = createBasePlan([
      makeItem({
        id: "hover/explicit-first",
        repairHints: {
          suspectedFiles: ["src/entrypoints/content/components/FloatBall.tsx"],
          suspectedSymbols: ["mountFloatBall"],
          suspectedKeywords: ["floatBallMounted"],
          confidence: "high",
          risk: "local",
          failingSignals: ["float ball should stay independent"],
        },
      }),
    ])

    const balancedTask = buildPatchTask(plan, sourceArtifacts, {
      optimizer: {
        sourcePath: "data/bench-opt-results/latest.resolved.json",
        sourceKind: "direct-config",
        prompt: null,
        context: {
          id: "context/minimal-task",
          label: "Minimal task context",
          description: "Compact context pack.",
          slots: ["task", "surface", "fixture", "codeHint"],
          policy: {
            rankingMode: "balanced",
            maxFiles: 4,
            maxLinesPerFile: 80,
            preferHistory: false,
          },
        },
      },
    })
    const explicitTask = buildPatchTask(plan, sourceArtifacts, {
      optimizer: {
        sourcePath: "data/bench-opt-results/latest.resolved.json",
        sourceKind: "direct-config",
        prompt: null,
        context: {
          id: "context/expanded-task",
          label: "Expanded task context",
          description: "Broader context pack.",
          slots: ["task", "surface", "fixture", "codeHint", "history", "candidateFiles", "patchHints"],
          policy: {
            rankingMode: "explicit-first",
            maxFiles: 6,
            maxLinesPerFile: 120,
            preferHistory: true,
          },
        },
      },
    })

    const balancedCandidate = balancedTask.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))
    const explicitCandidate = explicitTask.candidateFiles.find((candidate) => candidate.path.endsWith("FloatBall.tsx"))

    expect(balancedCandidate).toBeTruthy()
    expect(explicitCandidate).toBeTruthy()
    expect((explicitCandidate?.priority ?? 0)).toBeGreaterThan(balancedCandidate?.priority ?? 0)
    expect(explicitTask.instructions.some((line) => line.includes("Optimizer context policy: ranking=explicit-first"))).toBe(true)
  })

  it("falls back to the surface file map when no hints are present", () => {
    const task = buildPatchTask(createBasePlan(), sourceArtifacts)

    expect(task.candidateFiles).toHaveLength(4)
    expect(task.candidateFiles[0].path.endsWith("HoverTranslate.tsx")).toBe(true)
    expect(task.candidateFiles.some((candidate) => candidate.path.endsWith("interaction-coordination.ts"))).toBe(true)
    expect(task.candidateFiles.every((candidate) => candidate.symbols.length === 0 && candidate.keywords.length === 0)).toBe(true)
    expect(task.relevantFiles).toHaveLength(4)

    const markdown = renderPatchTaskMarkdown(task)
    expect(markdown).toContain("surface fallback")
    expect(markdown).toContain("HoverTranslate.tsx")
  })
})
