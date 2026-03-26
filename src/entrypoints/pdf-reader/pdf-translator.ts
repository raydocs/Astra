/**
 * PDF page translation — translates text blocks via the background runtime.
 */

import { browser } from "#imports"
import type { RuntimeResponse } from "@/types/messages"
import type { PdfPage } from "./pdf-extractor"

export interface TranslatedBlock {
  sourceIndex: number
  sourceText: string
  translation: string
}

const BATCH_SIZE = 8
const TARGET_LANG = "zh-CN" // TODO: read from config

export async function translatePdfPage(page: PdfPage): Promise<TranslatedBlock[]> {
  const results: TranslatedBlock[] = []
  const textsToTranslate = page.blocks.filter((b) => b.text.length >= 5)

  for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
    const batch = textsToTranslate.slice(i, i + BATCH_SIZE)
    const texts = batch.map((b) => b.text)

    try {
      const response: RuntimeResponse = await browser.runtime.sendMessage({
        type: "runtime/translate-batch",
        payload: {
          texts,
          targetLang: TARGET_LANG,
          task: "translate",
        },
      })

      if (response.type === "runtime/translate-batch:success") {
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

  return results
}
