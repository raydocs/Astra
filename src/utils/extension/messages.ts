import { browser } from "#imports"

import type {
  ContentCommand,
  ContentCommandResponse,
  ContentStudyContextResponse,
  ContentTranslationOverrides,
  LearningContinuitySyncStatus,
  RuntimeSaveConfigErrorResponse,
  RuntimeTranslateBatchSuccessResponse,
  TranslationPlaceholderFormat,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"
import type { AstraConfig, AstraConfigInput } from "@/types/config"
import {
  isContentCommandResponse,
  isContentStudyContextResponse,
  isRuntimeLearningContinuitySyncResponse,
  isRuntimeLearningContinuitySyncStatusResponse,
  isRuntimeSaveConfigResponse,
  isRuntimeTranslateResponse,
  isRuntimeTranslationCacheStatsResponse,
} from "@/types/messages"
import {
  createTranslationError,
  toTranslationError,
  type TranslationError,
  type TranslationSnapshot,
} from "@/types/translation"
import type { ExplainMode, LanguageLevel } from "@/types/config"

export type TranslationBatchRequestResult =
  | {
      ok: true
      translations: string[]
      metadata?: RuntimeTranslateBatchSuccessResponse["payload"]["metadata"]
    }
  | { ok: false; error: TranslationError }

export type LearningContinuitySyncCommitResult =
  | { ok: true; status: LearningContinuitySyncStatus }
  | { ok: false; error: TranslationError; status?: LearningContinuitySyncStatus }

export type TranslationCacheStatsResult =
  | { ok: true; stats: import("@/types/messages").TranslationCacheStats }
  | { ok: false; error: TranslationError }

function mapContentMessagingError(error: unknown): TranslationError {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes("Could not establish connection")
    || message.includes("Receiving end does not exist")
    || message.includes("The message port closed")) {
    return createTranslationError(
      "CONTENT_UNAVAILABLE",
      "Astra cannot run on this page.",
    )
  }

  return toTranslationError(error, "UNKNOWN")
}

function mapRuntimeMessagingError(error: unknown): TranslationError {
  return toTranslationError(error, "PROVIDER_REQUEST_FAILED")
}

function mapRuntimeConfigMessagingError(error: unknown): TranslationError {
  return toTranslationError(error, "UNKNOWN")
}

type TabLike = { id?: number; url?: string; lastAccessed?: number }

function pickHttpTabs(tabs: readonly TabLike[]) {
  return tabs.filter(
    (tab): tab is TabLike & { id: number; url: string } =>
      typeof tab.id === "number" && !!tab.url && /^https?:/i.test(tab.url),
  )
}

/**
 * The http(s) tab the popup should treat as "current reading" for site keys, digests, etc.
 * When the action popup opens as a **tab**, it may steal focus; prefer last-accessed http tab.
 */
export async function resolveActiveHttpTab(): Promise<{ id: number; url: string } | null> {
  const allTabs = await browser.tabs.query({})
  let httpTabs = pickHttpTabs(allTabs)

  if (httpTabs.length === 0) {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true })
    if (active?.id && active.url && /^https?:/i.test(active.url)) {
      return { id: active.id, url: active.url }
    }
    return null
  }

  httpTabs = [...httpTabs].sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))
  const tab = httpTabs[0]!
  return { id: tab.id, url: tab.url }
}

/**
 * Tab id used for content-script messaging from the popup.
 * When the action popup opens as a **tab** (e.g. Playwright CDP / window.open), that tab can
 * become the active tab while the user is still "reading" an http(s) page in another tab.
 * `tabs.query({ active: true, currentWindow: true })` would then target the popup and break
 * `get-study-context` / translation commands. Prefer the most recently accessed normal web tab.
 */
export async function resolveMessagingTabId(): Promise<number> {
  const target = await resolveActiveHttpTab()
  if (target) {
    return target.id
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error("No active tab available.")
  }

  return tab.id
}

async function getActiveTabId(): Promise<number> {
  return resolveMessagingTabId()
}

async function sendContentCommand(
  tabId: number,
  command: ContentCommand,
): Promise<ContentCommandResponse> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/tab-command",
      tabId,
      command,
    }) as unknown

    if (!isContentCommandResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "UNKNOWN",
          "Received an unexpected response from the page translator.",
        ),
      }
    }

    return response
  } catch (error) {
    return { ok: false, error: mapContentMessagingError(error) }
  }
}

async function sendCurrentTabCommand(
  command: ContentCommand,
): Promise<ContentCommandResponse> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/current-tab-command",
      command,
    }) as unknown

    if (!isContentCommandResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "UNKNOWN",
          "Received an unexpected response from the page translator.",
        ),
      }
    }

    return response
  } catch (error) {
    return { ok: false, error: mapContentMessagingError(error) }
  }
}

export async function requestTranslationBatch(payload: {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: TranslationRequestContext
  task?: TranslationTask
  customSystemPrompt?: string
  placeholderFormat?: TranslationPlaceholderFormat
  languageLevel?: LanguageLevel
  explainMode?: ExplainMode
  explanationRepairInstruction?: string
}): Promise<TranslationBatchRequestResult> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/translate-batch",
      payload,
    }) as unknown

    if (!isRuntimeTranslateResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Received an invalid translation response.",
        ),
      }
    }

    if (response.type === "runtime/translate-batch:error") {
      return { ok: false, error: response.error }
    }

    return {
      ok: true,
      translations: response.payload.translations,
      ...(response.payload.metadata ? { metadata: response.payload.metadata } : {}),
    }
  } catch (error) {
    return { ok: false, error: mapRuntimeMessagingError(error) }
  }
}

export async function commitLearningContinuitySync(reason: string): Promise<LearningContinuitySyncCommitResult> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/learning-continuity-sync",
      reason,
    }) as unknown

    if (!isRuntimeLearningContinuitySyncResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Received an invalid learning continuity sync response.",
        ),
      }
    }

    if (response.type === "runtime/learning-continuity-sync:error") {
      return { ok: false, error: response.error, status: response.payload?.status }
    }

    return { ok: true, status: response.payload.status }
  } catch (error) {
    return { ok: false, error: mapRuntimeConfigMessagingError(error) }
  }
}

export async function getLearningContinuitySyncStatus(): Promise<LearningContinuitySyncCommitResult> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/learning-continuity-sync-status",
    }) as unknown

    if (!isRuntimeLearningContinuitySyncStatusResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Received an invalid learning continuity sync status response.",
        ),
      }
    }

    return { ok: true, status: response.payload.status }
  } catch (error) {
    return { ok: false, error: mapRuntimeConfigMessagingError(error) }
  }
}

export async function getTranslationCacheStats(): Promise<TranslationCacheStatsResult> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/translation-cache-stats",
    }) as unknown

    if (!isRuntimeTranslationCacheStatsResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Received an invalid translation cache stats response.",
        ),
      }
    }

    if (response.type === "runtime/translation-cache-stats:error") {
      return { ok: false, error: response.error }
    }

    return { ok: true, stats: response.payload }
  } catch (error) {
    return { ok: false, error: mapRuntimeConfigMessagingError(error) }
  }
}

export async function saveConfigInBackground(
  payload: AstraConfigInput,
): Promise<{ ok: true; config: AstraConfig } | { ok: false; error: RuntimeSaveConfigErrorResponse["error"] }> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/save-config",
      payload,
    }) as unknown

    if (!isRuntimeSaveConfigResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "INVALID_RESPONSE",
          "Received an invalid config save response.",
        ),
      }
    }

    if (response.type === "runtime/save-config:error") {
      return { ok: false, error: response.error }
    }

    return { ok: true, config: response.payload.config }
  } catch (error) {
    return { ok: false, error: mapRuntimeConfigMessagingError(error) }
  }
}

export async function getActiveTabTranslationState(): Promise<ContentCommandResponse> {
  try {
    const tabId = await getActiveTabId()
    return sendContentCommand(tabId, { type: "content/get-translation-state" })
  } catch (error) {
    return { ok: false, error: toTranslationError(error, "CONTENT_UNAVAILABLE") }
  }
}

export async function getActiveTabStudyContext(): Promise<ContentStudyContextResponse> {
  try {
    const tabId = await getActiveTabId()
    const response = await browser.tabs.sendMessage(
      tabId,
      {
        type: "content/get-study-context",
      },
      { frameId: 0 },
    ) as unknown

    if (!isContentStudyContextResponse(response)) {
      return {
        ok: false,
        error: createTranslationError(
          "UNKNOWN",
          "Received an unexpected study context response.",
        ),
      }
    }

    return response
  } catch (error) {
    return { ok: false, error: mapContentMessagingError(error) }
  }
}

export async function startActiveTabTranslation(
  overrides?: ContentTranslationOverrides,
): Promise<ContentCommandResponse> {
  try {
    const tabId = await getActiveTabId()
    return sendContentCommand(tabId, {
      type: "content/start-translation",
      ...(overrides && Object.keys(overrides).length > 0 ? { payload: overrides } : {}),
    })
  } catch (error) {
    return { ok: false, error: toTranslationError(error, "CONTENT_UNAVAILABLE") }
  }
}

export async function stopActiveTabTranslation(): Promise<ContentCommandResponse> {
  try {
    const tabId = await getActiveTabId()
    return sendContentCommand(tabId, { type: "content/stop-translation" })
  } catch (error) {
    return { ok: false, error: toTranslationError(error, "CONTENT_UNAVAILABLE") }
  }
}

export async function toggleTabTranslation(
  tabId: number,
  overrides?: ContentTranslationOverrides,
): Promise<ContentCommandResponse> {
  return sendContentCommand(tabId, {
    type: "content/toggle-translation",
    ...(overrides && Object.keys(overrides).length > 0 ? { payload: overrides } : {}),
  })
}

export async function toggleCurrentTabTranslation(
  overrides?: ContentTranslationOverrides,
): Promise<ContentCommandResponse> {
  return sendCurrentTabCommand({
    type: "content/toggle-translation",
    ...(overrides && Object.keys(overrides).length > 0 ? { payload: overrides } : {}),
  })
}

export async function retryActiveTabFailedBlocks(): Promise<ContentCommandResponse> {
  try {
    const tabId = await getActiveTabId()
    return sendContentCommand(tabId, { type: "content/retry-failed" })
  } catch (error) {
    return { ok: false, error: toTranslationError(error, "CONTENT_UNAVAILABLE") }
  }
}

export function getResponseState(
  response: ContentCommandResponse,
): TranslationSnapshot | null {
  return response.ok ? response.state : response.state ?? null
}
