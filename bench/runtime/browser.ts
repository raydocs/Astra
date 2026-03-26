import { ASTRA_CONFIG_STORAGE_KEY } from "@/utils/storage/config"
import { ASTRA_AUTH_STORAGE_KEY } from "@/utils/storage/auth"
import { DEFAULT_ASTRA_CONFIG, type AstraConfig } from "@/types/config"
import type { AstraSession } from "@/types/auth"
import { IDLE_TRANSLATION_SNAPSHOT } from "@/types/translation"
import type {
  ContentCommand,
  ContentCommandResponse,
  RuntimeResponse,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"

export interface TranslationBatchPayload {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
}

export interface TranslateCallRecord {
  payload: TranslationBatchPayload
  startedAt: number
  durationMs: number
}

export interface CommandCallRecord {
  requestType: "runtime/current-tab-command" | "runtime/tab-command"
  command: ContentCommand
  tabId: number | null
  startedAt: number
}

export interface BenchFrameEntry {
  frameId: number
  parentFrameId: number
  url: string
}

export interface BenchBrowserController {
  browser: Record<string, unknown>
  getTranslateCalls: () => TranslateCallRecord[]
  getCommandCalls: () => CommandCallRecord[]
  emitRuntimeMessage: (message: unknown, sender?: unknown) => Promise<unknown[]>
  emitStorageChange: (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName?: string) => Promise<void>
  reset: () => void
}

export interface BenchBrowserOptions {
  config?: Partial<AstraConfig>
  session?: Partial<AstraSession> | null
  translateBatch?: (payload: TranslationBatchPayload) => Promise<RuntimeResponse> | RuntimeResponse
  frames?: BenchFrameEntry[] | (() => Promise<BenchFrameEntry[]> | BenchFrameEntry[])
  sendFrameMessage?: (
    tabId: number,
    command: ContentCommand,
    options?: { frameId?: number },
  ) => Promise<unknown> | unknown
}

function mergeConfig(config: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...config,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...config.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...config.presentation,
    },
    sites: {
      ...DEFAULT_ASTRA_CONFIG.sites,
      ...config.sites,
    },
  }
}

export function installBenchBrowser(
  options: BenchBrowserOptions = {},
): BenchBrowserController {
  const storage: Record<string, unknown> = {
    [ASTRA_CONFIG_STORAGE_KEY]: mergeConfig(options.config),
    ...(options.session
      ? {
          [ASTRA_AUTH_STORAGE_KEY]: options.session,
        }
      : {}),
  }
  const translateCalls: TranslateCallRecord[] = []
  const commandCalls: CommandCallRecord[] = []
  const storageChangedListeners = new Set<(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => unknown>()
  const runtimeMessageListeners = new Set<(message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => unknown>()

  const translateBatch = options.translateBatch ?? (async (payload) => ({
    type: "runtime/translate-batch:success" as const,
    payload: {
      translations: payload.texts.map((text) => {
        const taskPrefix = payload.task === "explain" ? "EXPLAIN" : "ZH"
        return `${taskPrefix}:${text.slice(0, 48)}`
      }),
    },
  }))

  const successCommandResponse: ContentCommandResponse = {
    ok: true,
    state: IDLE_TRANSLATION_SNAPSHOT,
  }

  const resolveFrames = async (): Promise<BenchFrameEntry[]> => {
    if (!options.frames) return []
    if (typeof options.frames === "function") {
      return await options.frames()
    }
    return options.frames
  }

  const browser = {
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
        clear: async () => {
          Object.keys(storage).forEach((key) => {
            delete storage[key]
          })
        },
      },
    },
    runtime: {
      async sendMessage(message: { type?: string; payload?: TranslationBatchPayload }) {
        if (message?.type === "runtime/translate-batch" && message.payload) {
          const startedAt = performance.now()
          const response = await translateBatch(message.payload)
          translateCalls.push({
            payload: message.payload,
            startedAt,
            durationMs: performance.now() - startedAt,
          })
          return response
        }

        if (message?.type === "runtime/current-tab-command" && "command" in message) {
          commandCalls.push({
            requestType: "runtime/current-tab-command",
            command: message.command as ContentCommand,
            tabId: null,
            startedAt: performance.now(),
          })
          return successCommandResponse
        }

        if (message?.type === "runtime/tab-command" && "command" in message) {
          const candidate = message as { tabId?: unknown; command: ContentCommand }
          commandCalls.push({
            requestType: "runtime/tab-command",
            command: candidate.command,
            tabId: typeof candidate.tabId === "number"
              ? candidate.tabId
              : null,
            startedAt: performance.now(),
          })
          return successCommandResponse
        }

        throw new Error(`Unhandled runtime message: ${JSON.stringify(message)}`)
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
      sendMessage: async (tabId: number, command: ContentCommand, sendOptions?: { frameId?: number }) => {
        if (!options.sendFrameMessage) return undefined
        return await options.sendFrameMessage(tabId, command, sendOptions)
      },
      onActivated: {
        addListener() {},
        removeListener() {},
      },
    },
    webNavigation: {
      getAllFrames: async () => await resolveFrames(),
    },
    commands: {
      onCommand: {
        addListener() {},
        removeListener() {},
      },
    },
  }

  ;(globalThis as { __ASTRA_TEST_BROWSER__?: Record<string, unknown> }).__ASTRA_TEST_BROWSER__ = browser

  return {
    browser,
    getTranslateCalls: () => [...translateCalls],
    getCommandCalls: () => [...commandCalls],
    emitRuntimeMessage: async (message, sender = { id: "bench" }) => {
      const responses: unknown[] = []
      for (const listener of runtimeMessageListeners) {
        await listener(message, sender, (response?: unknown) => {
          responses.push(response)
        })
      }
      return responses
    },
    emitStorageChange: async (changes, areaName = "local") => {
      for (const listener of storageChangedListeners) {
        await listener(changes, areaName)
      }
    },
    reset: () => {
      translateCalls.length = 0
      commandCalls.length = 0
      storageChangedListeners.clear()
      runtimeMessageListeners.clear()
    },
  }
}
