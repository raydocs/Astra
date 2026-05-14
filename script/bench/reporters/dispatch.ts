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
  const gateSummary = status === "blocked"
    ? {
        decision: "blocked" as const,
        reason: blockReason ?? "Dispatch blocked.",
        error: null,
      }
    : status === "failed"
      ? {
          decision: "failed" as const,
          reason: null,
          error: options.error ?? "Dispatch failed.",
        }
      : {
          decision: "executed" as const,
          reason: `provider ${options.provider.id} accepted the dispatch prompt.`,
          error: null,
        }

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
      gateSummary,
    },
    prompt: options.prompt,
    response: options.response ?? null,
  }
}

export function formatDispatchGateDecision(dispatch: ExecutorDispatch): string[] {
  const lines: string[] = []
  const gateSummary = dispatch.summary.gateSummary

  if (gateSummary.decision === "blocked") {
    lines.push("Decision: `blocked`")
    lines.push(`Why: ${gateSummary.reason ?? "Dispatch blocked."}`)
    return lines
  }

  if (gateSummary.decision === "failed") {
    lines.push("Decision: `failed`")
    lines.push(`Why: ${gateSummary.error ?? "Dispatch failed."}`)
    return lines
  }

  lines.push("Decision: `executed`")
  lines.push(`Why: ${gateSummary.reason ?? `provider ${dispatch.provider.id} accepted the dispatch prompt.`}`)
  lines.push(`Prompt chars: ${dispatch.summary.promptChars}`)
  lines.push(`Response chars: ${dispatch.summary.responseChars}`)
  return lines
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

  lines.push("## Gate Decision")
  lines.push("")
  lines.push(...formatDispatchGateDecision(dispatch))
  lines.push("")

  if (dispatch.status === "blocked") {
    lines.push("## Blocked")
    lines.push("")
    lines.push(`- ${dispatch.summary.gateSummary.reason ?? "Dispatch blocked."}`)
    return lines.join("\n").trimEnd() + "\n"
  }

  if (dispatch.status === "failed") {
    lines.push("## Failure")
    lines.push("")
    lines.push(`- ${dispatch.summary.gateSummary.error ?? "Unknown dispatch failure."}`)
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
