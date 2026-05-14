import { readFile } from "node:fs/promises"
import path from "node:path"

import { getOptimizerCandidate } from "../bench-opt/registry.ts"
import type {
  OptimizerContextSlot,
  ResolvedOptimizerConfig,
  ResolvedOptimizerContextCandidate,
  ResolvedOptimizerContextPolicy,
  ResolvedOptimizerPromptCandidate,
  ResolvedOptimizerPromptPolicy,
} from "./types.ts"

type LooseRecord = Record<string, unknown>

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null
}

function toString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : []
}

function resolveSlots(value: unknown): OptimizerContextSlot[] {
  return toStringArray(value).filter((slot): slot is OptimizerContextSlot => (
    slot === "task" ||
    slot === "surface" ||
    slot === "fixture" ||
    slot === "codeHint" ||
    slot === "history" ||
    slot === "candidateFiles" ||
    slot === "reportSummary" ||
    slot === "patchHints"
  ))
}

function defaultPromptPolicy(): ResolvedOptimizerPromptPolicy {
  return {
    analysisMode: "minimal",
    toolPolicy: "default",
    writeScopeMode: "strict",
  }
}

function defaultContextPolicy(): ResolvedOptimizerContextPolicy {
  return {
    rankingMode: "balanced",
    maxFiles: 4,
    maxLinesPerFile: 80,
    preferHistory: false,
  }
}

function resolvePromptPolicy(value: unknown): ResolvedOptimizerPromptPolicy {
  if (!isRecord(value)) {
    return defaultPromptPolicy()
  }

  return {
    analysisMode: value.analysisMode === "analysis-first" ? "analysis-first" : "minimal",
    toolPolicy: value.toolPolicy === "read-before-edit" ? "read-before-edit" : "default",
    writeScopeMode: value.writeScopeMode === "evidence-led" ? "evidence-led" : "strict",
  }
}

function resolveContextPolicy(value: unknown): ResolvedOptimizerContextPolicy {
  if (!isRecord(value)) {
    return defaultContextPolicy()
  }

  return {
    rankingMode: value.rankingMode === "explicit-first" ? "explicit-first" : "balanced",
    maxFiles: typeof value.maxFiles === "number" && Number.isFinite(value.maxFiles) ? Math.max(1, Math.round(value.maxFiles)) : 4,
    maxLinesPerFile: typeof value.maxLinesPerFile === "number" && Number.isFinite(value.maxLinesPerFile) ? Math.max(20, Math.round(value.maxLinesPerFile)) : 80,
    preferHistory: Boolean(value.preferHistory),
  }
}

function resolvePromptCandidate(id: string | null): ResolvedOptimizerPromptCandidate | null {
  if (!id) {
    return null
  }

  const candidate = getOptimizerCandidate(id)
  if (!candidate || candidate.kind !== "prompt") {
    return null
  }

  return {
    id: candidate.id,
    label: candidate.label,
    description: candidate.description,
    text: candidate.prompt,
    policy: resolvePromptPolicy(candidate.policy),
  }
}

function resolveContextCandidate(id: string | null): ResolvedOptimizerContextCandidate | null {
  if (!id) {
    return null
  }

  const candidate = getOptimizerCandidate(id)
  if (!candidate || candidate.kind !== "context") {
    return null
  }

  return {
    id: candidate.id,
    label: candidate.label,
    description: candidate.description,
    slots: resolveSlots(candidate.slots),
    policy: resolveContextPolicy(candidate.policy),
  }
}

function resolvePromptFromResolvedArtifact(value: LooseRecord): ResolvedOptimizerPromptCandidate | null {
  const prompt = isRecord(value.prompt) ? value.prompt : null
  if (!prompt) {
    return null
  }

  const id = toString(prompt.id)
  const label = toString(prompt.label)
  const description = toString(prompt.description)
  const text = toString(prompt.prompt ?? prompt.text)

  if (!id || !label || !description || !text) {
    return null
  }

  return {
    id,
    label,
    description,
    text,
    policy: resolvePromptPolicy(prompt.policy),
  }
}

function resolveContextFromResolvedArtifact(value: LooseRecord): ResolvedOptimizerContextCandidate | null {
  const context = isRecord(value.context) ? value.context : null
  if (!context) {
    return null
  }

  const id = toString(context.id)
  const label = toString(context.label)
  const description = toString(context.description)
  const slots = resolveSlots(context.slots)

  if (!id || !label || !description || slots.length === 0) {
    return null
  }

  return {
    id,
    label,
    description,
    slots,
    policy: resolveContextPolicy(context.policy),
  }
}

function resolveBestCandidateId(value: LooseRecord): string | null {
  const bestCandidateId = toString(value?.summary && isRecord(value.summary) ? value.summary.bestCandidateId : undefined)
  if (bestCandidateId) {
    return bestCandidateId
  }

  return toString(value.candidateId)
}

function resolveDirectCandidateIds(value: LooseRecord) {
  return {
    promptId: toString(value.promptCandidateId ?? value.promptId),
    contextId: toString(value.contextCandidateId ?? value.contextId),
  }
}

function resolveCandidatePair(value: LooseRecord) {
  const bestCandidateId = resolveBestCandidateId(value)
  if (bestCandidateId) {
    const [promptId, contextId] = bestCandidateId.split("+")
    return {
      promptId: toString(promptId),
      contextId: toString(contextId),
      sourceKind: "bench-opt-report" as const,
    }
  }

  const direct = resolveDirectCandidateIds(value)
  if (direct.promptId || direct.contextId) {
    return {
      promptId: direct.promptId,
      contextId: direct.contextId,
      sourceKind: "direct-config" as const,
    }
  }

  return null
}

export async function loadResolvedOptimizerConfig(configPath?: string | null): Promise<ResolvedOptimizerConfig | null> {
  const candidatePaths = configPath
    ? [path.resolve(configPath)]
    : [
        path.join(path.resolve(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results")), "latest.resolved.json"),
        path.join(path.resolve(process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? path.join(process.cwd(), "data/bench-opt-results")), "latest.json"),
      ]

  for (const candidatePath of candidatePaths) {
    const resolvedPath = path.resolve(candidatePath)

    try {
      const raw = await readFile(resolvedPath, "utf8")
      const value = JSON.parse(raw) as LooseRecord
      if (!isRecord(value)) {
        continue
      }

      const resolvedPrompt = resolvePromptFromResolvedArtifact(value)
      const resolvedContext = resolveContextFromResolvedArtifact(value)
      if (resolvedPrompt || resolvedContext) {
        return {
          sourcePath: resolvedPath,
          sourceKind: "direct-config",
          prompt: resolvedPrompt,
          context: resolvedContext,
        }
      }

      const pair = resolveCandidatePair(value)
      if (!pair) {
        continue
      }

      const prompt = resolvePromptCandidate(pair.promptId)
      const context = resolveContextCandidate(pair.contextId)

      if (!prompt && !context) {
        continue
      }

      return {
        sourcePath: resolvedPath,
        sourceKind: pair.sourceKind,
        prompt,
        context,
      }
    } catch {
      continue
    }
  }

  return null
}
