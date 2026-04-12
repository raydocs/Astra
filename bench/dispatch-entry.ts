import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { executeWithOpenAI } from "./executors/openai.ts"
import { buildDispatchArtifact, createDispatchPrompt, renderDispatchMarkdown } from "./reporters/dispatch.ts"
import type { ExecutorAttempt } from "./types.ts"

function parseArgs(argv: string[]) {
  let model = process.env.ASTRA_EXECUTOR_MODEL ?? "gpt-4.1-nano"
  let baseURL = process.env.ASTRA_EXECUTOR_BASE_URL ?? ""
  let mockResponse = process.env.ASTRA_EXECUTOR_MOCK_RESPONSE ?? ""

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]
    if (current === "--model") {
      model = argv[index + 1] ?? model
      index += 1
      continue
    }

    if (current === "--base-url") {
      baseURL = argv[index + 1] ?? baseURL
      index += 1
      continue
    }

    if (current === "--mock-response") {
      mockResponse = argv[index + 1] ?? mockResponse
      index += 1
    }
  }

  return { model, baseURL: baseURL || null, mockResponse: mockResponse || null }
}

async function readJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8")
  return JSON.parse(content) as T
}

export async function runDispatch(argv: string[] = process.argv.slice(2)) {
  const { model, baseURL, mockResponse } = parseArgs(argv)
  const outputDir = path.resolve(process.cwd(), "bench-results")
  const executorPath = path.join(outputDir, "latest.executor.json")
  const patchPassPath = path.join(outputDir, "latest.patch-pass.json")
  const patchContextPath = path.join(outputDir, "latest.patch-context.md")
  const executor = await readJson<ExecutorAttempt>(executorPath)
  const patchContextMarkdown = await readFile(patchContextPath, "utf8")
  const prompt = createDispatchPrompt(executor, patchContextMarkdown)
  const provider = {
    id: "openai" as const,
    model,
    baseURL,
  }

  let response: string | null = null
  let error: string | null = null

  if (executor.status === "ready" && prompt) {
    if (mockResponse) {
      response = mockResponse
    } else {
      const apiKey = process.env.ASTRA_EXECUTOR_API_KEY?.trim() ?? ""
      if (!apiKey) {
        error = "ASTRA_EXECUTOR_API_KEY is required for live dispatch."
      } else {
        try {
          response = await executeWithOpenAI({
            apiKey,
            ...(baseURL ? { baseURL } : {}),
            model,
            prompt,
          })
        } catch (dispatchError) {
          error = dispatchError instanceof Error ? dispatchError.message : "Executor dispatch failed."
        }
      }
    }
  }

  const dispatch = buildDispatchArtifact({
    executor: executor.status === "ready" && error && !response
      ? {
          ...executor,
          status: "ready",
        }
      : executor,
    provider,
    sourceArtifacts: {
      latestExecutor: executorPath,
      latestPatchPass: patchPassPath,
      latestPatchContext: patchContextPath,
    },
    prompt,
    response,
    error,
  })

  const dispatchJsonPath = path.join(outputDir, "latest.dispatch.json")
  const dispatchMarkdownPath = path.join(outputDir, "latest.dispatch.md")
  await writeFile(dispatchJsonPath, JSON.stringify(dispatch, null, 2))
  await writeFile(dispatchMarkdownPath, renderDispatchMarkdown(dispatch))

  return {
    dispatch,
    paths: {
      dispatchJsonPath,
      dispatchMarkdownPath,
    },
  }
}
