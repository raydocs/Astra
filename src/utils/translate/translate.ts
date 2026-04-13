/**
 * Translation orchestration — batch texts, send to background, control concurrency.
 */

import { requestTranslationBatch } from "@/utils/extension/messages"
import type {
  TranslationPlaceholderFormat,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"
import {
  createTranslationError,
  toTranslationError,
  type TranslationError,
} from "@/types/translation"
import { validateTranslationBatch } from "./quality-check"

export interface TranslateRequest {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
  placeholderFormat?: TranslationPlaceholderFormat
}

export interface TranslateResponse {
  ok: true
  translations: string[]
}

export interface TranslateErrorResponse {
  ok: false
  error: TranslationError
}

export type TranslateResult = TranslateResponse | TranslateErrorResponse

const MAX_BATCH_ITEMS = 12
const MAX_BATCH_CHARS = 8000
const MAX_CONCURRENCY = 4

interface TranslateBatch {
  originalIndices: number[]
  texts: string[]
  charCount: number
}

interface TranslateSegment {
  originalIndex: number
  text: string
}

function splitIntoSegments(
  texts: string[],
  options: { preservePlaceholderTokens?: boolean } = {},
): TranslateSegment[] {
  return texts.flatMap((text, originalIndex) => {
    if (options.preservePlaceholderTokens) {
      return [{ originalIndex, text }]
    }

    const codePoints = Array.from(text)
    if (codePoints.length <= MAX_BATCH_CHARS) {
      return [{ originalIndex, text }]
    }

    const segments: TranslateSegment[] = []
    for (let start = 0; start < codePoints.length; start += MAX_BATCH_CHARS) {
      segments.push({
        originalIndex,
        text: codePoints.slice(start, start + MAX_BATCH_CHARS).join(""),
      })
    }

    return segments
  })
}

function createBatches(segments: TranslateSegment[]): TranslateBatch[] {
  const batches: TranslateBatch[] = []
  let currentBatch: TranslateBatch = { originalIndices: [], texts: [], charCount: 0 }

  segments.forEach(({ text, originalIndex }) => {
    const nextCharCount = currentBatch.charCount + text.length
    const shouldFlush = currentBatch.texts.length > 0
      && (currentBatch.texts.length >= MAX_BATCH_ITEMS || nextCharCount > MAX_BATCH_CHARS)

    if (shouldFlush) {
      batches.push(currentBatch)
      currentBatch = { originalIndices: [], texts: [], charCount: 0 }
    }

    currentBatch.originalIndices.push(originalIndex)
    currentBatch.texts.push(text)
    currentBatch.charCount += text.length
  })

  if (currentBatch.texts.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const taskIndex = nextIndex
      nextIndex += 1

      if (taskIndex >= tasks.length) return
      results[taskIndex] = await tasks[taskIndex]()
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker(),
  )

  await Promise.all(workers)
  return results
}

export async function translateTexts(
  request: TranslateRequest,
): Promise<TranslateResult> {
  const {
    texts,
    targetLang,
    sourceLang,
    context,
    task = "translate",
    customSystemPrompt,
    placeholderFormat,
  } = request

  if (texts.length === 0) {
    return { ok: true, translations: [] }
  }

  const segments = splitIntoSegments(texts, {
    preservePlaceholderTokens: placeholderFormat === "astra-rich-text-v1",
  })
  const batches = createBatches(segments)
  const tasks = batches.map((batch) => async () => {
    try {
      return await requestTranslationBatch({
        texts: batch.texts,
        targetLang,
        ...(sourceLang ? { sourceLang } : {}),
        ...(context ? { context } : {}),
        ...(task !== "translate" ? { task } : {}),
        ...(customSystemPrompt ? { customSystemPrompt } : {}),
        ...(placeholderFormat ? { placeholderFormat } : {}),
      })
    } catch (error) {
      return {
        ok: false,
        error: toTranslationError(error, "PROVIDER_REQUEST_FAILED"),
      } as const
    }
  })

  const batchResults = await withConcurrency(tasks, MAX_CONCURRENCY)
  const translations = Array.from({ length: texts.length }, () => "")

  for (const [index, batchResult] of batchResults.entries()) {
    const batch = batches[index]

    if (!batchResult.ok) {
      return { ok: false, error: batchResult.error }
    }

    if (batchResult.translations.length !== batch.texts.length) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Translation batch response length did not match the request.",
        ),
      }
    }

    batch.originalIndices.forEach((originalIndex, translationIndex) => {
      translations[originalIndex] += batchResult.translations[translationIndex]
    })
  }

  if (translations.some((translation) => typeof translation !== "string")) {
    return {
      ok: false,
      error: createTranslationError(
        "INVALID_RESPONSE",
        "Translation results were incomplete.",
      ),
    }
  }

  // --- advisory quality check (non-blocking) ---
  try {
    const qualityResults = validateTranslationBatch(texts, translations)
    for (let i = 0; i < qualityResults.length; i++) {
      if (!qualityResults[i].valid) {
        console.warn(
          `[Astra] Translation quality warning for item ${i}:`,
          qualityResults[i].warnings.join("; "),
        )
      }
    }
  } catch {
    // Quality check failure is non-fatal — never block the translation pipeline.
  }

  return { ok: true, translations }
}
