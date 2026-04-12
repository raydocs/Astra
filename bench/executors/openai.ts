import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"

export interface OpenAIExecutorOptions {
  apiKey: string
  baseURL?: string
  model?: string
  prompt: string
}

export async function executeWithOpenAI(options: OpenAIExecutorOptions): Promise<string> {
  const openai = createOpenAI({
    apiKey: options.apiKey,
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  })

  const { text } = await generateText({
    model: openai(options.model ?? "gpt-4.1-nano"),
    system: [
      "You are a senior software engineer executing a restricted patch pass.",
      "Stay inside the provided write scope unless the prompt explicitly justifies a narrow expansion.",
      "Return concise Markdown with exactly these sections: Summary, Proposed Changes, Risks, Validation.",
      "Do not claim you edited files. Only propose the smallest defensible patch attempt.",
    ].join(" "),
    prompt: options.prompt,
  })

  return text.trim()
}
