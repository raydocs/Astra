import path from "node:path"
import { writeFile } from "node:fs/promises"

import { JSDOM } from "jsdom"

import type { PageTranslationExecution } from "../bench/evaluators/page-translation"
import {
  buildExpectedPageTranslationTexts,
  buildPageTranslationExecutionFromDocument,
} from "../bench/scenarios/helpers/page-translation"

const ASTRA_CONFIG_STORAGE_KEY = "astra.config.v1"

const ASTRA_LIVE_STYLE_TEXT = `
  .astra-translation {
    display: block;
    margin-top: 6px;
  }
  .astra-source[data-astra-source-hidden] {
    display: none !important;
  }
  .astra-translation-inner {
    color: #64748b;
    font-size: 0.92em;
    line-height: 1.6;
    border-left: 2px solid #6366f1;
    padding-left: 8px;
    display: block;
    user-select: text;
    -webkit-user-select: text;
  }
`

interface PageTranslateModule {
  getPageTranslationState: () => {
    phase: string
    lastError: { code: string; message: string } | null
    progress: {
      totalBlocks: number
      queuedBlocks: number
      inFlightBlocks: number
      translatedBlocks: number
      failedBlocks: number
    }
  }
  startPageTranslation: (overrides?: {
    targetLang?: string
    translationMode?: "bilingual" | "translation-only"
    translationTheme?: "default" | "underline" | "highlight"
    contentScope?: "page" | "article"
  }) => Promise<unknown>
  stopPageTranslation: () => unknown
}

export interface TranslateCallRecord {
  payload: {
    texts: string[]
    targetLang: string
  }
}

interface BenchBrowserController {
  getTranslateCalls: () => TranslateCallRecord[]
  reset: () => void
}

interface SourceBackedPageTranslationResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCount: number
  translateCalls: Array<{ payload: { texts: string[]; targetLang: string } }>
}

function installSourceBenchBrowser(config: {
  targetLang: string
  contentScope: "page" | "article"
  translationMode: "bilingual" | "translation-only"
}) {
  const translateCalls: TranslateCallRecord[] = []
  const storage: Record<string, unknown> = {
    [ASTRA_CONFIG_STORAGE_KEY]: {
      version: 1,
      targetLang: config.targetLang,
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: config.contentScope,
      inputTranslation: "disabled",
      languageLevel: "intermediate",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        apiKey: "live-bench-test-key",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: config.translationMode,
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {},
      customActions: [],
    },
  }

  ;(globalThis as { __ASTRA_TEST_BROWSER__?: Record<string, unknown> }).__ASTRA_TEST_BROWSER__ = {
    storage: {
      onChanged: {
        addListener() {},
        removeListener() {},
      },
      local: {
        get: async (keys?: string | string[]) => {
          if (typeof keys === "string") {
            return { [keys]: storage[keys] }
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, storage[key]]))
          }
          return { ...storage }
        },
        set: async (values: Record<string, unknown>) => {
          Object.assign(storage, values)
        },
        remove: async (keys: string | string[]) => {
          const keysToRemove = Array.isArray(keys) ? keys : [keys]
          keysToRemove.forEach((key) => {
            delete storage[key]
          })
        },
      },
    },
    runtime: {
      async sendMessage(message: { type?: string; payload?: { texts: string[]; targetLang: string } }) {
        if (message?.type !== "runtime/translate-batch" || !message.payload) {
          throw new Error(`Unhandled runtime message: ${JSON.stringify(message)}`)
        }

        translateCalls.push({
          payload: {
            texts: [...message.payload.texts],
            targetLang: message.payload.targetLang,
          },
        })

        return {
          type: "runtime/translate-batch:success",
          payload: {
            translations: message.payload.texts.map((text) => `ZH:${text.slice(0, 48)}`),
          },
        }
      },
    },
    tabs: {
      query: async () => [{ id: 1 }],
    },
  }

  return {
    getTranslateCalls: () => [...translateCalls],
    reset: () => {
      delete (globalThis as { __ASTRA_TEST_BROWSER__?: unknown }).__ASTRA_TEST_BROWSER__
    },
  } satisfies BenchBrowserController
}

function renderFixtureDocument(bodyHtml: string, title: string) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${title}</title>`,
    "</head>",
    "<body>",
    bodyHtml,
    "</body>",
    "</html>",
  ].join("\n")
}

function injectLiveTranslationStyles(doc: Document) {
  const style = doc.createElement("style")
  style.dataset.astraLiveStyles = "1"
  style.textContent = ASTRA_LIVE_STYLE_TEXT
  doc.head.appendChild(style)
}

function createDocumentFromFixtureHtml(bodyHtml: string, url: string, title: string) {
  return new JSDOM(renderFixtureDocument(bodyHtml, title), {
    url,
    pretendToBeVisual: true,
  })
}

async function withViteModule<T>(callback: (module: PageTranslateModule) => Promise<T>) {
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
    const pageTranslateModule = await server.ssrLoadModule("/src/entrypoints/content/page-translate.ts")
    return await callback(pageTranslateModule as PageTranslateModule)
  } finally {
    await server.close()
  }
}

async function waitForTranslationCompletion(
  pageTranslateModule: PageTranslateModule,
  expectedNodeCount: number,
  timeoutMs: number,
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = pageTranslateModule.getPageTranslationState()

    if (snapshot.lastError) {
      throw new Error(`${snapshot.lastError.code}: ${snapshot.lastError.message}`)
    }

    const progress = snapshot.progress
    const settled = progress.totalBlocks > 0
      && progress.queuedBlocks === 0
      && progress.inFlightBlocks === 0
      && progress.translatedBlocks + progress.failedBlocks >= progress.totalBlocks

    if (settled && progress.translatedBlocks >= expectedNodeCount) {
      return snapshot
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  const snapshot = pageTranslateModule.getPageTranslationState()
  throw new Error(
    `Timed out waiting for page translation completion (translated=${snapshot.progress.translatedBlocks}, total=${snapshot.progress.totalBlocks}).`,
  )
}

function setGlobalValue(key: PropertyKey, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key)
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
      return
    }

    delete (globalThis as Record<PropertyKey, unknown>)[key]
  }
}

function installDomGlobals(window: {
  document: Document
  navigator: Navigator
  HTMLElement: typeof HTMLElement
  Node: typeof Node
  MutationObserver: typeof MutationObserver
  getComputedStyle: typeof getComputedStyle
  history: History
  location: Location
}) {
  const restore = [
    setGlobalValue("window", window),
    setGlobalValue("document", window.document),
    setGlobalValue("navigator", window.navigator),
    setGlobalValue("HTMLElement", window.HTMLElement),
    setGlobalValue("Node", window.Node),
    setGlobalValue("MutationObserver", window.MutationObserver),
    setGlobalValue("getComputedStyle", window.getComputedStyle.bind(window)),
    setGlobalValue("history", window.history),
    setGlobalValue("location", window.location),
  ]

  return () => {
    restore.reverse().forEach((undo) => undo())
  }
}

export async function runSourceBackedPageTranslation(params: {
  fixtureHtml: string
  url: string
  title: string
  targetLang?: string
  contentScope?: "page" | "article"
  translationMode?: "bilingual" | "translation-only"
  snapshotHtmlPath?: string
  timeoutMs?: number
}) {
  const fakeIndexedDb = await import("fake-indexeddb")
  Object.assign(globalThis, {
    indexedDB: fakeIndexedDb.indexedDB,
    IDBKeyRange: fakeIndexedDb.IDBKeyRange,
    IDBCursor: fakeIndexedDb.IDBCursor,
    IDBCursorWithValue: fakeIndexedDb.IDBCursorWithValue,
    IDBDatabase: fakeIndexedDb.IDBDatabase,
    IDBFactory: fakeIndexedDb.IDBFactory,
    IDBIndex: fakeIndexedDb.IDBIndex,
    IDBObjectStore: fakeIndexedDb.IDBObjectStore,
    IDBOpenDBRequest: fakeIndexedDb.IDBOpenDBRequest,
    IDBRequest: fakeIndexedDb.IDBRequest,
    IDBTransaction: fakeIndexedDb.IDBTransaction,
    IDBVersionChangeEvent: fakeIndexedDb.IDBVersionChangeEvent,
  })

  const targetLang = params.targetLang ?? "zh-CN"
  const contentScope = params.contentScope ?? "page"
  const translationMode = params.translationMode ?? "bilingual"
  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, contentScope)
    const browserController = installSourceBenchBrowser({
      targetLang,
      contentScope,
      translationMode,
    })

    try {
      const result = await withViteModule(async (pageTranslateModule) => {
        await pageTranslateModule.startPageTranslation({
          targetLang,
          contentScope,
          translationMode,
          translationTheme: "default",
        })

        const snapshot = await waitForTranslationCompletion(
          pageTranslateModule,
          expected.expectedTexts.length,
          params.timeoutMs ?? 4_000,
        )

        const html = dom.serialize()
        if (params.snapshotHtmlPath) {
          await writeFile(params.snapshotHtmlPath, html, "utf8")
        }

        return {
          html,
          pageTranslation: buildPageTranslationExecutionFromDocument({
            doc: dom.window.document,
            expectedTexts: expected.expectedTexts,
            requestCount: browserController.getTranslateCalls().length,
            snapshotPhase: snapshot.phase,
            failedBlocks: snapshot.progress.failedBlocks,
            notes: [
              `effectiveScope=${expected.effectiveScope}`,
              "live-source-page-translation",
            ],
          }),
          requestCount: browserController.getTranslateCalls().length,
          translateCalls: browserController.getTranslateCalls().map((call) => ({
            payload: {
              texts: call.payload.texts,
              targetLang: call.payload.targetLang,
            },
          })),
        } satisfies SourceBackedPageTranslationResult
      })

      return result
    } finally {
      browserController.reset()
    }
  } finally {
    restoreGlobals()
    dom.window.close()
  }
}
