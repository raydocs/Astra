import { ASTRA_CONFIG_STORAGE_KEY } from "@/utils/storage/config"
import { ASTRA_AUTH_STORAGE_KEY } from "@/utils/storage/auth"
import { DEFAULT_ASTRA_CONFIG, type AstraConfig } from "@/types/config"
import type { AstraSession } from "@/types/auth"
import { getPageTranslationState, stopPageTranslation } from "@/entrypoints/content/page-translate"
import contentScript, { __resetContentEntrypointForTests } from "@/entrypoints/content/index"

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
