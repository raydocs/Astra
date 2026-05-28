import "@/utils/zod-config"
import { defineContentScript, browser } from "#imports"
import {
  getPageTranslationState,
  retryFailedBlocks,
  startPageTranslation,
  stopPageTranslation,
} from "./page-translate"
import { createSPANavigationWatcher } from "./spa-navigation"
import { mountFloatBall } from "./components/FloatBall"
import { mountSelectionToolbar } from "./components/SelectionToolbar"
import { mountHoverTranslate } from "./components/HoverTranslate"
import { mountInputTranslate } from "./components/InputTranslate"
import { mountPageAnnotations, renderPageAnnotations } from "./page-annotations"
import { isHoverCapable } from "@/utils/ui/useViewportProfile"
import { translatePageSubtitles, removeTranslatedSubtitles } from "./subtitle-translate"
import {
  captureCurrentVideoNoteSource,
  getVideoSubtitleQualitySnapshot,
  isVideoPage,
  isVideoSubtitleTranslationActive,
  startVideoSubtitleTranslation,
  stopVideoSubtitleTranslation,
  setupVideoNavigationHandler,
} from "./video-platforms"
import { detectAndShowPdfBanner } from "./pdf-detect"
import {
  getMeetingCaptionQualitySnapshot,
  isMeetingCaptionTranslationActive,
  isMeetingPage,
  startMeetingCaptionTranslation,
  stopMeetingCaptionTranslation,
} from "./meeting-captions"
import { extractTextFromImage, isOcrFeatureEnabled } from "@/utils/ocr/image-text"
import { IMAGE_TRANSLATION_MAX_FILE_BYTES } from "@/utils/ocr/image-translation"
import { isTopFrame } from "./frame-context"
import {
  isContentCommand,
  isContentVideoNoteSourceCommand,
  isContentStudyContextCommand,
  isContentDetectArticleCommand,
  type ContentCommand,
  type ContentCommandResponse,
  type ContentStudyContextResponse,
  type ContentVideoNoteSourceResponse,
  type ContentDetectArticleResponse,
} from "@/types/messages"
import { findContentRoot } from "@/utils/dom/traversal"
import {
  createSiteSnapshot,
  createTranslationError,
  type TranslationSnapshot,
} from "@/types/translation"
import { readConfig } from "@/utils/storage/config"
import { getDueVocabularyCount, saveVocabularyEntry } from "@/utils/storage/vocabulary"
import { copyTextToClipboard } from "@/utils/dom/clipboard"
import { commitLearningContinuitySync } from "@/utils/extension/messages"
import { buildPageStudyContext } from "./translation-context"
import {
  hasResolvedSiteProviderAccess,
  resolveSiteProviderConfig,
  resolveSiteTranslationSettings,
} from "@/types/config"
import { readAstraSession } from "@/utils/storage/auth"
import { runActionById } from "./inline-actions"
import { markSessionSave } from "./learning-state"
import {
  doesPageAccessChangeAffectUrl,
  isPageAccessAllowedByPolicyValue,
  isPageAccessAllowedForUrl,
  isPageAccessChangeMessage,
  PAGE_ACCESS_POLICY_STORAGE_KEY,
} from "@/utils/extension/page-permissions"

let siteUiMounted = false
let inputUiMounted = false
let stylesInjected = false
let customCssElement: HTMLStyleElement | null = null
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
let pageAccessChangeGeneration = 0
let pageAccessAllowedForCurrentUrl = true
const spaWatcher = createSPANavigationWatcher()
let spaRestartTimer: ReturnType<typeof setTimeout> | null = null

export function __resetContentEntrypointForTests() {
  siteUiMounted = false
  inputUiMounted = false
  stylesInjected = false
  removeCustomCss()
  stopMeetingCaptionTranslation()
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
  pageAccessChangeGeneration = 0
  pageAccessAllowedForCurrentUrl = true
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
    pageAccessAllowedForCurrentUrl = await isPageAccessAllowedForUrl(window.location.href)

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

      if (isPageAccessChangeMessage(message)) {
        if (doesPageAccessChangeAffectUrl(message, window.location.href)) {
          void handlePageAccessChange()
        }
        sendResponse({ ok: true })
        return false
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

      if (isContentDetectArticleCommand(message)) {
        const root = findContentRoot(document)
        const selector = buildSelectorForElement(root)
        sendResponse({ ok: true, selector } satisfies ContentDetectArticleResponse)
        return true
      }

      if (isContentVideoNoteSourceCommand(message)) {
        void handleVideoNoteSourceCommand()
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              ok: false,
              error: {
                code: "UNKNOWN",
                message: error instanceof Error ? error.message : "Unexpected content error.",
              },
            } satisfies ContentVideoNoteSourceResponse)
          })
        return true
      }

      if (isCaptureImageMessage(message)) {
        void handleCaptureImageMessage(message.payload.imageUrl)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : "Unexpected image capture error.",
            } satisfies CaptureImageResponse)
          })
        return true
      }

      if (isTranslateImageMessage(message)) {
        void handleTranslateImageMessage(message.payload.imageUrl)
        return false
      }

      return
    })

    browser.storage.onChanged?.addListener((changes, areaName) => {
      if (areaName !== "local") return
      if (PAGE_ACCESS_POLICY_STORAGE_KEY in changes) {
        pageAccessAllowedForCurrentUrl = isPageAccessAllowedByPolicyValue(
          window.location.href,
          changes[PAGE_ACCESS_POLICY_STORAGE_KEY]?.newValue,
        )
        void handlePageAccessChange()
        return
      }
      void handleStorageChange()
    })

    const [config, session] = await Promise.all([
      readConfig(),
      readAstraSession(),
    ])
    try {
      await reconcileSiteAutomation(config, session)
    } catch (error) {
      // Auto-start / hot paths must not prevent mounting UI or message handling.
      console.error("[Astra] reconcileSiteAutomation failed", error)
      const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname)
      if (siteSettings.enabled) {
        ensureSiteUiMounted(config)
      }
    }

    // PDF auto-detect: show banner for PDF pages
    if (isTopFrame()) {
      detectAndShowPdfBanner()

      // SPA navigation: auto-restart translation on significant URL changes
      spaWatcher.start(() => {
        void renderPageAnnotations()
        const state = getPageTranslationState()
        if (state.phase !== "idle") {
          stopPageTranslation()
          removeTranslatedSubtitles()
          if (isVideoPage()) {
            stopVideoSubtitleTranslation()
          }
          stopMeetingCaptionTranslation()
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

    // Meeting caption auto-detect (Google Meet, Zoom) — gated by site enabled + provider access
    if (isTopFrame() && isMeetingPage()) {
      const meetingSiteSettings = resolveSiteTranslationSettings(config, window.location.hostname)
      if (meetingSiteSettings.enabled && hasResolvedSiteProviderAccess(config, window.location.hostname, session)) {
        void startMeetingCaptionTranslation()
      }
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
    presentationFontSize: siteSettings.presentation.fontSize,
    presentationTranslationColor: siteSettings.presentation.translationColor,
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
  const provider = resolveSiteProviderConfig(config, window.location.hostname, session)
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
  if (!pageAccessAllowedForCurrentUrl) {
    return false
  }

  const [config, session] = await Promise.all([
    configOverride ? Promise.resolve(configOverride) : readConfig(),
    sessionOverride !== undefined ? Promise.resolve(sessionOverride) : readAstraSession(),
  ])

  if (!hasResolvedSiteProviderAccess(config, window.location.hostname, session)) {
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
  if (isMeetingPage()) {
    void startMeetingCaptionTranslation()
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

  let reconcileResult: { activeSessionHandled: boolean } = { activeSessionHandled: false }
  try {
    reconcileResult = await reconcileSiteAutomation(config, session)
  } catch (error) {
    console.error("[Astra] reconcileSiteAutomation failed (storage)", error)
    const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname)
    if (siteSettings.enabled) {
      ensureSiteUiMounted(config)
    }
  }
  if (generation !== storageChangeGeneration) {
    return
  }

  await handleProviderHotSwitch(config, session, {
    activeSessionHandled: reconcileResult.activeSessionHandled,
  })
}

async function handlePageAccessChange() {
  const generation = ++pageAccessChangeGeneration
  pageAccessAllowedForCurrentUrl = await isPageAccessAllowedForUrl(window.location.href)
  if (pageAccessAllowedForCurrentUrl) {
    const [config, session] = await Promise.all([
      readConfig(),
      readAstraSession(),
    ])
    if (generation !== pageAccessChangeGeneration) return
    await reconcileSiteAutomation(config, session)
    return
  }

  if (generation !== pageAccessChangeGeneration) return
  removeCustomCss()
  const state = getPageTranslationState()
  if (state.phase !== "idle") {
    stopPageTranslation()
    removeTranslatedSubtitles()
  }
  if (isVideoPage()) {
    stopVideoSubtitleTranslation()
  }
  stopMeetingCaptionTranslation()
  autoTranslateSuppressedForPage = true
  lastAutomationState = {
    enabled: false,
    alwaysTranslate: false,
    providerReady: false,
  }
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
  const accessAllowed = pageAccessAllowedForCurrentUrl
  const providerReady = accessAllowed && hasResolvedSiteProviderAccess(config, window.location.hostname, session)
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
    if (accessAllowed && siteSettings.customCss) {
      injectCustomCss(siteSettings.customCss)
    } else {
      removeCustomCss()
    }
  } else {
    removeCustomCss()
  }

  if (!accessAllowed || !siteSettings.enabled || !providerReady) {
    if (!accessAllowed || !siteSettings.enabled) {
      removeCustomCss()
    }

    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    if (currentState.phase !== "idle") {
      stopPageTranslation()
      removeTranslatedSubtitles()
      if (isVideoPage()) {
        stopVideoSubtitleTranslation()
      }
      stopMeetingCaptionTranslation()
      activeSessionHandled = true
    }

    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    lastAutomationState = {
      enabled: accessAllowed && siteSettings.enabled,
      alwaysTranslate: accessAllowed && siteSettings.alwaysTranslate,
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
    stopMeetingCaptionTranslation()
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
    if (isMeetingPage()) {
      void startMeetingCaptionTranslation()
    }
  }

  if (currentState.phase === "idle" && translationSettingsChanged && !autoTranslateSuppressedForPage) {
    if (generation !== reconcileGeneration) {
      return { activeSessionHandled: false }
    }

    if (isVideoPage() && isVideoSubtitleTranslationActive()) {
      stopVideoSubtitleTranslation()
      void startVideoSubtitleTranslation()
      activeSessionHandled = true
    }

    if (isMeetingPage() && isMeetingCaptionTranslationActive()) {
      stopMeetingCaptionTranslation()
      void startMeetingCaptionTranslation()
      activeSessionHandled = true
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
    if (isMeetingPage()) {
      void startMeetingCaptionTranslation()
    }
  }

  if (generation !== reconcileGeneration) {
    return { activeSessionHandled: false }
  }

  lastAutomationState = {
    enabled: accessAllowed && siteSettings.enabled,
    alwaysTranslate: accessAllowed && siteSettings.alwaysTranslate,
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

  const providerReady = hasResolvedSiteProviderAccess(config, window.location.hostname, session)
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
  stopMeetingCaptionTranslation()

  if (generation !== providerHotSwitchGeneration) return

  await startPageTranslation(buildTranslationStartOverrides(siteSettings))
  if (generation !== providerHotSwitchGeneration) return

  if (isVideoPage()) {
    void startVideoSubtitleTranslation()
  }
  if (isMeetingPage()) {
    void startMeetingCaptionTranslation()
  }
}

function ensureSiteUiMounted(config: Awaited<ReturnType<typeof readConfig>>) {
  injectStyles()

  if (!siteUiMounted) {
    mountSelectionToolbar()
    mountPageAnnotations()
    // Only mount hover translation on devices with fine pointer (not touch-primary)
    if (isHoverCapable()) {
      mountHoverTranslate()
    }

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

function getActiveSubtitleQualitySnapshot() {
  try {
    return getVideoSubtitleQualitySnapshot() ?? getMeetingCaptionQualitySnapshot()
  } catch {
    return null
  }
}

function attachSubtitleQuality(snapshot: TranslationSnapshot): TranslationSnapshot {
  const subtitleQuality = getActiveSubtitleQualitySnapshot()
  return subtitleQuality ? { ...snapshot, subtitleQuality } : snapshot
}

function getSelectionCommandContext(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  return normalized.length > 500 ? `${normalized.slice(0, 500).trim()}…` : normalized
}

async function handleContentCommand(
  message: ContentCommand,
): Promise<ContentCommandResponse> {
  const config = await readConfig()
  if (!pageAccessAllowedForCurrentUrl) {
    const currentState = attachSubtitleQuality(
      await mergeIdleStateForSite(getPageTranslationState(), window.location.hostname),
    )
    return {
      ok: false,
      error: createTranslationError("SITE_DISABLED", "Astra page access is revoked for this site."),
      state: currentState,
    }
  }

  const overrides = message.type === "content/start-translation" || message.type === "content/toggle-translation"
    ? message.payload
    : undefined
  const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname, overrides)
  const currentState = attachSubtitleQuality(
    await mergeIdleStateForSite(getPageTranslationState(), window.location.hostname),
  )

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
      stopMeetingCaptionTranslation()
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
      stopMeetingCaptionTranslation()
      return {
        ok: true,
        state: stopPageTranslation(),
      }

    case "content/retry-failed":
      retryFailedBlocks()
      return { ok: true, state: attachSubtitleQuality(getPageTranslationState()) }

    case "content/run-selection-action": {
      if (!siteSettings.enabled) {
        return {
          ok: false,
          error: createTranslationError("SITE_DISABLED", "Astra is disabled on this site."),
          state: currentState,
        }
      }
      const selectedText = message.payload.text.trim()
      const result = await runActionById({
        actionId: message.payload.actionId,
        text: selectedText,
        targetLang: siteSettings.targetLang,
        languageLevel: config.languageLevel,
        explainMode: config.explainMode,
        serviceMode: config.serviceMode,
        explanationGlossary: config.explanationGlossary,
        selectionContext: getSelectionCommandContext(selectedText),
        customActions: config.customActions,
      })

      if (!result.ok) {
        return {
          ok: false,
          error: createTranslationError("UNKNOWN", result.message),
          state: currentState,
        }
      }

      await copyTextToClipboard(result.text)
      return { ok: true, state: attachSubtitleQuality(getPageTranslationState()) }
    }

    case "content/save-selection": {
      if (!siteSettings.enabled) {
        return {
          ok: false,
          error: createTranslationError("SITE_DISABLED", "Astra is disabled on this site."),
          state: currentState,
        }
      }
      const selectedText = message.payload.text.trim()
      await saveVocabularyEntry({
        text: selectedText,
        url: window.location.href,
        context: getSelectionCommandContext(selectedText),
        sourceContext: {
          surface: "selection_toolbar",
          pageTitle: document.title?.trim() || undefined,
          pageUrl: window.location.href,
          sentenceText: selectedText,
          languageLevel: config.languageLevel,
          explainMode: config.explainMode,
        },
      })
      const nextDueCount = await getDueVocabularyCount().catch(() => null)
      markSessionSave("selection_toolbar", nextDueCount)
      void commitLearningContinuitySync("selection-save")
      return { ok: true, state: attachSubtitleQuality(getPageTranslationState()) }
    }

    default:
      return { ok: true, state: currentState }
  }
}

async function handleStudyContextCommand(): Promise<ContentStudyContextResponse> {
  return {
    ok: true,
    context: await buildPageStudyContext(),
  }
}

async function handleVideoNoteSourceCommand(): Promise<ContentVideoNoteSourceResponse> {
  const source = await captureCurrentVideoNoteSource()
  if (!source) {
    return {
      ok: false,
      error: createTranslationError("CONTENT_UNAVAILABLE", "No supported current video source was detected on this page."),
    }
  }

  return {
    ok: true,
    source,
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
      margin-top: 0.45em;
    }
    .astra-translation-error {
      display: block;
      margin-top: 0.5em;
      padding: 0.22rem 0 0.24rem 0.72rem;
      border-left: 1.5px solid rgba(141, 112, 80, 0.42);
      color: color-mix(in srgb, currentColor 58%, transparent);
      font-family: "Source Serif 4", "Source Serif Pro", "Tiempos Text", "Songti SC", "Noto Serif SC", Georgia, serif;
      font-size: 0.88rem;
      font-style: italic;
      line-height: 1.45;
    }
    .astra-translation-error-text {
      margin-right: 0.72em;
    }
    .astra-translation-error-retry {
      appearance: none;
      border: 0;
      background: transparent;
      color: color-mix(in srgb, currentColor 82%, transparent);
      border-radius: 999px;
      padding: 0.08em 0.18em;
      font-family: "Inter Tight", "Söhne", "Helvetica Neue", system-ui, sans-serif;
      font-size: 0.82rem;
      font-style: normal;
      line-height: 1.2;
      cursor: pointer;
    }
    .astra-translation-error-retry:hover {
      background: color-mix(in srgb, currentColor 8%, transparent);
    }
    .astra-translation-error-retry:focus-visible {
      outline: 2px solid rgba(196, 99, 58, 0.45);
      outline-offset: 2px;
    }
    .astra-source[data-astra-source-hidden] {
      display: none !important;
    }
    .astra-translation-inner {
      color: color-mix(in srgb, currentColor 62%, transparent);
      font-family: "Source Serif 4", "Source Serif Pro", "Tiempos Text", "Songti SC", "Noto Serif SC", Georgia, serif;
      font-size: 0.94em;
      font-style: italic;
      line-height: 1.62;
      border-left: 2px solid rgba(196, 99, 58, 0.52);
      padding-left: 0.72em;
      display: block;
      user-select: text;
      -webkit-user-select: text;
    }
    .astra-mode-translation-only {
      margin-top: 0;
    }
    .astra-mode-translation-only .astra-translation-inner {
      color: inherit;
      font-family: inherit;
      font-size: inherit;
      font-style: inherit;
      line-height: inherit;
      border-left: none;
      padding-left: 0;
    }
    .astra-theme-underline .astra-translation-inner {
      border-left: none;
      padding-left: 0;
      text-decoration: underline;
      text-decoration-color: rgba(196, 99, 58, 0.72);
      text-underline-offset: 2px;
    }
    .astra-theme-highlight .astra-translation-inner {
      border-left: none;
      padding-left: 0;
      background: rgba(196, 99, 58, 0.10);
      padding: 2px 4px;
      border-radius: 3px;
    }
    .astra-theme-mask .astra-translation-inner {
      border-left: none;
      padding-left: 0;
      background: rgba(15, 23, 42, 0.08);
      padding: 2px 4px;
      border-radius: 4px;
      filter: blur(4px);
      opacity: 0.72;
      transition: filter 0.18s ease, opacity 0.18s ease;
    }
    .astra-theme-mask:hover .astra-translation-inner,
    .astra-theme-mask:focus-within .astra-translation-inner {
      filter: none;
      opacity: 1;
    }
    .astra-translation[data-astra-collapsed] .astra-translation-inner {
      opacity: 0.2;
      text-decoration: line-through;
      text-decoration-color: var(--astra-text-hint);
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .astra-translation:not([data-astra-collapsed]) .astra-translation-inner {
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .astra-loading .astra-translation-inner {
      border-left-style: dashed;
      border-left-color: rgba(141, 112, 80, 0.34);
      color: color-mix(in srgb, currentColor 42%, transparent);
    }
    .astra-loading-lines {
      display: flex;
      flex-direction: column;
      gap: 0.42em;
      width: min(40rem, 96%);
      padding: 0.08em 0 0.04em;
    }
    .astra-loading-line {
      display: block;
      height: 0.54em;
      border-radius: 999px;
      background: rgba(141, 112, 80, 0.26);
      animation: astra-pulse 1.5s ease-in-out infinite;
    }
    .astra-loading-line-long { width: 100%; }
    .astra-loading-line-medium { width: 92%; }
    .astra-loading-line-short { width: 43%; }
    .astra-loading-dots {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      opacity: 0;
    }
    @keyframes astra-pulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `
  document.head.appendChild(style)
}

function injectCustomCss(css: string): void {
  removeCustomCss()
  if (!css.trim()) return
  const el = document.createElement("style")
  el.dataset.astraCustomCss = "1"
  el.textContent = css
  document.head.appendChild(el)
  customCssElement = el
}

function removeCustomCss(): void {
  if (customCssElement) {
    customCssElement.remove()
    customCssElement = null
  }
}

function buildSelectorForElement(el: HTMLElement): string | undefined {
  if (el === document.body) return undefined

  if (el.id) return `#${CSS.escape(el.id)}`

  const tag = el.tagName.toLowerCase()
  if (["article", "main"].includes(tag)) return tag

  const role = el.getAttribute("role")
  if (role === "main") return `[role="main"]`

  const canEscape = typeof CSS !== "undefined" && typeof CSS.escape === "function"
  const specialCharsPattern = /[:#./[\]()>+~,\\@!$%^&*=|?{}'"` ]/

  for (const cls of Array.from(el.classList)) {
    if (!canEscape && specialCharsPattern.test(cls)) continue

    const escaped = canEscape ? CSS.escape(cls) : cls
    if (document.querySelectorAll(`.${escaped}`).length === 1) {
      return `.${escaped}`
    }
  }

  return tag
}

// --- Image translation overlay ---

interface CapturedImagePayload {
  dataUrl: string
  mimeType: string
  fileName?: string
  byteLength?: number
}

type CaptureImageResponse =
  | { ok: true; capture: CapturedImagePayload }
  | { ok: false; error: string }

interface CaptureImageMessage {
  type: "content/capture-image"
  payload: { imageUrl: string }
}

interface TranslateImageMessage {
  type: "content/translate-image"
  payload: { imageUrl: string }
}

function isCaptureImageMessage(value: unknown): value is CaptureImageMessage {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { type?: string; payload?: { imageUrl?: string } }
  return candidate.type === "content/capture-image"
    && typeof candidate.payload?.imageUrl === "string"
    && candidate.payload.imageUrl.length > 0
}

function isTranslateImageMessage(value: unknown): value is TranslateImageMessage {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as { type?: string; payload?: { imageUrl?: string } }
  return candidate.type === "content/translate-image"
    && typeof candidate.payload?.imageUrl === "string"
}

function findImageElementForCapture(imageUrl: string): HTMLImageElement | null {
  const images = Array.from(document.images)
  return images.find((image) => {
    const candidates = [image.currentSrc, image.src, image.getAttribute("src")]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
    return candidates.some((candidate) => {
      if (candidate === imageUrl) return true
      try {
        return new URL(candidate, document.baseURI).href === imageUrl
      } catch {
        return false
      }
    })
  }) ?? null
}

function getDataUrlMimeType(dataUrl: string): string | null {
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl)
  return match?.[1]?.toLowerCase() ?? null
}

function estimateDataUrlByteLength(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",")
  if (commaIndex < 0) return dataUrl.length
  const metadata = dataUrl.slice(0, commaIndex).toLowerCase()
  const payload = dataUrl.slice(commaIndex + 1)
  if (metadata.endsWith(";base64")) {
    return Math.ceil(payload.replace(/=+$/g, "").length * 3 / 4)
  }
  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength
  } catch {
    return payload.length
  }
}

function buildCapturedFileName(imageUrl: string, mimeType: string): string {
  const extension = mimeType === "image/svg+xml"
    ? "svg"
    : mimeType.startsWith("image/")
      ? mimeType.slice("image/".length).replace(/[^a-z0-9]+/gi, "") || "png"
      : "png"
  try {
    const pathname = new URL(imageUrl, document.baseURI).pathname
    const name = decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "")
    if (name) return name
  } catch {
    // Fall through to a stable generated name.
  }
  return `astra-captured-image.${extension}`
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(reader.error ?? new Error("Unable to encode captured image."))
    reader.readAsDataURL(blob)
  })
}

async function captureImageViaFetch(image: HTMLImageElement, imageUrl: string): Promise<CapturedImagePayload | null> {
  const sourceUrl = image.currentSrc || image.src || imageUrl
  try {
    const response = await fetch(sourceUrl, { credentials: "include", cache: "force-cache" })
    if (!response.ok) return null
    const responseType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
    if (!responseType?.startsWith("image/")) return null
    const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10)
    if (Number.isFinite(contentLength) && contentLength > IMAGE_TRANSLATION_MAX_FILE_BYTES) return null
    const blob = await response.blob()
    if (blob.size <= 0 || blob.size > IMAGE_TRANSLATION_MAX_FILE_BYTES) return null
    const dataUrl = await blobToDataUrl(blob)
    return {
      dataUrl,
      mimeType: blob.type || responseType,
      fileName: buildCapturedFileName(imageUrl, blob.type || responseType),
      byteLength: blob.size,
    }
  } catch {
    return null
  }
}

function captureImageViaCanvas(image: HTMLImageElement, imageUrl: string): CapturedImagePayload {
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) {
    throw new Error("Image is not decoded yet.")
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Canvas capture is not available.")
  }
  context.drawImage(image, 0, 0, width, height)
  const dataUrl = canvas.toDataURL("image/png")
  const mimeType = getDataUrlMimeType(dataUrl) ?? "image/png"
  const byteLength = estimateDataUrlByteLength(dataUrl)
  if (byteLength <= 0 || byteLength > IMAGE_TRANSLATION_MAX_FILE_BYTES) {
    throw new Error("Captured image is too large.")
  }
  return {
    dataUrl,
    mimeType,
    fileName: buildCapturedFileName(imageUrl, mimeType),
    byteLength,
  }
}

async function handleCaptureImageMessage(imageUrl: string): Promise<CaptureImageResponse> {
  const image = findImageElementForCapture(imageUrl)
  if (!image) {
    return { ok: false, error: "Could not find the clicked image in this frame." }
  }

  const fetchedCapture = await captureImageViaFetch(image, imageUrl)
  if (fetchedCapture) {
    return { ok: true, capture: fetchedCapture }
  }

  try {
    return { ok: true, capture: captureImageViaCanvas(image, imageUrl) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not capture the clicked image.",
    }
  }
}

async function handleTranslateImageMessage(imageUrl: string): Promise<void> {
  // Only process in the top frame to avoid duplicate handling from iframes
  if (!isTopFrame()) return

  // Respect the feature flag — bail out if the OCR feature is disabled
  if (!isOcrFeatureEnabled()) {
    console.info("[Astra] Image translation is currently disabled (feature flag).")
    return
  }

  const config = await readConfig()
  const siteSettings = resolveSiteTranslationSettings(config, window.location.hostname)
  const targetLang = siteSettings.targetLang

  // Find the image element on the page to anchor the overlay
  const imgElement = document.querySelector<HTMLImageElement>(`img[src="${CSS.escape(imageUrl)}"]`)

  let result: Awaited<ReturnType<typeof extractTextFromImage>>
  try {
    result = await extractTextFromImage(imageUrl, targetLang, config.serviceMode)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unexpected error during image text extraction."
    console.warn("[Astra] Image text extraction threw:", errorMessage)
    showImageTranslationOverlay(`[Error] ${errorMessage}`, imgElement)
    return
  }

  if (!result.ok) {
    console.warn("[Astra] Image text extraction failed:", result.message)
    showImageTranslationOverlay(`[Error] ${result.message}`, imgElement)
    return
  }

  showImageTranslationOverlay(result.text, imgElement)
}

function showImageTranslationOverlay(
  translatedText: string,
  anchorImage: HTMLImageElement | null,
): void {
  // Remove any existing overlay
  document.querySelectorAll(".astra-image-overlay").forEach((el) => el.remove())

  const overlay = document.createElement("div")
  overlay.className = "astra-image-overlay"
  overlay.textContent = translatedText

  const style = overlay.style
  style.position = "absolute"
  style.zIndex = "2147483647"
  style.background = "rgba(0, 0, 0, 0.85)"
  style.color = "#fff"
  style.padding = "10px 14px"
  style.borderRadius = "6px"
  style.fontSize = "13px"
  style.lineHeight = "1.5"
  style.maxWidth = "400px"
  style.whiteSpace = "pre-wrap"
  style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)"
  style.pointerEvents = "auto"
  style.cursor = "pointer"

  overlay.addEventListener("click", () => {
    overlay.remove()
  })

  if (anchorImage) {
    const rect = anchorImage.getBoundingClientRect()
    style.top = `${window.scrollY + rect.bottom + 4}px`
    style.left = `${window.scrollX + rect.left}px`
  } else {
    style.top = "20px"
    style.right = "20px"
  }

  document.body.appendChild(overlay)

  // Auto-remove after 30 seconds
  setTimeout(() => {
    overlay.remove()
  }, 30_000)
}
