import type { ContextOptimizerCandidate } from "../types"

export const contextCandidates = [
  {
    id: "context/minimal-task",
    kind: "context",
    label: "Minimal task context",
    description: "Compact context pack with only the core task inputs needed for execution.",
    tags: ["phase-1", "baseline", "compact"],
    slots: ["task", "surface", "fixture", "codeHint"],
    policy: {
      rankingMode: "balanced",
      maxFiles: 4,
      maxLinesPerFile: 80,
      preferHistory: false,
    },
  },
  {
    id: "context/expanded-task",
    kind: "context",
    label: "Expanded task context",
    description: "Broader context pack that adds history and candidate file guidance.",
    tags: ["phase-1", "expanded", "history-aware"],
    slots: ["task", "surface", "fixture", "codeHint", "history", "candidateFiles", "patchHints"],
    policy: {
      rankingMode: "explicit-first",
      maxFiles: 6,
      maxLinesPerFile: 120,
      preferHistory: true,
    },
  },
  {
    id: "context/report-summary",
    kind: "context",
    label: "Report summary context",
    description: "Context pack centered on report and summary artifacts for downstream synthesis.",
    tags: ["phase-1", "reporting", "summary"],
    slots: ["task", "surface", "reportSummary", "history"],
    policy: {
      rankingMode: "balanced",
      maxFiles: 4,
      maxLinesPerFile: 100,
      preferHistory: true,
    },
  },
] satisfies readonly ContextOptimizerCandidate[]
