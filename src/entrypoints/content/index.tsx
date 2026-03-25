import { defineContentScript, browser } from "#imports"
import {
  getPageTranslationState,
  startPageTranslation,
  stopPageTranslation,
  togglePageTranslation,
} from "./page-translate"
import { mountFloatBall } from "./components/FloatBall"
import { mountSelectionToolbar } from "./components/SelectionToolbar"
import { mountHoverTranslate } from "./components/HoverTranslate"
import { mountInputTranslate } from "./components/InputTranslate"
import { isTopFrame } from "./frame-context"
import {
  isContentCommand,
  type ContentCommand,
  type ContentCommandResponse,
} from "@/types/messages"
import {
  createSiteSnapshot,
  createTranslationError,
  type TranslationSnapshot,
} from "@/types/translation"
import { readConfig } from "@/utils/storage/config"
import { resolveSiteTranslationSettings } from "@/types/config"

declare global {
  interface Window {
    __ASTRA_INJECTED__?: boolean
  }
}

export default defineContentScript({
  matches: ["*://*/*"],
  allFrames: true,
  cssInjectionMode: "manual",
  async main() {
    if (window.__ASTRA_INJECTED__) return
    window.__ASTRA_INJECTED__ = true

    console.log("[Astra] Content script loaded on:", window.location.href)

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

    const config = await readConfig()
    const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname)

    if (!siteSettings.enabled) {
      return
    }

    injectStyles()

    // Only mount floating UI components in the top frame to avoid duplicates
    if (isTopFrame()) {
      mountFloatBall()
      mountSelectionToolbar()
      mountHoverTranslate()
      mountInputTranslate()
    }


    if (siteSettings.alwaysTranslate && config.provider.apiKey.trim().length > 0) {
      void startPageTranslation()
    }
  },
})

function mergeIdleStateForSite(snapshot: TranslationSnapshot, hostname: string) {
  if (snapshot.phase !== "idle") return snapshot

  return readConfig().then((config) => {
    const siteSettings = resolveSiteTranslationSettings(config, hostname)
    return {
      ...snapshot,
      targetLang: siteSettings.targetLang,
      presentation: siteSettings.presentation,
      site: createSiteSnapshot(siteSettings),
    } satisfies TranslationSnapshot
  })
}

async function handleContentCommand(
  message: ContentCommand,
): Promise<ContentCommandResponse> {
  const config = await readConfig()
  const overrides = "payload" in message ? message.payload : undefined
  const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname, overrides)
  const currentState = await mergeIdleStateForSite(getPageTranslationState(), window.location.hostname)

  switch (message.type) {
    case "content/get-translation-state":
      return { ok: true, state: currentState }

    case "content/start-translation":
      if (!siteSettings.enabled) {
        return {
          ok: false,
          error: createTranslationError("SITE_DISABLED", "Astra is disabled on this site."),
          state: {
            ...currentState,
            targetLang: siteSettings.targetLang,
            presentation: siteSettings.presentation,
            site: createSiteSnapshot(siteSettings),
          },
        }
      }
      return {
        ok: true,
        state: await startPageTranslation(message.payload),
      }

    case "content/stop-translation":
      return { ok: true, state: stopPageTranslation() }

    case "content/toggle-translation":
      if (!siteSettings.enabled && currentState.phase === "idle") {
        return {
          ok: false,
          error: createTranslationError("SITE_DISABLED", "Astra is disabled on this site."),
          state: {
            ...currentState,
            targetLang: siteSettings.targetLang,
            presentation: siteSettings.presentation,
            site: createSiteSnapshot(siteSettings),
          },
        }
      }
      return {
        ok: true,
        state: await togglePageTranslation(message.payload),
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
    }
    .astra-mode-translation-only {
      margin-top: 0;
    }
    .astra-mode-translation-only .astra-translation-inner {
      color: inherit;
      font-size: inherit;
      line-height: inherit;
      border-left: none;
      padding-left: 0;
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
