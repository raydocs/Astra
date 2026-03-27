import type { PromptOptimizerCandidate } from "../types"

export const promptCandidates = [
  {
    id: "prompt/minimal-direct",
    kind: "prompt",
    label: "Minimal direct instruction",
    description: "Short task prompt optimized for concise execution and low prompt overhead.",
    tags: ["phase-1", "baseline", "direct"],
    policy: {
      analysisMode: "minimal",
      toolPolicy: "default",
      writeScopeMode: "strict",
    },
    prompt: [
      "Solve the benchmark task using the smallest safe change.",
      "Use only the provided context and keep the implementation narrowly scoped.",
      "Return the requested artifact without extra commentary unless the task asks for it.",
    ].join(" "),
  },
  {
    id: "prompt/analysis-first",
    kind: "prompt",
    label: "Analysis-first instruction",
    description: "Prompt variant that asks the agent to identify the relevant surface before editing.",
    tags: ["phase-1", "analysis", "structured"],
    policy: {
      analysisMode: "analysis-first",
      toolPolicy: "read-before-edit",
      writeScopeMode: "evidence-led",
    },
    prompt: [
      "First identify the relevant files, types, and integration points.",
      "Then apply the smallest change that satisfies the task and preserves existing behavior.",
      "Prefer targeted edits over broad refactors.",
    ].join(" "),
  },
] satisfies readonly PromptOptimizerCandidate[]
