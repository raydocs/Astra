import {
  getPageTranslationState,
  startPageTranslation,
  stopPageTranslation,
} from "@/entrypoints/content/page-translate"

import {
  evaluateDynamicContent,
  type DynamicContentExecution,
} from "../evaluators/dynamic-content"
import { installBenchBrowser } from "../runtime/browser"
import {
  cleanupDomEnvironment,
  flushMicrotasks,
  installDomEnvironment,
  setElementRect,
} from "../runtime/dom"
import { mountFixture } from "../runtime/fixtures"
import type { BenchmarkScenario } from "../types"

function collectTranslatedTexts(): string[] {
  return Array.from(document.querySelectorAll("[data-astra-translation='1'] .astra-translation-inner"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean)
}

async function waitForTranslationMarkers(timeoutMs = 400) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (document.querySelectorAll("[data-astra-translation='1']").length > 0) {
      await flushMicrotasks(4)
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    await flushMicrotasks(2)
  }
}

async function waitForRequests(
  getCount: () => number,
  expected: number,
  timeoutMs = 600,
) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (getCount() >= expected) {
      await flushMicrotasks(4)
      return
    }
    await new Promise((resolve) => window.setTimeout(resolve, 10))
    await flushMicrotasks(2)
  }
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 600) {
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

function mountDynamicFixture() {
  mountFixture({ kind: "page", name: "dynamic-feed" }, {
    title: "Astra Dynamic Feed Bench",
    url: "/fixtures/dynamic-feed",
  })

  const paragraphs = Array.from(document.querySelectorAll("main p"))
  paragraphs.forEach((element, index) => {
    setElementRect(element, {
      top: 40 + (index * 36),
      left: 16,
      width: 560,
      height: 20,
    })
  })
}

async function executeDynamicScenario(run: () => Promise<DynamicContentExecution>) {
  installDomEnvironment("https://example.com/fixtures/dynamic-feed")
  try {
    return await run()
  } finally {
    stopPageTranslation()
    await new Promise((resolve) => window.setTimeout(resolve, 200))
    await flushMicrotasks(10)
    cleanupDomEnvironment()
  }
}

export const dynamicContentScenarios: BenchmarkScenario<DynamicContentExecution>[] = [
  {
    id: "dynamic-content/new-feed-item-translates-once",
    title: "New dynamic feed items are translated once after they appear",
    surface: "dynamic-content",
    fixture: "dynamic-feed",
    task: "Translate newly appended feed items after the initial page pass without duplicating requests.",
    run: () => executeDynamicScenario(async () => {
      const browser = installBenchBrowser()
      mountDynamicFixture()

      await startPageTranslation({ targetLang: "zh-CN" })
      await waitForTranslationMarkers()

      const beforeRequests = browser.getTranslateCalls().length
      const beforeMarkers = document.querySelectorAll("[data-astra-translation='1']").length
      const beforeProgress = getPageTranslationState().progress.totalBlocks

      const feed = document.querySelector(".feed") as HTMLElement
      const addedArticle = document.createElement("article")
      const addedParagraph = document.createElement("p")
      addedParagraph.textContent = "Third story arrives from a live feed update."
      addedArticle.appendChild(addedParagraph)
      feed.appendChild(addedArticle)
      setElementRect(addedParagraph, {
        top: 40 + (beforeMarkers * 36),
        left: 16,
        width: 560,
        height: 20,
      })

      await waitForRequests(() => browser.getTranslateCalls().length, beforeRequests + 1)

      const translatedTexts = collectTranslatedTexts()
      const latestRequestedSourceText = browser.getTranslateCalls().at(-1)?.payload.texts[0] ?? null

      return {
        requestCountBeforeMutation: beforeRequests,
        requestCountAfterMutation: browser.getTranslateCalls().length,
        latestRequestedSourceText,
        translatedNodeCountBeforeMutation: beforeMarkers,
        translatedNodeCountAfterMutation: document.querySelectorAll("[data-astra-translation='1']").length,
        translatedTextsAfterMutation: translatedTexts,
        updatedTextRequested: latestRequestedSourceText?.includes("Third story arrives") ?? false,
        oldTextCleared: true,
        progressTotalBlocksBeforeMutation: beforeProgress,
        progressTotalBlocksAfterMutation: getPageTranslationState().progress.totalBlocks,
        removedElementStillTracked: false,
        notes: ["dynamic-append"],
      }
    }),
    evaluate: (execution) => evaluateDynamicContent(execution, {
      expectedNewRequests: 1,
      expectedTranslatedNodeDelta: 1,
      requireUpdatedText: true,
      expectedProgressTotalAfterMutation: execution.progressTotalBlocksBeforeMutation + 1,
    }),
  },
  {
    id: "dynamic-content/in-place-text-change-retranslates-cleanly",
    title: "In-place feed text changes re-translate without leaving stale output behind",
    surface: "dynamic-content",
    fixture: "dynamic-feed",
    task: "Re-translate a changed feed block in place and clear stale translation output.",
    run: () => executeDynamicScenario(async () => {
      const browser = installBenchBrowser()
      mountDynamicFixture()

      await startPageTranslation({ targetLang: "zh-CN" })
      await waitForTranslationMarkers()

      const target = document.querySelector("main p") as HTMLElement
      const beforeRequests = browser.getTranslateCalls().length
      const beforeMarkers = document.querySelectorAll("[data-astra-translation='1']").length
      const beforeProgress = getPageTranslationState().progress.totalBlocks
      const oldSource = "First visible story in the dynamic feed."

      target.textContent = "First visible story was edited after the feed refreshed."

      await waitForRequests(() => browser.getTranslateCalls().length, beforeRequests + 1)
      await waitForCondition(() => collectTranslatedTexts().some((text) => text.includes("edited after the feed refreshed")))

      const translatedTexts = collectTranslatedTexts()
      const latestRequestedSourceText = browser.getTranslateCalls().at(-1)?.payload.texts[0] ?? null

      return {
        requestCountBeforeMutation: beforeRequests,
        requestCountAfterMutation: browser.getTranslateCalls().length,
        latestRequestedSourceText,
        translatedNodeCountBeforeMutation: beforeMarkers,
        translatedNodeCountAfterMutation: document.querySelectorAll("[data-astra-translation='1']").length,
        translatedTextsAfterMutation: translatedTexts,
        updatedTextRequested: latestRequestedSourceText?.includes("edited after the feed refreshed") ?? false,
        oldTextCleared: !translatedTexts.some((text) => text.includes(oldSource)),
        progressTotalBlocksBeforeMutation: beforeProgress,
        progressTotalBlocksAfterMutation: getPageTranslationState().progress.totalBlocks,
        removedElementStillTracked: false,
        notes: ["dynamic-text-change"],
      }
    }),
    evaluate: (execution) => evaluateDynamicContent(execution, {
      expectedNewRequests: 1,
      expectedTranslatedNodeDelta: 0,
      requireUpdatedText: true,
      requireOldTextCleared: true,
      expectedProgressTotalAfterMutation: execution.progressTotalBlocksBeforeMutation,
    }),
  },
  {
    id: "dynamic-content/removed-feed-item-cleans-registry",
    title: "Removed dynamic feed items are cleaned out of translation progress tracking",
    surface: "dynamic-content",
    fixture: "dynamic-feed",
    task: "Drop disconnected feed items from the registry so progress totals do not drift upward over time.",
    run: () => executeDynamicScenario(async () => {
      installBenchBrowser()
      mountDynamicFixture()

      await startPageTranslation({ targetLang: "zh-CN" })
      await waitForTranslationMarkers()

      const beforeMarkers = document.querySelectorAll("[data-astra-translation='1']").length
      const beforeProgress = getPageTranslationState().progress.totalBlocks
      const removed = document.querySelectorAll(".feed article")[1] as HTMLElement
      removed.remove()

      await waitForCondition(() => getPageTranslationState().progress.totalBlocks === beforeProgress - 1)

      return {
        requestCountBeforeMutation: 0,
        requestCountAfterMutation: 0,
        latestRequestedSourceText: null,
        translatedNodeCountBeforeMutation: beforeMarkers,
        translatedNodeCountAfterMutation: document.querySelectorAll("[data-astra-translation='1']").length,
        translatedTextsAfterMutation: collectTranslatedTexts(),
        updatedTextRequested: true,
        oldTextCleared: true,
        progressTotalBlocksBeforeMutation: beforeProgress,
        progressTotalBlocksAfterMutation: getPageTranslationState().progress.totalBlocks,
        removedElementStillTracked: getPageTranslationState().progress.totalBlocks >= beforeProgress,
        notes: ["dynamic-remove-cleanup"],
      }
    }),
    evaluate: (execution) => evaluateDynamicContent(execution, {
      expectedNewRequests: 0,
      expectedTranslatedNodeDelta: -1,
      expectedProgressTotalAfterMutation: execution.progressTotalBlocksBeforeMutation - 1,
      shouldCleanupRemovedBlocks: true,
    }),
  },
]
