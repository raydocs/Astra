/**
 * Translation orchestration — batch texts, send to background, control concurrency.
 */

import { requestTranslationBatch } from "@/utils/extension/messages"
import type { TranslationRequestContext, TranslationTask } from "@/types/messages"
import {
  createTranslationError,
  toTranslationError,
  type TranslationError,
} from "@/types/translation"
import {
  getCachedTranslations,
  setCachedTranslation,
} from "@/utils/cache/translation-cache"

export interface TranslateRequest {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
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

const MAX_BATCH_ITEMS = 8
const MAX_BATCH_CHARS = 4000
const MAX_CONCURRENCY = 3

interface TranslateBatch {
  originalIndices: number[]
  texts: string[]
  charCount: number
}

interface TranslateSegment {
  originalIndex: number
  text: string
}

function splitIntoSegments(texts: string[]): TranslateSegment[] {
  return texts.flatMap((text, originalIndex) => {
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

/** Cache is only used for standard translate tasks without custom prompts. */
function isCacheable(task: TranslationTask, customSystemPrompt?: string): boolean {
  return task === "translate" && !customSystemPrompt
}

export async function translateTexts(
  request: TranslateRequest,
): Promise<TranslateResult> {
  const { texts, targetLang, sourceLang, context, task = "translate", customSystemPrompt } = request

  if (texts.length === 0) {
    return { ok: true, translations: [] }
  }

  const cacheable = isCacheable(task, customSystemPrompt)

  // --- cache lookup ---
  let cachedResults = new Map<number, string>()
  if (cacheable) {
    try {
      cachedResults = await getCachedTranslations(
        texts.map((text) => ({ text, targetLang })),
      )
    } catch {
      // Cache read failure is non-fatal — proceed without cache.
    }
  }

  // Determine which texts still need translation
  const uncachedEntries: Array<{ originalIndex: number; text: string }> = []
  for (let i = 0; i < texts.length; i++) {
    if (!cachedResults.has(i)) {
      uncachedEntries.push({ originalIndex: i, text: texts[i] })
    }
  }

  // If everything was cached, return immediately
  if (uncachedEntries.length === 0) {
    return { ok: true, translations: texts.map((_, i) => cachedResults.get(i)!) }
  }

  // --- translate uncached texts ---
  const uncachedTexts = uncachedEntries.map((e) => e.text)
  const segments = splitIntoSegments(uncachedTexts)
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
      })
    } catch (error) {
      return {
        ok: false,
        error: toTranslationError(error, "PROVIDER_REQUEST_FAILED"),
      } as const
    }
  })

  const batchResults = await withConcurrency(tasks, MAX_CONCURRENCY)
  const uncachedTranslations = Array.from({ length: uncachedTexts.length }, () => "")

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
      uncachedTranslations[originalIndex] += batchResult.translations[translationIndex]
    })
  }

  if (uncachedTranslations.some((translation) => typeof translation !== "string")) {
    return {
      ok: false,
      error: createTranslationError(
        "INVALID_RESPONSE",
        "Translation results were incomplete.",
      ),
    }
  }

  // --- write fresh translations to cache ---
  if (cacheable) {
    for (let i = 0; i < uncachedEntries.length; i++) {
      const { text } = uncachedEntries[i]
      const translation = uncachedTranslations[i]
      // Fire-and-forget; cache write failure should not block the response.
      setCachedTranslation(text, targetLang, translation).catch(() => {})
    }
  }

  // --- merge cached + fresh results in original order ---
  const translations = Array.from({ length: texts.length }, () => "")
  for (const [index, cached] of cachedResults) {
    translations[index] = cached
  }
  for (let i = 0; i < uncachedEntries.length; i++) {
    translations[uncachedEntries[i].originalIndex] = uncachedTranslations[i]
  }

  return { ok: true, translations }
}
