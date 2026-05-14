import path from "node:path"

import type { EpubTranslationExecution } from "../bench/evaluators/epub"

export interface SourceBackedEpubHarnessResult {
  execution: EpubTranslationExecution
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
    bookTitle: string
    activeChapterTitle: string
    resumedChapterTitle: string | null
    chapterTitles: string[]
    modes: Array<{
      mode: "bilingual" | "translation-only"
      chapterCount: number
      sectionCount: number
      sourceCount: number
      translationCount: number
      chapterTitles: string[]
      sourceTexts: string[]
      translationTexts: string[]
    }>
  }
}

interface EpubReaderHarnessModule {
  runEpubReaderHarness: (options?: {
    fixtureName?: string
    modes?: ("bilingual" | "translation-only")[]
  }) => Promise<SourceBackedEpubHarnessResult>
}

async function withViteModule<T>(callback: (module: EpubReaderHarnessModule) => Promise<T>) {
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
    const epubHarnessModule = await server.ssrLoadModule("/script/bench/scenarios/helpers/epub-reader.ts")
    return await callback(epubHarnessModule as EpubReaderHarnessModule)
  } finally {
    await server.close()
  }
}

export async function runSourceBackedEpubReaderHarness(options: {
  fixtureName?: string
  modes?: ("bilingual" | "translation-only")[]
} = {}): Promise<SourceBackedEpubHarnessResult> {
  return await withViteModule(async (epubHarnessModule) => {
    return await epubHarnessModule.runEpubReaderHarness(options)
  })
}
