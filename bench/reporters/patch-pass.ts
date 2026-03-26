import type { PatchContextPack, PatchPass, PatchTask } from "../types"

function buildPrompt(task: PatchTask, context: PatchContextPack) {
  const lines: string[] = []
  lines.push("Task: execute a single focused Astra patch pass.")
  lines.push("Constraints:")
  lines.push("- Only work inside the listed write scope unless the evidence forces a narrow expansion.")
  lines.push("- Preserve behavior outside the selected scenarios.")
  lines.push("- Use the patch context bundle as the first code-reading source before searching wider.")
  lines.push("- Re-run `pnpm bench` and then `pnpm test` after edits.")
  lines.push("Selected scenarios:")
  task.focus.scenarioIds.forEach((scenarioId) => {
    lines.push(`- ${scenarioId}`)
  })
  lines.push("Write scope:")
  task.relevantFiles.forEach((file) => {
    lines.push(`- ${file}`)
  })
  lines.push("Context bundle:")
  context.files.forEach((file) => {
    const status = file.exists ? `${file.includedLines}/${file.lineCount}${file.truncated ? " truncated" : ""}` : "missing"
    lines.push(`- ${file.path} (${status})`)
  })
  lines.push("Validation:")
  task.validationCommands.forEach((command) => {
    lines.push(`- ${command}`)
  })
  lines.push(`Patch brief: ${task.prompt}`)
  return lines.join("\n")
}

export function buildPatchPass(
  task: PatchTask,
  context: PatchContextPack,
  sourceArtifacts: PatchPass["sourceArtifacts"],
): PatchPass {
  return {
    schemaVersion: 1,
    runId: task.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts,
    summary: {
      primaryScenarioId: task.focus.primaryScenarioId,
      primarySurface: task.focus.primarySurface,
      scenarioCount: task.focus.scenarioCount,
      relevantFileCount: task.relevantFiles.length,
      contextFileCount: context.files.length,
    },
    execution: {
      writeScope: task.relevantFiles,
      validationCommands: task.validationCommands,
      stopConditions: [
        "Stop if the required fix obviously exceeds the current write scope.",
        "Stop if the next edit would require an architectural decision instead of a local repair.",
        "Stop after `pnpm bench` and `pnpm test` are both green for the selected pass.",
      ],
    },
    prompt: buildPrompt(task, context),
  }
}

export function renderPatchPassMarkdown(pass: PatchPass) {
  const lines: string[] = []
  lines.push("# Astra Patch Pass")
  lines.push("")
  lines.push(`- Run ID: \`${pass.runId}\``)
  lines.push(`- Generated: ${pass.generatedAt}`)
  lines.push(`- Primary scenario: \`${pass.summary.primaryScenarioId ?? "none"}\``)
  lines.push(`- Primary surface: \`${pass.summary.primarySurface ?? "none"}\``)
  lines.push(`- Scenario count: ${pass.summary.scenarioCount}`)
  lines.push(`- Write scope files: ${pass.summary.relevantFileCount}`)
  lines.push(`- Context files: ${pass.summary.contextFileCount}`)
  lines.push(`- Latest patch task: \`${pass.sourceArtifacts.latestPatchTask}\``)
  lines.push(`- Latest patch context: \`${pass.sourceArtifacts.latestPatchContext}\``)
  lines.push("")
  lines.push("## Write Scope")
  lines.push("")
  pass.execution.writeScope.forEach((file) => {
    lines.push(`- \`${file}\``)
  })
  lines.push("")
  lines.push("## Validation")
  lines.push("")
  pass.execution.validationCommands.forEach((command) => {
    lines.push(`- \`${command}\``)
  })
  lines.push("")
  lines.push("## Stop Conditions")
  lines.push("")
  pass.execution.stopConditions.forEach((condition, index) => {
    lines.push(`${index + 1}. ${condition}`)
  })
  lines.push("")
  lines.push("## Executor Prompt")
  lines.push("")
  lines.push("```text")
  lines.push(pass.prompt)
  lines.push("```")
  return lines.join("\n").trimEnd() + "\n"
}
