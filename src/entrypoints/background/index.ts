import { defineBackground, browser } from "#imports"
import { isRuntimeTranslateBatchRequest, type RuntimeResponse } from "@/types/messages"
import { toTranslationError } from "@/types/translation"
import { toggleTabTranslation } from "@/utils/extension/messages"
import { translateWithProvider } from "@/utils/providers/router"
import { readConfig } from "@/utils/storage/config"

export default defineBackground({
  type: "module",
  main: () => {
    console.log("[Astra] Background service worker started")

    browser.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        console.log("[Astra] Extension installed")
      }
    })

    // Keyboard shortcut: Alt+A toggle translation
    browser.commands.onCommand.addListener((command) => {
      if (command === "toggleTranslate") {
        void (async () => {
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
          if (tab?.id) {
            const response = await toggleTabTranslation(tab.id)
            if (!response.ok && response.error.code !== "CONTENT_UNAVAILABLE") {
              console.warn("[Astra] Failed to toggle translation:", response.error.message)
            }
          }
        })()
      }
    })

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (isRuntimeTranslateBatchRequest(message)) {
        handleTranslate(message.payload)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              type: "runtime/translate-batch:error",
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies RuntimeResponse)
          })
        return true
      }
    })
  },
})

async function handleTranslate(payload: {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: {
    pageTitle?: string
    pageUrl?: string
    hostname?: string
    metaDescription?: string
    contentSummary?: string
    selectionContext?: string
  }
  task?: "translate" | "explain" | "custom"
  customSystemPrompt?: string
}): Promise<RuntimeResponse> {
  const config = await readConfig()

  const translations = await translateWithProvider(config.provider, {
    texts: payload.texts,
    targetLang: payload.targetLang,
    sourceLang: payload.sourceLang,
    context: payload.context,
    task: payload.task,
    customSystemPrompt: payload.customSystemPrompt,
  })

  return {
    type: "runtime/translate-batch:success",
    payload: { translations },
  }
}
