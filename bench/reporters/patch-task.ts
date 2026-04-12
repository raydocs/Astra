import path from "node:path"

import type { BenchmarkSurface, HistoryPromptSummary, LoopPlan, OptimizerContextSlot, PatchTask, ResolvedOptimizerConfig } from "../types"

const ROOT = process.cwd()

const SURFACE_FILE_MAP: Record<BenchmarkSurface, string[]> = {
  "page-translation": [
    "src/entrypoints/content/index.tsx",
    "src/entrypoints/content/page-translate.ts",
    "src/entrypoints/content/page-translate-registry.ts",
    "src/entrypoints/content/translation-context.ts",
    "src/utils/dom/extraction.ts",
    "src/utils/dom/traversal.ts",
  ],
  "site-automation": [
    "src/entrypoints/content/index.tsx",
    "src/entrypoints/content/page-translate.ts",
    "src/entrypoints/content/subtitle-translate.ts",
    "src/types/config.ts",
    "src/utils/storage/config.ts",
  ],
  "interaction-priority": [
    "src/entrypoints/content/components/HoverTranslate.tsx",
    "src/entrypoints/content/components/SelectionToolbar.tsx",
    "src/entrypoints/content/components/InputTranslate.tsx",
    "src/entrypoints/content/components/FloatBall.tsx",
    "src/entrypoints/content/interaction-coordination.ts",
    "src/utils/extension/messages.ts",
  ],
  "frame-coordination": [
    "src/entrypoints/content/index.tsx",
    "src/entrypoints/content/frame-context.ts",
    "src/entrypoints/background/frame-coordinator.ts",
    "src/entrypoints/content/page-translate.ts",
    "src/utils/extension/messages.ts",
  ],
  "dynamic-content": [
    "src/entrypoints/content/page-translate.ts",
    "src/entrypoints/content/page-translate-registry.ts",
    "src/utils/dom/traversal.ts",
    "src/utils/dom/inject.ts",
  ],
  "article-extraction": [
    "src/utils/dom/extraction.ts",
    "src/utils/dom/traversal.ts",
    "src/entrypoints/content/translation-context.ts",
  ],
  hover: [
    "src/entrypoints/content/components/HoverTranslate.tsx",
    "src/entrypoints/content/interaction-coordination.ts",
    "src/entrypoints/content/inline-actions.ts",
    "src/entrypoints/content/translation-context.ts",
  ],
  "selection-explain": [
    "src/entrypoints/content/components/SelectionToolbar.tsx",
    "src/entrypoints/content/inline-actions.ts",
    "src/entrypoints/content/translation-context.ts",
    "src/types/actions.ts",
  ],
  "input-translation": [
    "src/entrypoints/content/components/InputTranslate.tsx",
    "src/entrypoints/content/inline-actions.ts",
    "src/entrypoints/content/translation-context.ts",
    "src/utils/privacy.ts",
  ],
  subtitle: [
    "src/entrypoints/content/subtitle-translate.ts",
    "src/entrypoints/content/translation-context.ts",
    "src/utils/privacy.ts",
  ],
  "subtitle-file": [
    "src/entrypoints/subtitle-reader/subtitle-parser.ts",
    "src/entrypoints/subtitle-reader/SubtitleReaderApp.tsx",
    "src/entrypoints/subtitle-reader/main.tsx",
    "src/entrypoints/subtitle-reader/index.html",
  ],
  pdf: [
    "src/entrypoints/pdf-reader/PdfReaderApp.tsx",
    "src/entrypoints/pdf-reader/pdf-extractor.ts",
    "src/entrypoints/pdf-reader/pdf-translator.ts",
    "src/entrypoints/content/pdf-detect.ts",
  ],
  epub: [
    "src/entrypoints/epub-reader/EpubReaderApp.tsx",
    "src/entrypoints/epub-reader/main.tsx",
  ],
  "provider-routing": [
    "src/utils/providers/router.ts",
    "src/utils/providers/openai.ts",
    "src/utils/providers/gemini.ts",
    "src/utils/providers/relay.ts",
    "src/entrypoints/background/index.ts",
    "src/types/config.ts",
  ],
}

type LoopItem = LoopPlan["selectedItems"][number]
type LooseRecord = Record<string, unknown>

interface HintSource {
  source: string
  explicitFiles: string[]
  fallbackFiles: string[]
  symbols: string[]
  keywords: string[]
  failingSignals: string[]
  confidence: "low" | "medium" | "high" | null
  risk: "local" | "cross-module" | null
}

interface CandidateAccumulator {
  path: string
  reasons: Set<string>
  symbols: Set<string>
  keywords: Set<string>
  priority: number
}

export interface RankedPatchCandidateFile {
  path: string
  reasons: string[]
  symbols: string[]
  keywords: string[]
  priority: number
}

type PatchTaskLike = PatchTask & {
  candidateFiles: RankedPatchCandidateFile[]
}

type PatchTaskRenderLike = PatchTask & Partial<Pick<PatchTaskLike, "candidateFiles">>


function buildHistoryContext(plan: LoopPlan): HistoryPromptSummary | undefined {
  if (!plan.history) {
    return undefined
  }

  const selectedScenarioIds = new Set(plan.selectedItems.map((item) => item.id))
  const selectedSurfaces = new Set(plan.selectedItems.map((item) => item.surface))
  const recurringFailures = plan.history.recurringFailures.filter((entry) => (
    selectedScenarioIds.has(entry.id) || selectedSurfaces.has(entry.surface)
  ))
  const weakestSurfaces = plan.history.weakestSurfaces.filter((entry) => selectedSurfaces.has(entry.surface))

  return {
    ...plan.history,
    recurringFailures: (recurringFailures.length > 0 ? recurringFailures : plan.history.recurringFailures).slice(0, 4),
    weakestSurfaces: (weakestSurfaces.length > 0 ? weakestSurfaces : plan.history.weakestSurfaces).slice(0, 3),
  }
}

function optimizerHasSlot(
  optimizer: ResolvedOptimizerConfig | undefined,
  slot: OptimizerContextSlot,
  defaultValue = true,
) {
  if (!optimizer?.context) {
    return defaultValue
  }

  return optimizer.context.slots.includes(slot)
}

function getContextRankingMode(optimizer: ResolvedOptimizerConfig | undefined) {
  return optimizer?.context?.policy.rankingMode ?? "balanced"
}

function getPromptAnalysisMode(optimizer: ResolvedOptimizerConfig | undefined) {
  return optimizer?.prompt?.policy.analysisMode ?? "minimal"
}

function getPromptToolPolicy(optimizer: ResolvedOptimizerConfig | undefined) {
  return optimizer?.prompt?.policy.toolPolicy ?? "default"
}

function getPromptWriteScopeMode(optimizer: ResolvedOptimizerConfig | undefined) {
  return optimizer?.prompt?.policy.writeScopeMode ?? "strict"
}

function buildHistoryPromptLines(history?: HistoryPromptSummary) {
  if (!history) {
    return []
  }

  const lines: string[] = []
  lines.push(`History runs analyzed: ${history.totalRuns}`)
  history.recurringFailures.forEach((entry) => {
    lines.push(`Recurring failure: ${entry.id} (${entry.surface}) issue hits=${entry.issueCount}, latest=${entry.latestTotal}, worst=${entry.worstTotal}`)
  })
  history.weakestSurfaces.forEach((entry) => {
    lines.push(`Surface trend: ${entry.surface} avg ${entry.averageTotal.toFixed(1)} (${entry.direction}, failures ${entry.failureRuns})`)
  })

  return lines
}

interface HistoryScoreBreakdown {
  explicit: ScoreDetail
  fallbackPrimary: ScoreDetail
  fallbackSecondary: ScoreDetail
}

function buildHistoryScoreBreakdown(
  item: LoopItem,
  history: HistoryPromptSummary | undefined,
  hasExplicitMapping: boolean,
): HistoryScoreBreakdown {
  const explicit = createScoreDetail()
  const fallbackPrimary = createScoreDetail()
  const fallbackSecondary = createScoreDetail()

  if (!history) {
    return { explicit, fallbackPrimary, fallbackSecondary }
  }

  const recurring = history.recurringFailures.find((entry) => entry.id === item.id)
  if (recurring) {
    addScore(explicit, `history recurring issue hits=${recurring.issueCount}`, Math.min(140, recurring.issueCount * 32))

    const relapseRegressions = recurring.regressionCount ?? 0
    if (relapseRegressions > 0) {
      addScore(explicit, `history relapse regressions=${relapseRegressions}`, Math.min(72, relapseRegressions * 18))
    }

    const repeatFailures = recurring.failureCount ?? 0
    if (repeatFailures > 0) {
      addScore(explicit, `history repeated failures=${repeatFailures}`, Math.min(40, repeatFailures * 8))
    }

    if (typeof recurring.averageTotal === "number" && recurring.averageTotal < 100) {
      addScore(explicit, `history recurring average=${recurring.averageTotal.toFixed(1)}`, Math.min(18, Math.ceil((100 - recurring.averageTotal) / 3)))
    }

    if (recurring.latestTotal < 100) {
      addScore(explicit, `history latest total=${recurring.latestTotal}`, Math.min(24, Math.ceil((100 - recurring.latestTotal) / 3)))
    }

    const relapseGap = Math.max(0, recurring.latestTotal - recurring.worstTotal)
    if (relapseGap > 0) {
      addScore(explicit, `history relapse gap=${relapseGap}`, Math.min(20, Math.ceil(relapseGap / 4)))
    }

    if (!hasExplicitMapping) {
      addScore(fallbackPrimary, `history recurring carryover issue hits=${recurring.issueCount}`, Math.min(36, recurring.issueCount * 8))
      if (relapseRegressions > 0) {
        addScore(fallbackPrimary, `history recurring carryover regressions=${relapseRegressions}`, Math.min(16, relapseRegressions * 4))
      }
      if (recurring.latestTotal < 100) {
        addScore(fallbackPrimary, `history recurring carryover latest=${recurring.latestTotal}`, Math.min(10, Math.ceil((100 - recurring.latestTotal) / 8)))
      }

      addScore(fallbackSecondary, `history recurring carryover issue hits=${recurring.issueCount}`, Math.min(18, recurring.issueCount * 4))
    }
  }

  const surfaceSignal = history.weakestSurfaces.find((entry) => entry.surface === item.surface)
  if (surfaceSignal) {
    if (surfaceSignal.averageTotal < 100) {
      addScore(fallbackPrimary, `history trend surface avg=${surfaceSignal.averageTotal.toFixed(1)}`, Math.min(18, Math.ceil((100 - surfaceSignal.averageTotal) / 2)))
      addScore(fallbackSecondary, `history trend surface avg=${surfaceSignal.averageTotal.toFixed(1)}`, Math.min(10, Math.ceil((100 - surfaceSignal.averageTotal) / 4)))
    }
    if (surfaceSignal.failureRuns > 0) {
      addScore(fallbackPrimary, `history trend surface failures=${surfaceSignal.failureRuns}`, Math.min(12, surfaceSignal.failureRuns * 2))
      addScore(fallbackSecondary, `history trend surface failures=${surfaceSignal.failureRuns}`, Math.min(6, surfaceSignal.failureRuns))
    }
    if (surfaceSignal.direction === "regressing") {
      addScore(fallbackPrimary, "history trend surface direction=regressing", 8)
      addScore(fallbackSecondary, "history trend surface direction=regressing", 4)
    }
  }

  return { explicit, fallbackPrimary, fallbackSecondary }
}

function buildHistoryScore(item: LoopItem, history: HistoryPromptSummary | undefined): ScoreDetail {
  const breakdown = buildHistoryScoreBreakdown(item, history, false)
  return {
    total: breakdown.explicit.total + breakdown.fallbackPrimary.total + breakdown.fallbackSecondary.total,
    reasons: dedupe([
      ...breakdown.explicit.reasons,
      ...breakdown.fallbackPrimary.reasons,
      ...breakdown.fallbackSecondary.reasons,
    ]),
  }
}

interface ScoreDetail {
  total: number
  reasons: string[]
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)]
}

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function normalizeConfidence(value: unknown): HintSource["confidence"] {
  if (value === "low" || value === "medium" || value === "high") {
    return value
  }

  return null
}

function normalizeRisk(value: unknown): HintSource["risk"] {
  if (value === "local" || value === "cross-module") {
    return value
  }

  return null
}

function parseHintSource(source: string, value: unknown): HintSource | null {
  if (!isRecord(value)) {
    return null
  }

  const explicitFiles = dedupe([
    ...toStringArray(value.suspectedFiles),
    ...toStringArray(value.files),
    ...toStringArray(value.relevantFiles),
  ])
  const fallbackFiles = dedupe(toStringArray(value.fallbackSurfaceFiles))
  const symbols = dedupe([
    ...toStringArray(value.suspectedSymbols),
    ...toStringArray(value.symbols),
  ])
  const keywords = dedupe([
    ...toStringArray(value.suspectedKeywords),
    ...toStringArray(value.keywords),
  ])
  const failingSignals = dedupe(toStringArray(value.failingSignals))
  const confidence = normalizeConfidence(value.confidence)
  const risk = normalizeRisk(value.risk)

  if (
    explicitFiles.length === 0 &&
    fallbackFiles.length === 0 &&
    symbols.length === 0 &&
    keywords.length === 0 &&
    failingSignals.length === 0 &&
    confidence === null &&
    risk === null
  ) {
    return null
  }

  return {
    source,
    explicitFiles,
    fallbackFiles,
    symbols,
    keywords,
    failingSignals,
    confidence,
    risk,
  }
}

function getLoopItemHints(item: LoopItem & LooseRecord) {
  return [
    parseHintSource("item", item),
    parseHintSource("codeHint", item.codeHint),
    parseHintSource("repairHints", item.repairHints),
    parseHintSource("patchHints", item.patchHints),
    parseHintSource("hints", item.hints),
  ].filter((source): source is HintSource => source !== null)
}

function getSurfaceFallbackFiles(item: LoopItem & LooseRecord, fallbackOverrides: string[]) {
  if (fallbackOverrides.length > 0) {
    return dedupe(fallbackOverrides)
  }

  return SURFACE_FILE_MAP[item.surface] ?? []
}

function createScoreDetail(): ScoreDetail {
  return {
    total: 0,
    reasons: [],
  }
}

function formatScore(amount: number) {
  return amount >= 0 ? `+${amount}` : `${amount}`
}

function addScore(detail: ScoreDetail, label: string, amount: number) {
  if (amount === 0) {
    return
  }

  detail.total += amount
  detail.reasons.push(`score: ${label} ${formatScore(amount)}`)
}

function maxIssueSeverity(issues: LoopItem["issues"]) {
  const severityOrder = ["critical", "high", "medium", "low"] as const

  return severityOrder.find((severity) => issues.some((issue) => issue.severity === severity)) ?? null
}

function buildItemScore(item: LoopItem) {
  const detail = createScoreDetail()

  if (item.status === "regressed") {
    addScore(detail, "item status=regressed", 60)
  } else if (item.status === "new") {
    addScore(detail, "item status=new", 24)
  } else if (item.status === "improved") {
    addScore(detail, "item status=improved", 10)
  }

  if (!item.pass) {
    addScore(detail, "item pass=false", 25)
  }

  if (item.delta !== null && item.delta < 0) {
    addScore(detail, `overall delta=${item.delta}`, Math.min(20, Math.abs(item.delta)))
  }

  const severity = maxIssueSeverity(item.issues)
  if (severity === "critical") {
    addScore(detail, "max issue severity=critical", 40)
  } else if (severity === "high") {
    addScore(detail, "max issue severity=high", 28)
  } else if (severity === "medium") {
    addScore(detail, "max issue severity=medium", 14)
  } else if (severity === "low") {
    addScore(detail, "max issue severity=low", 6)
  }

  if (item.issues.length > 1) {
    addScore(detail, `issue count=${item.issues.length}`, Math.min(12, (item.issues.length - 1) * 3))
  }

  if (item.priority === "critical") {
    addScore(detail, "item priority=critical", 20)
  } else if (item.priority === "high") {
    addScore(detail, "item priority=high", 12)
  } else if (item.priority === "medium") {
    addScore(detail, "item priority=medium", 6)
  }

  const negativeScoreDeltas = item.scoreDeltas.filter((entry) => typeof entry.delta === "number" && entry.delta < 0).length
  if (negativeScoreDeltas > 0) {
    addScore(detail, `${negativeScoreDeltas} negative score delta${negativeScoreDeltas === 1 ? "" : "s"}`, Math.min(15, negativeScoreDeltas * 4))
  }

  return detail
}

function buildSourceScore(source: HintSource) {
  const detail = createScoreDetail()

  if (source.source === "repairHints") {
    addScore(detail, "hint source=repairHints", 50)
  } else if (source.source === "patchHints") {
    addScore(detail, "hint source=patchHints", 42)
  } else if (source.source === "codeHint") {
    addScore(detail, "hint source=codeHint", 34)
  } else if (source.source === "item") {
    addScore(detail, "hint source=item", 18)
  } else {
    addScore(detail, `hint source=${source.source}`, 12)
  }

  if (source.confidence === "high") {
    addScore(detail, "hint confidence=high", 12)
  } else if (source.confidence === "medium") {
    addScore(detail, "hint confidence=medium", 6)
  } else if (source.confidence === "low") {
    addScore(detail, "hint confidence=low", -4)
  }

  if (source.risk === "local") {
    addScore(detail, "hint risk=local", 6)
  } else if (source.risk === "cross-module") {
    addScore(detail, "hint risk=cross-module", 4)
  }

  if (source.failingSignals.length > 0) {
    addScore(detail, `failing signals=${source.failingSignals.length}`, Math.min(12, source.failingSignals.length * 4))
  }

  return detail
}

function addCandidate(
  map: Map<string, CandidateAccumulator>,
  filePath: string,
  options: {
    reasons?: string[]
    symbols?: string[]
    keywords?: string[]
    priority: number
  },
) {
  const absolutePath = path.resolve(ROOT, filePath)
  const existing = map.get(absolutePath)

  if (existing) {
    existing.priority += options.priority
    options.reasons?.forEach((reason) => existing.reasons.add(reason))
    options.symbols?.forEach((symbol) => existing.symbols.add(symbol))
    options.keywords?.forEach((keyword) => existing.keywords.add(keyword))
    return
  }

  map.set(absolutePath, {
    path: absolutePath,
    reasons: new Set(options.reasons ?? []),
    symbols: new Set(options.symbols ?? []),
    keywords: new Set(options.keywords ?? []),
    priority: options.priority,
  })
}

function describeItemSignals(item: LoopItem, index: number) {
  const severity = maxIssueSeverity(item.issues)
  const lines = [
    `selected scenario: ${item.id}`,
    `surface: ${item.surface}`,
    `status: ${item.status}`,
    `pass: ${item.pass ? "true" : "false"}`,
    `priority: ${item.priority}`,
    item.previousTotal !== null ? `previous total: ${item.previousTotal}` : null,
    item.delta !== null ? `delta: ${item.delta}` : null,
    item.issues.length > 0 ? `issue count: ${item.issues.length}` : null,
    severity ? `max issue severity: ${severity}` : null,
    item.scoreDeltas.some((entry) => typeof entry.delta === "number" && entry.delta < 0)
      ? `negative score deltas: ${item.scoreDeltas.filter((entry) => typeof entry.delta === "number" && entry.delta < 0).length}`
      : null,
    index === 0 ? "primary loop item" : null,
  ]

  return lines.filter((value): value is string => value !== null)
}

function buildInstructions(
  plan: LoopPlan,
  candidateFiles: RankedPatchCandidateFile[],
  optimizer?: ResolvedOptimizerConfig,
) {
  const instructions: string[] = []
  const history = optimizerHasSlot(optimizer, "history") ? buildHistoryContext(plan) : undefined
  instructions.push("Fix the selected scenarios before touching any unselected behavior.")
  instructions.push("Keep the code change as small and local as possible.")
  if (optimizerHasSlot(optimizer, "candidateFiles")) {
    instructions.push("Use the ranked candidate files as the first inspection boundary, then expand only if the evidence forces it.")
  } else {
    instructions.push("The optimizer context candidate omits ranked file guidance; inspect the selected scenarios directly before widening scope.")
  }
  instructions.push("Re-run `pnpm bench` after the edit. Re-run `pnpm test` once bench is acceptable.")

  if (optimizer?.prompt) {
    instructions.push(`Optimizer prompt candidate: ${optimizer.prompt.id} (${optimizer.prompt.label})`)
    instructions.push(`Optimizer prompt policy: analysis=${getPromptAnalysisMode(optimizer)}, tools=${getPromptToolPolicy(optimizer)}, write-scope=${getPromptWriteScopeMode(optimizer)}`)
  }
  if (optimizer?.context) {
    instructions.push(`Optimizer context candidate: ${optimizer.context.id} (${optimizer.context.label})`)
    instructions.push(`Optimizer slots: ${optimizer.context.slots.join(", ")}`)
    instructions.push(`Optimizer context policy: ranking=${getContextRankingMode(optimizer)}, maxFiles=${optimizer.context.policy.maxFiles}, maxLines=${optimizer.context.policy.maxLinesPerFile}, history=${optimizer.context.policy.preferHistory ? "preferred" : "trimmed"}`)
  }

  if (getPromptAnalysisMode(optimizer) === "analysis-first") {
    instructions.push("Before editing, do a quick relevance pass across the selected scenario, candidate files, and write-scope boundary.")
  }

  if (getPromptToolPolicy(optimizer) === "read-before-edit") {
    instructions.push("Read the highest-ranked candidate files first; do not widen scope or edit until those reads fail to explain the regression.")
  }

  if (plan.selectedItems.some((item) => item.status === "regressed")) {
    instructions.unshift("Prioritize regression recovery over polish work.")
  }

  if (candidateFiles.length === 0) {
    instructions.push("No surface-specific file map was found; inspect the scenario artifacts directly before editing.")
  }

  if (optimizerHasSlot(optimizer, "reportSummary", false)) {
    instructions.push(`Report summary: failed=${plan.summary.failedScenarios}, regressed=${plan.summary.regressedScenarios}, imperfect passes=${plan.summary.imperfectPasses}`)
  }

  if (history && history.recurringFailures.length > 0) {
    instructions.push("Use the attached history signals to check for recurring regressions before widening scope.")
  }

  return instructions
}

function renderCandidateFileLine(candidate: RankedPatchCandidateFile, index: number) {
  const reasons = candidate.reasons.length > 0 ? candidate.reasons.join("; ") : "none"
  const symbols = candidate.symbols.length > 0 ? candidate.symbols.join(", ") : "none"
  const keywords = candidate.keywords.length > 0 ? candidate.keywords.join(", ") : "none"

  return [
    `${index + 1}. \`${candidate.path}\``,
    `   - priority: ${candidate.priority}`,
    `   - reasons: ${reasons}`,
    `   - symbols: ${symbols}`,
    `   - keywords: ${keywords}`,
  ]
}

function buildPrompt(
  plan: LoopPlan,
  candidateFiles: RankedPatchCandidateFile[],
  optimizer?: ResolvedOptimizerConfig,
) {
  const lines: string[] = []
  const primary = plan.selectedItems[0] ?? null
  const history = optimizerHasSlot(optimizer, "history") ? buildHistoryContext(plan) : undefined
  lines.push("Task: implement a single focused Astra patch pass against the current bench loop plan.")
  lines.push("Requirements:")
  lines.push("- Fix the selected scenarios in priority order.")
  lines.push("- Preserve existing passing behavior outside those scenarios.")
  if (optimizer?.prompt) {
    lines.push(`- Optimizer prompt candidate: ${optimizer.prompt.id} (${optimizer.prompt.label})`)
    lines.push(`- Optimizer prompt policy: analysis=${getPromptAnalysisMode(optimizer)}, tools=${getPromptToolPolicy(optimizer)}, write-scope=${getPromptWriteScopeMode(optimizer)}`)
  }
  if (optimizer?.context) {
    lines.push(`- Optimizer context candidate: ${optimizer.context.id} (${optimizer.context.label})`)
    lines.push(`- Optimizer slots: ${optimizer.context.slots.join(", ")}`)
    lines.push(`- Optimizer context policy: ranking=${getContextRankingMode(optimizer)}, maxFiles=${optimizer.context.policy.maxFiles}, maxLines=${optimizer.context.policy.maxLinesPerFile}, history=${optimizer.context.policy.preferHistory ? "preferred" : "trimmed"}`)
  }
  if (getPromptAnalysisMode(optimizer) === "analysis-first") {
    lines.push("- Start with a quick relevance pass before editing.")
  }
  if (getPromptToolPolicy(optimizer) === "read-before-edit") {
    lines.push("- Read the highest-ranked candidate files before editing or widening scope.")
  }
  if (optimizerHasSlot(optimizer, "candidateFiles")) {
    lines.push("- Start in the listed ranked candidate files before widening scope.")
  } else {
    lines.push("- The optimizer context candidate intentionally omits ranked file guidance; inspect the selected scenarios directly first.")
  }
  lines.push("- Run `pnpm bench` and then `pnpm test` after the change.")
  lines.push("Selected scenarios:")
  plan.selectedItems.forEach((item) => {
    lines.push(`- ${item.id} (${item.priority}, ${item.total})`)
  })
  if (optimizerHasSlot(optimizer, "candidateFiles")) {
    lines.push("Ranked candidate files:")
    if (candidateFiles.length === 0) {
      lines.push("- none available; inspect the scenario artifacts directly")
    } else {
      candidateFiles.forEach((candidate, index) => {
        lines.push(...renderCandidateFileLine(candidate, index))
      })
    }
  } else {
    lines.push("Ranked candidate files: omitted by optimizer context candidate.")
  }
  if (history) {
    lines.push("History signals:")
    buildHistoryPromptLines(history).forEach((line) => {
      lines.push(`- ${line}`)
    })
  }
  if (optimizerHasSlot(optimizer, "reportSummary", false)) {
    lines.push(`Report summary: failed=${plan.summary.failedScenarios}, regressed=${plan.summary.regressedScenarios}, imperfect passes=${plan.summary.imperfectPasses}`)
  }
  if (primary) {
    lines.push(`Primary prompt: ${primary.suggestedPrompt}`)
  }

  return lines.join("\n")
}

function buildCandidateFiles(plan: LoopPlan, optimizer?: ResolvedOptimizerConfig) {
  const candidateMap = new Map<string, CandidateAccumulator>()
  const selectedItems = plan.selectedItems as Array<LoopItem & LooseRecord>
  const history = optimizerHasSlot(optimizer, "history") ? buildHistoryContext(plan) : undefined
  const rankingMode = getContextRankingMode(optimizer)

  selectedItems.forEach((item, index) => {
    const itemScore = buildItemScore(item)
    const historyScore = buildHistoryScore(item, history)
    const hintSources = getLoopItemHints(item)
    const scoredSources = hintSources.map((source) => ({
      source,
      score: buildSourceScore(source),
    }))
    const combinedSymbols = dedupe(hintSources.flatMap((hint) => hint.symbols))
    const combinedKeywords = dedupe(hintSources.flatMap((hint) => hint.keywords))
    const fallbackSurfaceFiles = getSurfaceFallbackFiles(
      item,
      dedupe(hintSources.flatMap((hint) => hint.fallbackFiles)),
    )
    const itemReasons = [
      ...describeItemSignals(item, index),
      ...itemScore.reasons,
      ...historyScore.reasons,
    ]
    const aggregatedSourceReasons = dedupe(scoredSources.flatMap((entry) => [
      `hint source: ${entry.source.source}${entry.source.confidence ? ` (${entry.source.confidence})` : ""}`,
      ...entry.score.reasons,
      ...(entry.source.failingSignals.length > 0 ? [`failing signals: ${entry.source.failingSignals.join("; ")}`] : []),
    ]))
    const totalSourcePriority = scoredSources.reduce((total, entry) => total + entry.score.total, 0)

    scoredSources.forEach(({ source, score }) => {
      source.explicitFiles.forEach((file) => {
        addCandidate(candidateMap, file, {
          reasons: [
            ...itemReasons,
            `hint source: ${source.source}${source.confidence ? ` (${source.confidence})` : ""}`,
            ...score.reasons,
            ...(source.failingSignals.length > 0 ? [`failing signals: ${source.failingSignals.join("; ")}`] : []),
            `score: explicit file mapping +18`,
            "file mapping: explicit",
            combinedSymbols.length > 0 ? `shared symbols: ${combinedSymbols.join(", ")}` : null,
            combinedKeywords.length > 0 ? `shared keywords: ${combinedKeywords.join(", ")}` : null,
          ].filter((value): value is string => value !== null),
          symbols: dedupe([...source.symbols, ...combinedSymbols]),
          keywords: dedupe([...source.keywords, ...combinedKeywords]),
          priority: itemScore.total + historyScore.total + score.total + (rankingMode === "explicit-first" ? 30 : 18),
        })
      })
    })

    if (fallbackSurfaceFiles.length > 0) {
      const [primaryFallback, ...restFallback] = fallbackSurfaceFiles

      if (primaryFallback) {
        addCandidate(candidateMap, primaryFallback, {
          reasons: [
            ...itemReasons,
            ...aggregatedSourceReasons,
            "score: surface fallback primary +12",
            "file mapping: surface fallback primary",
            combinedSymbols.length > 0 || combinedKeywords.length > 0
              ? "carried hints without explicit file mapping"
              : "no explicit repair hint",
          ],
          symbols: combinedSymbols,
          keywords: combinedKeywords,
          priority: itemScore.total + historyScore.total + totalSourcePriority + (rankingMode === "explicit-first" ? 6 : 12),
        })
      }

      restFallback.forEach((file) => {
        addCandidate(candidateMap, file, {
          reasons: [
            ...itemReasons,
            ...aggregatedSourceReasons,
            "score: surface fallback +4",
            "file mapping: surface fallback",
          ],
          symbols: combinedSymbols,
          keywords: combinedKeywords,
          priority: itemScore.total + historyScore.total + totalSourcePriority + (rankingMode === "explicit-first" ? 2 : 4),
        })
      })
    }
  })

  return [...candidateMap.values()]
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority
      }

      return left.path.localeCompare(right.path)
    })
    .map((candidate) => ({
      path: candidate.path,
      reasons: dedupe([...candidate.reasons]),
      symbols: dedupe([...candidate.symbols]),
      keywords: dedupe([...candidate.keywords]),
      priority: candidate.priority,
    }))
}

export function buildPatchTask(
  plan: LoopPlan,
  sourceArtifacts: PatchTask["sourceArtifacts"],
  options: {
    optimizer?: ResolvedOptimizerConfig
  } = {},
): PatchTaskLike {
  const candidateFiles = buildCandidateFiles(plan, options.optimizer)
  const history = optimizerHasSlot(options.optimizer, "history") ? buildHistoryContext(plan) : undefined
  const relevantFiles = dedupe(candidateFiles.map((candidate) => candidate.path))
  const validationCommands = ["pnpm bench", "pnpm test"]

  return {
    schemaVersion: 2,
    runId: plan.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts,
    focus: {
      primaryScenarioId: plan.selectedItems[0]?.id ?? null,
      primarySurface: plan.selectedItems[0]?.surface ?? null,
      scenarioIds: plan.selectedItems.map((item) => item.id),
      scenarioCount: plan.selectedItems.length,
    },
    candidateFiles,
    relevantFiles,
    validationCommands,
    instructions: buildInstructions(plan, candidateFiles, options.optimizer),
    ...(history ? { history } : {}),
    prompt: buildPrompt(plan, candidateFiles, options.optimizer),
  }
}

export function renderPatchTaskMarkdown(task: PatchTaskRenderLike) {
  const lines: string[] = []
  const candidateFiles = task.candidateFiles ?? []

  lines.push("# Astra Patch Task")
  lines.push("")
  lines.push(`- Run ID: \`${task.runId}\``)
  lines.push(`- Generated: ${task.generatedAt}`)
  lines.push(`- Primary scenario: \`${task.focus.primaryScenarioId ?? "none"}\``)
  lines.push(`- Primary surface: \`${task.focus.primarySurface ?? "none"}\``)
  lines.push(`- Scenario count: ${task.focus.scenarioCount}`)
  lines.push(`- Latest loop: \`${task.sourceArtifacts.latestLoop}\``)
  lines.push(`- Latest handoff: \`${task.sourceArtifacts.latestHandoff}\``)
  if (task.sourceArtifacts.latestHistoryJson) {
    lines.push(`- Latest history JSON: \`${task.sourceArtifacts.latestHistoryJson}\``)
  }
  if (task.sourceArtifacts.latestHistoryMarkdown) {
    lines.push(`- Latest history Markdown: \`${task.sourceArtifacts.latestHistoryMarkdown}\``)
  }
  lines.push("")
  lines.push("## Instructions")
  lines.push("")
  task.instructions.forEach((instruction, index) => {
    lines.push(`${index + 1}. ${instruction}`)
  })
  lines.push("")
  lines.push("## Ranked Candidate Files")
  lines.push("")
  if (candidateFiles.length === 0) {
    lines.push("- No ranked candidate files available.")
  } else {
    candidateFiles.forEach((candidate, index) => {
      lines.push(...renderCandidateFileLine(candidate, index))
      lines.push("")
    })
  }
  lines.push("## Relevant Files")
  lines.push("")
  if (task.relevantFiles.length === 0) {
    lines.push("- No surface-specific file map available.")
  } else {
    task.relevantFiles.forEach((file) => {
      lines.push(`- \`${file}\``)
    })
  }
  lines.push("")
  if (task.history) {
    lines.push("## History Signals")
    lines.push("")
    buildHistoryPromptLines(task.history).forEach((line) => {
      lines.push(`- ${line}`)
    })
    lines.push("")
  }
  lines.push("## Validation")
  lines.push("")
  task.validationCommands.forEach((command) => {
    lines.push(`- \`${command}\``)
  })
  lines.push("")
  lines.push("## Patch Prompt")
  lines.push("")
  lines.push("```text")
  lines.push(task.prompt)
  lines.push("```")
  return lines.join("\n").trimEnd() + "\n"
}
