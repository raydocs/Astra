import { defineBackground, browser } from "#imports"
import {
  isRuntimeCurrentTabCommandRequest,
  isRuntimeTabCommandRequest,
  isRuntimeTranslateBatchRequest,
  type ContentCommandResponse,
  type RuntimeResponse,
} from "@/types/messages"
import { executeTabCommand } from "./frame-coordinator"
import { toTranslationError } from "@/types/translation"
import { toggleTabTranslation } from "@/utils/extension/messages"
import { translateWithProvider } from "@/utils/providers/router"
import { readConfig, saveConfig } from "@/utils/storage/config"
import { readAstraSession } from "@/utils/storage/auth"
import { resolveManagedProviderConfig, type HoverTrigger } from "@/types/config"

export default defineBackground({
  type: "module",
  main: () => {
    browser.runtime.onInstalled.addListener(() => {
      if (browser.contextMenus) {
        browser.contextMenus.create({
          id: "astra-translate-selection",
          title: "Translate with Astra",
          contexts: ["selection"],
        })
        browser.contextMenus.create({
          id: "astra-open-pdf-reader",
          title: "Open PDF in Astra Reader",
          contexts: ["link"],
          targetUrlPatterns: ["*://*/*.pdf", "*://*/*.PDF"],
        })
      }
    })

    if (browser.contextMenus?.onClicked) {
      browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === "astra-translate-selection") {
          if (!info.selectionText || !tab?.id) return
          void browser.tabs.sendMessage(tab.id, {
            type: "content/start-translation",
          })
          return
        }

        if (info.menuItemId === "astra-open-pdf-reader" && info.linkUrl) {
          const pdfReaderUrl = `${browser.runtime.getURL("/pdf-reader/index.html" as "/popup.html")}?url=${encodeURIComponent(info.linkUrl)}`
          void browser.tabs.create({ url: pdfReaderUrl })
          return
        }
      })
    }

    // Keyboard shortcuts
    browser.commands.onCommand.addListener((command) => {
      void (async () => {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true })

        switch (command) {
          case "toggleTranslate": {
            if (tab?.id) {
              const response = await toggleTabTranslation(tab.id)
              if (!response.ok && response.error.code !== "CONTENT_UNAVAILABLE") {
                console.warn("[Astra] Failed to toggle translation:", response.error.message)
              }
            }
            break
          }

          case "translatePage": {
            if (tab?.id) {
              await browser.tabs.sendMessage(tab.id, {
                type: "content/start-translation",
                payload: { contentScope: "page" },
              })
            }
            break
          }

          case "toggleHover": {
            const config = await readConfig()
            const cycle: HoverTrigger[] = ["alt", "always", "disabled"]
            const currentIndex = cycle.indexOf(config.hoverTrigger)
            const nextTrigger = cycle[(currentIndex + 1) % cycle.length]
            await saveConfig({ ...config, hoverTrigger: nextTrigger })
            break
          }
        }
      })()
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

      if (isRuntimeTabCommandRequest(message)) {
        executeTabCommand(message.tabId, message.command)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              ok: false,
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies ContentCommandResponse)
          })
        return true
      }

      if (isRuntimeCurrentTabCommandRequest(message)) {
        const tabId = _sender.tab?.id
        if (!tabId) {
          sendResponse({
            ok: false,
            error: toTranslationError(new Error("No sender tab available."), "CONTENT_UNAVAILABLE"),
          } satisfies ContentCommandResponse)
          return false
        }

        executeTabCommand(tabId, message.command)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              ok: false,
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies ContentCommandResponse)
          })
        return true
      }

      return false
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
  const [config, session] = await Promise.all([
    readConfig(),
    readAstraSession(),
  ])

  const translations = await translateWithProvider(resolveManagedProviderConfig(config.provider, session), {
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
