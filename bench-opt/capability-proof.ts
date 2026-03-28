import { randomUUID } from "node:crypto"

import {
  createLongRunConfig,
  runLongRunBenchmark,
  type LongRunConfig,
  type LongRunResult,
} from "./long-run.ts"
import type { AstraCapabilityId, AstraCapabilityLaneStatus } from "./capabilities.ts"

export interface CapabilityProofPromptSpec {
  id: string
  prompt: string
  category: string
  difficulty: "easy" | "medium" | "hard"
  capabilityTargets: readonly AstraCapabilityId[]
}

export interface CapabilityProofConfig {
  prompts: CapabilityProofPromptSpec[]
  runsPerPrompt: number
  sprintsPerRun: number
  longRunConfig?: Partial<LongRunConfig>
}

export interface CapabilityProofRunResult {
  promptId: string
  runIndex: number
  capabilityTargets: readonly AstraCapabilityId[]
  result: LongRunResult
  durationMs: number
}

export interface CapabilityProofCapabilitySummary {
  capabilityId: AstraCapabilityId
  promptIds: string[]
  runCount: number
  passCount: number
  partialCount: number
  failCount: number
  successRate: number
  averageScore: number
  laneStatus: AstraCapabilityLaneStatus
  notes: string[]
}

export interface CapabilityProofResult {
  schemaVersion: 1
  runId: string
  generatedAt: string
  config: CapabilityProofConfig
  runs: CapabilityProofRunResult[]
  capabilitySummaries: CapabilityProofCapabilitySummary[]
  notes: string[]
}

export function createWaveBCapabilityProofConfig(
  overrides: Partial<Pick<CapabilityProofConfig, "runsPerPrompt" | "sprintsPerRun" | "longRunConfig">> & {
    includeHoverTranslation?: boolean
    includeSubtitleFileTranslation?: boolean
    includeEpubTranslation?: boolean
  } = {},
): CapabilityProofConfig {
  const prompts: CapabilityProofPromptSpec[] = [
      {
        id: "wave-b-web-translation",
        prompt:
          "Build a browser translation experience optimized for dense articles, feed cards, navigation-heavy docs pages, and bilingual reading with resilient retry behavior.",
        category: "content-reading",
        difficulty: "medium",
        capabilityTargets: ["web-translation"],
      },
      {
        id: "wave-b-pdf-translation",
        prompt:
          "Build a bilingual PDF reader with translation-only mode, page-stable navigation, lazy visible-page translation, and layout-preserving paragraph alignment.",
        category: "document-translation",
        difficulty: "medium",
        capabilityTargets: ["pdf-translation", "web-translation"],
      },
      {
        id: "wave-b-youtube-subtitle",
        prompt:
          "Build a YouTube bilingual subtitle layer that handles rapid caption updates, deduplicates segments, and remains stable during pause, resume, and seek.",
        category: "media-subtitle",
        difficulty: "hard",
        capabilityTargets: ["youtube-bilingual-subtitles"],
      },
      {
        id: "wave-b-input-translation",
        prompt:
          "Build an input translation assistant for forms, textareas, and contenteditable fields with cursor preservation, safe writeback, and sensitive-field suppression.",
        category: "privacy-sensitive-authoring",
        difficulty: "medium",
        capabilityTargets: ["input-translation", "privacy-mode"],
      },
      {
        id: "wave-d-privacy-mode",
        prompt:
          "Build a privacy-preserving translation system that redacts page metadata, strips query and fragment data, preserves only hostname and canonical path, and keeps sensitive authoring surfaces isolated.",
        category: "privacy-sensitive-authoring",
        difficulty: "medium",
        capabilityTargets: ["privacy-mode", "web-translation", "input-translation"],
      },
    ]

  if (overrides.includeHoverTranslation) {
    prompts.push({
      id: "wave-c-hover-translation",
      prompt:
        "Build a hover translation experience with stable tooltips, request dedupe, moving-target resilience, and clear coordination with selection and input interactions.",
      category: "interaction-polish",
      difficulty: "medium",
      capabilityTargets: ["hover-translation"],
    })
  }

  if (overrides.includeSubtitleFileTranslation) {
    prompts.push({
      id: "wave-c-subtitle-file-translation",
      prompt:
        "Build a subtitle-file translation workflow for .srt and .vtt files with ingest, bilingual preview, malformed timing recovery, and timing-preserving export.",
      category: "document-translation",
      difficulty: "medium",
      capabilityTargets: ["subtitle-file-translation"],
    })
  }

  if (overrides.includeEpubTranslation) {
    prompts.push({
      id: "wave-c-epub-translation",
      prompt:
        "Build an EPUB bilingual reader with chapter navigation, translation-only mode, restored reading state, and resilient long-chapter batching.",
      category: "document-translation",
      difficulty: "medium",
      capabilityTargets: ["epub-bilingual-translation"],
    })
  }

  return {
    prompts,
    runsPerPrompt: overrides.runsPerPrompt ?? 2,
    sprintsPerRun: overrides.sprintsPerRun ?? 5,
    longRunConfig: overrides.longRunConfig,
  }
}

export async function runCapabilityProof(
  config: CapabilityProofConfig,
): Promise<CapabilityProofResult> {
  const runId = `cap-proof-${Date.now()}-${randomUUID().slice(0, 8)}`
  const runs: CapabilityProofRunResult[] = []
  const notes: string[] = []

  for (const prompt of config.prompts) {
    for (let runIndex = 0; runIndex < config.runsPerPrompt; runIndex++) {
      const startedAt = Date.now()
      const cfg = createLongRunConfig(prompt.prompt, {
        maxSprints: config.sprintsPerRun,
        liveValidation: { enabled: false, scenarioIds: [], runOnSprints: [] },
        hardening: {
          useArtifactScoring: true,
          usePromptClassification: true,
          perturbation: {
            enabled: true,
            seed: Date.now() + runIndex * 1000,
            thresholdJitter: 3,
            weightJitter: 0.05,
            promptVariants: true,
            scenarioOrderShuffle: true,
          },
          useHardenedVerdict: true,
          collectRealEvidence: false,
          ...(config.longRunConfig?.hardening ?? {}),
        },
        ...(config.longRunConfig ?? {}),
      })

      const result = await runLongRunBenchmark(cfg)
      runs.push({
        promptId: prompt.id,
        runIndex,
        capabilityTargets: prompt.capabilityTargets,
        result,
        durationMs: Date.now() - startedAt,
      })
    }
  }

  return {
    schemaVersion: 1,
    runId,
    generatedAt: new Date().toISOString(),
    config,
    runs,
    capabilitySummaries: summarizeCapabilityProofRuns(config, runs),
    notes,
  }
}

export function summarizeCapabilityProofRuns(
  config: CapabilityProofConfig,
  runs: CapabilityProofRunResult[],
): CapabilityProofCapabilitySummary[] {
  const capabilityIds = new Set<AstraCapabilityId>()
  for (const prompt of config.prompts) {
    for (const id of prompt.capabilityTargets) capabilityIds.add(id)
  }

  return Array.from(capabilityIds).map((capabilityId) => {
    const targetedPromptIds = config.prompts.filter((p) => p.capabilityTargets.includes(capabilityId)).map((p) => p.id)
    const targetedRuns = runs.filter((run) => run.capabilityTargets.includes(capabilityId))
    const scores = targetedRuns.map((run) => run.result.finalScore ?? 0)
    const passCount = targetedRuns.filter((run) => run.result.finalVerdict === "pass").length
    const partialCount = targetedRuns.filter((run) => run.result.finalVerdict === "partial").length
    const failCount = targetedRuns.filter((run) => run.result.finalVerdict === "fail").length
    const successRate = targetedRuns.length > 0 ? passCount / targetedRuns.length : 0
    const averageScore = scores.length > 0 ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10 : 0
    let laneStatus: AstraCapabilityLaneStatus = "missing"
    if (targetedRuns.length > 0) {
      laneStatus = successRate >= 0.8 && averageScore >= 70 ? "green" : "partial"
    }

    const notes: string[] = []
    if (targetedRuns.length === 0) {
      notes.push("No targeted proof runs executed.")
    } else {
      notes.push(`${passCount}/${targetedRuns.length} targeted proof run(s) passed.`)
      notes.push(`Average score: ${averageScore}.`)
      const families = new Set(targetedRuns.map((run) => run.result.classification?.family).filter(Boolean) as string[])
      if (families.size > 0) {
        notes.push(`Observed prompt families: ${Array.from(families).join(", ")}.`)
      }
    }

    return {
      capabilityId,
      promptIds: targetedPromptIds,
      runCount: targetedRuns.length,
      passCount,
      partialCount,
      failCount,
      successRate,
      averageScore,
      laneStatus,
      notes,
    }
  })
}

export function buildCapabilityProofOverrides(result: CapabilityProofResult) {
  const proofStatusOverrides: Partial<Record<AstraCapabilityId, AstraCapabilityLaneStatus>> = {}
  const proofNotes: Partial<Record<AstraCapabilityId, string[]>> = {}
  for (const summary of result.capabilitySummaries) {
    proofStatusOverrides[summary.capabilityId] = summary.laneStatus
    proofNotes[summary.capabilityId] = [
      `Capability proof: ${summary.passCount}/${summary.runCount} pass, avg ${summary.averageScore}.`,
      `Targeted prompts: ${summary.promptIds.join(", ") || "none"}.`,
      ...summary.notes,
    ]
  }
  return { proofStatusOverrides, proofNotes }
}

export function renderCapabilityProofMarkdown(result: CapabilityProofResult): string {
  const lines: string[] = []
  lines.push("# Astra Wave B Capability Proof")
  lines.push("")
  lines.push(`- Run ID: ${result.runId}`)
  lines.push(`- Generated: ${result.generatedAt}`)
  lines.push(`- Prompts: ${result.config.prompts.length}`)
  lines.push(`- Runs per prompt: ${result.config.runsPerPrompt}`)
  lines.push("")
  lines.push("## Capability Summary")
  lines.push("")
  lines.push("| Capability | Runs | Pass | Partial | Fail | Avg Score | Proof |")
  lines.push("|---|---:|---:|---:|---:|---:|---|")
  for (const summary of result.capabilitySummaries) {
    lines.push(`| ${summary.capabilityId} | ${summary.runCount} | ${summary.passCount} | ${summary.partialCount} | ${summary.failCount} | ${summary.averageScore} | ${summary.laneStatus} |`)
  }
  lines.push("")
  lines.push("## Targeted Prompts")
  lines.push("")
  for (const prompt of result.config.prompts) {
    lines.push(`### ${prompt.id}`)
    lines.push(`- Category: ${prompt.category}`)
    lines.push(`- Difficulty: ${prompt.difficulty}`)
    lines.push(`- Capabilities: ${prompt.capabilityTargets.join(", ")}`)
    lines.push(`- Prompt: ${prompt.prompt}`)
    lines.push("")
  }
  return lines.join("\n")
}
