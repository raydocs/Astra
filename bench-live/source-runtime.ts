import path from "node:path"
import { writeFile } from "node:fs/promises"

import { JSDOM } from "jsdom"

import { DEFAULT_ASTRA_CONFIG, type AstraConfig } from "@/types/config"
import type { RuntimeResponse } from "@/types/messages"
import type { PageTranslationExecution } from "../bench/evaluators/page-translation"
import {
  buildExpectedPageTranslationTexts,
  buildPageTranslationExecutionFromDocument,
} from "../bench/scenarios/helpers/page-translation"
import enMessages from "../public/_locales/en/messages.json"

const ASTRA_CONFIG_STORAGE_KEY = "astra.config.v1"
const ASTRA_AUTH_STORAGE_KEY = "astra.auth.v1"

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

interface SourceTranslateCallRecord {
  payload: {
    texts: string[]
    targetLang: string
    sourceLang?: string
    context?: Record<string, unknown>
    task?: unknown
    customSystemPrompt?: string
    placeholderFormat?: "astra-rich-text-v1"
  }
  response: RuntimeResponse
}

interface PageTranslateModule {
  getPageTranslationState: () => {
    phase: string
    sessionId: number
    targetLang: string | null
    presentation: {
      mode: "bilingual" | "translation-only"
      theme: "default" | "underline" | "highlight"
    }
    lastError: { code: string; message: string } | null
    progress: {
      totalBlocks: number
      queuedBlocks: number
      inFlightBlocks: number
      translatedBlocks: number
      failedBlocks: number
    }
  }
  subscribePageTranslationState: (listener: (snapshot: {
    phase: string
    sessionId: number
  }) => void) => () => void
  startPageTranslation: (overrides?: {
    targetLang?: string
    translationMode?: "bilingual" | "translation-only"
    translationTheme?: "default" | "underline" | "highlight"
    contentScope?: "page" | "article"
    privacyMode?: boolean
    selectors?: string[]
    excludeSelectors?: string[]
    paragraphMinLength?: number
  }) => Promise<unknown>
  stopPageTranslation: () => unknown
}

interface ContentEntrypointModule {
  default: {
    main: (ctx: never) => Promise<void>
  }
  __resetContentEntrypointForTests: () => void
}

interface BackgroundEntrypointModule {
  default: {
    main: () => void
  }
}

interface RouterModule {
  setProviderRouterDependenciesForTests: (overrides: {
    translateWithOpenAI?: (...args: any[]) => Promise<string[]>
    translateWithGemini?: (...args: any[]) => Promise<string[]>
    translateWithRelay?: (...args: any[]) => Promise<string[]>
  }) => void
  resetProviderRouterDependenciesForTests: () => void
}

export interface TranslateCallRecord extends SourceTranslateCallRecord {}

interface BenchBrowserController {
  getTranslateCalls: () => TranslateCallRecord[]
  emitStorageChange: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName?: string) => Promise<void>
  reset: () => void
}

interface SourceBackedPageTranslationResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCount: number
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedSiteRuleUpdateResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCountBeforeUpdate: number
  requestCountAfterUpdate: number
  restartSessionCount: number
  restartedTargetLang: string | null
  restartedPresentationMode: "bilingual" | "translation-only" | null
  hiddenSourceCountAfterUpdate: number
  translationMarkerCountAfterUpdate: number
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedProviderSwitchResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCountBeforeUpdate: number
  requestCountAfterUpdate: number
  restartSessionCount: number
  initialFinalTransport: "direct" | "relay" | null
  restartedFinalTransport: "direct" | "relay" | null
  restartedFallbackUsed: boolean
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedProviderAndSiteRuleUpdateResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCountBeforeUpdate: number
  requestCountAfterUpdate: number
  restartSessionCount: number
  initialFinalTransport: "direct" | "relay" | null
  restartedFinalTransport: "direct" | "relay" | null
  restartedFallbackUsed: boolean
  restartedTargetLang: string | null
  restartedPresentationMode: "bilingual" | "translation-only" | null
  hiddenSourceCountAfterUpdate: number
  translationMarkerCountAfterUpdate: number
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedSpaNavigationResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCountBeforeNavigation: number
  requestCountAfterNavigation: number
  restartedTargetLang: string | null
  restartedPresentationMode: "bilingual" | "translation-only" | null
  hiddenSourceCountAfterNavigation: number
  translationMarkerCountAfterNavigation: number
  navigatedUrl: string
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedRapidSpaNavigationResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCountBeforeNavigation: number
  requestCountAfterNavigation: number
  restartedTargetLang: string | null
  restartedPresentationMode: "bilingual" | "translation-only" | null
  hiddenSourceCountAfterNavigation: number
  translationMarkerCountAfterNavigation: number
  navigatedUrl: string
  navigationCount: number
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedBackgroundRelayOnlyResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCount: number
  relayRequestCount: number
  finalTransport: "direct" | "relay" | null
  fallbackUsed: boolean
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedBackgroundDirectSuccessResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCount: number
  relayRequestCount: number
  finalTransport: "direct" | "relay" | null
  fallbackUsed: boolean
  translateCalls: SourceTranslateCallRecord[]
}

interface SourceBackedBackgroundDirectRelayFallbackResult {
  html: string
  pageTranslation: PageTranslationExecution
  requestCount: number
  relayRequestCount: number
  finalTransport: "direct" | "relay" | null
  fallbackUsed: boolean
  translateCalls: SourceTranslateCallRecord[]
}

function resolveMessage(key: string, substitutions?: string | string[]) {
  const entry = (enMessages as Record<string, { message: string }>)[key]
  if (!entry) return key

  let message = entry.message
  if (substitutions) {
    const values = Array.isArray(substitutions) ? substitutions : [substitutions]
    values.forEach((value, index) => {
      message = message.replace(`$${index + 1}`, value)
    })
  }

  return message
}

function installSourceBenchBrowser(config: {
  config: AstraConfig
  translateBatch?: (payload: SourceTranslateCallRecord["payload"]) => string[] | RuntimeResponse
  dispatchRuntimeMessagesToListeners?: boolean
}) {
  const translateCalls: TranslateCallRecord[] = []
  const storageChangedListeners = new Set<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => unknown>()
  const runtimeMessageListeners = new Set<(message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => unknown>()
  const storage: Record<string, unknown> = {
    [ASTRA_CONFIG_STORAGE_KEY]: config.config,
    [ASTRA_AUTH_STORAGE_KEY]: null,
  }

  ;(globalThis as { __ASTRA_TEST_BROWSER__?: Record<string, unknown> }).__ASTRA_TEST_BROWSER__ = {
    storage: {
      onChanged: {
        addListener(listener: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => unknown) {
          storageChangedListeners.add(listener)
        },
        removeListener(listener: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => unknown) {
          storageChangedListeners.delete(listener)
        },
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
      async sendMessage(message: { type?: string; payload?: SourceTranslateCallRecord["payload"] }) {
        if (message?.type !== "runtime/translate-batch" || !message.payload) {
          return { ok: true }
        }

        const payload = message.payload
        const response = config.dispatchRuntimeMessagesToListeners
          ? await (async () => {
              const responses: RuntimeResponse[] = []
              for (const listener of runtimeMessageListeners) {
                const listenerResponse = await new Promise<RuntimeResponse | null>((resolve, reject) => {
                  let settled = false
                  const timeout = setTimeout(() => {
                    if (!settled) {
                      settled = true
                      reject(new Error("Timed out waiting for runtime listener response."))
                    }
                  }, 2_000)
                  const finish = (value: RuntimeResponse | null) => {
                    if (settled) return
                    settled = true
                    clearTimeout(timeout)
                    resolve(value)
                  }

                  try {
                    const maybeAsync = listener(message, { id: "source-runtime", tab: { id: 1 } }, (runtimeResponse?: unknown) => {
                      finish((runtimeResponse ?? null) as RuntimeResponse | null)
                    })
                    Promise.resolve(maybeAsync).then((result) => {
                      if (result === true) {
                        return
                      }
                      if (typeof result !== "undefined" && result !== false) {
                        finish(result as RuntimeResponse)
                        return
                      }
                      finish(null)
                    }, reject)
                  } catch (error) {
                    clearTimeout(timeout)
                    reject(error)
                  }
                })

                if (listenerResponse) {
                  responses.push(listenerResponse)
                }
              }

              const lastResponse = responses.at(-1)
              if (!lastResponse) {
                throw new Error("Runtime translate-batch message was not handled by any listener.")
              }
              return lastResponse
            })()
          : (() => {
              const result = config.translateBatch
                ? config.translateBatch(payload)
                : payload.texts.map((text) => `ZH:${payload.placeholderFormat ? text : text.slice(0, 48)}`)

              if (Array.isArray(result)) {
                return {
                  type: "runtime/translate-batch:success" as const,
                  payload: {
                    translations: result,
                  },
                } satisfies RuntimeResponse
              }

              return result
            })()

        translateCalls.push({
          payload: {
            texts: [...payload.texts],
            targetLang: payload.targetLang,
            ...(payload.sourceLang ? { sourceLang: payload.sourceLang } : {}),
            ...(payload.context ? { context: payload.context as Record<string, unknown> } : {}),
            ...(payload.task ? { task: payload.task } : {}),
            ...(payload.customSystemPrompt ? { customSystemPrompt: payload.customSystemPrompt } : {}),
            ...(payload.placeholderFormat ? { placeholderFormat: payload.placeholderFormat } : {}),
          },
          response: await Promise.resolve(response),
        })

        return response
      },
      onMessage: {
        addListener(listener: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => unknown) {
          runtimeMessageListeners.add(listener)
        },
        removeListener(listener: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => unknown) {
          runtimeMessageListeners.delete(listener)
        },
      },
      onInstalled: {
        addListener() {},
        removeListener() {},
      },
    },
    tabs: {
      query: async () => [{ id: 1 }],
      sendMessage: async () => undefined,
      onActivated: {
        addListener() {},
        removeListener() {},
      },
    },
    webNavigation: {
      getAllFrames: async () => [],
    },
    commands: {
      onCommand: {
        addListener() {},
        removeListener() {},
      },
    },
    i18n: {
      getMessage: (key: string, substitutions?: string | string[]) => resolveMessage(key, substitutions),
    },
  }

  return {
    getTranslateCalls: () => [...translateCalls],
    emitStorageChange: async (changes, areaName = "local") => {
      for (const listener of storageChangedListeners) {
        await listener(changes, areaName)
      }
    },
    reset: () => {
      delete (globalThis as { __ASTRA_TEST_BROWSER__?: unknown }).__ASTRA_TEST_BROWSER__
      storageChangedListeners.clear()
      runtimeMessageListeners.clear()
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

async function withViteModules<T>(callback: (modules: {
  pageTranslateModule: PageTranslateModule
  contentEntrypointModule: ContentEntrypointModule
}) => Promise<T>) {
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
    const [pageTranslateModule, contentEntrypointModule] = await Promise.all([
      server.ssrLoadModule("/src/entrypoints/content/page-translate.ts"),
      server.ssrLoadModule("/src/entrypoints/content/index.tsx"),
    ])

    return await callback({
      pageTranslateModule: pageTranslateModule as PageTranslateModule,
      contentEntrypointModule: contentEntrypointModule as ContentEntrypointModule,
    })
  } finally {
    await server.close()
  }
}

async function withViteModulesAndBackground<T>(callback: (modules: {
  pageTranslateModule: PageTranslateModule
  contentEntrypointModule: ContentEntrypointModule
  backgroundEntrypointModule: BackgroundEntrypointModule
  routerModule: RouterModule
}) => Promise<T>) {
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
    const [pageTranslateModule, contentEntrypointModule, backgroundEntrypointModule, routerModule] = await Promise.all([
      server.ssrLoadModule("/src/entrypoints/content/page-translate.ts"),
      server.ssrLoadModule("/src/entrypoints/content/index.tsx"),
      server.ssrLoadModule("/src/entrypoints/background/index.ts"),
      server.ssrLoadModule("/src/utils/providers/router.ts"),
    ])

    return await callback({
      pageTranslateModule: pageTranslateModule as PageTranslateModule,
      contentEntrypointModule: contentEntrypointModule as ContentEntrypointModule,
      backgroundEntrypointModule: backgroundEntrypointModule as BackgroundEntrypointModule,
      routerModule: routerModule as RouterModule,
    })
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

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  errorMessage: string,
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  throw new Error(errorMessage)
}

function getTranslateCallFinalTransport(call: SourceTranslateCallRecord | null | undefined) {
  if (!call || call.response.type !== "runtime/translate-batch:success") {
    return null
  }

  return call.response.payload.metadata?.finalTransport ?? null
}

function getTranslateCallFallbackUsed(call: SourceTranslateCallRecord | null | undefined) {
  if (!call || call.response.type !== "runtime/translate-batch:success") {
    return false
  }

  return call.response.payload.metadata?.fallbackUsed ?? false
}

function createSessionRestartTracker(
  subscribePageTranslationState: PageTranslateModule["subscribePageTranslationState"],
) {
  const startedSessionIds = new Set<number>()
  const unsubscribe = subscribePageTranslationState((snapshot) => {
    if (snapshot.sessionId > 0 && snapshot.phase !== "idle") {
      startedSessionIds.add(snapshot.sessionId)
    }
  })

  return {
    countNewSessionsSince(sessionId: number) {
      return [...startedSessionIds].filter((startedSessionId) => startedSessionId > sessionId).length
    },
    stop() {
      unsubscribe()
    },
  }
}

async function clearIndexedDbDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete IndexedDB database: ${name}`))
    request.onblocked = () => resolve()
  })
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
  privacyMode?: boolean
  browserConfig?: Partial<AstraConfig>
  snapshotHtmlPath?: string
  timeoutMs?: number
  translateBatch?: (payload: SourceTranslateCallRecord["payload"]) => string[] | RuntimeResponse
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
    const defaultConfig: AstraConfig = {
      version: 1,
      targetLang,
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope,
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: params.privacyMode ?? false,
      provider: {
        id: "openai",
        accessToken: "",
        apiKey: "live-bench-test-key",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: translationMode,
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {},
      customActions: [],
    }
    const browserController = installSourceBenchBrowser({
      config: {
        ...defaultConfig,
        ...(params.browserConfig ?? {}),
        provider: {
          ...defaultConfig.provider,
          ...params.browserConfig?.provider,
        },
        tts: {
          ...defaultConfig.tts,
          ...params.browserConfig?.tts,
        },
        presentation: {
          ...defaultConfig.presentation,
          ...params.browserConfig?.presentation,
        },
        sites: {
          ...defaultConfig.sites,
          ...params.browserConfig?.sites,
        },
        customActions: params.browserConfig?.customActions ?? defaultConfig.customActions,
      },
      translateBatch: params.translateBatch,
    })

    try {
      const result = await withViteModule(async (pageTranslateModule) => {
        await pageTranslateModule.startPageTranslation({
          targetLang,
          contentScope,
          translationMode,
          translationTheme: "default",
          ...(params.privacyMode ? { privacyMode: true } : {}),
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
            payloadContext: (browserController.getTranslateCalls()[0]?.payload.context ?? null) as Record<string, unknown> | null,
            requestTexts: browserController.getTranslateCalls().flatMap((call) => call.payload.texts),
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
              ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
              ...(call.payload.context ? { context: call.payload.context } : {}),
              ...(call.payload.task ? { task: call.payload.task } : {}),
              ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
              ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
            },
            response: call.response,
          })),
        } satisfies SourceBackedPageTranslationResult
      })

      return result
    } finally {
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedSiteRuleUpdateAutomation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")

    const initialConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        apiKey: "live-bench-test-key",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: ["article"],
        },
      },
      customActions: [],
    }

    const nextConfig: AstraConfig = {
      ...initialConfig,
      sites: {
        ...initialConfig.sites,
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          targetLang: "ja",
          selectors: ["article", ".content"],
          presentation: {
            mode: "translation-only",
          },
        },
      },
    }

    const browserController = installSourceBenchBrowser({
      config: initialConfig,
    })

    try {
      const result = await withViteModules(async ({ pageTranslateModule, contentEntrypointModule }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()
        const sessionTracker = createSessionRestartTracker(pageTranslateModule.subscribePageTranslationState)

        try {
          await contentEntrypointModule.default.main({} as never)

          await waitForCondition(
            () => browserController.getTranslateCalls().length > 0
              && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
            params.timeoutMs ?? 4_000,
            "Timed out waiting for the initial site-automation translation to start.",
          )

          const beforeSnapshot = pageTranslateModule.getPageTranslationState()
          const requestCountBeforeUpdate = browserController.getTranslateCalls().length
          await (globalThis as {
            __ASTRA_TEST_BROWSER__?: {
              storage?: { local?: { set?: (values: Record<string, unknown>) => Promise<void> } }
            }
          }).__ASTRA_TEST_BROWSER__?.storage?.local?.set?.({
            [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
          })

          await browserController.emitStorageChange({
            [ASTRA_CONFIG_STORAGE_KEY]: {
              oldValue: initialConfig,
              newValue: nextConfig,
            },
          })

          await waitForCondition(
            () => {
              const snapshot = pageTranslateModule.getPageTranslationState()
              return browserController.getTranslateCalls().length > requestCountBeforeUpdate
                && snapshot.phase === "running"
                && snapshot.presentation.mode === "translation-only"
                && sessionTracker.countNewSessionsSince(beforeSnapshot.sessionId) > 0
                && dom.window.document.querySelectorAll("[data-astra-source-hidden]").length > 0
            },
            params.timeoutMs ?? 4_000,
            "Timed out waiting for the storage-backed site rule update restart to settle.",
          )

          await new Promise((resolve) => setTimeout(resolve, 150))

          const snapshot = pageTranslateModule.getPageTranslationState()
          const html = dom.serialize()
          if (params.snapshotHtmlPath) {
            await writeFile(params.snapshotHtmlPath, html, "utf8")
          }

          const translateCalls = browserController.getTranslateCalls()
          const restartTranslateCall = translateCalls[requestCountBeforeUpdate] ?? null
          const restartSessionCount = sessionTracker.countNewSessionsSince(beforeSnapshot.sessionId)

          const result = {
            html,
            pageTranslation: buildPageTranslationExecutionFromDocument({
              doc: dom.window.document,
              expectedTexts: expected.expectedTexts,
              requestCount: translateCalls.length,
              snapshotPhase: snapshot.phase,
              failedBlocks: snapshot.progress.failedBlocks,
              payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
              requestTexts: translateCalls.flatMap((call) => call.payload.texts),
              notes: [
                `effectiveScope=${expected.effectiveScope}`,
                "live-source-site-rule-update",
                `restartSessionCount=${restartSessionCount}`,
              ],
            }),
            requestCountBeforeUpdate,
            requestCountAfterUpdate: translateCalls.length,
            restartSessionCount,
            restartedTargetLang: restartTranslateCall?.payload.targetLang ?? null,
            restartedPresentationMode: snapshot.presentation.mode,
            hiddenSourceCountAfterUpdate: dom.window.document.querySelectorAll("[data-astra-source-hidden]").length,
            translationMarkerCountAfterUpdate: dom.window.document.querySelectorAll("[data-astra-translation='1']").length,
            translateCalls: translateCalls.map((call) => ({
              payload: {
                texts: call.payload.texts,
                targetLang: call.payload.targetLang,
                ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
                ...(call.payload.context ? { context: call.payload.context } : {}),
                ...(call.payload.task ? { task: call.payload.task } : {}),
                ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
                ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
              },
              response: call.response,
            })),
          } satisfies SourceBackedSiteRuleUpdateResult

          pageTranslateModule.stopPageTranslation()
          await new Promise((resolve) => setTimeout(resolve, 0))
          return result
        } finally {
          sessionTracker.stop()
        }
      })

      return result
    } finally {
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedProviderSwitchAutomation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")
    const initialConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "astra-session",
        apiKey: "live-direct-key",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
        },
      },
      customActions: [],
    }

    const nextConfig: AstraConfig = {
      ...initialConfig,
      provider: {
        ...initialConfig.provider,
        apiKey: "",
      },
    }

    const browserController = installSourceBenchBrowser({
      config: initialConfig,
      dispatchRuntimeMessagesToListeners: true,
    })
    const restoreFetch = setGlobalValue("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url

      if (requestUrl.endsWith("/translate")) {
        const requestBody = input instanceof Request ? await input.text() : typeof init?.body === "string" ? init.body : ""
        const payload = requestBody ? JSON.parse(requestBody) as { texts?: string[] } : { texts: [] }
        return new Response(JSON.stringify({
          translations: (payload.texts ?? []).map((text) => `ZH:${text}`),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error("unexpected network call escaped provider-switch router seam")
    })

    try {
      const result = await withViteModulesAndBackground(async ({
        pageTranslateModule,
        contentEntrypointModule,
        backgroundEntrypointModule,
        routerModule,
      }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()
        const sessionTracker = createSessionRestartTracker(pageTranslateModule.subscribePageTranslationState)
        routerModule.setProviderRouterDependenciesForTests({
          translateWithOpenAI: async ({ texts }: { texts: string[] }) => texts.map((text) => `ZH:${text}`),
        })

        try {
          backgroundEntrypointModule.default.main()
          await contentEntrypointModule.default.main({} as never)

          await waitForCondition(
            () => browserController.getTranslateCalls().length > 0
              && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
            params.timeoutMs ?? 4_000,
            "Timed out waiting for the initial provider-switch translation to start.",
          )

          await new Promise((resolve) => setTimeout(resolve, 50))
          await clearIndexedDbDatabase("astra-translation-cache")

          const beforeSnapshot = pageTranslateModule.getPageTranslationState()
          const requestCountBeforeUpdate = browserController.getTranslateCalls().length
          const initialFinalTransport = getTranslateCallFinalTransport(browserController.getTranslateCalls().at(-1) ?? null)

          await (globalThis as {
            __ASTRA_TEST_BROWSER__?: {
              storage?: { local?: { set?: (values: Record<string, unknown>) => Promise<void> } }
            }
          }).__ASTRA_TEST_BROWSER__?.storage?.local?.set?.({
            [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
          })

          await browserController.emitStorageChange({
            [ASTRA_CONFIG_STORAGE_KEY]: {
              oldValue: initialConfig,
              newValue: nextConfig,
            },
          })

          await waitForCondition(
            () => {
              const snapshot = pageTranslateModule.getPageTranslationState()
              return browserController.getTranslateCalls().length > requestCountBeforeUpdate
                && snapshot.phase === "running"
                && sessionTracker.countNewSessionsSince(beforeSnapshot.sessionId) > 0
            },
            params.timeoutMs ?? 4_000,
            "Timed out waiting for the provider-switch restart to settle.",
          )

          await new Promise((resolve) => setTimeout(resolve, 150))

          const snapshot = pageTranslateModule.getPageTranslationState()
          const html = dom.serialize()
          if (params.snapshotHtmlPath) {
            await writeFile(params.snapshotHtmlPath, html, "utf8")
          }

          const translateCalls = browserController.getTranslateCalls()
          const restartTranslateCall = translateCalls[requestCountBeforeUpdate] ?? null
          const restartSessionCount = sessionTracker.countNewSessionsSince(beforeSnapshot.sessionId)

          const result = {
            html,
            pageTranslation: buildPageTranslationExecutionFromDocument({
              doc: dom.window.document,
              expectedTexts: expected.expectedTexts,
              requestCount: translateCalls.length,
              snapshotPhase: snapshot.phase,
              failedBlocks: snapshot.progress.failedBlocks,
              payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
              requestTexts: translateCalls.flatMap((call) => call.payload.texts),
              notes: [
                `effectiveScope=${expected.effectiveScope}`,
                "live-source-provider-switch",
                `restartSessionCount=${restartSessionCount}`,
              ],
            }),
            requestCountBeforeUpdate,
            requestCountAfterUpdate: translateCalls.length,
            restartSessionCount,
            initialFinalTransport,
            restartedFinalTransport: getTranslateCallFinalTransport(restartTranslateCall),
            restartedFallbackUsed: getTranslateCallFallbackUsed(restartTranslateCall),
            translateCalls: translateCalls.map((call) => ({
              payload: {
                texts: call.payload.texts,
                targetLang: call.payload.targetLang,
                ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
                ...(call.payload.context ? { context: call.payload.context } : {}),
                ...(call.payload.task ? { task: call.payload.task } : {}),
                ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
                ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
              },
              response: call.response,
            })),
          } satisfies SourceBackedProviderSwitchResult

          pageTranslateModule.stopPageTranslation()
          await new Promise((resolve) => setTimeout(resolve, 0))
          return result
        } finally {
          sessionTracker.stop()
          routerModule.resetProviderRouterDependenciesForTests()
        }
      })

      return result
    } finally {
      restoreFetch()
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedBackgroundRelayOnlyPageTranslation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")
    const relayOnlyConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "astra-session",
        apiKey: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
        },
      },
      customActions: [],
    }

    let relayRequestCount = 0
    const originalFetch = globalThis.fetch
    const browserController = installSourceBenchBrowser({
      config: relayOnlyConfig,
      dispatchRuntimeMessagesToListeners: true,
    })
    const restoreFetch = setGlobalValue("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url

      if (!requestUrl.endsWith("/translate")) {
        return originalFetch(input as never, init)
      }
      relayRequestCount += 1
      const requestBody = input instanceof Request ? await input.text() : typeof init?.body === "string" ? init.body : ""
      const payload = requestBody ? JSON.parse(requestBody) as { texts?: string[] } : { texts: [] }
      return new Response(JSON.stringify({
        translations: (payload.texts ?? []).map((text) => `ZH:${text}`),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    try {
      const result = await withViteModulesAndBackground(async ({ pageTranslateModule, contentEntrypointModule, backgroundEntrypointModule }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()
        backgroundEntrypointModule.default.main()
        await contentEntrypointModule.default.main({} as never)

        await waitForCondition(
          () => browserController.getTranslateCalls().length > 0
            && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
          params.timeoutMs ?? 5_000,
          "Timed out waiting for the relay-only background-routed translation to start.",
        )

        const snapshot = pageTranslateModule.getPageTranslationState()
        const html = dom.serialize()
        if (params.snapshotHtmlPath) {
          await writeFile(params.snapshotHtmlPath, html, "utf8")
        }

        const translateCalls = browserController.getTranslateCalls()
        const lastTranslateCall = translateCalls.at(-1) ?? null

        const result = {
          html,
          pageTranslation: buildPageTranslationExecutionFromDocument({
            doc: dom.window.document,
            expectedTexts: expected.expectedTexts,
            requestCount: translateCalls.length,
            snapshotPhase: snapshot.phase,
            failedBlocks: snapshot.progress.failedBlocks,
            payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
            requestTexts: translateCalls.flatMap((call) => call.payload.texts),
            notes: [
              `effectiveScope=${expected.effectiveScope}`,
              "live-source-background-relay-only",
            ],
          }),
          requestCount: translateCalls.length,
          relayRequestCount,
          finalTransport: getTranslateCallFinalTransport(lastTranslateCall),
          fallbackUsed: getTranslateCallFallbackUsed(lastTranslateCall),
          translateCalls: translateCalls.map((call) => ({
            payload: {
              texts: call.payload.texts,
              targetLang: call.payload.targetLang,
              ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
              ...(call.payload.context ? { context: call.payload.context } : {}),
              ...(call.payload.task ? { task: call.payload.task } : {}),
              ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
              ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
            },
            response: call.response,
          })),
        } satisfies SourceBackedBackgroundRelayOnlyResult

        pageTranslateModule.stopPageTranslation()
        await new Promise((resolve) => setTimeout(resolve, 0))
        return result
      })

      return result
    } finally {
      restoreFetch()
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedBackgroundDirectSuccessPageTranslation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")
    const directConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "astra-session",
        apiKey: "live-direct-key",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
        },
      },
      customActions: [],
    }

    let relayRequestCount = 0
    const browserController = installSourceBenchBrowser({
      config: directConfig,
      dispatchRuntimeMessagesToListeners: true,
    })
    const restoreFetch = setGlobalValue("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url

      if (requestUrl.endsWith("/translate")) {
        relayRequestCount += 1
        return new Response(JSON.stringify({
          translations: [],
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error("unexpected direct network call escaped router seam")
    })

    try {
      const result = await withViteModulesAndBackground(async ({ pageTranslateModule, contentEntrypointModule, backgroundEntrypointModule, routerModule }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()
        routerModule.setProviderRouterDependenciesForTests({
          translateWithOpenAI: async ({ texts }: { texts: string[] }) => texts.map((text) => `ZH:${text}`),
        })

        try {
          backgroundEntrypointModule.default.main()
          await contentEntrypointModule.default.main({} as never)

          await waitForCondition(
            () => browserController.getTranslateCalls().length > 0
              && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
            params.timeoutMs ?? 5_000,
            "Timed out waiting for the background-routed direct-success translation to start.",
          )

          const snapshot = pageTranslateModule.getPageTranslationState()
          const html = dom.serialize()
          if (params.snapshotHtmlPath) {
            await writeFile(params.snapshotHtmlPath, html, "utf8")
          }

          const translateCalls = browserController.getTranslateCalls()
          const lastTranslateCall = translateCalls.at(-1) ?? null

          const result = {
            html,
            pageTranslation: buildPageTranslationExecutionFromDocument({
              doc: dom.window.document,
              expectedTexts: expected.expectedTexts,
              requestCount: translateCalls.length,
              snapshotPhase: snapshot.phase,
              failedBlocks: snapshot.progress.failedBlocks,
              payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
              requestTexts: translateCalls.flatMap((call) => call.payload.texts),
              notes: [
                `effectiveScope=${expected.effectiveScope}`,
                "live-source-background-direct-success",
              ],
            }),
            requestCount: translateCalls.length,
            relayRequestCount,
            finalTransport: getTranslateCallFinalTransport(lastTranslateCall),
            fallbackUsed: getTranslateCallFallbackUsed(lastTranslateCall),
            translateCalls: translateCalls.map((call) => ({
              payload: {
                texts: call.payload.texts,
                targetLang: call.payload.targetLang,
                ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
                ...(call.payload.context ? { context: call.payload.context } : {}),
                ...(call.payload.task ? { task: call.payload.task } : {}),
                ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
                ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
              },
              response: call.response,
            })),
          } satisfies SourceBackedBackgroundDirectSuccessResult

          pageTranslateModule.stopPageTranslation()
          await new Promise((resolve) => setTimeout(resolve, 0))
          return result
        } finally {
          routerModule.resetProviderRouterDependenciesForTests()
        }
      })

      return result
    } finally {
      restoreFetch()
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedBackgroundDirectRelayFallbackPageTranslation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")
    const fallbackConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "astra-session",
        apiKey: "live-direct-key",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
        },
      },
      customActions: [],
    }

    let relayRequestCount = 0
    const originalFetch = globalThis.fetch
    const browserController = installSourceBenchBrowser({
      config: fallbackConfig,
      dispatchRuntimeMessagesToListeners: true,
    })
    const restoreFetch = setGlobalValue("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url

      if (!requestUrl.endsWith("/translate")) {
        throw new Error("stubbed direct transport failure")
      }
      relayRequestCount += 1
      const requestBody = input instanceof Request ? await input.text() : typeof init?.body === "string" ? init.body : ""
      const payload = requestBody ? JSON.parse(requestBody) as { texts?: string[] } : { texts: [] }
      return new Response(JSON.stringify({
        translations: (payload.texts ?? []).map((text) => `ZH:${text}`),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    })

    try {
      const result = await withViteModulesAndBackground(async ({ pageTranslateModule, contentEntrypointModule, backgroundEntrypointModule }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()

        try {
          backgroundEntrypointModule.default.main()
          await contentEntrypointModule.default.main({} as never)

          await waitForCondition(
            () => browserController.getTranslateCalls().length > 0
              && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
            params.timeoutMs ?? 5_000,
            "Timed out waiting for the background-routed direct→relay fallback translation to start.",
          )

          const snapshot = pageTranslateModule.getPageTranslationState()
          const html = dom.serialize()
          if (params.snapshotHtmlPath) {
            await writeFile(params.snapshotHtmlPath, html, "utf8")
          }

          const translateCalls = browserController.getTranslateCalls()
          const lastTranslateCall = translateCalls.at(-1) ?? null

          const result = {
            html,
            pageTranslation: buildPageTranslationExecutionFromDocument({
              doc: dom.window.document,
              expectedTexts: expected.expectedTexts,
              requestCount: translateCalls.length,
              snapshotPhase: snapshot.phase,
              failedBlocks: snapshot.progress.failedBlocks,
              payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
              requestTexts: translateCalls.flatMap((call) => call.payload.texts),
              notes: [
                `effectiveScope=${expected.effectiveScope}`,
                "live-source-background-direct-relay-fallback",
              ],
            }),
            requestCount: translateCalls.length,
            relayRequestCount,
            finalTransport: getTranslateCallFinalTransport(lastTranslateCall),
            fallbackUsed: getTranslateCallFallbackUsed(lastTranslateCall),
            translateCalls: translateCalls.map((call) => ({
              payload: {
                texts: call.payload.texts,
                targetLang: call.payload.targetLang,
                ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
                ...(call.payload.context ? { context: call.payload.context } : {}),
                ...(call.payload.task ? { task: call.payload.task } : {}),
                ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
                ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
              },
              response: call.response,
            })),
          } satisfies SourceBackedBackgroundDirectRelayFallbackResult

          pageTranslateModule.stopPageTranslation()
          await new Promise((resolve) => setTimeout(resolve, 0))
          return result
        } finally {
          // No-op: this runner uses fetch-level direct failure injection so the
          // real background/router path remains intact without module overrides.
        }
      })

      return result
    } finally {
      restoreFetch()
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedProviderAndSiteRuleUpdateAutomation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")
    const initialConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "astra-session",
        apiKey: "live-direct-key",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: ["article"],
        },
      },
      customActions: [],
    }

    const nextConfig: AstraConfig = {
      ...initialConfig,
      provider: {
        ...initialConfig.provider,
        apiKey: "",
      },
      sites: {
        ...initialConfig.sites,
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          targetLang: "ja",
          selectors: ["article", ".content"],
          presentation: {
            mode: "translation-only",
          },
        },
      },
    }

    const browserController = installSourceBenchBrowser({
      config: initialConfig,
      dispatchRuntimeMessagesToListeners: true,
    })
    const restoreFetch = setGlobalValue("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url

      if (requestUrl.endsWith("/translate")) {
        const requestBody = input instanceof Request ? await input.text() : typeof init?.body === "string" ? init.body : ""
        const payload = requestBody ? JSON.parse(requestBody) as { texts?: string[] } : { texts: [] }
        return new Response(JSON.stringify({
          translations: (payload.texts ?? []).map((text) => `ZH:${text}`),
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      }

      throw new Error("unexpected network call escaped provider+site router seam")
    })

    try {
      const result = await withViteModulesAndBackground(async ({
        pageTranslateModule,
        contentEntrypointModule,
        backgroundEntrypointModule,
        routerModule,
      }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()
        const sessionTracker = createSessionRestartTracker(pageTranslateModule.subscribePageTranslationState)
        routerModule.setProviderRouterDependenciesForTests({
          translateWithOpenAI: async ({ texts }: { texts: string[] }) => texts.map((text) => `ZH:${text}`),
        })

        try {
          backgroundEntrypointModule.default.main()
          await contentEntrypointModule.default.main({} as never)

          await waitForCondition(
            () => browserController.getTranslateCalls().length > 0
              && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
            params.timeoutMs ?? 4_000,
            "Timed out waiting for the initial provider+site update translation to start.",
          )

          const beforeSnapshot = pageTranslateModule.getPageTranslationState()
          const requestCountBeforeUpdate = browserController.getTranslateCalls().length
          const initialFinalTransport = getTranslateCallFinalTransport(browserController.getTranslateCalls().at(-1) ?? null)

          await (globalThis as {
            __ASTRA_TEST_BROWSER__?: {
              storage?: { local?: { set?: (values: Record<string, unknown>) => Promise<void> } }
            }
          }).__ASTRA_TEST_BROWSER__?.storage?.local?.set?.({
            [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
          })

          await browserController.emitStorageChange({
            [ASTRA_CONFIG_STORAGE_KEY]: {
              oldValue: initialConfig,
              newValue: nextConfig,
            },
          })

          await waitForCondition(
            () => {
              const snapshot = pageTranslateModule.getPageTranslationState()
              return browserController.getTranslateCalls().length === requestCountBeforeUpdate + 1
                && snapshot.phase === "running"
                && snapshot.presentation.mode === "translation-only"
                && snapshot.targetLang === "ja"
                && sessionTracker.countNewSessionsSince(beforeSnapshot.sessionId) > 0
                && dom.window.document.querySelectorAll("[data-astra-source-hidden]").length > 0
            },
            params.timeoutMs ?? 5_000,
            "Timed out waiting for the combined provider/site update restart to settle.",
          )

          await new Promise((resolve) => setTimeout(resolve, 150))

          const snapshot = pageTranslateModule.getPageTranslationState()
          const html = dom.serialize()
          if (params.snapshotHtmlPath) {
            await writeFile(params.snapshotHtmlPath, html, "utf8")
          }

          const translateCalls = browserController.getTranslateCalls()
          const restartTranslateCall = translateCalls[requestCountBeforeUpdate] ?? null
          const restartSessionCount = sessionTracker.countNewSessionsSince(beforeSnapshot.sessionId)

          const result = {
            html,
            pageTranslation: buildPageTranslationExecutionFromDocument({
              doc: dom.window.document,
              expectedTexts: expected.expectedTexts,
              requestCount: translateCalls.length,
              snapshotPhase: snapshot.phase,
              failedBlocks: snapshot.progress.failedBlocks,
              payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
              requestTexts: translateCalls.flatMap((call) => call.payload.texts),
              notes: [
                `effectiveScope=${expected.effectiveScope}`,
                "live-source-provider-and-site-rule-update",
                `restartSessionCount=${restartSessionCount}`,
              ],
            }),
            requestCountBeforeUpdate,
            requestCountAfterUpdate: translateCalls.length,
            restartSessionCount,
            initialFinalTransport,
            restartedFinalTransport: getTranslateCallFinalTransport(restartTranslateCall),
            restartedFallbackUsed: getTranslateCallFallbackUsed(restartTranslateCall),
            restartedTargetLang: restartTranslateCall?.payload.targetLang ?? null,
            restartedPresentationMode: snapshot.presentation.mode,
            hiddenSourceCountAfterUpdate: dom.window.document.querySelectorAll("[data-astra-source-hidden]").length,
            translationMarkerCountAfterUpdate: dom.window.document.querySelectorAll("[data-astra-translation='1']").length,
            translateCalls: translateCalls.map((call) => ({
              payload: {
                texts: call.payload.texts,
                targetLang: call.payload.targetLang,
                ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
                ...(call.payload.context ? { context: call.payload.context } : {}),
                ...(call.payload.task ? { task: call.payload.task } : {}),
                ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
                ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
              },
              response: call.response,
            })),
          } satisfies SourceBackedProviderAndSiteRuleUpdateResult

          pageTranslateModule.stopPageTranslation()
          await new Promise((resolve) => setTimeout(resolve, 0))
          return result
        } finally {
          sessionTracker.stop()
          routerModule.resetProviderRouterDependenciesForTests()
        }
      })

      return result
    } finally {
      restoreFetch()
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedSpaNavigationAutomation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")

    const initialConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        apiKey: "live-bench-test-key",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: ["article"],
        },
      },
      customActions: [],
    }

    const nextConfig: AstraConfig = {
      ...initialConfig,
      sites: {
        ...initialConfig.sites,
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          targetLang: "ja",
          selectors: ["article", ".content"],
          presentation: {
            mode: "translation-only",
          },
        },
      },
    }

    const browserController = installSourceBenchBrowser({
      config: initialConfig,
    })

    try {
      const result = await withViteModules(async ({ pageTranslateModule, contentEntrypointModule }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()

        await contentEntrypointModule.default.main({} as never)

        await waitForCondition(
          () => browserController.getTranslateCalls().length > 0
            && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
          params.timeoutMs ?? 4_000,
          "Timed out waiting for the initial SPA translation to start.",
        )

        const requestCountBeforeNavigation = browserController.getTranslateCalls().length
        await (globalThis as {
          __ASTRA_TEST_BROWSER__?: {
            storage?: { local?: { set?: (values: Record<string, unknown>) => Promise<void> } }
          }
        }).__ASTRA_TEST_BROWSER__?.storage?.local?.set?.({
          [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
        })

        const navigatedUrl = "https://example.com/bench-live/article-basic-next"
        dom.window.history.pushState({ from: "spa-holdout" }, "", navigatedUrl)

        await waitForCondition(
          () => {
            const snapshot = pageTranslateModule.getPageTranslationState()
            return browserController.getTranslateCalls().length > requestCountBeforeNavigation
              && snapshot.phase === "running"
              && snapshot.presentation.mode === "translation-only"
              && snapshot.targetLang === "ja"
              && dom.window.document.querySelectorAll("[data-astra-source-hidden]").length > 0
          },
          params.timeoutMs ?? 5_000,
          "Timed out waiting for the SPA navigation restart to settle.",
        )

        const snapshot = pageTranslateModule.getPageTranslationState()
        const html = dom.serialize()
        if (params.snapshotHtmlPath) {
          await writeFile(params.snapshotHtmlPath, html, "utf8")
        }

        const translateCalls = browserController.getTranslateCalls()
        const restartTranslateCall = translateCalls[requestCountBeforeNavigation] ?? null

        const result = {
          html,
          pageTranslation: buildPageTranslationExecutionFromDocument({
            doc: dom.window.document,
            expectedTexts: expected.expectedTexts,
            requestCount: translateCalls.length,
            snapshotPhase: snapshot.phase,
            failedBlocks: snapshot.progress.failedBlocks,
            payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
            requestTexts: translateCalls.flatMap((call) => call.payload.texts),
            notes: [
              `effectiveScope=${expected.effectiveScope}`,
              "live-source-spa-navigation",
            ],
          }),
          requestCountBeforeNavigation,
          requestCountAfterNavigation: translateCalls.length,
          restartedTargetLang: restartTranslateCall?.payload.targetLang ?? null,
          restartedPresentationMode: snapshot.presentation.mode,
          hiddenSourceCountAfterNavigation: dom.window.document.querySelectorAll("[data-astra-source-hidden]").length,
          translationMarkerCountAfterNavigation: dom.window.document.querySelectorAll("[data-astra-translation='1']").length,
          navigatedUrl,
          translateCalls: translateCalls.map((call) => ({
            payload: {
              texts: call.payload.texts,
              targetLang: call.payload.targetLang,
              ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
              ...(call.payload.context ? { context: call.payload.context } : {}),
              ...(call.payload.task ? { task: call.payload.task } : {}),
              ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
              ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
            },
            response: call.response,
          })),
        } satisfies SourceBackedSpaNavigationResult

        pageTranslateModule.stopPageTranslation()
        await new Promise((resolve) => setTimeout(resolve, 0))
        return result
      })

      return result
    } finally {
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}

export async function runSourceBackedRapidSpaNavigationAutomation(params: {
  fixtureHtml: string
  url: string
  title: string
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

  const dom = createDocumentFromFixtureHtml(params.fixtureHtml, params.url, params.title)
  const restoreGlobals = installDomGlobals(dom.window)

  try {
    injectLiveTranslationStyles(dom.window.document)

    const expected = buildExpectedPageTranslationTexts(dom.window.document, "page")

    const initialConfig: AstraConfig = {
      version: 1,
      targetLang: "zh-CN",
      connectionMode: "astra",
      hoverTrigger: "alt",
      contentScope: "page",
      inputTranslation: "disabled",
      inputTranslationMode: "replace",
      languageLevel: "intermediate",
      explainMode: "deep",
      explanationGlossary: [],
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "",
        apiKey: "live-bench-test-key",
        model: "gpt-5.4-nano",
      },
      tts: DEFAULT_ASTRA_CONFIG.tts,
      presentation: {
        mode: "bilingual",
        theme: "default",
        fontSize: 0.92,
        translationColor: "#64748b",
      },
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          selectors: ["article"],
        },
      },
      customActions: [],
    }

    const nextConfig: AstraConfig = {
      ...initialConfig,
      sites: {
        ...initialConfig.sites,
        "example.com": {
          enabled: true,
          alwaysTranslate: true,
          targetLang: "ja",
          selectors: ["article", ".content"],
          presentation: {
            mode: "translation-only",
          },
        },
      },
    }

    const browserController = installSourceBenchBrowser({
      config: initialConfig,
    })

    try {
      const result = await withViteModules(async ({ pageTranslateModule, contentEntrypointModule }) => {
        delete ((dom.window as unknown) as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
        contentEntrypointModule.__resetContentEntrypointForTests()

        await contentEntrypointModule.default.main({} as never)

        await waitForCondition(
          () => browserController.getTranslateCalls().length > 0
            && dom.window.document.querySelectorAll("[data-astra-translation='1']").length > 0,
          params.timeoutMs ?? 4_000,
          "Timed out waiting for the initial rapid-SPA translation to start.",
        )

        const requestCountBeforeNavigation = browserController.getTranslateCalls().length
        await (globalThis as {
          __ASTRA_TEST_BROWSER__?: {
            storage?: { local?: { set?: (values: Record<string, unknown>) => Promise<void> } }
          }
        }).__ASTRA_TEST_BROWSER__?.storage?.local?.set?.({
          [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
        })

        const firstNavigatedUrl = "https://example.com/bench-live/article-basic-nav-1"
        const secondNavigatedUrl = "https://example.com/bench-live/article-basic-nav-2"
        dom.window.history.pushState({ from: "rapid-spa-holdout-1" }, "", firstNavigatedUrl)
        await new Promise((resolve) => setTimeout(resolve, 350))
        dom.window.history.pushState({ from: "rapid-spa-holdout-2" }, "", secondNavigatedUrl)

        await waitForCondition(
          () => {
            const snapshot = pageTranslateModule.getPageTranslationState()
            return browserController.getTranslateCalls().length > requestCountBeforeNavigation
              && snapshot.phase === "running"
              && snapshot.presentation.mode === "translation-only"
              && snapshot.targetLang === "ja"
              && dom.window.location.href === secondNavigatedUrl
              && dom.window.document.querySelectorAll("[data-astra-source-hidden]").length > 0
          },
          params.timeoutMs ?? 6_000,
          "Timed out waiting for the rapid SPA navigation restart to settle.",
        )

        await new Promise((resolve) => setTimeout(resolve, 900))

        const snapshot = pageTranslateModule.getPageTranslationState()
        const html = dom.serialize()
        if (params.snapshotHtmlPath) {
          await writeFile(params.snapshotHtmlPath, html, "utf8")
        }

        const translateCalls = browserController.getTranslateCalls()
        const restartTranslateCall = translateCalls[requestCountBeforeNavigation] ?? null

        const result = {
          html,
          pageTranslation: buildPageTranslationExecutionFromDocument({
            doc: dom.window.document,
            expectedTexts: expected.expectedTexts,
            requestCount: translateCalls.length,
            snapshotPhase: snapshot.phase,
            failedBlocks: snapshot.progress.failedBlocks,
            payloadContext: (translateCalls[0]?.payload.context ?? null) as Record<string, unknown> | null,
            requestTexts: translateCalls.flatMap((call) => call.payload.texts),
            notes: [
              `effectiveScope=${expected.effectiveScope}`,
              "live-source-rapid-spa-navigation",
            ],
          }),
          requestCountBeforeNavigation,
          requestCountAfterNavigation: translateCalls.length,
          restartedTargetLang: restartTranslateCall?.payload.targetLang ?? null,
          restartedPresentationMode: snapshot.presentation.mode,
          hiddenSourceCountAfterNavigation: dom.window.document.querySelectorAll("[data-astra-source-hidden]").length,
          translationMarkerCountAfterNavigation: dom.window.document.querySelectorAll("[data-astra-translation='1']").length,
          navigatedUrl: secondNavigatedUrl,
          navigationCount: 2,
          translateCalls: translateCalls.map((call) => ({
            payload: {
              texts: call.payload.texts,
              targetLang: call.payload.targetLang,
              ...(call.payload.sourceLang ? { sourceLang: call.payload.sourceLang } : {}),
              ...(call.payload.context ? { context: call.payload.context } : {}),
              ...(call.payload.task ? { task: call.payload.task } : {}),
              ...(call.payload.customSystemPrompt ? { customSystemPrompt: call.payload.customSystemPrompt } : {}),
              ...(call.payload.placeholderFormat ? { placeholderFormat: call.payload.placeholderFormat } : {}),
            },
            response: call.response,
          })),
        } satisfies SourceBackedRapidSpaNavigationResult

        pageTranslateModule.stopPageTranslation()
        await new Promise((resolve) => setTimeout(resolve, 0))
        return result
      })

      return result
    } finally {
      browserController.reset()
    }
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 50))
    restoreGlobals()
    dom.window.close()
  }
}
