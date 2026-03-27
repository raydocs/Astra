import type {
  BenchArtifactReportLike,
  BenchOptBaselineSnapshot,
  BenchOptCandidate,
  BenchOptCandidateInput,
  BenchOptCandidateScore,
  BenchOptTrialSplit,
} from "./types.ts"
import { buildWorktreePlan } from "./worktree.ts"

const FILE_PATH_PATTERN = /(?:^|[\s"'`(])[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+(?:[\s"'`).,:;]|$)/g
const LINE_REF_PATTERN = /\b(?:line\s+\d+|\d+-\d+|:\d+)\b/gi
const ARTIFACT_PATTERN = /\b(?:bench-results|latest\.json|latest\.md|patch-context|patch-task|handoff|feedback)\b/gi
const STRUCTURE_PATTERN = /(^|\n)\s*[-*]\s+|(^|\n)\s*\d+\.\s+|```/g
const ACTION_PATTERN = /\b(?:improve|refine|evaluate|score|compare|optimize|preserve|validate|analyze|reduce|tighten|isolate)\b/gi

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function countMatches(text: string, pattern: RegExp) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  const matcher = new RegExp(pattern.source, flags)
  const matches = text.match(matcher)
  return matches?.length ?? 0
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim()
}

function normalizeTrialSplit(value: string | null | undefined): BenchOptTrialSplit {
  return value === "validation" || value === "holdout" ? value : "train"
}

export function normalizeBaseline(report: BenchArtifactReportLike | null, pathHint: string | null): BenchOptBaselineSnapshot {
  if (!report) {
    return {
      path: pathHint,
      available: false,
      runId: null,
      generatedAt: null,
      split: null,
      totalScenarios: null,
      passedScenarios: null,
      failedScenarios: null,
      averageTotal: null,
      regressions: null,
      improvements: null,
      unchanged: null,
      added: null,
      terms: [],
      surfaces: [],
    }
  }

  const scenarios = report.scenarios ?? []
  const terms = new Set<string>()

  scenarios.forEach((scenario) => {
    if (scenario.id) terms.add(scenario.id)
    if (scenario.title) terms.add(scenario.title)
    if (scenario.task) terms.add(scenario.task)
    if (scenario.surface) terms.add(scenario.surface)
  })

  return {
    path: pathHint,
    available: true,
    runId: report.runId ?? null,
    generatedAt: report.generatedAt ?? null,
    split: report.filter?.split ? normalizeTrialSplit(report.filter.split) : null,
    totalScenarios: report.summary?.totalScenarios ?? scenarios.length,
    passedScenarios: report.summary?.passedScenarios ?? null,
    failedScenarios: report.summary?.failedScenarios ?? null,
    averageTotal: report.summary?.averageTotal ?? null,
    regressions: report.comparison?.regressions ?? null,
    improvements: report.comparison?.improvements ?? null,
    unchanged: report.comparison?.unchanged ?? null,
    added: report.comparison?.added ?? null,
    terms: [...terms],
    surfaces: report.summary?.surfaces ?? [],
  }
}

export function normalizeCandidate(candidate: BenchOptCandidateInput | BenchOptCandidate): BenchOptCandidate {
  const contextLines = "contextLines" in candidate
    ? candidate.contextLines.map((line) => line.trim()).filter(Boolean)
    : Array.isArray(candidate.context)
      ? candidate.context.map((line) => line.trim()).filter(Boolean)
      : candidate.context
        ? [candidate.context.trim()].filter(Boolean)
        : []

  return {
    id: candidate.id,
    prompt: (candidate.prompt ?? "").trim(),
    contextLines,
    notes: (candidate.notes ?? []).map((note) => note.trim()).filter(Boolean),
    edits: (candidate.edits ?? []).map((instruction) => ({ ...instruction })),
    worktree: {
      baseRef: candidate.worktree?.baseRef?.trim() || "HEAD",
      branchPrefix: candidate.worktree?.branchPrefix?.trim() || "codex/bench-opt",
      path: candidate.worktree?.path?.trim() || null,
      root: candidate.worktree?.root?.trim() || null,
    },
  }
}

function scorePrompt(candidate: BenchOptCandidate, baseline: BenchOptBaselineSnapshot) {
  const prompt = candidate.prompt
  const normalizedPrompt = normalizeWhitespace(prompt)
  const length = normalizedPrompt.length
  const structureSignals = countMatches(prompt, STRUCTURE_PATTERN)
  const fileRefs = countMatches(prompt, FILE_PATH_PATTERN)
  const lineRefs = countMatches(prompt, LINE_REF_PATTERN)
  const artifactRefs = countMatches(prompt, ARTIFACT_PATTERN)
  const actionVerbs = countMatches(prompt, ACTION_PATTERN)

  const promptClarity =
    clamp(length / 48, 0, 16) +
    clamp(structureSignals * 2.5, 0, 8) +
    clamp(fileRefs * 3, 0, 8) +
    clamp(lineRefs * 2.5, 0, 6) +
    clamp(artifactRefs * 3, 0, 6) +
    clamp(actionVerbs * 1.5, 0, 6)

  const penalties =
    (length > 0 && length < 80 ? 6 : 0) +
    (length > 1800 ? 4 : 0) +
    (baseline.available && baseline.failedScenarios !== null && baseline.failedScenarios > 0 ? 0 : 0)

  return {
    promptClarity: clamp(Math.round(promptClarity), 0, 30),
    penalties,
  }
}

function scoreContext(candidate: BenchOptCandidate) {
  const contextText = candidate.contextLines.join("\n")
  const normalizedContext = normalizeWhitespace(contextText)
  const length = normalizedContext.length
  const fileRefs = countMatches(contextText, FILE_PATH_PATTERN)
  const lineRefs = countMatches(contextText, LINE_REF_PATTERN)
  const artifactRefs = countMatches(contextText, ARTIFACT_PATTERN)
  const structureSignals = countMatches(contextText, STRUCTURE_PATTERN)

  const contextCoverage =
    clamp(length / 52, 0, 18) +
    clamp(fileRefs * 2.5, 0, 10) +
    clamp(lineRefs * 2.5, 0, 8) +
    clamp(artifactRefs * 3, 0, 8) +
    clamp(structureSignals * 1.5, 0, 6)

  const penalties =
    (length === 0 ? 8 : 0) +
    (length > 2200 ? 4 : 0)

  return {
    contextCoverage: clamp(Math.round(contextCoverage), 0, 32),
    penalties,
  }
}

function scoreAlignment(candidate: BenchOptCandidate, baseline: BenchOptBaselineSnapshot) {
  if (baseline.terms.length === 0) {
    return {
      alignment: 0,
      matches: [],
    }
  }

  const haystack = `${candidate.id}\n${candidate.prompt}\n${candidate.contextLines.join("\n")}`.toLowerCase()
  const matches = baseline.terms.filter((term) => term && haystack.includes(term.toLowerCase()))
  return {
    alignment: clamp(matches.length * 4, 0, 20),
    matches,
  }
}

function scoreBaselineHealth(baseline: BenchOptBaselineSnapshot) {
  if (!baseline.available) {
    return 0
  }

  const average = baseline.averageTotal ?? 0
  const failed = baseline.failedScenarios ?? 0
  const regressions = baseline.regressions ?? 0
  const passed = baseline.passedScenarios ?? 0

  return clamp(Math.round(average * 0.2 + passed * 0.5 - failed * 2 - regressions * 3), 0, 24)
}

export function scoreCandidate(
  candidateInput: BenchOptCandidateInput | BenchOptCandidate,
  baseline: BenchOptBaselineSnapshot,
  options: {
    worktreeRoot?: string
    repositoryRoot?: string
    dryRun?: boolean
  } = {},
): BenchOptCandidateScore {
  const candidate = normalizeCandidate(candidateInput)
  const prompt = scorePrompt(candidate, baseline)
  const context = scoreContext(candidate)
  const alignment = scoreAlignment(candidate, baseline)
  const baselineHealth = scoreBaselineHealth(baseline)
  const structuralSignals = clamp(candidate.notes.length * 2 + (candidate.contextLines.length > 0 ? 2 : 0), 0, 10)
  const penalties = prompt.penalties + context.penalties + (candidate.prompt.length === 0 ? 10 : 0)
  const total = clamp(
    Math.round(baselineHealth + prompt.promptClarity + context.contextCoverage + alignment.alignment + structuralSignals - penalties),
    0,
    100,
  )

  return {
    candidate,
    worktree: buildWorktreePlan(candidate, {
      repositoryRoot: options.repositoryRoot,
      worktreeRoot: options.worktreeRoot,
      dryRun: options.dryRun,
    }),
    breakdown: {
      baselineHealth,
      promptClarity: prompt.promptClarity,
      contextCoverage: context.contextCoverage,
      artifactAlignment: alignment.alignment,
      structuralSignals,
      penalties,
      total,
    },
    notes: [
      ...(baseline.available ? [] : ["No benchmark artifact available; scored against prompt/context heuristics only."]),
      ...(candidate.notes.length > 0 ? candidate.notes : []),
    ],
    alignmentMatches: alignment.matches,
  }
}

export function compareCandidateScores(a: BenchOptCandidateScore, b: BenchOptCandidateScore) {
  if (b.breakdown.total !== a.breakdown.total) {
    return b.breakdown.total - a.breakdown.total
  }

  if (b.breakdown.artifactAlignment !== a.breakdown.artifactAlignment) {
    return b.breakdown.artifactAlignment - a.breakdown.artifactAlignment
  }

  return b.breakdown.promptClarity - a.breakdown.promptClarity
}
