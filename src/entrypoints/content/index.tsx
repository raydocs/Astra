import { defineContentScript, browser } from "#imports"
import {
  getPageTranslationState,
  startPageTranslation,
  stopPageTranslation,
  togglePageTranslation,
} from "./page-translate"
import { mountFloatBall } from "./components/FloatBall"
import { mountSelectionToolbar } from "./components/SelectionToolbar"
import {
  isContentCommand,
  type ContentCommand,
  type ContentCommandResponse,
} from "@/types/messages"

declare global {
  interface Window {
    __ASTRA_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: ["*://*/*"],
  cssInjectionMode: "manual",
  main() {
    if (window.__ASTRA_INJECTED__) return
    window.__ASTRA_INJECTED__ = true

    console.log("[Astra] Content script loaded on:", window.location.href)

    injectStyles()
    mountFloatBall()
    mountSelectionToolbar()

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!isContentCommand(message)) return

      void handleContentCommand(message)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            ok: false,
            error: {
              code: "UNKNOWN",
              message: error instanceof Error ? error.message : "Unexpected content error.",
            },
            state: getPageTranslationState(),
          } satisfies ContentCommandResponse)
        })

      return true
    })
  },
})

async function handleContentCommand(
  message: ContentCommand,
): Promise<ContentCommandResponse> {
  switch (message.type) {
    case "content/get-translation-state":
      return { ok: true, state: getPageTranslationState() }

    case "content/start-translation":
      return {
        ok: true,
        state: await startPageTranslation(message.payload?.targetLang),
      }

    case "content/stop-translation":
      return { ok: true, state: stopPageTranslation() }

    case "content/toggle-translation":
      return {
        ok: true,
        state: await togglePageTranslation(message.payload?.targetLang),
      }
  }
}

function injectStyles() {
  const style = document.createElement("style")
  style.textContent = `
    .astra-translation {
      display: block;
      margin-top: 6px;
    }
    .astra-translation-inner {
      color: #64748b;
      font-size: 0.92em;
      line-height: 1.6;
      border-left: 2px solid #6366f1;
      padding-left: 8px;
      display: block;
    }
    .astra-theme-underline .astra-translation-inner {
      border-left: none;
      padding-left: 0;
      text-decoration: underline;
      text-decoration-color: #6366f1;
      text-underline-offset: 2px;
    }
    .astra-theme-highlight .astra-translation-inner {
      border-left: none;
      padding-left: 0;
      background: rgba(99, 102, 241, 0.08);
      padding: 2px 4px;
      border-radius: 3px;
    }
    .astra-loading-dots {
      color: #94a3b8;
      animation: astra-pulse 1.5s ease-in-out infinite;
    }
    @keyframes astra-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `
  document.head.appendChild(style)
}
