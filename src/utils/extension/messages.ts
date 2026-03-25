import { browser } from "#imports"

import type {
  ContentCommand,
  ContentCommandResponse,
} from "@/types/messages"
import {
  isContentCommandResponse,
  isRuntimeResponse,
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
    const response = await browser.tabs.sendMessage(tabId, command) as unknown

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
}): Promise<TranslationBatchRequestResult> {
  try {
    const response = await browser.runtime.sendMessage({
      type: "runtime/translate-batch",
      payload,
    }) as unknown

    if (!isRuntimeResponse(response)) {
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

export async function getActiveTabTranslationState(): Promise<ContentCommandResponse> {
  try {
    const tabId = await getActiveTabId()
    return sendContentCommand(tabId, { type: "content/get-translation-state" })
  } catch (error) {
    return { ok: false, error: toTranslationError(error, "CONTENT_UNAVAILABLE") }
  }
}

export async function startActiveTabTranslation(
  targetLang?: string,
): Promise<ContentCommandResponse> {
  try {
    const tabId = await getActiveTabId()
    return sendContentCommand(tabId, {
      type: "content/start-translation",
      ...(targetLang ? { payload: { targetLang } } : {}),
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
  targetLang?: string,
): Promise<ContentCommandResponse> {
  return sendContentCommand(tabId, {
    type: "content/toggle-translation",
    ...(targetLang ? { payload: { targetLang } } : {}),
  })
}

export function getResponseState(
  response: ContentCommandResponse,
): TranslationSnapshot | null {
  return response.ok ? response.state : response.state ?? null
}
