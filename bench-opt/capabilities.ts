import type { BenchmarkSurface } from "../bench/types"

export type AstraCapabilityId =
  | "web-translation"
  | "pdf-translation"
  | "youtube-bilingual-subtitles"
  | "epub-bilingual-translation"
  | "image-translation"
  | "comic-translation"
  | "privacy-mode"
  | "hover-translation"
  | "subtitle-file-translation"
  | "input-translation"

export type AstraCapabilityWave = "A" | "B" | "C" | "D"

export type AstraCapabilityCurrentState = "strong" | "partial" | "gap"

export type AstraCapabilityGapType = "coverage" | "runtime" | "ux" | "protocol" | "new-subsystem"

export type AstraCapabilityLaneStatus = "green" | "partial" | "missing"

export type AstraCapabilityVerdict =
  | "not-started"
  | "partial"
  | "bench-pass"
  | "live-pass"
  | "holdout-pass"
  | "conquered"

export interface AstraCapabilityLaneCoverage {
  bench: AstraCapabilityLaneStatus
  live: AstraCapabilityLaneStatus
  holdout: AstraCapabilityLaneStatus
  proof: AstraCapabilityLaneStatus
}

export interface AstraCapabilityDefinition {
  id: AstraCapabilityId
  name: string
  wave: AstraCapabilityWave
  beta: boolean
  astraCurrentState: AstraCapabilityCurrentState
  currentCoverage: AstraCapabilityLaneCoverage
  benchmarkSurfaces: readonly BenchmarkSurface[]
  readFrogReference: string
  immersiveBenchmark: string
  gapClassification: readonly AstraCapabilityGapType[]
  targetBehavior: string
  missingHarnessLanes: readonly (keyof AstraCapabilityLaneCoverage)[]
  exitCriteria: readonly string[]
}

export interface AstraCapabilityStatusCard {
  id: AstraCapabilityId
  name: string
  wave: AstraCapabilityWave
  beta: boolean
  astraCurrentState: AstraCapabilityCurrentState
  verdict: AstraCapabilityVerdict
  currentCoverage: AstraCapabilityLaneCoverage
  benchmarkSurfaces: readonly BenchmarkSurface[]
  gapClassification: readonly AstraCapabilityGapType[]
  targetBehavior: string
  readFrogReference: string
  immersiveBenchmark: string
  missingHarnessLanes: readonly (keyof AstraCapabilityLaneCoverage)[]
  exitCriteria: readonly string[]
  notes: readonly string[]
}

function deriveCapabilityVerdict(coverage: AstraCapabilityLaneCoverage): AstraCapabilityVerdict {
  if (coverage.bench === "green" && coverage.live === "green" && coverage.holdout === "green" && coverage.proof === "green") {
    return "conquered"
  }

  if (coverage.bench === "green" && coverage.live === "green" && coverage.holdout === "green") {
    return "holdout-pass"
  }

  if (coverage.bench === "green" && coverage.live === "green") {
    return "live-pass"
  }

  if (coverage.bench === "green") {
    return "bench-pass"
  }

  if (coverage.bench === "partial" || coverage.live === "partial" || coverage.holdout === "partial" || coverage.proof === "partial") {
    return "partial"
  }

  return "not-started"
}

export const astraV2Capabilities: readonly AstraCapabilityDefinition[] = [
  {
    id: "web-translation",
    name: "网页翻译",
    wave: "B",
    beta: false,
    astraCurrentState: "strong",
    currentCoverage: { bench: "green", live: "green", holdout: "green", proof: "green" },
    benchmarkSurfaces: ["page-translation", "dynamic-content", "article-extraction"],
    readFrogReference: "Bilingual and translation-only reading UX with context-aware article presentation.",
    immersiveBenchmark: "Core page translation surface with polished bilingual readability and dynamic page behavior.",
    gapClassification: ["coverage", "ux"],
    targetBehavior: "Reference-grade default page translation across dense articles, feed/list pages, docs sidebars, and dynamic content with resilient retry behavior.",
    missingHarnessLanes: [],
    exitCriteria: [
      "All page-translation deterministic scenarios green across article/feed/docs/dynamic site shapes.",
      "Standard live page-translation set green for bilingual and translation-only modes.",
      "Dedicated page-translation holdout stress scenarios green under DOM mutation and layout perturbation.",
      "Proof-suite content-reading prompts show no page-translation-specific regressions.",
    ],
  },
  {
    id: "pdf-translation",
    name: "PDF 文件翻译",
    wave: "B",
    beta: false,
    astraCurrentState: "strong",
    currentCoverage: { bench: "green", live: "green", holdout: "green", proof: "green" },
    benchmarkSurfaces: ["article-extraction", "page-translation"],
    readFrogReference: "Reading-oriented UX patterns are relevant, but PDF is not the primary inspected differentiator.",
    immersiveBenchmark: "Layout-preserving PDF translation is an explicit product surface.",
    gapClassification: ["new-subsystem", "runtime", "protocol"],
    targetBehavior: "Bilingual and translation-only PDF reading with block alignment, stable pagination, and lazy visible-page translation.",
    missingHarnessLanes: [],
    exitCriteria: [
      "Bilingual and translation-only PDF rendering stable without layout collapse.",
      "Deterministic PDF extraction/order/alignment scenarios green.",
      "Live PDF fixture lane green with page navigation and visible-page translation.",
      "Multi-column and delayed-render holdout fixtures green.",
    ],
  },
  {
    id: "youtube-bilingual-subtitles",
    name: "视频双语字幕（YouTube 双语字幕）",
    wave: "B",
    beta: false,
    astraCurrentState: "strong",
    currentCoverage: { bench: "green", live: "green", holdout: "green", proof: "green" },
    benchmarkSurfaces: ["subtitle", "interaction-priority", "frame-coordination"],
    readFrogReference: "Video subtitle translation is a visible reading/learning reference surface.",
    immersiveBenchmark: "YouTube/streaming subtitle translation is a flagship product experience.",
    gapClassification: ["runtime", "coverage", "ux"],
    targetBehavior: "YouTube-specific bilingual subtitle stacking with incremental updates, dedupe, and stable seek/pause/resume behavior.",
    missingHarnessLanes: [],
    exitCriteria: [
      "Deterministic segment-stream update and duplicate suppression scenarios green.",
      "Live YouTube-equivalent subtitle scenario green under pause/resume and seek.",
      "Burst-update and language-switch holdout scenarios green.",
      "Subtitle robustness appears as its own scorecard line item in reporting.",
    ],
  },
  {
    id: "epub-bilingual-translation",
    name: "Epub 电子书双语翻译",
    wave: "C",
    beta: false,
    astraCurrentState: "strong",
    currentCoverage: { bench: "green", live: "green", holdout: "green", proof: "green" },
    benchmarkSurfaces: ["epub", "article-extraction", "page-translation"],
    readFrogReference: "Reading-oriented UX and bilingual study workflows are directly relevant.",
    immersiveBenchmark: "EPUB/TXT/document translation is a public product surface.",
    gapClassification: ["new-subsystem", "runtime", "protocol"],
    targetBehavior: "Persistent EPUB reader with bilingual and translation-only chapter rendering, reading-state retention, and chapter-scoped translation.",
    missingHarnessLanes: [],
    exitCriteria: [
      "Chapter extraction/order deterministic scenarios green.",
      "Live reader navigation and mode-switch scenarios green.",
      "Malformed/long-chapter holdouts green.",
      "Reader state resume is operator-visible and proof-covered.",
    ],
  },
  {
    id: "image-translation",
    name: "图片翻译 (Beta)",
    wave: "D",
    beta: true,
    astraCurrentState: "gap",
    currentCoverage: { bench: "missing", live: "missing", holdout: "missing", proof: "missing" },
    benchmarkSurfaces: ["page-translation"],
    readFrogReference: "No primary image-translation reference from inspected repo surface.",
    immersiveBenchmark: "Official beta image translation surface.",
    gapClassification: ["new-subsystem", "runtime"],
    targetBehavior: "Image-region detection, OCR/text extraction, and translated overlay rendering that preserves readability.",
    missingHarnessLanes: ["bench", "live", "holdout", "proof"],
    exitCriteria: [
      "At least one beta benchmark lane exists for OCR/overlay behavior.",
      "Live static-image fixture set green for basic image translation.",
      "Noisy-background and mixed-script holdouts green enough for beta label.",
      "Failures are categorized by OCR, layout, or translation cause.",
    ],
  },
  {
    id: "comic-translation",
    name: "漫画翻译 (Beta)",
    wave: "D",
    beta: true,
    astraCurrentState: "gap",
    currentCoverage: { bench: "missing", live: "missing", holdout: "missing", proof: "missing" },
    benchmarkSurfaces: ["page-translation"],
    readFrogReference: "No primary comic translation reference from inspected repo surface.",
    immersiveBenchmark: "Official beta comic translation surface.",
    gapClassification: ["new-subsystem", "runtime", "ux"],
    targetBehavior: "Panel-aware and balloon-aware translation overlay with reading-order sensitivity and explicit beta thresholds.",
    missingHarnessLanes: ["bench", "live", "holdout", "proof"],
    exitCriteria: [
      "Fixture-based comic panel and balloon scenarios exist.",
      "Live comic/image page lane green for baseline beta behavior.",
      "Overlapping-balloon and stylized-font holdouts achieve beta-grade pass.",
      "Protocol documents explicit beta-only parity limits.",
    ],
  },
  {
    id: "privacy-mode",
    name: "隐私模式 (Beta → core policy)",
    wave: "D",
    beta: true,
    astraCurrentState: "partial",
    currentCoverage: { bench: "partial", live: "green", holdout: "green", proof: "partial" },
    benchmarkSurfaces: ["input-translation", "subtitle", "page-translation"],
    readFrogReference: "Context-aware study UX implies strong privacy expectations around sensitive text handling.",
    immersiveBenchmark: "Product positioning implies strong privacy and local-only expectations.",
    gapClassification: ["protocol", "coverage", "runtime"],
    targetBehavior: "System-wide privacy contract that consistently redacts or suppresses sensitive content across web, input, subtitle, document, and file flows.",
    missingHarnessLanes: [],
    exitCriteria: [
      "Deterministic privacy assertions green across request payload surfaces.",
      "Live privacy-mode toggles green for major flows.",
      "Holdout should-not-leak scenarios green.",
      "Benchmark pack can fail if privacy regressions occur.",
    ],
  },
  {
    id: "hover-translation",
    name: "鼠标悬停翻译",
    wave: "C",
    beta: false,
    astraCurrentState: "strong",
    currentCoverage: { bench: "green", live: "green", holdout: "green", proof: "green" },
    benchmarkSurfaces: ["hover", "interaction-priority"],
    readFrogReference: "Inline/selection UX patterns are directly relevant.",
    immersiveBenchmark: "Hover translation is an explicit public product surface.",
    gapClassification: ["coverage", "ux"],
    targetBehavior: "Product-grade hover translation with stable tooltips, dedupe, cooldown, and clear boundaries with selection/input interactions.",
    missingHarnessLanes: [],
    exitCriteria: [
      "Live hover translation lane green.",
      "Moving-target and overlay-interference holdouts green.",
      "No conflicts with selection toolbar, input translation, or float-ball flows.",
      "Hover-specific robustness is operator-visible in reporting.",
    ],
  },
  {
    id: "subtitle-file-translation",
    name: "字幕文件翻译",
    wave: "C",
    beta: false,
    astraCurrentState: "strong",
    currentCoverage: { bench: "green", live: "green", holdout: "green", proof: "green" },
    benchmarkSurfaces: ["subtitle"],
    readFrogReference: "Subtitle translation concepts are adjacent, but file ingestion/export is a separate workflow.",
    immersiveBenchmark: "Document/subtitle file translation is an explicit public surface.",
    gapClassification: ["new-subsystem", "runtime", "protocol"],
    targetBehavior: "End-to-end .srt/.vtt ingest, bilingual preview/export, and timing-preserving subtitle-file translation.",
    missingHarnessLanes: [],
    exitCriteria: [
      "Parser/serializer deterministic scenarios green.",
      "Live upload/preview flow green.",
      "Malformed timing and overlapping-cue holdouts green.",
      "Operator/reporting surfaces distinguish parse, translate, and export failures.",
    ],
  },
  {
    id: "input-translation",
    name: "输入框翻译",
    wave: "B",
    beta: false,
    astraCurrentState: "strong",
    currentCoverage: { bench: "green", live: "green", holdout: "green", proof: "green" },
    benchmarkSurfaces: ["input-translation", "interaction-priority"],
    readFrogReference: "Inline authoring assist and selection-adjacent UX offer strong interaction inspiration.",
    immersiveBenchmark: "Input-box translation is an explicit public product surface.",
    gapClassification: ["coverage", "ux"],
    targetBehavior: "Best-in-class authoring assist with richer field detection, cursor preservation, writeback confidence, debounce, and privacy-aware suppression.",
    missingHarnessLanes: [],
    exitCriteria: [
      "Textarea/contenteditable/cursor-preservation deterministic scenarios green.",
      "Live multi-field form flow green with verified writeback.",
      "Delayed hydration and repeated-edit holdouts green.",
      "Operator reporting clearly distinguishes trigger, translate, and writeback failures.",
    ],
  },
] as const

export function listAstraV2Capabilities(): readonly AstraCapabilityDefinition[] {
  return astraV2Capabilities
}

export function getAstraV2Capability(id: AstraCapabilityId): AstraCapabilityDefinition | undefined {
  return astraV2Capabilities.find((capability) => capability.id === id)
}

export function createAstraCapabilityStatusCards(options?: {
  proofStatusOverrides?: Partial<Record<AstraCapabilityId, AstraCapabilityLaneStatus>>
  proofNotes?: Partial<Record<AstraCapabilityId, string[]>>
}): AstraCapabilityStatusCard[] {
  return astraV2Capabilities.map((capability) => {
    const proofOverride = options?.proofStatusOverrides?.[capability.id]
    const currentCoverage = proofOverride
      ? { ...capability.currentCoverage, proof: proofOverride }
      : capability.currentCoverage
    return {
      ...capability,
      currentCoverage,
      verdict: deriveCapabilityVerdict(currentCoverage),
      notes: [
        `Wave ${capability.wave} owner for v2 conquest sequencing.`,
        capability.beta ? "This capability is explicitly beta-scoped until holdout criteria are met." : "This capability is intended to graduate to non-beta parity claims.",
        ...(options?.proofNotes?.[capability.id] ?? []),
      ],
    }
  })
}

export function summarizeAstraCapabilityCards(cards: readonly AstraCapabilityStatusCard[]) {
  const conquered = cards.filter((card) => card.verdict === "conquered").length
  const byWave = ["A", "B", "C", "D"].map((wave) => ({
    wave: wave as AstraCapabilityWave,
    total: cards.filter((card) => card.wave === wave).length,
    conquered: cards.filter((card) => card.wave === wave && card.verdict === "conquered").length,
  }))

  return {
    protocolVersion: "2.0.0-draft",
    total: cards.length,
    conquered,
    byWave,
    cards: [...cards],
  }
}
