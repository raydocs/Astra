import path from "node:path"

import type { PdfTranslationExecution } from "../bench/evaluators/pdf"

export interface SourceBackedPdfHarnessResult {
  execution: PdfTranslationExecution
  renderedHtml: string
  translateCalls: Array<{
    payload: {
      texts: string[]
      targetLang: string
      sourceLang?: string
      context?: unknown
      task?: unknown
      customSystemPrompt?: string
    }
    durationMs: number
  }>
  summary: {
    fileName: string
    modes: Array<{
      mode: "bilingual" | "translation-only"
      pageCount: number
      blockCount: number
      sectionCount: number
      sourceCount: number
      translationCount: number
      sourceTexts: string[]
      translationTexts: string[]
    }>
  }
}

interface PdfReaderHarnessModule {
  runPdfReaderHarness: (options?: {
    fixtureName?: string
    modes?: ("bilingual" | "translation-only")[]
  }) => Promise<SourceBackedPdfHarnessResult>
}

async function withViteModule<T>(callback: (module: PdfReaderHarnessModule) => Promise<T>) {
  const { createViteServer } = await import("vitest/node")
  const root = process.cwd()
  const server = await createViteServer({
    root,
    mode: "test",
    appType: "custom",
    server: { middlewareMode: true },
    optimizeDeps: {
      noDiscovery: true,
      entries: [],
    },
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
        "#imports": path.resolve(root, "test/mocks/imports.ts"),
      },
    },
  })

  try {
    const pdfHarnessModule = await server.ssrLoadModule("/bench/scenarios/helpers/pdf-reader.ts")
    return await callback(pdfHarnessModule as PdfReaderHarnessModule)
  } finally {
    await server.close()
  }
}

export async function runSourceBackedPdfReaderHarness(options: {
  fixtureName?: string
  modes?: ("bilingual" | "translation-only")[]
} = {}): Promise<SourceBackedPdfHarnessResult> {
  return await withViteModule(async (pdfHarnessModule) => {
    return await pdfHarnessModule.runPdfReaderHarness(options)
  })
}
