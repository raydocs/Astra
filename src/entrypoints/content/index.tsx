import { defineContentScript, browser } from "#imports"
import {
  getPageTranslationState,
  startPageTranslation,
  stopPageTranslation,
} from "./page-translate"
import { createSPANavigationWatcher } from "./spa-navigation"
import { mountFloatBall } from "./components/FloatBall"
import { mountSelectionToolbar } from "./components/SelectionToolbar"
import { mountHoverTranslate } from "./components/HoverTranslate"
import { mountInputTranslate } from "./components/InputTranslate"
import { translatePageSubtitles, removeTranslatedSubtitles } from "./subtitle-translate"
import {
  isVideoPage,
  startVideoSubtitleTranslation,
  stopVideoSubtitleTranslation,
  setupVideoNavigationHandler,
} from "./video-platforms"
import { detectAndShowPdfBanner } from "./pdf-detect"
import { isTopFrame } from "./frame-context"
import {
  isContentCommand,
  isContentStudyContextCommand,
  type ContentCommand,
  type ContentCommandResponse,
  type ContentStudyContextResponse,
} from "@/types/messages"
import {
  createSiteSnapshot,
  createTranslationError,
  type TranslationSnapshot,
} from "@/types/translation"
import { readConfig } from "@/utils/storage/config"
import { buildInlineTranslationContext } from "./translation-context"
import {
  hasResolvedProviderAccess,
  resolveManagedProviderConfig,
  resolveSiteTranslationSettings,
} from "@/types/config"
import { readAstraSession } from "@/utils/storage/auth"

let siteUiMounted = false
let inputUiMounted = false
let stylesInjected = false
let autoTranslateSuppressedForPage = false
let lastAutomationState = {
  enabled: false,
  alwaysTranslate: false,
  providerReady: false,
}
let lastProviderSnapshot: string | null = null
let lastTranslationSettingsSnapshot: string | null = null
let storageChangeGeneration = 0
let reconcileGeneration = 0
let providerHotSwitchGeneration = 0
const spaWatcher = createSPANavigationWatcher()
let spaRestartTimer: ReturnType<typeof setTimeout> | null = null

export function __resetContentEntrypointForTests() {
  siteUiMounted = false
  inputUiMounted = false
  stylesInjected = false
  autoTranslateSuppressedForPage = false
  lastAutomationState = {
    enabled: false,
    alwaysTranslate: false,
    providerReady: false,
  }
  lastProviderSnapshot = null
  lastTranslationSettingsSnapshot = null
  storageChangeGeneration = 0
  reconcileGeneration = 0
  providerHotSwitchGeneration = 0
  spaWatcher.stop()
  if (spaRestartTimer !== null) {
    clearTimeout(spaRestartTimer)
    spaRestartTimer = null
  }
}

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

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (isContentCommand(message)) {
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
      }

      if (isContentStudyContextCommand(message)) {
        void handleStudyContextCommand()
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              ok: false,
              error: {
                code: "UNKNOWN",
                message: error instanceof Error ? error.message : "Unexpected content error.",
              },
            } satisfies ContentStudyContextResponse)
          })

        return true
      }

      return
    })

    browser.storage.onChanged?.addListener((_changes, areaName) => {
      if (areaName !== "local") return
      void handleStorageChange()
    })

    const [config, session] = await Promise.all([
      readConfig(),
      readAstraSession(),
    ])
    await reconcileSiteAutomation(config, session)

    // PDF auto-detect: show banner for PDF pages
    if (isTopFrame()) {
      detectAndShowPdfBanner()

      // SPA navigation: auto-restart translation on significant URL changes
      spaWatcher.start((_prevUrl, _newUrl) => {
        const state = getPageTranslationState()
        if (state.phase !== "idle") {
          stopPageTranslation()
          removeTranslatedSubtitles()
          if (isVideoPage()) {
            stopVideoSubtitleTranslation()
          }
          if (spaRestartTimer !== null) {
            clearTimeout(spaRestartTimer)
          }
          spaRestartTimer = setTimeout(() => {
            spaRestartTimer = null
            void startTranslationForCurrentSettings()
          }, 500)
        }
      })
    }

    // Initialize effective provider snapshot for hot-switch detection
    lastProviderSnapshot = buildProviderSnapshot(config, session)
  },
})

function buildTranslationSettingsSnapshot(siteSettings: ReturnType<typeof resolveSiteTranslationSettings>): string {
  const selectors = normalizeSelectorList(siteSettings.selectors) ?? []
  const excludeSelectors = normalizeSelectorList(siteSettings.excludeSelectors) ?? []

  return JSON.stringify({
    enabled: siteSettings.enabled,
    targetLang: siteSettings.targetLang,
    contentScope: siteSettings.contentScope,
    presentationMode: siteSettings.presentation.mode,
    presentationTheme: siteSettings.presentation.theme,
    selectors,
    excludeSelectors,
    paragraphMinLength: siteSettings.paragraphMinLength ?? null,
  })
}

function normalizeSelectorList(selectors?: string[]): string[] | undefined {
  if (!selectors) return undefined

  const normalized = [...new Set(
    selectors
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0),
  )].sort((left, right) => left.localeCompare(right))

  return normalized.length > 0 ? normalized : undefined
}

function buildTranslationStartOverrides(
  siteSettings: ReturnType<typeof resolveSiteTranslationSettings>,
) {
  return {
    targetLang: siteSettings.targetLang,
    contentScope: siteSettings.contentScope,
    translationMode: siteSettings.presentation.mode,
    translationTheme: siteSettings.presentation.theme,
    selectors: normalizeSelectorList(siteSettings.selectors),
    excludeSelectors: normalizeSelectorList(siteSettings.excludeSelectors),
    paragraphMinLength: siteSettings.paragraphMinLength,
  }
}

function buildProviderSnapshot(
  config: Awaited<ReturnType<typeof readConfig>>,
  session: Awaited<ReturnType<typeof readAstraSession>>,
) {
  const provider = resolveManagedProviderConfig(config.provider, session)
  return JSON.stringify({
    id: provider.id ?? null,
    apiKey: (provider.apiKey ?? "").trim(),
    accessToken: (provider.accessToken ?? "").trim(),
    relayBaseURL: provider.relayBaseURL?.trim() ?? "",
    model: (provider.model ?? "").trim(),
  })
}

async function startTranslationForCurrentSettings(
  configOverride?: Awaited<ReturnType<typeof readConfig>>,
  sessionOverride?: Awaited<ReturnType<typeof readAstraSession>>,
) {
  const [config, session] = await Promise.all([
    configOverride ? Promise.resolve(configOverride) : readConfig(),
    sessionOverride !== undefined ? Promise.resolve(sessionOverride) : readAstraSession(),
  ])

  if (!hasResolvedProviderAccess(config.provider, session)) {
    return false
  }

  const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname)
  if (!siteSettings.enabled) {
    return false
  }

  await startPageTranslation(buildTranslationStartOverrides(siteSettings))
  if (isVideoPage()) {
    void startVideoSubtitleTranslation()
  }

  return true
}

async function handleStorageChange() {
  const generation = ++storageChangeGeneration
  const [config, session] = await Promise.all([
    readConfig(),
    readAstraSession(),
  ])

  if (generation !== storageChangeGeneration) {
    return
  }

  const reconcileResult = await reconcileSiteAutomation(config, session)
  if (generation !== storageChangeGeneration) {
    return
  }

  await handleProviderHotSwitch(config, session, {
    activeSessionHandled: reconcileResult.activeSessionHandled,
  })
}

async function reconcileSiteAutomation(
  configOverride?: Awaited<ReturnType<typeof readConfig>>,
  sessionOverride?: Awaited<ReturnType<typeof readAstraSession>>,
): Promise<{ activeSessionHandled: boolean }> {
  const generation = ++reconcileGeneration
  const [config, session] = configOverride && sessionOverride !== undefined
    ? [configOverride, sessionOverride]
    : await Promise.all([
        configOverride ? Promise.resolve(configOverride) : readConfig(),
        sessionOverride !== undefined ? Promise.resolve(sessionOverride) : readAstraSession(),
      ])

  if (generation !== reconcileGeneration) {
    return { activeSessionHandled: false }
  }

  const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname)
  const providerReady = hasResolvedProviderAccess(config.provider, session)
  const currentState = getPageTranslationState()
  let activeSessionHandled = false
  const translationSettingsSnapshot = buildTranslationSettingsSnapshot(siteSettings)
  const translationSettingsChanged = lastTranslationSettingsSnapshot !== null
    && translationSettingsSnapshot !== lastTranslationSettingsSnapshot
  const automationEligible = siteSettings.enabled && siteSettings.alwaysTranslate && providerReady
  const previousAutomationEligible = lastAutomationState.enabled
    && lastAutomationState.alwaysTranslate
    && lastAutomationState.providerReady

  if (automationEligible && !previousAutomationEligible) {
    autoTranslateSuppressedForPage = false
  }

  if (siteSettings.enabled) {
    ensureSiteUiMounted(config)
  }

  if (!siteSettings.enabled || !providerReady) {
    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    if (currentState.phase !== "idle") {
      stopPageTranslation()
      removeTranslatedSubtitles()
      if (isVideoPage()) {
        stopVideoSubtitleTranslation()
      }
      activeSessionHandled = true
    }

    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    lastAutomationState = {
      enabled: siteSettings.enabled,
      alwaysTranslate: siteSettings.alwaysTranslate,
      providerReady,
    }
    lastTranslationSettingsSnapshot = translationSettingsSnapshot
    return { activeSessionHandled }
  }

  if (currentState.phase !== "idle" && translationSettingsChanged && !autoTranslateSuppressedForPage) {
    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    stopPageTranslation()
    removeTranslatedSubtitles()
    if (isVideoPage()) {
      stopVideoSubtitleTranslation()
    }
    activeSessionHandled = true

    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    await startPageTranslation(buildTranslationStartOverrides(siteSettings))
    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }
    if (isVideoPage()) {
      void startVideoSubtitleTranslation()
    }
  }

  if (siteSettings.alwaysTranslate && currentState.phase === "idle" && !autoTranslateSuppressedForPage) {
    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    await startPageTranslation(buildTranslationStartOverrides(siteSettings))
    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }
    if (isVideoPage()) {
      void startVideoSubtitleTranslation()
    }
  }

  if (generation !== reconcileGeneration) {
    return { activeSessionHandled: false }
  }

  lastAutomationState = {
    enabled: siteSettings.enabled,
    alwaysTranslate: siteSettings.alwaysTranslate,
    providerReady,
  }
  lastTranslationSettingsSnapshot = translationSettingsSnapshot
  return { activeSessionHandled }
}

async function handleProviderHotSwitch(
  config: Awaited<ReturnType<typeof readConfig>>,
  session: Awaited<ReturnType<typeof readAstraSession>>,
  options: { activeSessionHandled?: boolean } = {},
) {
  const generation = ++providerHotSwitchGeneration
  if (generation !== providerHotSwitchGeneration) return

  const currentProviderSnapshot = buildProviderSnapshot(config, session)
  const previousProviderSnapshot = lastProviderSnapshot
  lastProviderSnapshot = currentProviderSnapshot

  if (previousProviderSnapshot === null || currentProviderSnapshot === previousProviderSnapshot) {
    return
  }

  if (options.activeSessionHandled) {
    return
  }

  const state = getPageTranslationState()
  if (state.phase === "idle") {
    return
  }

  const providerReady = hasResolvedProviderAccess(config.provider, session)
  if (!providerReady) {
    return
  }

  const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname)
  if (!siteSettings.enabled) {
    return
  }

  stopPageTranslation()
  removeTranslatedSubtitles()
  if (isVideoPage()) {
    stopVideoSubtitleTranslation()
  }

  if (generation !== providerHotSwitchGeneration) return

  await startPageTranslation(buildTranslationStartOverrides(siteSettings))
  if (generation !== providerHotSwitchGeneration) return

  if (isVideoPage()) {
    void startVideoSubtitleTranslation()
  }
}

function ensureSiteUiMounted(config: Awaited<ReturnType<typeof readConfig>>) {
  injectStyles()

  if (!siteUiMounted) {
    mountSelectionToolbar()
    mountHoverTranslate()

    if (isTopFrame()) {
      mountFloatBall()
      setupVideoNavigationHandler()
    }

    siteUiMounted = true
  }

  if (!inputUiMounted && config.inputTranslation !== "disabled") {
    mountInputTranslate()
    inputUiMounted = true
  }
}

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
      autoTranslateSuppressedForPage = false
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
      {
        const state = await startPageTranslation(message.payload)
        void translatePageSubtitles()
        if (isVideoPage()) void startVideoSubtitleTranslation()
        return { ok: true, state }
      }

    case "content/stop-translation":
      autoTranslateSuppressedForPage = true
      removeTranslatedSubtitles()
      stopVideoSubtitleTranslation()
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

      if (currentState.phase === "idle") {
        autoTranslateSuppressedForPage = false
        const state = await startPageTranslation(message.payload)
        void translatePageSubtitles()
        if (isVideoPage()) void startVideoSubtitleTranslation()
        return {
          ok: true,
          state,
        }
      }

      autoTranslateSuppressedForPage = true
      removeTranslatedSubtitles()
      stopVideoSubtitleTranslation()
      return {
        ok: true,
        state: stopPageTranslation(),
      }
  }
}

async function handleStudyContextCommand(): Promise<ContentStudyContextResponse> {
  return {
    ok: true,
    context: await buildInlineTranslationContext(),
  }
}

function injectStyles() {
  if (stylesInjected) return
  stylesInjected = true

  const style = document.createElement("style")
  style.dataset.astraContentStyles = "1"
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
      user-select: text;
      -webkit-user-select: text;
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
    .astra-translation[data-astra-collapsed] .astra-translation-inner {
      opacity: 0.2;
      text-decoration: line-through;
      text-decoration-color: #94a3b8;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .astra-translation:not([data-astra-collapsed]) .astra-translation-inner {
      cursor: pointer;
      transition: opacity 0.2s ease;
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
