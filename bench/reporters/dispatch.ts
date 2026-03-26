import type { ExecutorAttempt, ExecutorDispatch } from "../types"

export function createDispatchPrompt(
  executor: ExecutorAttempt,
  patchContextMarkdown: string,
): string | null {
  if (executor.status !== "ready" || !executor.prompt) {
    return null
  }

  return [
    executor.prompt,
    "",
    "Patch context bundle:",
    patchContextMarkdown,
  ].join("\n")
}

export function buildDispatchArtifact(options: {
  executor: ExecutorAttempt
  provider: ExecutorDispatch["provider"]
  sourceArtifacts: ExecutorDispatch["sourceArtifacts"]
  prompt: string | null
  response?: string | null
  error?: string | null
}): ExecutorDispatch {
  const blockReason = options.executor.status === "blocked"
    ? options.executor.summary.blockReason
    : null
  const status = options.error
    ? "failed"
    : options.executor.status === "blocked"
      ? "blocked"
      : "executed"

  return {
    schemaVersion: 1,
    runId: options.executor.runId,
    generatedAt: new Date().toISOString(),
    sourceArtifacts: options.sourceArtifacts,
    provider: options.provider,
    status,
    summary: {
      attempted: status === "executed",
      promptChars: options.prompt?.length ?? 0,
      responseChars: options.response?.length ?? 0,
      blockReason,
      error: options.error ?? null,
    },
    prompt: options.prompt,
    response: options.response ?? null,
  }
}

export function renderDispatchMarkdown(dispatch: ExecutorDispatch) {
  const lines: string[] = []
  lines.push("# Astra Executor Dispatch")
  lines.push("")
  lines.push(`- Run ID: \`${dispatch.runId}\``)
  lines.push(`- Generated: ${dispatch.generatedAt}`)
  lines.push(`- Status: \`${dispatch.status}\``)
  lines.push(`- Provider: \`${dispatch.provider.id}\``)
  lines.push(`- Model: \`${dispatch.provider.model}\``)
  if (dispatch.provider.baseURL) {
    lines.push(`- Base URL: \`${dispatch.provider.baseURL}\``)
  }
  lines.push(`- Prompt chars: ${dispatch.summary.promptChars}`)
  lines.push(`- Response chars: ${dispatch.summary.responseChars}`)
  lines.push("")

  if (dispatch.status === "blocked") {
    lines.push("## Blocked")
    lines.push("")
    lines.push(`- ${dispatch.summary.blockReason ?? "Dispatch blocked."}`)
    return lines.join("\n").trimEnd() + "\n"
  }

  if (dispatch.status === "failed") {
    lines.push("## Failure")
    lines.push("")
    lines.push(`- ${dispatch.summary.error ?? "Unknown dispatch failure."}`)
    lines.push("")
  }

  if (dispatch.prompt) {
    lines.push("## Prompt")
    lines.push("")
    lines.push("```text")
    lines.push(dispatch.prompt)
    lines.push("```")
    lines.push("")
  }

  if (dispatch.response) {
    lines.push("## Response")
    lines.push("")
    lines.push(dispatch.response)
    lines.push("")
  }

  return lines.join("\n").trimEnd() + "\n"
}
