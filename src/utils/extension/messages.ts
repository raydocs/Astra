import { browser } from "#imports"

import type {
  ContentCommand,
  ContentCommandResponse,
  ContentTranslationOverrides,
  RuntimeSaveConfigErrorResponse,
  TranslationPlaceholderFormat,
  TranslationRequestContext,
  TranslationTask,
} from "@/types/messages"
import type { AstraConfig, AstraConfigInput } from "@/types/config"
import {
  isContentCommandResponse,
  isRuntimeSaveConfigResponse,
  isRuntimeTranslateResponse,
} from "@/types/messages"
import {
  createTranslationError,
  toTranslationError,
  type TranslationError,
  type TranslationSnapshot,
} from "@/types/translation"

export type TranslationBatchRequestResult =
  | { ok: true; translations: string[] }
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

async function getActiveTabId(): Promise<number> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) {
    throw new Error("No active tab available.")
  }

  return tab.id
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

    return { ok: true, translations: response.payload.translations }
  } catch (error) {
    return { ok: false, error: mapRuntimeMessagingError(error) }
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

export function getResponseState(
  response: ContentCommandResponse,
): TranslationSnapshot | null {
  return response.ok ? response.state : response.state ?? null
}
