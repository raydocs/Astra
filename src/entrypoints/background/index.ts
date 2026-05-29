import "@/utils/zod-config"
import { defineBackground, browser } from "#imports"
import {
  isContentVideoNoteSourceResponse,
  isRuntimeCurrentTabCommandRequest,
  isRuntimeLearningContinuitySyncRequest,
  isRuntimeLearningContinuitySyncStatusRequest,
  isRuntimeSaveConfigRequest,
  isRuntimeTabCommandRequest,
  isRuntimeTranslateBatchRequest,
  isRuntimeTranslationCacheStatsRequest,
  isRuntimeVideoNoteCreateFromCurrentTabRequest,
  isRuntimeVideoNoteGetJobRequest,
  type ContentVideoNoteSourceResponse,
  type ContentCommandResponse,
  type LearningContinuitySyncResult,
  type LearningContinuitySyncStatus,
  type RuntimeTranslateBatchRequest,
  type RuntimeResponse,
} from "@/types/messages"
import { executeTabCommand, initializeFrameCoordinator } from "./frame-coordinator"
import { AstraError, toTranslationError } from "@/types/translation"
import { toggleTabTranslation } from "@/utils/extension/messages"
import { reconcileBrowserPermissionEvent } from "@/utils/extension/page-permissions"
import {
  getProviderRoutingMetadataFromError,
  translateWithProviderDetailed,
} from "@/utils/providers/router"
import { summarizeProviderRoute } from "@/utils/providers/routing-metadata"
import { readConfig, saveConfig } from "@/utils/storage/config"
import { readPhaseOneCollectionSyncStatus, runPhaseOneCollectionSync } from "@/utils/storage/config-sync"
import {
  cleanExpiredCache,
  getCachedTranslations,
  getCacheStats,
  setCachedTranslation,
} from "@/utils/cache/translation-cache"
import {
  buildTranslationCacheContext,
  isTranslationCacheable,
} from "@/utils/cache/translation-cache-context"
import { STUDY_PROGRESS_STORAGE_KEY } from "@/utils/storage/study-progress"
import { DEEP_READ_SESSION_STORAGE_KEY } from "@/utils/storage/deep-read-session"
import { buildTerminologyGlossary, getDueVocabularyCount } from "@/utils/storage/vocabulary"
import {
  ensureAstraDeviceIdentity,
  readAstraSession,
  readPendingAnonymousBootstrapKey,
  saveAstraSession,
} from "@/utils/storage/auth"
import { bootstrapAnonymousAstraSession } from "@/utils/astra/auth"
import {
  AstraVideoNoteApiError,
  createAstraVideoNoteJob,
  fetchAstraVideoNoteJob,
} from "@/utils/astra/video-notes"
import { resolveSiteProviderConfig, type HoverTrigger, type ServiceMode } from "@/types/config"
import { initializeTranslationUsageSession, recordTranslationUsage, type RequestSource } from "@/utils/storage/translation-usage"
import { trackEvent } from "@/utils/telemetry"
import { resolveScheduledServiceMode } from "@/utils/service-mode-scheduler"
import {
  consumeIosSessionBootstrap,
  isIosHostBridgeAvailable,
  openIosLaunchURL,
  readIosBootstrapHistory,
  readIosBootstrapStatus,
  type IosBootstrapHistoryEvent,
  type IosBootstrapStatus,
} from "@/utils/extension/ios-host-bridge"
import { sanitizeTranslationContextForTransport } from "@/utils/privacy"
import {
  createImageTranslateHandoff,
  IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM,
  type ImageTranslateCapturedPayload,
} from "@/entrypoints/image-translate/handoff"
let anonymousRegistrationPromise: Promise<void> | null = null
let collectionSyncPromise: Promise<LearningContinuitySyncResult> | null = null
let collectionSyncQueued = false
let collectionSyncLastReason: string | null = null
let collectionSyncLastStartedAt: string | null = null
let collectionSyncLastFinishedAt: string | null = null
let collectionSyncLastResult: LearningContinuitySyncResult | null = null
let collectionSyncLastError: string | null = null
let iosBootstrapConsumePromise: Promise<{ opened: boolean; status: IosBootstrapStatus | null; history: IosBootstrapHistoryEvent[] } | null> | null = null
let lastIosBootstrapStatus: IosBootstrapStatus | null = null
let lastIosBootstrapHistory: IosBootstrapHistoryEvent[] = []

async function buildLearningContinuitySyncStatus(): Promise<LearningContinuitySyncStatus> {
  const local = await readPhaseOneCollectionSyncStatus()
  return {
    inFlight: !!collectionSyncPromise,
    queued: collectionSyncQueued,
    lastReason: collectionSyncLastReason,
    lastStartedAt: collectionSyncLastStartedAt,
    lastFinishedAt: collectionSyncLastFinishedAt,
    lastResult: collectionSyncLastResult,
    lastError: collectionSyncLastError,
    ...local,
  }
}

function commitPhaseOneCollectionSync(reason = "background"): Promise<LearningContinuitySyncResult> {
  if (collectionSyncPromise) {
    collectionSyncQueued = true
    collectionSyncLastReason = reason
    return collectionSyncPromise
  }

  collectionSyncLastReason = reason
  collectionSyncLastStartedAt = new Date().toISOString()
  collectionSyncLastError = null
  collectionSyncPromise = runPhaseOneCollectionSync()
    .then((result) => {
      collectionSyncLastResult = result
      collectionSyncLastError = null
      return result
    })
    .catch((error) => {
      collectionSyncLastError = error instanceof Error ? error.message : String(error)
      throw error
    })
    .finally(() => {
      collectionSyncPromise = null
      collectionSyncLastFinishedAt = new Date().toISOString()
      if (collectionSyncQueued) {
        collectionSyncQueued = false
        void commitPhaseOneCollectionSync("coalesced-learning-mutation").catch(() => {})
      }
    })

  return collectionSyncPromise
}

function schedulePhaseOneCollectionSync(reason = "background"): void {
  void commitPhaseOneCollectionSync(reason).catch(() => {})
}

async function tryAnonymousRegistration(): Promise<void> {
  if (anonymousRegistrationPromise) return anonymousRegistrationPromise
  anonymousRegistrationPromise = (async () => {
    try {
      const existingSession = await readAstraSession()
      if (existingSession) return
      const config = await readConfig()
      const relayBaseURL = config.provider.relayBaseURL?.trim()
      if (!relayBaseURL) return
      const session = await bootstrapAnonymousAstraSession({
        baseURL: relayBaseURL.replace(/\/+$/, ""),
      })
      await saveAstraSession(session)
    } catch {
      // Best-effort — silently ignore failures
    } finally {
      anonymousRegistrationPromise = null
    }
  })()
  return anonymousRegistrationPromise
}

async function retryPendingAnonymousRegistration(): Promise<void> {
  const [existingSession, pendingBootstrapKey] = await Promise.all([
    readAstraSession(),
    readPendingAnonymousBootstrapKey(),
  ])
  if (existingSession || !pendingBootstrapKey) return
  await tryAnonymousRegistration()
}

async function consumeIosBootstrap(source: string): Promise<{ opened: boolean; status: IosBootstrapStatus | null; history: IosBootstrapHistoryEvent[] } | null> {
  if (iosBootstrapConsumePromise) {
    return iosBootstrapConsumePromise
  }

  iosBootstrapConsumePromise = (async () => {
    if (!isIosHostBridgeAvailable()) {
      return null
    }

    const result = await consumeIosSessionBootstrap(source)
    if (result.status) {
      lastIosBootstrapStatus = result.status
    }

    lastIosBootstrapHistory = result.history

    return {
      opened: result.opened,
      status: result.status,
      history: result.history,
    }
  })().finally(() => {
    iosBootstrapConsumePromise = null
  })

  return iosBootstrapConsumePromise
}

async function getIosBootstrapStatus(): Promise<IosBootstrapStatus | null> {
  if (!isIosHostBridgeAvailable()) {
    return null
  }

  const status = await readIosBootstrapStatus()
  if (status) {
    lastIosBootstrapStatus = status
  }

  return status ?? lastIosBootstrapStatus
}

async function getIosBootstrapHistory(limit = 10): Promise<IosBootstrapHistoryEvent[]> {
  if (!isIosHostBridgeAvailable()) {
    return []
  }

  const history = await readIosBootstrapHistory(limit)
  if (history.length > 0) {
    lastIosBootstrapHistory = history
  }

  return history.length > 0 ? history : lastIosBootstrapHistory
}

async function replayIosBootstrap(sessionId?: string | null): Promise<{ opened: boolean; event: IosBootstrapHistoryEvent | null }> {
  const history = await getIosBootstrapHistory(20)
  const event = sessionId
    ? history.find((item) => item.sessionId === sessionId) ?? null
    : history[0] ?? null

  if (!event || !event.launchURL) {
    return { opened: false, event }
  }

  const opened = await openIosLaunchURL(event.launchURL)
  return { opened, event }
}

function selectMostRecentHttpTab(tabs: Array<{ id?: number; url?: string; lastAccessed?: number }>): { id: number; url: string } | null {
  const eligibleTabs = tabs
    .filter((tab): tab is { id: number; url: string; lastAccessed?: number } =>
      typeof tab.id === "number" && typeof tab.url === "string" && /^https?:/i.test(tab.url),
    )
    .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))
  return eligibleTabs[0] ?? null
}

async function resolveCurrentHttpTab(): Promise<{ id: number; url: string } | null> {
  const tabs = await browser.tabs.query({})
  const recent = selectMostRecentHttpTab(tabs)
  if (recent) return recent

  const [active] = await browser.tabs.query({ active: true, currentWindow: true })
  if (active?.id && active.url && /^https?:/i.test(active.url)) {
    return { id: active.id, url: active.url }
  }
  return null
}

async function requestVideoNoteSourceFromTab(tabId: number): Promise<ContentVideoNoteSourceResponse> {
  try {
    const response = await browser.tabs.sendMessage(tabId, { type: "content/get-video-note-source" }, { frameId: 0 }) as unknown
    if (!isContentVideoNoteSourceResponse(response)) {
      return {
        ok: false,
        error: toTranslationError(new Error("Received an unexpected video-note source response."), "INVALID_RESPONSE"),
      }
    }
    return response
  } catch (error) {
    return {
      ok: false,
      error: toTranslationError(error, "CONTENT_UNAVAILABLE"),
    }
  }
}

function isCapturedImagePayload(value: unknown): value is ImageTranslateCapturedPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const candidate = value as Partial<ImageTranslateCapturedPayload>
  return typeof candidate.dataUrl === "string"
    && candidate.dataUrl.startsWith("data:image/")
    && typeof candidate.mimeType === "string"
    && candidate.mimeType.startsWith("image/")
    && (candidate.fileName === undefined || typeof candidate.fileName === "string")
    && (candidate.byteLength === undefined || typeof candidate.byteLength === "number")
}

async function requestImageCaptureFromTab(
  tabId: number | undefined,
  imageUrl: string,
  frameId?: number,
): Promise<ImageTranslateCapturedPayload | undefined> {
  if (typeof tabId !== "number") return undefined

  try {
    const response = await browser.tabs.sendMessage(
      tabId,
      { type: "content/capture-image", payload: { imageUrl } },
      { frameId: typeof frameId === "number" ? frameId : 0 },
    ) as unknown
    if (
      typeof response === "object"
      && response !== null
      && (response as { ok?: unknown }).ok === true
      && isCapturedImagePayload((response as { capture?: unknown }).capture)
    ) {
      return (response as { capture: ImageTranslateCapturedPayload }).capture
    }
  } catch {
    // Best-effort only; the image translate page can still try the original URL.
  }

  return undefined
}

async function handleCreateVideoNoteFromCurrentTab(
  payload: { forceRegenerate?: boolean } = {},
): Promise<RuntimeResponse> {
  const [session, device, activeTab] = await Promise.all([
    readAstraSession(),
    ensureAstraDeviceIdentity(),
    resolveCurrentHttpTab(),
  ])

  if (!session?.sessionToken || !session.relayBaseURL) {
    return {
      type: "runtime/video-note:create-from-current-tab:error",
      error: toTranslationError(new Error("Sign in to Astra before creating video notes."), "CONFIG_MISSING"),
    }
  }

  if (session.identityMode !== "authenticated") {
    return {
      type: "runtime/video-note:create-from-current-tab:error",
      error: toTranslationError(new Error("Video-note jobs require an authenticated Astra account."), "CONFIG_MISSING"),
    }
  }

  if (!activeTab) {
    return {
      type: "runtime/video-note:create-from-current-tab:error",
      error: toTranslationError(new Error("Open a supported video tab before creating a note."), "CONTENT_UNAVAILABLE"),
    }
  }

  const sourceResponse = await requestVideoNoteSourceFromTab(activeTab.id)
  if (!sourceResponse.ok) {
    return {
      type: "runtime/video-note:create-from-current-tab:error",
      error: sourceResponse.error,
    }
  }

  try {
    const createResponse = await createAstraVideoNoteJob({
      baseURL: session.relayBaseURL,
      sessionToken: session.sessionToken,
      deviceId: device.deviceId,
      request: {
        sourceUrl: sourceResponse.source.sourceUrl,
        platformHint: sourceResponse.source.platform,
        sourceTitle: sourceResponse.source.title,
        forceRegenerate: payload.forceRegenerate ?? false,
        capture: sourceResponse.source.capture,
      },
    })

    return {
      type: "runtime/video-note:create-from-current-tab:success",
      payload: createResponse,
    }
  } catch (error) {
    const fallbackCode = error instanceof AstraVideoNoteApiError && error.status === 403
      ? "CONFIG_MISSING"
      : "UNKNOWN"
    return {
      type: "runtime/video-note:create-from-current-tab:error",
      error: toTranslationError(error, fallbackCode),
    }
  }
}

async function handleGetVideoNoteJob(payload: { jobId: string }): Promise<RuntimeResponse> {
  const [session, device] = await Promise.all([
    readAstraSession(),
    ensureAstraDeviceIdentity(),
  ])

  if (!session?.sessionToken || !session.relayBaseURL) {
    return {
      type: "runtime/video-note:get-job:error",
      error: toTranslationError(new Error("Sign in to Astra before checking video-note jobs."), "CONFIG_MISSING"),
    }
  }

  try {
    const statusResponse = await fetchAstraVideoNoteJob({
      baseURL: session.relayBaseURL,
      sessionToken: session.sessionToken,
      deviceId: device.deviceId,
      jobId: payload.jobId,
    })
    return {
      type: "runtime/video-note:get-job:success",
      payload: statusResponse,
    }
  } catch (error) {
    return {
      type: "runtime/video-note:get-job:error",
      error: toTranslationError(error, "UNKNOWN"),
    }
  }
}

export default defineBackground({
  type: "module",
  main: () => {
    initializeFrameCoordinator()
    void ensureAstraDeviceIdentity().catch(() => {})
    void retryPendingAnonymousRegistration().catch(() => {})
    schedulePhaseOneCollectionSync()
    void consumeIosBootstrap("background-startup").catch(() => {})

    browser.runtime.onInstalled.addListener((details: { reason?: string }) => {
      // Prune expired translation cache entries on install/update
      cleanExpiredCache().catch(() => {})
      initializeTranslationUsageSession().catch(() => {})

      // Auto-register anonymous account on first install
      if (details.reason === "install") {
        trackEvent({
          type: "feature_usage",
          data: {
            feature: "learning_loop",
            event: "extension_installed",
            source: "background",
          },
        })
        void tryAnonymousRegistration()

        // First-success: open the zero-config sample lesson so the user
        // experiences understand → save → review without hunting for a page.
        // Stamp install time so the <60s first-value metric has a baseline.
        // Wrapped in Promise.resolve so a non-promise mock return is safe too.
        void Promise.resolve(browser.storage.local.set({ "astra.installed_at": Date.now() })).catch(() => {})
        void Promise.resolve(
          browser.tabs.create({ url: browser.runtime.getURL("/sample-lesson.html") }),
        ).catch(() => {})
      }

      if (browser.contextMenus) {
        const createContextMenuItem = (item: Parameters<typeof browser.contextMenus.create>[0]) => {
          try {
            browser.contextMenus?.create(item)
          } catch {
            // Individual menu IDs may already exist after an extension update.
            // Keep registering the rest so new menu items still roll out.
          }
        }

        createContextMenuItem({
          id: "astra-translate-page",
          title: "Translate page with Astra",
          contexts: ["page"],
        })
        createContextMenuItem({
          id: "astra-translate-selection",
          title: "Translate selection with Astra",
          contexts: ["selection"],
        })
        createContextMenuItem({
          id: "astra-explain-selection",
          title: "Explain selection with Astra",
          contexts: ["selection"],
        })
        createContextMenuItem({
          id: "astra-save-selection",
          title: "Save selection to Astra Review",
          contexts: ["selection"],
        })
        createContextMenuItem({
          id: "astra-open-pdf-reader",
          title: "Open PDF in Astra Reader",
          contexts: ["link"],
          targetUrlPatterns: ["*://*/*.pdf", "*://*/*.PDF"],
        })
        createContextMenuItem({
          id: "astra-translate-image",
          title: "Translate image with Astra",
          contexts: ["image"],
        })
      }
    })

    if (browser.contextMenus?.onClicked) {
      try {
        browser.contextMenus.onClicked.addListener((info, tab) => {
          if (info.menuItemId === "astra-translate-page") {
            if (!tab?.id) return
            void executeTabCommand(tab.id, {
              type: "content/start-translation",
              payload: { contentScope: "page" },
            })
            return
          }

          if (info.menuItemId === "astra-translate-selection" || info.menuItemId === "astra-explain-selection") {
            if (!info.selectionText || !tab?.id) return
            const { frameId: rawFrameId } = info as { frameId?: unknown }
            const options = typeof rawFrameId === "number" ? { frameId: rawFrameId } : undefined
            const message = {
              type: "content/run-selection-action",
              payload: {
                actionId: info.menuItemId === "astra-explain-selection" ? "explain" : "translate",
                text: info.selectionText,
              },
            }
            void (options
              ? browser.tabs.sendMessage(tab.id, message, options)
              : browser.tabs.sendMessage(tab.id, message))
            return
          }

          if (info.menuItemId === "astra-save-selection") {
            if (!info.selectionText || !tab?.id) return
            const { frameId: rawFrameId } = info as { frameId?: unknown }
            const options = typeof rawFrameId === "number" ? { frameId: rawFrameId } : undefined
            const message = {
              type: "content/save-selection",
              payload: { text: info.selectionText },
            }
            void (options
              ? browser.tabs.sendMessage(tab.id, message, options)
              : browser.tabs.sendMessage(tab.id, message))
            return
          }

          if (info.menuItemId === "astra-open-pdf-reader" && info.linkUrl) {
            const pdfReaderUrl = `${browser.runtime.getURL("/pdf-reader/index.html" as "/popup.html")}?url=${encodeURIComponent(info.linkUrl)}`
            void browser.tabs.create({ url: pdfReaderUrl })
            return
          }

          if (info.menuItemId === "astra-translate-image" && info.srcUrl) {
            const imageUrl = info.srcUrl
            void (async () => {
              const { frameId: rawFrameId } = info as { frameId?: unknown }
              const frameId = typeof rawFrameId === "number" ? rawFrameId : undefined
              const captured = await requestImageCaptureFromTab(tab?.id, imageUrl, frameId)
              const baseHandoffInput = {
                imageUrl,
                ...(tab?.url ? { pageUrl: tab.url } : {}),
                ...(tab?.title ? { pageTitle: tab.title } : {}),
              }
              const handoff = await createImageTranslateHandoff({
                ...baseHandoffInput,
                ...(captured ? { captured } : {}),
              }).catch((error) => {
                if (!captured) throw error
                return createImageTranslateHandoff(baseHandoffInput)
              })
              const imageTranslateUrl = `${browser.runtime.getURL("/image-translate.html")}?${IMAGE_TRANSLATE_HANDOFF_QUERY_PARAM}=${encodeURIComponent(handoff.token)}`
              await browser.tabs.create({ url: imageTranslateUrl })
            })().catch(() => {})
            return
          }
        })
      } catch {
        // onClicked listener registration may fail in compat builds
      }
    }

    // Keyboard shortcuts (may be unavailable in compat/mobile builds)
    if (browser.commands?.onCommand) {
      try {
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
              await executeTabCommand(tab.id, {
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
      } catch {
        // commands API may be unavailable in compat/mobile builds
      }
    }

    // Omnibox integration: "astra <URL>" in address bar opens + auto-translates
    if (browser.omnibox?.onInputEntered) {
      try {
        void browser.omnibox.setDefaultSuggestion({ description: "Translate: %s" })

        browser.omnibox.onInputEntered.addListener((text) => {
          void (async () => {
            // Normalize the input into a valid URL
            let url = text.trim()
            if (!/^https?:\/\//i.test(url)) {
              url = `https://${url}`
            }

            const tab = await browser.tabs.create({ url })
            if (!tab.id) return

            // Wait for the tab to finish loading before sending the translate command
            const tabId = tab.id
            const onUpdated = (
              updatedTabId: number,
              changeInfo: { status?: string },
            ) => {
              if (updatedTabId === tabId && changeInfo.status === "complete") {
                browser.tabs.onUpdated.removeListener(onUpdated)
                void executeTabCommand(tabId, {
                  type: "content/start-translation",
                  payload: { contentScope: "page" },
                })
              }
            }
            browser.tabs.onUpdated.addListener(onUpdated)
          })()
        })
      } catch {
        // omnibox API may be unavailable in compat/mobile builds
      }
    }

    // Badge indicator for active translation + SRS due count
    let activeTranslations = 0
    let srsDueCount = 0

    function updateBadge() {
      if (browser.action?.setBadgeText) {
        if (activeTranslations > 0) {
          void browser.action.setBadgeText({ text: `${activeTranslations}` })
          void browser.action.setBadgeBackgroundColor?.({ color: "#6366f1" })
        } else if (srsDueCount > 0) {
          void browser.action.setBadgeText({ text: `${srsDueCount}` })
          void browser.action.setBadgeBackgroundColor?.({ color: "#d97706" })
        } else {
          void browser.action.setBadgeText({ text: "" })
        }
      }
    }

    async function refreshSrsBadge() {
      try {
        srsDueCount = await getDueVocabularyCount()
        updateBadge()
      } catch {
        // Silently ignore
      }
    }

    // Periodic SRS badge refresh (may be unavailable in compat builds)
    if (browser.alarms) {
      try {
        void browser.alarms.create("astra-srs-badge", { periodInMinutes: 30 })
        browser.alarms.onAlarm?.addListener((alarm) => {
          if (alarm.name === "astra-srs-badge") void refreshSrsBadge()
        })
      } catch {
        // alarms API may be limited in compat builds
      }
    }

    // Always do initial badge refresh regardless of alarms availability
    void refreshSrsBadge()

    browser.tabs.onActivated?.addListener(() => {
      schedulePhaseOneCollectionSync("tab-activated")
    })

    // Refresh badge when vocabulary changes and trigger best-effort collection sync.
    browser.storage.onChanged?.addListener((changes, areaName) => {
      if (areaName !== "local") return

      if ("astra.vocabulary.v1" in changes) {
        void refreshSrsBadge()
      }

      if (
        "astra.vocabulary.v1" in changes
        || "astra.reading_history.v1" in changes
        || STUDY_PROGRESS_STORAGE_KEY in changes
        || DEEP_READ_SESSION_STORAGE_KEY in changes
        || "astra.config.v1" in changes
        || "astra.auth.v1" in changes
      ) {
        schedulePhaseOneCollectionSync("storage-change")
      }
    })

    initializeTranslationUsageSession().catch(() => {})

    if (browser.permissions?.onAdded) {
      try {
        browser.permissions.onAdded.addListener((permissions) => {
          void reconcileBrowserPermissionEvent(permissions, true).catch((error) => {
            console.warn("[Astra] Failed to reconcile added permissions:", error)
          })
        })
      } catch {
        // permissions events may be unavailable in compat/mobile builds.
      }
    }

    if (browser.permissions?.onRemoved) {
      try {
        browser.permissions.onRemoved.addListener((permissions) => {
          void reconcileBrowserPermissionEvent(permissions, false).catch((error) => {
            console.warn("[Astra] Failed to reconcile removed permissions:", error)
          })
        })
      } catch {
        // permissions events may be unavailable in compat/mobile builds.
      }
    }

    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (isRuntimeTranslateBatchRequest(message)) {
        activeTranslations++
        updateBadge()
        handleTranslate(message.payload, _sender)
          .then((r) => { activeTranslations = Math.max(0, activeTranslations - 1); updateBadge(); sendResponse(r) })
          .catch((error) => {
            activeTranslations = Math.max(0, activeTranslations - 1)
            updateBadge()
            const metadata = getProviderRoutingMetadataFromError(error)
            sendResponse({
              type: "runtime/translate-batch:error",
              error: toTranslationError(error, "UNKNOWN"),
              ...(metadata ? { metadata } : {}),
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

      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "runtime/ensure-astra-session"
      ) {
        tryAnonymousRegistration()
          .then(() => sendResponse({ ok: true }))
          .catch(() => sendResponse({ ok: false }))
        return true
      }

      if (
        typeof message === "object"
        && message !== null
        && (message as { type?: string }).type === "runtime/ios-bootstrap-consume"
      ) {
        const source = typeof (message as { source?: unknown }).source === "string"
          ? (message as { source: string }).source
          : "popup"

        consumeIosBootstrap(source)
          .then((result) => {
            sendResponse({
              ok: true,
              bridgeAvailable: isIosHostBridgeAvailable(),
              opened: result?.opened ?? false,
              status: result?.status ?? lastIosBootstrapStatus,
              history: result?.history ?? lastIosBootstrapHistory,
            })
          })
          .catch(() => {
            sendResponse({
              ok: false,
              bridgeAvailable: isIosHostBridgeAvailable(),
              opened: false,
              status: lastIosBootstrapStatus,
              history: lastIosBootstrapHistory,
            })
          })
        return true
      }

      if (
        typeof message === "object"
        && message !== null
        && (message as { type?: string }).type === "runtime/ios-bootstrap-status"
      ) {
        Promise.all([
          getIosBootstrapStatus(),
          getIosBootstrapHistory(10),
        ])
          .then(([status, history]) => {
            sendResponse({
              ok: true,
              bridgeAvailable: isIosHostBridgeAvailable(),
              status,
              history,
            })
          })
          .catch(() => {
            sendResponse({
              ok: false,
              bridgeAvailable: isIosHostBridgeAvailable(),
              status: lastIosBootstrapStatus,
              history: lastIosBootstrapHistory,
            })
          })
        return true
      }

      if (
        typeof message === "object"
        && message !== null
        && (message as { type?: string }).type === "runtime/ios-bootstrap-history"
      ) {
        const limit = typeof (message as { limit?: unknown }).limit === "number"
          ? Math.max(1, Math.min(30, Math.floor((message as { limit: number }).limit)))
          : 10

        getIosBootstrapHistory(limit)
          .then((history) => {
            sendResponse({
              ok: true,
              bridgeAvailable: isIosHostBridgeAvailable(),
              history,
            })
          })
          .catch(() => {
            sendResponse({
              ok: false,
              bridgeAvailable: isIosHostBridgeAvailable(),
              history: lastIosBootstrapHistory,
            })
          })
        return true
      }

      if (
        typeof message === "object"
        && message !== null
        && (message as { type?: string }).type === "runtime/ios-bootstrap-replay"
      ) {
        const sessionId = typeof (message as { sessionId?: unknown }).sessionId === "string"
          ? (message as { sessionId: string }).sessionId
          : null

        replayIosBootstrap(sessionId)
          .then(({ opened, event }) => {
            sendResponse({
              ok: true,
              bridgeAvailable: isIosHostBridgeAvailable(),
              opened,
              event,
              history: lastIosBootstrapHistory,
            })
          })
          .catch(() => {
            sendResponse({
              ok: false,
              bridgeAvailable: isIosHostBridgeAvailable(),
              opened: false,
              event: null,
              history: lastIosBootstrapHistory,
            })
          })
        return true
      }

      if (isRuntimeLearningContinuitySyncRequest(message)) {
        commitPhaseOneCollectionSync(message.reason ?? "learning-mutation")
          .then(async (result) => {
            sendResponse({
              type: "runtime/learning-continuity-sync:success",
              payload: {
                result,
                status: await buildLearningContinuitySyncStatus(),
              },
            } satisfies RuntimeResponse)
          })
          .catch(async (error) => {
            sendResponse({
              type: "runtime/learning-continuity-sync:error",
              error: toTranslationError(error, "UNKNOWN"),
              payload: {
                status: await buildLearningContinuitySyncStatus(),
              },
            } satisfies RuntimeResponse)
          })
        return true
      }

      if (isRuntimeLearningContinuitySyncStatusRequest(message)) {
        buildLearningContinuitySyncStatus()
          .then((status) => {
            sendResponse({
              type: "runtime/learning-continuity-sync-status:success",
              payload: { status },
            } satisfies RuntimeResponse)
          })
          .catch((error) => {
            sendResponse({
              type: "runtime/learning-continuity-sync:error",
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies RuntimeResponse)
          })
        return true
      }

      if (isRuntimeTranslationCacheStatsRequest(message)) {
        getCacheStats()
          .then((stats) => {
            sendResponse({
              type: "runtime/translation-cache-stats:success",
              payload: stats,
            } satisfies RuntimeResponse)
          })
          .catch((error) => {
            sendResponse({
              type: "runtime/translation-cache-stats:error",
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies RuntimeResponse)
          })
        return true
      }

      if (isRuntimeSaveConfigRequest(message)) {
        saveConfig(message.payload)
          .then((config) => {
            schedulePhaseOneCollectionSync("config-save")
            sendResponse({
              type: "runtime/save-config:success",
              payload: { config },
            } satisfies RuntimeResponse)
          })
          .catch((error) => {
            sendResponse({
              type: "runtime/save-config:error",
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies RuntimeResponse)
          })
        return true
      }

      if (isRuntimeVideoNoteCreateFromCurrentTabRequest(message)) {
        handleCreateVideoNoteFromCurrentTab(message.payload)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              type: "runtime/video-note:create-from-current-tab:error",
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies RuntimeResponse)
          })
        return true
      }

      if (isRuntimeVideoNoteGetJobRequest(message)) {
        handleGetVideoNoteJob(message.payload)
          .then(sendResponse)
          .catch((error) => {
            sendResponse({
              type: "runtime/video-note:get-job:error",
              error: toTranslationError(error, "UNKNOWN"),
            } satisfies RuntimeResponse)
          })
        return true
      }

      return false
    })
  },
})

function resolveHttpHostnameFromSender(sender: { url?: string; tab?: { url?: string } }): string | null {
  const candidates = [sender.url, sender.tab?.url]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.hostname
      }
    } catch {
      // Ignore malformed sender URLs.
    }
  }
  return null
}

function inferTranslationRequestSource(payload: RuntimeTranslateBatchRequest["payload"]): RequestSource | undefined {
  if (payload.placeholderFormat === "astra-rich-text-v1") return "page-translation"
  if (payload.task === "explain") return "selection"
  return undefined
}

function resolveQualityServiceMode(params: {
  requestedServiceMode?: ServiceMode
  texts: string[]
  context?: RuntimeTranslateBatchRequest["payload"]["context"]
  task: RuntimeTranslateBatchRequest["payload"]["task"]
  privacyMode?: boolean
  requestSource?: RequestSource
  tier?: string
}): ServiceMode | undefined {
  return resolveScheduledServiceMode(params)
}

async function handleTranslate(
  payload: RuntimeTranslateBatchRequest["payload"],
  sender: { url?: string; tab?: { url?: string } },
): Promise<RuntimeResponse> {
  if (payload.texts.length === 0) {
    return {
      type: "runtime/translate-batch:success",
      payload: {
        translations: [],
      },
    }
  }

  const [config, session] = await Promise.all([
    readConfig(),
    readAstraSession(),
  ])
  const transportContext = sanitizeTranslationContextForTransport(
    payload.context,
    config.privacyMode ?? false,
  )
  const terminologyGlossary = await buildTerminologyGlossary(transportContext?.hostname)
  const requestContext = (() => {
    const baseContext = transportContext ? { ...transportContext } : undefined
    if (baseContext?.terminologyGlossary) {
      delete baseContext.terminologyGlossary
    }

    if (terminologyGlossary) {
      return {
        ...(baseContext ?? {}),
        terminologyGlossary,
      }
    }

    return baseContext && Object.keys(baseContext).length > 0 ? baseContext : undefined
  })()
  const senderHostname = resolveHttpHostnameFromSender(sender)
  const resolvedProvider = resolveSiteProviderConfig(config, senderHostname, session)
  const task = payload.task ?? "translate"
  const requestedServiceMode = payload.serviceMode ?? config.serviceMode
  const requestSource = inferTranslationRequestSource(payload)
  const usageTier = session?.plan ?? "unknown"
  const serviceMode = resolveQualityServiceMode({
    requestedServiceMode,
    texts: payload.texts,
    context: requestContext,
    task,
    privacyMode: config.privacyMode ?? false,
    ...(requestSource ? { requestSource } : {}),
    tier: usageTier,
  })
  const cacheContext = isTranslationCacheable(
    task,
    payload.customSystemPrompt,
    payload.placeholderFormat,
  )
    ? buildTranslationCacheContext({ ...config, provider: resolvedProvider }, {
      sourceLang: payload.sourceLang,
      context: requestContext,
      serviceMode,
    })
    : null

  let cachedTranslations = new Map<number, string>()
  if (cacheContext) {
    try {
      cachedTranslations = await getCachedTranslations(
        payload.texts.map((text) => ({
          text,
          targetLang: payload.targetLang,
          cacheContext,
        })),
      )
    } catch {
      // Cache read failure is non-fatal.
    }
  }

  const uncachedEntries = payload.texts.flatMap((text, originalIndex) => (
    cachedTranslations.has(originalIndex) ? [] : [{ originalIndex, text }]
  ))
  const cacheStatus = !cacheContext
    ? "disabled"
    : cachedTranslations.size === 0
      ? "miss"
      : uncachedEntries.length === 0
        ? "hit"
        : "partial"

  if (uncachedEntries.length === 0) {
    recordTranslationUsage({
      providerId: resolvedProvider.id,
      model: resolvedProvider.model,
      task,
      texts: payload.texts,
      serviceMode,
      attemptedTransports: [],
      finalTransport: null,
      fallbackUsed: false,
      route: null,
      cacheStatus,
      fallbackReason: "none",
      tier: usageTier,
      success: true,
      ...(requestSource ? { requestSource } : {}),
    }).catch(() => {})

    return {
      type: "runtime/translate-batch:success",
      payload: {
        translations: payload.texts.map((_, index) => cachedTranslations.get(index) ?? ""),
      },
    }
  }

  const uncachedTexts = uncachedEntries.map(({ text }) => text)
  const requestStartedAt = Date.now()

  try {
    const result = await translateWithProviderDetailed(resolvedProvider, {
      texts: uncachedTexts,
      targetLang: payload.targetLang,
      sourceLang: payload.sourceLang,
      context: requestContext,
      task: payload.task,
      customSystemPrompt: payload.customSystemPrompt,
      placeholderFormat: payload.placeholderFormat,
      languageLevel: payload.languageLevel ?? config.languageLevel,
      serviceMode,
      ...(task === "explain" ? { explainMode: payload.explainMode ?? config.explainMode } : {}),
      ...(task === "explain" && payload.explanationRepairInstruction
        ? { explanationRepairInstruction: payload.explanationRepairInstruction }
        : {}),
    })

    if (result.translations.length !== uncachedTexts.length) {
      throw new AstraError(
        "INVALID_RESPONSE",
        "Translation batch response length did not match the request.",
      )
    }

    const translations = Array.from({ length: payload.texts.length }, () => "")
    for (const [index, translation] of cachedTranslations) {
      translations[index] = translation
    }
    uncachedEntries.forEach(({ originalIndex }, translationIndex) => {
      translations[originalIndex] = result.translations[translationIndex]
    })

    if (cacheContext) {
      await Promise.allSettled(uncachedEntries.map(({ text }, translationIndex) => (
        setCachedTranslation(
          text,
          payload.targetLang,
          result.translations[translationIndex],
          cacheContext,
        )
      )))
    }

    const route = summarizeProviderRoute(result.metadata.attemptedTransports, result.metadata.finalTransport)

    if (route === "fallback") {
      trackEvent({
        type: "provider_fallback",
        data: {
          providerId: resolvedProvider.id,
          model: resolvedProvider.model,
          serviceMode,
          attemptedTransports: result.metadata.attemptedTransports,
          finalTransport: result.metadata.finalTransport,
          fallbackReason: result.metadata.fallbackReason,
        },
      })
    }

    recordTranslationUsage({
      providerId: resolvedProvider.id,
      model: resolvedProvider.model,
      task: payload.task,
      texts: uncachedTexts,
      serviceMode,
      attemptedTransports: result.metadata.attemptedTransports,
      finalTransport: result.metadata.finalTransport,
      fallbackUsed: result.metadata.fallbackUsed,
      route,
      cacheStatus,
      fallbackReason: result.metadata.fallbackReason,
      tier: usageTier,
      success: true,
      durationMs: Date.now() - requestStartedAt,
      ...(requestSource ? { requestSource } : {}),
    }).catch(() => {})

    return {
      type: "runtime/translate-batch:success",
      payload: {
        translations,
        metadata: result.metadata,
      },
    }
  } catch (error) {
    const translatedError = toTranslationError(error, "UNKNOWN")
    const metadata = getProviderRoutingMetadataFromError(error)
    const route = metadata ? summarizeProviderRoute(metadata.attemptedTransports, metadata.finalTransport) : null

    recordTranslationUsage({
      providerId: resolvedProvider.id,
      model: resolvedProvider.model,
      task: payload.task,
      texts: uncachedTexts,
      serviceMode,
      attemptedTransports: metadata?.attemptedTransports,
      finalTransport: metadata?.finalTransport,
      fallbackUsed: metadata?.fallbackUsed,
      route,
      cacheStatus,
      fallbackReason: metadata?.fallbackReason,
      tier: usageTier,
      success: false,
      errorCode: translatedError.code,
      durationMs: Date.now() - requestStartedAt,
      ...(requestSource ? { requestSource } : {}),
    }).catch(() => {})

    throw error
  }
}
