import path from "node:path"

import type { BenchmarkSurface, LoopPlan, PatchTask } from "../types"

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
}

function absolutePaths(paths: string[]) {
  return paths.map((file) => path.resolve(ROOT, file))
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)]
}

function buildInstructions(plan: LoopPlan, relevantFiles: string[]) {
  const instructions: string[] = []
  instructions.push("Fix the selected scenarios before touching any unselected behavior.")
  instructions.push("Keep the code change as small and local as possible.")
  instructions.push("Use the relevant files list as the first inspection boundary, then expand only if the evidence forces it.")
  instructions.push("Re-run `pnpm bench` after the edit. Re-run `pnpm test` once bench is acceptable.")

  if (plan.selectedItems.some((item) => item.status === "regressed")) {
    instructions.unshift("Prioritize regression recovery over polish work.")
  }

  if (relevantFiles.length === 0) {
    instructions.push("No surface-specific file map was found; inspect the scenario artifacts directly before editing.")
  }

  return instructions
}

function buildPrompt(plan: LoopPlan, relevantFiles: string[]) {
  const lines: string[] = []
  const primary = plan.selectedItems[0] ?? null
  lines.push("Task: implement a single focused Astra patch pass against the current bench loop plan.")
  lines.push("Requirements:")
  lines.push("- Fix the selected scenarios in priority order.")
  lines.push("- Preserve existing passing behavior outside those scenarios.")
  lines.push("- Start in the listed relevant files before widening scope.")
  lines.push("- Run `pnpm bench` and then `pnpm test` after the change.")
  lines.push("Selected scenarios:")
  plan.selectedItems.forEach((item) => {
    lines.push(`- ${item.id} (${item.priority}, ${item.total})`)
  })
  lines.push("Relevant files:")
  relevantFiles.forEach((file) => {
    lines.push(`- ${file}`)
  })

  if (primary) {
    lines.push(`Primary prompt: ${primary.suggestedPrompt}`)
  }

  return lines.join("\n")
}

export function buildPatchTask(
  plan: LoopPlan,
  sourceArtifacts: PatchTask["sourceArtifacts"],
): PatchTask {
  const primary = plan.selectedItems[0] ?? null
  const surfaces = dedupe(plan.selectedItems.map((item) => item.surface))
  const relevantFiles = dedupe(absolutePaths(surfaces.flatMap((surface) => SURFACE_FILE_MAP[surface] ?? [])))
  const validationCommands = ["pnpm bench", "pnpm test"]

  return {
    schemaVersion: 1,
    runId: plan.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts,
    focus: {
      primaryScenarioId: primary?.id ?? null,
      primarySurface: primary?.surface ?? null,
      scenarioIds: plan.selectedItems.map((item) => item.id),
      scenarioCount: plan.selectedItems.length,
    },
    relevantFiles,
    validationCommands,
    instructions: buildInstructions(plan, relevantFiles),
    prompt: buildPrompt(plan, relevantFiles),
  }
}

export function renderPatchTaskMarkdown(task: PatchTask) {
  const lines: string[] = []
  lines.push("# Astra Patch Task")
  lines.push("")
  lines.push(`- Run ID: \`${task.runId}\``)
  lines.push(`- Generated: ${task.generatedAt}`)
  lines.push(`- Primary scenario: \`${task.focus.primaryScenarioId ?? "none"}\``)
  lines.push(`- Primary surface: \`${task.focus.primarySurface ?? "none"}\``)
  lines.push(`- Scenario count: ${task.focus.scenarioCount}`)
  lines.push(`- Latest loop: \`${task.sourceArtifacts.latestLoop}\``)
  lines.push(`- Latest handoff: \`${task.sourceArtifacts.latestHandoff}\``)
  lines.push("")
  lines.push("## Instructions")
  lines.push("")
  task.instructions.forEach((instruction, index) => {
    lines.push(`${index + 1}. ${instruction}`)
  })
  lines.push("")
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
