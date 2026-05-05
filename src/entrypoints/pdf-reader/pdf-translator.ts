/**
 * PDF page translation — translates text blocks via the background runtime.
 */

import { browser } from "#imports"
import {
  createTranslationPathMarker,
  summarizeTranslationPathMarkers,
  type TranslationPathMarker,
  type TranslationPathSummary,
} from "@/utils/providers/routing-metadata"
import type { RuntimeResponse } from "@/types/messages"
import type { PdfPage } from "./pdf-extractor"

export interface TranslatedBlock {
  sourceIndex: number
  sourceText: string
  translation: string
}

export interface PdfPageTranslationResult {
  translations: TranslatedBlock[]
  pathSummary?: TranslationPathSummary
}

const BATCH_SIZE = 8

async function getTargetLang(): Promise<string> {
  try {
    const result = await browser.storage.local.get("astra.config.v1")
    const config = result["astra.config.v1"] as { targetLang?: string } | undefined
    return config?.targetLang ?? "zh-CN"
  } catch {
    return "zh-CN"
  }
}

export async function translatePdfPage(page: PdfPage): Promise<PdfPageTranslationResult> {
  const results: TranslatedBlock[] = []
  const pathMarkers: TranslationPathMarker[] = []
  const textsToTranslate = page.blocks.filter((b) => b.text.length >= 5)

  const targetLang = await getTargetLang()
  for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
    const batch = textsToTranslate.slice(i, i + BATCH_SIZE)
    const texts = batch.map((b) => b.text)

    try {
      const response: RuntimeResponse = await browser.runtime.sendMessage({
        type: "runtime/translate-batch",
        payload: {
          texts,
          targetLang,
          task: "translate",
        },
      })

      if (response.type === "runtime/translate-batch:success") {
        if (response.payload.metadata) {
          pathMarkers.push(createTranslationPathMarker(response.payload.metadata))
        }

        batch.forEach((block, j) => {
          const blockIndex = page.blocks.indexOf(block)
          results.push({
            sourceIndex: blockIndex,
            sourceText: block.text,
            translation: response.payload.translations[j],
          })
        })
      }
    } catch {
      // Skip failed batches, continue with remaining
    }
  }

  const pathSummary = summarizeTranslationPathMarkers(pathMarkers)

  return {
    translations: results,
    ...(pathSummary ? { pathSummary } : {}),
  }
}
