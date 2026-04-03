import { ASTRA_CONFIG_STORAGE_KEY } from "@/utils/storage/config"
import { ASTRA_AUTH_STORAGE_KEY } from "@/utils/storage/auth"
import { DEFAULT_ASTRA_CONFIG, type AstraConfig } from "@/types/config"
import type { AstraSession } from "@/types/auth"
import { getPageTranslationState, stopPageTranslation } from "@/entrypoints/content/page-translate"
import { subscribePageTranslationState } from "@/entrypoints/content/page-translate"
import contentScript, { __resetContentEntrypointForTests } from "@/entrypoints/content/index"
import backgroundEntrypoint from "@/entrypoints/background/index"
import { ASTRA_SOURCE_HIDDEN_ATTR } from "@/utils/dom/inject"
import {
  resetProviderRouterDependenciesForTests,
  setProviderRouterDependenciesForTests,
} from "@/utils/providers/router"

import { evaluateSiteAutomation, type SiteAutomationExecution } from "../evaluators/site-automation"
import { installBenchBrowser } from "../runtime/browser"
import { cleanupDomEnvironment, flushMicrotasks, installDomEnvironment } from "../runtime/dom"
import { mountFixture, type FixtureSource } from "../runtime/fixtures"
import type { BenchmarkScenario, ScenarioCodeHint } from "../types"

const SITE_AUTOMATION_CODE_HINT: ScenarioCodeHint = {
  suspectedFiles: [
    "src/entrypoints/content/index.tsx",
    "src/entrypoints/content/page-translate.ts",
    "src/types/config.ts",
    "src/utils/storage/config.ts",
  ],
  suspectedSymbols: [
    "getPageTranslationState",
    "startPageTranslation",
    "stopPageTranslation",
    "ASTRA_CONFIG_STORAGE_KEY",
  ],
  suspectedKeywords: [
    "alwaysTranslate",
    "enabled",
    "suppressedAfterManualStop",
    "resumedAfterReenable",
  ],
  fallbackSurfaceFiles: [
    "src/entrypoints/content/index.tsx",
    "src/utils/storage/config.ts",
  ],
  risk: "cross-module",
}

const UI_HOST_IDS = [
  "astra-selection-toolbar-host",
  "astra-hover-translate-host",
  "astra-input-translate-host",
  "astra-float-ball-host",
]

const BENCH_SESSION: AstraSession = {
  version: 1 as const,
  sessionToken: "astra-bench-session",
  relayBaseURL: "https://astra.example/v1",
  email: "bench@astra.local",
  plan: "pro" as const,
  subscriptionStatus: "active" as const,
  providerEntitlements: ["openai", "gemini"],
  quota: {
    dailyRequestsLimit: 2000,
    dailyCharactersLimit: 500_000,
    requestsPerMinuteLimit: 120,
    remainingDailyRequests: 1999,
    remainingDailyCharacters: 499_995,
  },
  usage: {
    totalRequests: 1,
    totalCharacters: 5,
    dailyRequestsUsed: 1,
    dailyCharactersUsed: 5,
    lastRequestAt: "2026-03-26T00:00:00.000Z",
    recentEvents: [],
  },
  expiresAt: null,
}

function createConfig(overrides: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...overrides,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      relayBaseURL: "https://astra.example/v1",
      ...overrides.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...overrides.presentation,
    },
    sites: {
      ...DEFAULT_ASTRA_CONFIG.sites,
      ...overrides.sites,
    },
  }
}

function collectUiHosts(): string[] {
  return UI_HOST_IDS.filter((id) => document.getElementById(id))
}

function getTranslateCallFinalTransport(call: ReturnType<ReturnType<typeof installBenchBrowser>["getTranslateCalls"]>[number] | undefined) {
  if (!call || call.response.type !== "runtime/translate-batch:success") {
    return null
  }

  return call.response.payload.metadata?.finalTransport ?? null
}

function getTranslateCallFallbackUsed(call: ReturnType<ReturnType<typeof installBenchBrowser>["getTranslateCalls"]>[number] | undefined) {
  if (!call || call.response.type !== "runtime/translate-batch:success") {
    return false
  }

  return call.response.payload.metadata?.fallbackUsed ?? false
}

function createSessionRestartTracker() {
  const startedSessionIds = new Set<number>()
  const unsubscribe = subscribePageTranslationState((snapshot) => {
    if (snapshot.sessionId > 0 && snapshot.phase !== "idle") {
      startedSessionIds.add(snapshot.sessionId)
    }
  })

  return {
    countNewSessionsSince(sessionId: number) {
      return [...startedSessionIds].filter((startedSessionId) => startedSessionId > sessionId).length
    },
    stop() {
      unsubscribe()
    },
  }
}

async function waitForMarkersOrIdle(timeoutMs = 400) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const state = getPageTranslationState()
    if (document.querySelectorAll("[data-astra-translation='1']").length > 0 || state.phase === "idle") {
      await flushMicrotasks(4)
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    await flushMicrotasks(2)
  }
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 800,
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) {
      await flushMicrotasks(4)
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    await flushMicrotasks(2)
  }
}

async function bootContentScenario(config: AstraConfig) {
  const controller = installBenchBrowser({
    config,
    session: BENCH_SESSION,
  })

  mountFixture({ kind: "page", name: "article-basic" }, {
    title: "Astra Site Automation Bench",
    url: "/fixtures/article-basic",
  })

  delete (window as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
  __resetContentEntrypointForTests()

  await contentScript.main({} as never)
  await flushMicrotasks(6)
  return controller
}

async function bootBackgroundRoutedContentScenario(config: AstraConfig) {
  const controller = installBenchBrowser({
    config,
    session: BENCH_SESSION,
    dispatchRuntimeMessagesToListeners: true,
  })

  backgroundEntrypoint.main()

  mountFixture({ kind: "page", name: "article-basic" }, {
    title: "Astra Site Automation Bench",
    url: "/fixtures/article-basic",
  })

  delete (window as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
  __resetContentEntrypointForTests()

  await contentScript.main({} as never)
  await flushMicrotasks(6)
  return controller
}

async function executeSiteAutomationScenario(run: () => Promise<SiteAutomationExecution>) {
  installDomEnvironment("https://example.com/fixtures/article-basic")
  try {
    return await run()
  } finally {
    stopPageTranslation()
    await new Promise((resolve) => window.setTimeout(resolve, 200))
    await flushMicrotasks(10)
    __resetContentEntrypointForTests()
    cleanupDomEnvironment()
  }
}

export const siteAutomationScenarios: BenchmarkScenario<SiteAutomationExecution>[] = [
  {
    id: "site-automation/always-translate-initial-autostart",
    title: "Eligible sites auto-start translation on initial content-script mount",
    surface: "site-automation",
    fixture: "article-basic",
    task: "Verify Always Translate auto-starts on the first page load when provider access is available.",
    codeHint: SITE_AUTOMATION_CODE_HINT,
    run: () => executeSiteAutomationScenario(async () => {
      const config = createConfig({
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
      })
      const browser = await bootContentScenario(config)
      await waitForMarkersOrIdle()

      const state = getPageTranslationState()
      const markers = document.querySelectorAll("[data-astra-translation='1']").length
      const requests = browser.getTranslateCalls().length

      return {
        autoStarted: state.phase === "running" && markers > 0 && requests > 0,
        stoppedAfterDisable: false,
        suppressedAfterManualStop: false,
        resumedAfterReenable: false,
        requestCountBeforeTransition: requests,
        requestCountAfterTransition: requests,
        phaseBeforeTransition: state.phase,
        phaseAfterTransition: state.phase,
        translationMarkersBeforeTransition: markers,
        translationMarkersAfterTransition: markers,
        uiHostsPresent: collectUiHosts(),
        notes: ["initial-autostart"],
      }
    }),
    evaluate: (execution) => evaluateSiteAutomation(execution, {
      shouldAutoStart: true,
      requireUiHosts: UI_HOST_IDS,
    }),
  },
  {
    id: "site-automation/site-disable-stops-active-session",
    title: "Disabling a site rule stops active translation on the current page",
    surface: "site-automation",
    fixture: "article-basic",
    task: "Verify a storage-backed site disable event immediately stops active translation and removes Astra markers.",
    codeHint: SITE_AUTOMATION_CODE_HINT,
    run: () => executeSiteAutomationScenario(async () => {
      const initialConfig = createConfig({
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
      })
      const browser = await bootContentScenario(initialConfig)
      await waitForMarkersOrIdle()

      const beforeState = getPageTranslationState()
      const beforeMarkers = document.querySelectorAll("[data-astra-translation='1']").length
      const beforeRequests = browser.getTranslateCalls().length

      const nextConfig = createConfig({
        sites: {
          "example.com": {
            enabled: false,
            alwaysTranslate: false,
          },
        },
      })
      await (browser.browser as { storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } } }).storage.local.set({
        [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
      })
      await browser.emitStorageChange({
        [ASTRA_CONFIG_STORAGE_KEY]: {
          oldValue: initialConfig,
          newValue: nextConfig,
        },
      })
      await flushMicrotasks(6)

      const afterState = getPageTranslationState()
      const afterMarkers = document.querySelectorAll("[data-astra-translation='1']").length
      const afterRequests = browser.getTranslateCalls().length

      return {
        autoStarted: beforeState.phase === "running" && beforeMarkers > 0 && beforeRequests > 0,
        stoppedAfterDisable: afterState.phase === "idle" && afterMarkers === 0,
        suppressedAfterManualStop: false,
        resumedAfterReenable: false,
        requestCountBeforeTransition: beforeRequests,
        requestCountAfterTransition: afterRequests,
        phaseBeforeTransition: beforeState.phase,
        phaseAfterTransition: afterState.phase,
        translationMarkersBeforeTransition: beforeMarkers,
        translationMarkersAfterTransition: afterMarkers,
        uiHostsPresent: collectUiHosts(),
        notes: ["site-disable-stop"],
      }
    }),
    evaluate: (execution) => evaluateSiteAutomation(execution, {
      shouldAutoStart: true,
      shouldStopAfterDisable: true,
      requireUiHosts: UI_HOST_IDS,
    }),
  },
  {
    id: "site-automation/site-rule-update-restarts-active-session",
    title: "Translation-affecting site rule updates restart the active page session",
    surface: "site-automation",
    fixture: "article-basic",
    task: "Verify that storage-backed site rule changes which affect translation output restart the active page translation session immediately.",
    codeHint: SITE_AUTOMATION_CODE_HINT,
    run: () => executeSiteAutomationScenario(async () => {
      const sessionTracker = createSessionRestartTracker()
      const initialConfig = createConfig({
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
            selectors: ["article"],
          },
        },
      })
      try {
        const browser = await bootContentScenario(initialConfig)
        await waitForMarkersOrIdle()

        const beforeState = getPageTranslationState()
        const beforeMarkers = document.querySelectorAll("[data-astra-translation='1']").length
        const beforeRequests = browser.getTranslateCalls().length

        const nextConfig = createConfig({
          sites: {
            "example.com": {
              enabled: true,
              alwaysTranslate: true,
              targetLang: "ja",
              selectors: ["article", ".content"],
              presentation: { mode: "translation-only" },
            },
          },
        })
        await (browser.browser as { storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } } }).storage.local.set({
          [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
        })
        await browser.emitStorageChange({
          [ASTRA_CONFIG_STORAGE_KEY]: {
            oldValue: initialConfig,
            newValue: nextConfig,
          },
        })
        await waitFor(() => {
          const requests = browser.getTranslateCalls().length
          const markers = document.querySelectorAll("[data-astra-translation='1']").length
          return requests > beforeRequests
            && markers > 0
            && sessionTracker.countNewSessionsSince(beforeState.sessionId) > 0
        }, 1000)
        await new Promise((resolve) => window.setTimeout(resolve, 150))
        await flushMicrotasks(8)

        const afterState = getPageTranslationState()
        const afterMarkers = document.querySelectorAll("[data-astra-translation='1']").length
        const afterRequests = browser.getTranslateCalls().length
        const latestTranslateCall = browser.getTranslateCalls().at(-1)
        const hiddenSourceCountAfterTransition = document.querySelectorAll(`[${ASTRA_SOURCE_HIDDEN_ATTR}]`).length
        const restartSessionCount = sessionTracker.countNewSessionsSince(beforeState.sessionId)

        return {
          autoStarted: beforeState.phase === "running" && beforeMarkers > 0 && beforeRequests > 0,
          stoppedAfterDisable: false,
          suppressedAfterManualStop: false,
          resumedAfterReenable: afterState.phase === "running" && afterRequests > beforeRequests && afterMarkers > 0,
          restartedTargetLang: latestTranslateCall?.payload.targetLang ?? null,
          restartedPresentationMode: afterState.presentation.mode,
          hiddenSourceCountAfterTransition,
          restartSessionCount,
          requestCountBeforeTransition: beforeRequests,
          requestCountAfterTransition: afterRequests,
          phaseBeforeTransition: beforeState.phase,
          phaseAfterTransition: afterState.phase,
          translationMarkersBeforeTransition: beforeMarkers,
          translationMarkersAfterTransition: afterMarkers,
          uiHostsPresent: collectUiHosts(),
          notes: ["site-rule-update-restart", `restartSessionCount=${restartSessionCount}`],
        }
      } finally {
        sessionTracker.stop()
      }
    }),
    evaluate: (execution) => {
      const issues = [] as Array<{ severity: "critical" | "high" | "medium" | "low"; message: string; evidence?: string }>

      if (!execution.autoStarted) {
        issues.push({
          severity: "critical",
          message: "The active page never reached a translated running state before the rule update.",
          evidence: `phase=${execution.phaseBeforeTransition}, requests=${execution.requestCountBeforeTransition}, markers=${execution.translationMarkersBeforeTransition}`,
        })
      }

      if (!execution.resumedAfterReenable) {
        issues.push({
          severity: "high",
          message: "Translation-affecting site rule changes did not restart the active page session.",
          evidence: `phase=${execution.phaseAfterTransition}, requests=${execution.requestCountAfterTransition}, markers=${execution.translationMarkersAfterTransition}`,
        })
      }

      if (execution.restartSessionCount !== 1) {
        issues.push({
          severity: "high",
          message: "Translation-affecting site rule changes did not produce exactly one restarted session.",
          evidence: `restartSessionCount=${execution.restartSessionCount ?? 0}`,
        })
      }

      if (execution.restartedTargetLang !== "ja") {
        issues.push({
          severity: "high",
          message: "The restarted translation request did not use the updated target language.",
          evidence: `targetLang=${execution.restartedTargetLang ?? "null"}`,
        })
      }

      if (execution.restartedPresentationMode !== "translation-only") {
        issues.push({
          severity: "high",
          message: "The restarted page session did not apply translation-only presentation mode.",
          evidence: `presentationMode=${execution.restartedPresentationMode ?? "null"}`,
        })
      }

      if ((execution.hiddenSourceCountAfterTransition ?? 0) === 0) {
        issues.push({
          severity: "medium",
          message: "The restarted page did not hide any source blocks after switching to translation-only mode.",
          evidence: `hiddenSourceCount=${execution.hiddenSourceCountAfterTransition ?? 0}`,
        })
      }

      const missingUiHosts = UI_HOST_IDS.filter((id) => !execution.uiHostsPresent.includes(id))
      if (missingUiHosts.length > 0) {
        issues.push({
          severity: "medium",
          message: "Expected site-level UI hosts were not mounted during the site rule restart flow.",
          evidence: missingUiHosts.join(", "),
        })
      }

      const scores = {
        correctness: execution.autoStarted ? 10 : 0,
        rule_responsiveness: execution.resumedAfterReenable ? 10 : 4,
        stability: issues.some((issue) => issue.severity === "critical") ? 4 : 10,
        completeness: missingUiHosts.length === 0 ? 10 : 6,
      }
      const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
      const penalty = issues.reduce((sum, issue) => {
        switch (issue.severity) {
          case "critical":
            return sum + 40
          case "high":
            return sum + 20
          case "medium":
            return sum + 10
          case "low":
            return sum + 5
          default:
            return sum
        }
      }, 0)
      const total = Math.max(0, baseTotal - penalty)

      return {
        scores,
        total,
        pass: total >= 80 && !issues.some((issue) => issue.severity === "critical"),
        issues,
        artifacts: {
          phaseBeforeTransition: execution.phaseBeforeTransition,
          phaseAfterTransition: execution.phaseAfterTransition,
          requestCountBeforeTransition: execution.requestCountBeforeTransition,
          requestCountAfterTransition: execution.requestCountAfterTransition,
          restartSessionCount: execution.restartSessionCount ?? 0,
          translationMarkersBeforeTransition: execution.translationMarkersBeforeTransition,
          translationMarkersAfterTransition: execution.translationMarkersAfterTransition,
          restartedTargetLang: execution.restartedTargetLang ?? null,
          restartedPresentationMode: execution.restartedPresentationMode ?? null,
          hiddenSourceCountAfterTransition: execution.hiddenSourceCountAfterTransition ?? 0,
          uiHostsPresent: execution.uiHostsPresent,
          notes: execution.notes ?? [],
        },
        nextActions: issues.map((issue) => issue.message),
      }
    },
  },
  {
    id: "site-automation/provider-switch-restarts-active-session",
    title: "Provider changes restart the active session and expose the updated transport path",
    surface: "site-automation",
    fixture: "article-basic",
    task: "Verify that changing provider settings during an active session forces a clean restart and that the restarted request reports the new routing metadata.",
    codeHint: SITE_AUTOMATION_CODE_HINT,
    run: () => executeSiteAutomationScenario(async () => {
      const sessionTracker = createSessionRestartTracker()
      const initialConfig = createConfig({
        provider: {
          id: "openai",
          apiKey: "openai-direct-key",
          accessToken: "astra-session",
          relayBaseURL: "https://astra.example/v1",
          model: "gpt-5.4-nano",
        },
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
      })
      setProviderRouterDependenciesForTests({
        translateWithOpenAI: async ({ texts }: { texts: string[] }) => texts.map((text) => `ZH:${text}`),
        translateWithRelay: async ({ texts }: { texts: string[] }) => texts.map((text) => `ZH:${text}`),
      })

      try {
        const browser = await bootBackgroundRoutedContentScenario(initialConfig)
        await waitForMarkersOrIdle()

        const beforeState = getPageTranslationState()
        const beforeMarkers = document.querySelectorAll("[data-astra-translation='1']").length
        const beforeRequests = browser.getTranslateCalls().length
        const initialFinalTransport = getTranslateCallFinalTransport(browser.getTranslateCalls().at(-1))

        const nextConfig = createConfig({
          provider: {
            id: "openai",
            apiKey: "",
            accessToken: "astra-session",
            relayBaseURL: "https://astra.example/v1",
            model: "gpt-5.4-nano",
          },
          sites: {
            "example.com": {
              enabled: true,
              alwaysTranslate: true,
            },
          },
        })
        await (browser.browser as { storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } } }).storage.local.set({
          [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
        })
        await browser.emitStorageChange({
          [ASTRA_CONFIG_STORAGE_KEY]: {
            oldValue: initialConfig,
            newValue: nextConfig,
          },
        })
        await waitFor(() => {
          const afterRequests = browser.getTranslateCalls().length
          return afterRequests > beforeRequests
            && sessionTracker.countNewSessionsSince(beforeState.sessionId) > 0
        }, 1000)
        await new Promise((resolve) => window.setTimeout(resolve, 150))
        await flushMicrotasks(8)

        const afterState = getPageTranslationState()
        const afterMarkers = document.querySelectorAll("[data-astra-translation='1']").length
        const afterRequests = browser.getTranslateCalls().length
        const restartTranslateCall = browser.getTranslateCalls()[beforeRequests]
        const restartSessionCount = sessionTracker.countNewSessionsSince(beforeState.sessionId)

        return {
          autoStarted: beforeState.phase === "running" && beforeMarkers > 0 && beforeRequests > 0,
          stoppedAfterDisable: false,
          suppressedAfterManualStop: false,
          resumedAfterReenable: afterState.phase === "running" && afterRequests === beforeRequests + 1 && afterMarkers > 0,
          initialFinalTransport,
          restartedFinalTransport: getTranslateCallFinalTransport(restartTranslateCall),
          restartedFallbackUsed: getTranslateCallFallbackUsed(restartTranslateCall),
          restartSessionCount,
          requestCountBeforeTransition: beforeRequests,
          requestCountAfterTransition: afterRequests,
          phaseBeforeTransition: beforeState.phase,
          phaseAfterTransition: afterState.phase,
          translationMarkersBeforeTransition: beforeMarkers,
          translationMarkersAfterTransition: afterMarkers,
          uiHostsPresent: collectUiHosts(),
          notes: ["provider-switch-restart", `restartSessionCount=${restartSessionCount}`],
        }
      } finally {
        resetProviderRouterDependenciesForTests()
        sessionTracker.stop()
      }
    }),
    evaluate: (execution) => {
      const issues = [] as Array<{ severity: "critical" | "high" | "medium" | "low"; message: string; evidence?: string }>

      if (!execution.autoStarted) {
        issues.push({
          severity: "critical",
          message: "The active page never reached a translated running state before the provider update.",
          evidence: `phase=${execution.phaseBeforeTransition}, requests=${execution.requestCountBeforeTransition}`,
        })
      }

      if (!execution.resumedAfterReenable) {
        issues.push({
          severity: "high",
          message: "Provider updates did not restart the active page translation session exactly once.",
          evidence: `phase=${execution.phaseAfterTransition}, requests=${execution.requestCountAfterTransition}, expectedRequests=${execution.requestCountBeforeTransition + 1}, markers=${execution.translationMarkersAfterTransition}`,
        })
      }

      if (execution.restartSessionCount !== 1) {
        issues.push({
          severity: "high",
          message: "Provider updates did not produce exactly one restarted session.",
          evidence: `restartSessionCount=${execution.restartSessionCount ?? 0}`,
        })
      }

      if (execution.initialFinalTransport !== "direct") {
        issues.push({
          severity: "high",
          message: "Initial translation request did not report the expected direct transport.",
          evidence: `initialFinalTransport=${execution.initialFinalTransport ?? "null"}`,
        })
      }

      if (execution.restartedFinalTransport !== "relay") {
        issues.push({
          severity: "high",
          message: "Restarted translation request did not report the updated relay transport.",
          evidence: `restartedFinalTransport=${execution.restartedFinalTransport ?? "null"}`,
        })
      }

      if (execution.restartedFallbackUsed !== false) {
        issues.push({
          severity: "medium",
          message: "Provider switch scenario unexpectedly reported a fallback hop instead of a clean relay restart.",
          evidence: `restartedFallbackUsed=${execution.restartedFallbackUsed ?? false}`,
        })
      }

      const missingUiHosts = UI_HOST_IDS.filter((id) => !execution.uiHostsPresent.includes(id))
      if (missingUiHosts.length > 0) {
        issues.push({
          severity: "medium",
          message: "Expected site-level UI hosts were not mounted during the provider switch flow.",
          evidence: missingUiHosts.join(", "),
        })
      }

      const scores = {
        correctness: execution.autoStarted ? 10 : 0,
        completeness: missingUiHosts.length === 0 ? 10 : 6,
        provider_recovery: execution.resumedAfterReenable ? 10 : 4,
        routing_visibility: execution.initialFinalTransport === "direct" && execution.restartedFinalTransport === "relay" ? 10 : 4,
        stability: issues.some((issue) => issue.severity === "critical") ? 4 : 10,
      }
      const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
      const penalty = issues.reduce((sum, issue) => {
        switch (issue.severity) {
          case "critical":
            return sum + 40
          case "high":
            return sum + 20
          case "medium":
            return sum + 10
          case "low":
            return sum + 5
          default:
            return sum
        }
      }, 0)
      const total = Math.max(0, baseTotal - penalty)

      return {
        scores,
        total,
        pass: total >= 80 && !issues.some((issue) => issue.severity === "critical"),
        issues,
        artifacts: {
          phaseBeforeTransition: execution.phaseBeforeTransition,
          phaseAfterTransition: execution.phaseAfterTransition,
          requestCountBeforeTransition: execution.requestCountBeforeTransition,
          requestCountAfterTransition: execution.requestCountAfterTransition,
          restartSessionCount: execution.restartSessionCount ?? 0,
          initialFinalTransport: execution.initialFinalTransport ?? null,
          restartedFinalTransport: execution.restartedFinalTransport ?? null,
          restartedFallbackUsed: execution.restartedFallbackUsed ?? false,
          uiHostsPresent: execution.uiHostsPresent,
          notes: execution.notes ?? [],
        },
        nextActions: issues.map((issue) => issue.message),
      }
    },
  },
  {
    id: "site-automation/provider-and-site-rule-update-single-restart",
    title: "Provider and translation-affecting site updates coalesce into a single active-session restart",
    surface: "site-automation",
    fixture: "article-basic",
    task: "Verify that a single storage write changing both provider transport and translation-affecting site settings restarts the active session exactly once with the updated target language, presentation mode, and routing metadata.",
    codeHint: SITE_AUTOMATION_CODE_HINT,
    run: () => executeSiteAutomationScenario(async () => {
      const sessionTracker = createSessionRestartTracker()
      const initialConfig = createConfig({
        provider: {
          id: "openai",
          apiKey: "openai-direct-key",
          accessToken: "astra-session",
          relayBaseURL: "https://astra.example/v1",
          model: "gpt-5.4-nano",
        },
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
            selectors: ["article"],
          },
        },
      })
      setProviderRouterDependenciesForTests({
        translateWithOpenAI: async ({ texts }: { texts: string[] }) => texts.map((text) => `ZH:${text}`),
        translateWithRelay: async ({ texts }: { texts: string[] }) => texts.map((text) => `ZH:${text}`),
      })

      try {
        const browser = await bootBackgroundRoutedContentScenario(initialConfig)
        await waitForMarkersOrIdle()

        const beforeState = getPageTranslationState()
        const beforeMarkers = document.querySelectorAll("[data-astra-translation='1']").length
        const beforeRequests = browser.getTranslateCalls().length
        const initialFinalTransport = getTranslateCallFinalTransport(browser.getTranslateCalls().at(-1))

        const nextConfig = createConfig({
          provider: {
            id: "openai",
            apiKey: "",
            accessToken: "astra-session",
            relayBaseURL: "https://astra.example/v1",
            model: "gpt-5.4-nano",
          },
          sites: {
            "example.com": {
              enabled: true,
              alwaysTranslate: true,
              targetLang: "ja",
              selectors: ["article", ".content"],
              presentation: { mode: "translation-only" },
            },
          },
        })
        await (browser.browser as { storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } } }).storage.local.set({
          [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
        })
        await browser.emitStorageChange({
          [ASTRA_CONFIG_STORAGE_KEY]: {
            oldValue: initialConfig,
            newValue: nextConfig,
          },
        })
        await waitFor(() => {
          const requests = browser.getTranslateCalls().length
          const state = getPageTranslationState()
          return requests === beforeRequests + 1
            && state.phase === "running"
            && state.presentation.mode === "translation-only"
            && sessionTracker.countNewSessionsSince(beforeState.sessionId) > 0
            && document.querySelectorAll(`[${ASTRA_SOURCE_HIDDEN_ATTR}]`).length > 0
        }, 1200)
        await new Promise((resolve) => window.setTimeout(resolve, 150))
        await flushMicrotasks(8)

        const afterState = getPageTranslationState()
        const afterMarkers = document.querySelectorAll("[data-astra-translation='1']").length
        const afterRequests = browser.getTranslateCalls().length
        const restartTranslateCall = browser.getTranslateCalls()[beforeRequests]
        const hiddenSourceCountAfterTransition = document.querySelectorAll(`[${ASTRA_SOURCE_HIDDEN_ATTR}]`).length
        const restartSessionCount = sessionTracker.countNewSessionsSince(beforeState.sessionId)

        return {
          autoStarted: beforeState.phase === "running" && beforeMarkers > 0 && beforeRequests > 0,
          stoppedAfterDisable: false,
          suppressedAfterManualStop: false,
          resumedAfterReenable: afterState.phase === "running" && afterRequests === beforeRequests + 1 && afterMarkers > 0,
          initialFinalTransport,
          restartedFinalTransport: getTranslateCallFinalTransport(restartTranslateCall),
          restartedFallbackUsed: getTranslateCallFallbackUsed(restartTranslateCall),
          restartedTargetLang: restartTranslateCall?.payload.targetLang ?? null,
          restartedPresentationMode: afterState.presentation.mode,
          hiddenSourceCountAfterTransition,
          restartSessionCount,
          requestCountBeforeTransition: beforeRequests,
          requestCountAfterTransition: afterRequests,
          phaseBeforeTransition: beforeState.phase,
          phaseAfterTransition: afterState.phase,
          translationMarkersBeforeTransition: beforeMarkers,
          translationMarkersAfterTransition: afterMarkers,
          uiHostsPresent: collectUiHosts(),
          notes: ["provider-and-site-rule-single-restart", `restartSessionCount=${restartSessionCount}`],
        }
      } finally {
        resetProviderRouterDependenciesForTests()
        sessionTracker.stop()
      }
    }),
    evaluate: (execution) => {
      const issues = [] as Array<{ severity: "critical" | "high" | "medium" | "low"; message: string; evidence?: string }>

      if (!execution.autoStarted) {
        issues.push({
          severity: "critical",
          message: "The active page never reached a translated running state before the combined provider/site update.",
          evidence: `phase=${execution.phaseBeforeTransition}, requests=${execution.requestCountBeforeTransition}`,
        })
      }
      if (!execution.resumedAfterReenable) {
        issues.push({
          severity: "high",
          message: "The combined provider/site update did not restart the active page translation session exactly once.",
          evidence: `phase=${execution.phaseAfterTransition}, before=${execution.requestCountBeforeTransition}, after=${execution.requestCountAfterTransition}`,
        })
      }
      if (execution.restartSessionCount !== 1) {
        issues.push({
          severity: "high",
          message: "The combined provider/site update did not produce exactly one restarted session.",
          evidence: `restartSessionCount=${execution.restartSessionCount ?? 0}`,
        })
      }
      if (execution.initialFinalTransport !== "direct") {
        issues.push({
          severity: "high",
          message: "Initial translation request did not report the expected direct transport.",
          evidence: `initialFinalTransport=${execution.initialFinalTransport ?? "null"}`,
        })
      }
      if (execution.restartedFinalTransport !== "relay") {
        issues.push({
          severity: "high",
          message: "Restarted translation request did not report the updated relay transport.",
          evidence: `restartedFinalTransport=${execution.restartedFinalTransport ?? "null"}`,
        })
      }
      if (execution.restartedFallbackUsed !== false) {
        issues.push({
          severity: "medium",
          message: "The combined provider/site restart unexpectedly reported fallbackUsed=true instead of a clean relay restart.",
          evidence: `restartedFallbackUsed=${execution.restartedFallbackUsed ?? false}`,
        })
      }
      if (execution.restartedTargetLang !== "ja") {
        issues.push({
          severity: "high",
          message: "Restarted translation request did not use the updated target language.",
          evidence: `restartedTargetLang=${execution.restartedTargetLang ?? "null"}`,
        })
      }
      if (execution.restartedPresentationMode !== "translation-only") {
        issues.push({
          severity: "high",
          message: "Restarted translation session did not apply translation-only presentation mode.",
          evidence: `restartedPresentationMode=${execution.restartedPresentationMode ?? "null"}`,
        })
      }
      if ((execution.hiddenSourceCountAfterTransition ?? 0) === 0) {
        issues.push({
          severity: "medium",
          message: "Restarted translation session did not hide any source blocks after switching to translation-only mode.",
          evidence: `hiddenSourceCount=${execution.hiddenSourceCountAfterTransition ?? 0}`,
        })
      }

      const missingUiHosts = UI_HOST_IDS.filter((id) => !execution.uiHostsPresent.includes(id))
      if (missingUiHosts.length > 0) {
        issues.push({
          severity: "medium",
          message: "Expected site-level UI hosts were not mounted during the combined provider/site update flow.",
          evidence: missingUiHosts.join(", "),
        })
      }

      const scores = {
        correctness: execution.autoStarted ? 10 : 0,
        completeness: missingUiHosts.length === 0 ? 10 : 6,
        provider_recovery: execution.resumedAfterReenable ? 10 : 4,
        routing_visibility: execution.initialFinalTransport === "direct" && execution.restartedFinalTransport === "relay" ? 10 : 4,
        rule_responsiveness: execution.restartedTargetLang === "ja" && execution.restartedPresentationMode === "translation-only" ? 10 : 4,
        stability: issues.some((issue) => issue.severity === "critical") ? 4 : 10,
      }
      const baseTotal = Math.round((Object.values(scores).reduce((sum, score) => sum + score, 0) / (Object.keys(scores).length * 10)) * 100)
      const penalty = issues.reduce((sum, issue) => {
        switch (issue.severity) {
          case "critical":
            return sum + 40
          case "high":
            return sum + 20
          case "medium":
            return sum + 10
          case "low":
            return sum + 5
          default:
            return sum
        }
      }, 0)
      const total = Math.max(0, baseTotal - penalty)

      return {
        scores,
        total,
        pass: total >= 80 && !issues.some((issue) => issue.severity === "critical"),
        issues,
        artifacts: {
          phaseBeforeTransition: execution.phaseBeforeTransition,
          phaseAfterTransition: execution.phaseAfterTransition,
          requestCountBeforeTransition: execution.requestCountBeforeTransition,
          requestCountAfterTransition: execution.requestCountAfterTransition,
          restartSessionCount: execution.restartSessionCount ?? 0,
          initialFinalTransport: execution.initialFinalTransport ?? null,
          restartedFinalTransport: execution.restartedFinalTransport ?? null,
          restartedFallbackUsed: execution.restartedFallbackUsed ?? false,
          restartedTargetLang: execution.restartedTargetLang ?? null,
          restartedPresentationMode: execution.restartedPresentationMode ?? null,
          hiddenSourceCountAfterTransition: execution.hiddenSourceCountAfterTransition ?? 0,
          uiHostsPresent: execution.uiHostsPresent,
          notes: execution.notes ?? [],
        },
        nextActions: issues.map((issue) => issue.message),
      }
    },
  },
  {
    id: "site-automation/manual-stop-suppresses-page-restart",
    title: "Manual stop suppresses current-page auto-restart on unrelated config changes",
    surface: "site-automation",
    fixture: "article-basic",
    task: "Verify Always Translate does not immediately restart after a user manually stops translation on the current page.",
    codeHint: SITE_AUTOMATION_CODE_HINT,
    run: () => executeSiteAutomationScenario(async () => {
      const initialConfig = createConfig({
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
      })
      const browser = await bootContentScenario(initialConfig)
      await waitForMarkersOrIdle()

      const beforeStopRequests = browser.getTranslateCalls().length
      const beforeStopMarkers = document.querySelectorAll("[data-astra-translation='1']").length

      await browser.emitRuntimeMessage({
        type: "content/stop-translation",
      })
      await flushMicrotasks(6)

      const nextConfig = {
        ...initialConfig,
        targetLang: "ja",
      }
      await (browser.browser as { storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } } }).storage.local.set({
        [ASTRA_CONFIG_STORAGE_KEY]: nextConfig,
        [ASTRA_AUTH_STORAGE_KEY]: BENCH_SESSION,
      })
      await browser.emitStorageChange({
        [ASTRA_CONFIG_STORAGE_KEY]: {
          oldValue: initialConfig,
          newValue: nextConfig,
        },
      })
      await flushMicrotasks(6)

      const afterState = getPageTranslationState()
      const afterRequests = browser.getTranslateCalls().length
      const afterMarkers = document.querySelectorAll("[data-astra-translation='1']").length

      return {
        autoStarted: beforeStopRequests > 0 && beforeStopMarkers > 0,
        stoppedAfterDisable: false,
        suppressedAfterManualStop: afterState.phase === "idle" && afterRequests === beforeStopRequests && afterMarkers === 0,
        resumedAfterReenable: false,
        requestCountBeforeTransition: beforeStopRequests,
        requestCountAfterTransition: afterRequests,
        phaseBeforeTransition: "running",
        phaseAfterTransition: afterState.phase,
        translationMarkersBeforeTransition: beforeStopMarkers,
        translationMarkersAfterTransition: afterMarkers,
        uiHostsPresent: collectUiHosts(),
        notes: ["manual-stop-suppression"],
      }
    }),
    evaluate: (execution) => evaluateSiteAutomation(execution, {
      shouldAutoStart: true,
      shouldSuppressAfterManualStop: true,
      requireUiHosts: UI_HOST_IDS,
    }),
  },
  {
    id: "site-automation/eligibility-reset-clears-page-suppression",
    title: "Re-entering an eligible state clears current-page auto-restart suppression",
    surface: "site-automation",
    fixture: "article-basic",
    task: "Verify a page that was manually stopped starts again after the site becomes ineligible and then eligible once more.",
    codeHint: SITE_AUTOMATION_CODE_HINT,
    run: () => executeSiteAutomationScenario(async () => {
      const initialConfig = createConfig({
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
      })
      const browser = await bootContentScenario(initialConfig)
      await waitForMarkersOrIdle()

      await browser.emitRuntimeMessage({
        type: "content/stop-translation",
      })
      await flushMicrotasks(6)

      const disabledConfig = createConfig({
        sites: {
          "example.com": {
            enabled: false,
            alwaysTranslate: false,
          },
        },
      })
      await (browser.browser as { storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } } }).storage.local.set({
        [ASTRA_CONFIG_STORAGE_KEY]: disabledConfig,
      })
      await browser.emitStorageChange({
        [ASTRA_CONFIG_STORAGE_KEY]: {
          oldValue: initialConfig,
          newValue: disabledConfig,
        },
      })
      await flushMicrotasks(4)

      const beforeRequests = browser.getTranslateCalls().length
      const reenabledConfig = createConfig({
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
      })
      await (browser.browser as { storage: { local: { set: (values: Record<string, unknown>) => Promise<void> } } }).storage.local.set({
        [ASTRA_CONFIG_STORAGE_KEY]: reenabledConfig,
      })
      await browser.emitStorageChange({
        [ASTRA_CONFIG_STORAGE_KEY]: {
          oldValue: disabledConfig,
          newValue: reenabledConfig,
        },
      })
      await waitFor(() => {
        const requests = browser.getTranslateCalls().length
        const markers = document.querySelectorAll("[data-astra-translation='1']").length
        return requests > beforeRequests && markers > 0
      }, 1000)
      await flushMicrotasks(8)

      const afterState = getPageTranslationState()
      const afterRequests = browser.getTranslateCalls().length
      const afterMarkers = document.querySelectorAll("[data-astra-translation='1']").length

      return {
        autoStarted: true,
        stoppedAfterDisable: true,
        suppressedAfterManualStop: true,
        resumedAfterReenable: afterState.phase === "running" && afterRequests > beforeRequests && afterMarkers > 0,
        requestCountBeforeTransition: beforeRequests,
        requestCountAfterTransition: afterRequests,
        phaseBeforeTransition: "idle",
        phaseAfterTransition: afterState.phase,
        translationMarkersBeforeTransition: 0,
        translationMarkersAfterTransition: afterMarkers,
        uiHostsPresent: collectUiHosts(),
        notes: ["eligibility-reset"],
      }
    }),
    evaluate: (execution) => evaluateSiteAutomation(execution, {
      shouldResumeAfterReenable: true,
      requireUiHosts: UI_HOST_IDS,
    }),
  },
]
