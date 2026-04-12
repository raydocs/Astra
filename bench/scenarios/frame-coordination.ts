import contentScript, { __resetContentEntrypointForTests } from "@/entrypoints/content/index"
import {
  getPageTranslationState,
  stopPageTranslation,
} from "@/entrypoints/content/page-translate"
import { executeTabCommand } from "@/entrypoints/background/frame-coordinator"
import { __setTopFrameOverrideForTests } from "@/entrypoints/content/frame-context"
import { DEFAULT_ASTRA_CONFIG, type AstraConfig } from "@/types/config"
import type { AstraSession } from "@/types/auth"
import {
  IDLE_TRANSLATION_SNAPSHOT,
  type TranslationSnapshot,
} from "@/types/translation"
import {
  __resetInteractionCoordinationForTests,
  clearInteractionSuppression,
} from "@/entrypoints/content/interaction-coordination"

import {
  evaluateFrameCoordination,
  type FrameCoordinationExecution,
} from "../evaluators/frame-coordination"
import {
  installBenchBrowser,
  type BenchFrameEntry,
} from "../runtime/browser"
import {
  cleanupDomEnvironment,
  flushMicrotasks,
  installDomEnvironment,
} from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import type { BenchmarkScenario } from "../types"

type ScenarioCodeHint = {
  suspectedFiles?: string[]
  suspectedSymbols?: string[]
  suspectedKeywords?: string[]
  fallbackSurfaceFiles?: string[]
  risk?: "local" | "cross-module"
}

type BenchmarkScenarioWithHint = BenchmarkScenario<FrameCoordinationExecution> & {
  codeHint: ScenarioCodeHint
}

const SESSION: AstraSession = {
  version: 1,
  sessionToken: "astra-bench-session",
  sessionId: "bench-session-frame-coordination",
  deviceId: "bench-device-frame-coordination",
  identityMode: "authenticated",
  relayBaseURL: "https://astra.example/v1",
  email: "bench@astra.local",
  plan: "pro",
  subscriptionStatus: "active",
  providerEntitlements: ["openai", "gemini"],
  quota: {
    dailyRequestsLimit: 2000,
    dailyCharactersLimit: 500_000,
    requestsPerMinuteLimit: 120,
    remainingDailyRequests: 1990,
    remainingDailyCharacters: 499_500,
  },
  usage: {
    totalRequests: 10,
    totalCharacters: 500,
    dailyRequestsUsed: 10,
    dailyCharactersUsed: 500,
    lastRequestAt: "2026-03-26T00:00:00.000Z",
    recentEvents: [],
  },
  issuedAt: "2026-03-26T00:00:00.000Z",
  expiresAt: null,
}

const UI_HOST_IDS = {
  selection: "astra-selection-toolbar-host",
  hover: "astra-hover-translate-host",
  input: "astra-input-translate-host",
  floatBall: "astra-float-ball-host",
} as const

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

function hostExists(id: string) {
  return Boolean(document.getElementById(id))
}

function createSnapshot(overrides: Partial<TranslationSnapshot> = {}): TranslationSnapshot {
  return {
    ...IDLE_TRANSLATION_SNAPSHOT,
    progress: { ...IDLE_TRANSLATION_SNAPSHOT.progress },
    presentation: { ...IDLE_TRANSLATION_SNAPSHOT.presentation },
    site: { ...IDLE_TRANSLATION_SNAPSHOT.site },
    ...overrides,
  }
}

async function waitForAutoStart(timeoutMs = 500) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const state = getPageTranslationState()
    const markerCount = document.querySelectorAll("[data-astra-translation='1']").length
    if (state.phase === "running" && markerCount > 0) {
      await flushMicrotasks(4)
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    await flushMicrotasks(2)
  }
}

async function executeContentFrameScenario(
  frameRole: "top" | "child",
): Promise<FrameCoordinationExecution> {
  installDomEnvironment("https://example.com/fixtures/frame-coordination")
  try {
    __setTopFrameOverrideForTests(frameRole === "top")

    installBenchBrowser({
      config: createConfig({
        sites: {
          "example.com": {
            enabled: true,
            alwaysTranslate: true,
          },
        },
      }),
      session: SESSION,
    })

    mountFixture({ kind: "page", name: "article-basic" }, {
      title: "Astra Frame Coordination Bench",
      url: "/fixtures/article-basic",
    })

    delete (window as Window & { __ASTRA_INJECTED__?: boolean }).__ASTRA_INJECTED__
    __resetContentEntrypointForTests()

    await contentScript.main({} as never)
    await waitForAutoStart()

    const state = getPageTranslationState()
    const markerCount = document.querySelectorAll("[data-astra-translation='1']").length

    return {
      floatBallMounted: hostExists(UI_HOST_IDS.floatBall),
      siteUiMounted: hostExists(UI_HOST_IDS.selection) && hostExists(UI_HOST_IDS.hover),
      inputUiMounted: hostExists(UI_HOST_IDS.input),
      autoStarted: state.phase === "running" && markerCount > 0,
      translationMarkerCount: markerCount,
      framesTotal: null,
      framesTranslating: null,
      aggregatePhase: null,
      aggregateTargetLang: null,
      aggregateHostname: null,
      progressTotalBlocks: null,
      sendMessageFrameIds: [],
      notes: [`content-${frameRole}-frame`],
    }
  } finally {
    stopPageTranslation()
    await new Promise((resolve) => window.setTimeout(resolve, 200))
    await flushMicrotasks(10)
    clearInteractionSuppression()
    __resetInteractionCoordinationForTests()
    __setTopFrameOverrideForTests(null)
    __resetContentEntrypointForTests()
    cleanupDomEnvironment()
  }
}

async function executeBackgroundFrameScenario(run: () => Promise<FrameCoordinationExecution>) {
  installDomEnvironment("https://example.com/fixtures/frame-coordination")
  try {
    return await run()
  } finally {
    __setTopFrameOverrideForTests(null)
    clearInteractionSuppression()
    __resetInteractionCoordinationForTests()
    __resetContentEntrypointForTests()
    cleanupDomEnvironment()
  }
}

export const frameCoordinationScenarios: BenchmarkScenario<FrameCoordinationExecution>[] = [
  {
    id: "frame-coordination/top-frame-mounts-site-ui-and-float-ball",
    title: "Top frame mounts site UI, input overlay, and float ball during auto-start",
    surface: "frame-coordination",
    fixture: "article-basic",
    task: "Ensure top-frame content scripts mount all site-level UI, including the float ball, when Always Translate auto-starts.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/content/index.tsx",
        "src/entrypoints/content/frame-context.ts",
        "src/entrypoints/content/page-translate.ts",
      ],
      suspectedSymbols: ["main", "__setTopFrameOverrideForTests", "getPageTranslationState"],
      suspectedKeywords: ["__ASTRA_INJECTED__", "alwaysTranslate", "floatBall"],
      risk: "cross-module",
    },
    run: () => executeContentFrameScenario("top"),
    evaluate: (execution) => evaluateFrameCoordination(execution, {
      shouldMountFloatBall: true,
      shouldMountSiteUi: true,
      shouldMountInputUi: true,
      shouldAutoStart: true,
    }),
  },
  {
    id: "frame-coordination/child-frame-skips-top-frame-chrome",
    title: "Child frame mounts inline UI but skips top-frame-only chrome",
    surface: "frame-coordination",
    fixture: "article-basic",
    task: "Ensure child-frame content scripts do not mount the float ball while still supporting auto-start and inline tools.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/content/frame-context.ts",
        "src/entrypoints/content/index.tsx",
      ],
      suspectedSymbols: ["__setTopFrameOverrideForTests", "main"],
      suspectedKeywords: ["floatBall", "top-frame", "siteUiMounted"],
      risk: "cross-module",
    },
    run: () => executeContentFrameScenario("child"),
    evaluate: (execution) => evaluateFrameCoordination(execution, {
      shouldMountFloatBall: false,
      shouldMountSiteUi: true,
      shouldMountInputUi: true,
      shouldAutoStart: true,
    }),
  },
  {
    id: "frame-coordination/background-aggregates-running-frames",
    title: "Background frame coordinator aggregates progress across translatable frames",
    surface: "frame-coordination",
    fixture: "frame-list:top+child",
    task: "Aggregate translation state across multiple HTTP frames and keep the top-frame metadata.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/background/frame-coordinator.ts",
        "src/entrypoints/content/index.tsx",
        "src/utils/extension/messages.ts",
      ],
      suspectedSymbols: ["executeTabCommand", "main"],
      suspectedKeywords: ["framesTotal", "framesTranslating", "sendMessageFrameIds"],
      risk: "cross-module",
    },
    run: () => executeBackgroundFrameScenario(async () => {
      const sendMessageFrameIds: number[] = []
      const frames: BenchFrameEntry[] = [
        { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
        { frameId: 3, parentFrameId: 0, url: "https://example.com/frame" },
      ]

      installBenchBrowser({
        frames,
        sendFrameMessage: async (_tabId, _command, options) => {
          sendMessageFrameIds.push(options?.frameId ?? -1)
          if (options?.frameId === 0) {
            return {
              ok: true,
              state: createSnapshot({
                phase: "running",
                targetLang: "zh-CN",
                site: { hostname: "example.com", enabled: true, alwaysTranslate: true },
                progress: {
                  totalBlocks: 6,
                  queuedBlocks: 1,
                  inFlightBlocks: 1,
                  translatedBlocks: 4,
                  failedBlocks: 0,
                },
              }),
            }
          }

          return {
            ok: true,
            state: createSnapshot({
              phase: "running",
              targetLang: "fr",
              site: { hostname: "embed.example.com", enabled: true, alwaysTranslate: false },
              progress: {
                totalBlocks: 4,
                queuedBlocks: 0,
                inFlightBlocks: 0,
                translatedBlocks: 4,
                failedBlocks: 0,
              },
            }),
          }
        },
      })

      const result = await executeTabCommand(7, { type: "content/get-translation-state" })
      if (!result.ok) {
        throw new Error(result.error.message)
      }

      return {
        floatBallMounted: false,
        siteUiMounted: false,
        inputUiMounted: false,
        autoStarted: false,
        translationMarkerCount: 0,
        framesTotal: result.state.framesTotal ?? null,
        framesTranslating: result.state.framesTranslating ?? null,
        aggregatePhase: result.state.phase,
        aggregateTargetLang: result.state.targetLang,
        aggregateHostname: result.state.site.hostname,
        progressTotalBlocks: result.state.progress.totalBlocks,
        sendMessageFrameIds,
        notes: ["background-aggregate-running"],
      }
    }),
    evaluate: (execution) => evaluateFrameCoordination(execution, {
      expectedFramesTotal: 2,
      expectedFramesTranslating: 2,
      expectedAggregatePhase: "running",
      expectedAggregateHostname: "example.com",
      expectedAggregateTargetLang: "zh-CN",
      expectedProgressTotalBlocks: 10,
      expectedSendFrameIds: [0, 3],
    }),
  },
  {
    id: "frame-coordination/background-falls-back-to-top-frame-metadata",
    title: "Background coordinator falls back to top-frame URL metadata when the top frame is unavailable",
    surface: "frame-coordination",
    fixture: "frame-list:top+child",
    task: "Do not trust child-frame metadata when the top frame is unavailable; keep top-frame hostname and null target language fallback.",
    codeHint: {
      suspectedFiles: [
        "src/entrypoints/background/frame-coordinator.ts",
        "src/entrypoints/content/frame-context.ts",
      ],
      suspectedSymbols: ["executeTabCommand", "__setTopFrameOverrideForTests"],
      suspectedKeywords: ["top frame unavailable", "aggregateHostname", "aggregateTargetLang"],
      risk: "cross-module",
    },
    run: () => executeBackgroundFrameScenario(async () => {
      const sendMessageFrameIds: number[] = []
      const frames: BenchFrameEntry[] = [
        { frameId: 0, parentFrameId: -1, url: "https://example.com/page" },
        { frameId: 5, parentFrameId: 0, url: "https://embed.example.com/frame" },
      ]

      installBenchBrowser({
        frames,
        sendFrameMessage: async (_tabId, _command, options) => {
          sendMessageFrameIds.push(options?.frameId ?? -1)
          if (options?.frameId === 0) {
            throw new Error("top frame unavailable")
          }

          return {
            ok: true,
            state: createSnapshot({
              phase: "running",
              targetLang: "fr",
              site: { hostname: "embed.example.com", enabled: true, alwaysTranslate: false },
              progress: {
                totalBlocks: 0,
                queuedBlocks: 0,
                inFlightBlocks: 0,
                translatedBlocks: 0,
                failedBlocks: 0,
              },
            }),
          }
        },
      })

      const result = await executeTabCommand(7, { type: "content/get-translation-state" })
      if (!result.ok) {
        throw new Error(result.error.message)
      }

      return {
        floatBallMounted: false,
        siteUiMounted: false,
        inputUiMounted: false,
        autoStarted: false,
        translationMarkerCount: 0,
        framesTotal: result.state.framesTotal ?? null,
        framesTranslating: result.state.framesTranslating ?? null,
        aggregatePhase: result.state.phase,
        aggregateTargetLang: result.state.targetLang,
        aggregateHostname: result.state.site.hostname,
        progressTotalBlocks: result.state.progress.totalBlocks,
        sendMessageFrameIds,
        notes: ["background-top-fallback"],
      }
    }),
    evaluate: (execution) => evaluateFrameCoordination(execution, {
      expectedFramesTotal: 2,
      expectedFramesTranslating: 1,
      expectedAggregatePhase: "running",
      expectedAggregateHostname: "example.com",
      expectedAggregateTargetLang: null,
      expectedProgressTotalBlocks: 0,
      expectedSendFrameIds: [0, 5],
    }),
  },
] as BenchmarkScenarioWithHint[]
