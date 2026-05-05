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
import enMessages from "../../public/_locales/en/messages.json"

export interface TranslationBatchPayload {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
  placeholderFormat?: "astra-rich-text-v1"
}

export interface TranslateCallRecord {
  payload: TranslationBatchPayload
  response: RuntimeResponse
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
  dispatchRuntimeMessagesToListeners?: boolean
  frames?: BenchFrameEntry[] | (() => Promise<BenchFrameEntry[]> | BenchFrameEntry[])
  sendFrameMessage?: (
    tabId: number,
    command: ContentCommand,
    options?: { frameId?: number },
  ) => Promise<unknown> | unknown
}

function resolveMessage(key: string, substitutions?: string | string[]): string {
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
        if (payload.task === "explain") {
          return `EXPLAIN: This passage is explained with concise target-language guidance for ${text.split(/\s+/).slice(0, 3).join(" ")}.`
        }
        return `ZH:${text.slice(0, 48)}`
      }),
    },
  }))

  const successCommandResponse: ContentCommandResponse = {
    ok: true,
    state: IDLE_TRANSLATION_SNAPSHOT,
  }

  const dispatchRuntimeMessage = async (message: unknown, sender: unknown) => {
    const responses: unknown[] = []

    for (const listener of runtimeMessageListeners) {
      const listenerResponse = await new Promise<unknown | null>((resolve, reject) => {
        let settled = false
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true
            reject(new Error("Timed out waiting for bench runtime listener response."))
          }
        }, 2_000)

        const finish = (value: unknown | null) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          resolve(value)
        }

        try {
          const maybeAsync = listener(message, sender, (response?: unknown) => {
            finish(response ?? null)
          })
          Promise.resolve(maybeAsync).then((result) => {
            if (result === true) {
              return
            }
            if (typeof result !== "undefined" && result !== false) {
              finish(result)
              return
            }
            finish(null)
          }, reject)
        } catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      })

      if (listenerResponse !== null) {
        responses.push(listenerResponse)
      }
    }

    const lastResponse = responses.at(-1)
    if (typeof lastResponse === "undefined") {
      throw new Error(`Runtime message was not handled by any bench listener: ${JSON.stringify(message)}`)
    }
    return lastResponse
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
          const response = options.dispatchRuntimeMessagesToListeners
            ? await dispatchRuntimeMessage(message, { id: "bench-runtime", tab: { id: 1 } }) as RuntimeResponse
            : await translateBatch(message.payload)
          translateCalls.push({
            payload: message.payload,
            response,
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
          return options.dispatchRuntimeMessagesToListeners
            ? await dispatchRuntimeMessage(message, { id: "bench-runtime", tab: { id: 1 } }) as ContentCommandResponse
            : successCommandResponse
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
          return options.dispatchRuntimeMessagesToListeners
            ? await dispatchRuntimeMessage(message, { id: "bench-runtime", tab: { id: 1 } }) as ContentCommandResponse
            : successCommandResponse
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
    i18n: {
      getMessage: (key: string, substitutions?: string | string[]) => resolveMessage(key, substitutions),
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
