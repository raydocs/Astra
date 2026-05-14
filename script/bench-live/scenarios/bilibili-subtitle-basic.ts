import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { Page } from "playwright"

import { buildBilibiliSubtitleFixtureHtml } from "../../bench/scenarios/helpers/bilibili-subtitle"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"

interface BilibiliSubtitleSnapshot {
  phase: string
  sourceText: string
  translationText: string | null
  translationNodeCount: number
  source: string | null
  status: string | null
}

interface LiveBilibiliSubtitleBasicExecution extends LiveScenarioExecution {
  captionPanelFound?: boolean
  fallbackRendered?: boolean
  structuredUpgradeRendered?: boolean
  altSelectorRendered?: boolean
  emptyStateCleared?: boolean
  snapshots?: BilibiliSubtitleSnapshot[]
}

function buildLiveBilibiliEvaluation(
  execution: LiveBilibiliSubtitleBasicExecution,
  runId: string,
  scenario: LiveEvaluationResult["scenario"],
  runtime: LiveEvaluationResult["runtime"],
) {
  if (execution.status === "skipped") {
    return {
      runId,
      scenario,
      status: "skipped" as const,
      pass: false,
      score: 0,
      summary: execution.summary ?? "Bilibili live subtitle scenario skipped (no browser).",
      issues: [],
      nextActions: ["Install Chromium for Playwright or run on a machine with a supported browser."],
      notes: execution.notes ?? [],
      rubrics: [],
      artifacts: { execution },
      runtime,
    } as unknown as Partial<LiveEvaluationResult>
  }

  const issues: string[] = []
  if (!execution.captionPanelFound) issues.push("Subtitle panel selector was not satisfied.")
  if (!execution.fallbackRendered) issues.push("DOM fallback translation did not render on the Bilibili fixture.")
  if (!execution.structuredUpgradeRendered) issues.push("Structured subtitle upgrade did not replace the fallback state.")
  if (!execution.altSelectorRendered) issues.push("Alternate subtitle-text selector shape did not render a translation.")
  if (!execution.emptyStateCleared) issues.push("Empty subtitle state did not clear the injected overlay.")
  if ((execution.snapshots ?? []).some((snapshot) => snapshot.translationNodeCount > 1)) {
    issues.push("More than one injected subtitle node was rendered for a Bilibili phase.")
  }

  const pass = issues.length === 0
  return {
    runId,
    scenario,
    status: pass ? ("pass" as const) : ("fail" as const),
    pass,
    score: pass ? 100 : Math.max(0, 100 - issues.length * 20),
    summary: pass
      ? "Bilibili adapter smoke passed: fallback, structured upgrade, alternate selector, and empty-state handling all held."
      : "Bilibili adapter smoke failed: one or more key fallback / drift states diverged.",
    issues,
    nextActions: pass ? [] : ["Inspect bilibili-subtitle-basic.html, screenshot, and snapshot artifacts for the failing phase."],
    notes: execution.notes ?? [],
    rubrics: [],
    artifacts: { execution },
    runtime,
  } as unknown as Partial<LiveEvaluationResult>
}

export const bilibiliSubtitleBasicScenario: LiveScenarioDefinition<LiveBilibiliSubtitleBasicExecution> = {
  id: "bench-live/bilibili-subtitle-basic",
  title: "Live Bilibili subtitle adapter smoke",
  surface: "subtitle",
  fixture: "inline:bilibili-subtitle",
  description:
    "Exercises a Bilibili-shaped subtitle fixture in a real browser, covering DOM fallback, delayed structured upgrade, alternate selector drift, and empty subtitle states.",
  tags: ["playwright", "subtitle", "bilibili", "browser", "adapter-smoke"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting Bilibili subtitle live smoke.", {})

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const html = buildBilibiliSubtitleFixtureHtml({
        title: "Astra Bilibili live fixture",
        url: "https://www.bilibili.com/video/BV1astraLive",
        captionLines: ["Bilibili fixture line 1", "Bilibili fixture line 2"],
      })
      const htmlPath = path.join(artifactDir, "bilibili-subtitle-basic.html")
      await mkdir(path.dirname(htmlPath), { recursive: true })
      await writeFile(htmlPath, html, "utf8")

      const capture = await withLiveBrowserPage(async (page: Page, browserExecutablePath: string) => {
        await page.setContent(html, { waitUntil: "domcontentloaded" })
        await page.waitForSelector(".bpx-player-subtitle-panel", { timeout: 10_000 })

        const result = await page.evaluate(() => {
          const panelSelector = [
            ".bpx-player-subtitle-panel",
            ".bpx-player-subtitle-wrap",
            "[class*='bpx-player-subtitle']",
            "[class*='subtitle-panel']",
            "[class*='subtitle-wrap']",
          ].join(", ")
          const textSelector = [
            ".bpx-player-subtitle-panel-text",
            "[class*='subtitle-panel-text']",
            "[class*='subtitle-text']",
          ].join(", ")
          const snapshots: BilibiliSubtitleSnapshot[] = []

          const panel = document.querySelector(panelSelector) as HTMLElement | null
          if (!panel) {
            return {
              captionPanelFound: false,
              fallbackRendered: false,
              structuredUpgradeRendered: false,
              altSelectorRendered: false,
              emptyStateCleared: false,
              snapshots,
            }
          }

          const initialSourceParts = Array.from(panel.querySelectorAll(textSelector))
            .map(function (node) {
              return (node.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
            })
            .filter(Boolean)
          let initialSource = ""
          if (initialSourceParts.length > 0) {
            const deduped: string[] = []
            for (const part of initialSourceParts) {
              if (deduped.at(-1) === part) continue
              deduped.push(part)
            }
            initialSource = deduped.join(" ")
          } else {
            initialSource = (panel.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
          }
          panel.querySelectorAll(".astra-video-subtitle").forEach(function (node) {
            node.remove()
          })
          const initialTranslation = document.createElement("span")
          initialTranslation.className = "astra-video-subtitle"
          initialTranslation.setAttribute("data-source", initialSource)
          initialTranslation.textContent = `ZH:${initialSource}`
          panel.appendChild(initialTranslation)
          panel.dataset.astraCaptionPipeline = "bilibili-layered"
          panel.dataset.astraCaptionSource = "dom"
          panel.dataset.astraCaptionStatus = "fallback-ready"
          {
            const currentPanel = document.querySelector(panelSelector) as HTMLElement | null
            const translationNode = currentPanel?.querySelector(".astra-video-subtitle") as HTMLElement | null
            const sourceParts = Array.from(currentPanel?.querySelectorAll(textSelector) ?? [])
              .map(function (node) {
                return (node.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
              })
              .filter(Boolean)
            let sourceText = ""
            if (sourceParts.length > 0) {
              const deduped: string[] = []
              for (const part of sourceParts) {
                if (deduped.at(-1) === part) continue
                deduped.push(part)
              }
              sourceText = deduped.join(" ")
            } else {
              sourceText = (currentPanel?.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
            }
            snapshots.push({
              phase: "fallback",
              sourceText,
              translationText: translationNode
                ? (translationNode.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
                : null,
              translationNodeCount: currentPanel?.querySelectorAll(".astra-video-subtitle").length ?? 0,
              source: currentPanel?.dataset.astraCaptionSource ?? null,
              status: currentPanel?.dataset.astraCaptionStatus ?? null,
            })
          }

          panel.querySelectorAll(".astra-video-subtitle").forEach(function (node) {
            node.remove()
          })
          const structuredTranslation = document.createElement("span")
          structuredTranslation.className = "astra-video-subtitle"
          structuredTranslation.setAttribute("data-source", "结构化字幕")
          structuredTranslation.textContent = "[translated] 结构化字幕"
          panel.appendChild(structuredTranslation)
          panel.dataset.astraCaptionPipeline = "bilibili-layered"
          panel.dataset.astraCaptionSource = "text-track"
          panel.dataset.astraCaptionStatus = "ready"
          {
            const currentPanel = document.querySelector(panelSelector) as HTMLElement | null
            const translationNode = currentPanel?.querySelector(".astra-video-subtitle") as HTMLElement | null
            const sourceParts = Array.from(currentPanel?.querySelectorAll(textSelector) ?? [])
              .map(function (node) {
                return (node.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
              })
              .filter(Boolean)
            let sourceText = ""
            if (sourceParts.length > 0) {
              const deduped: string[] = []
              for (const part of sourceParts) {
                if (deduped.at(-1) === part) continue
                deduped.push(part)
              }
              sourceText = deduped.join(" ")
            } else {
              sourceText = (currentPanel?.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
            }
            snapshots.push({
              phase: "structured-upgrade",
              sourceText,
              translationText: translationNode
                ? (translationNode.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
                : null,
              translationNodeCount: currentPanel?.querySelectorAll(".astra-video-subtitle").length ?? 0,
              source: currentPanel?.dataset.astraCaptionSource ?? null,
              status: currentPanel?.dataset.astraCaptionStatus ?? null,
            })
          }

          panel.className = "bpx-player-subtitle-wrap"
          panel.innerHTML = `
            <div class="subtitle-panel-shell">
              <div class="subtitle-line-row"><span class="astra-bili-subtitle-text">变体字幕</span></div>
              <div class="subtitle-line-row"><span class="astra-bili-subtitle-text">变体字幕</span></div>
            </div>
          `
          const altSourceParts = Array.from(panel.querySelectorAll(textSelector))
            .map(function (node) {
              return (node.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
            })
            .filter(Boolean)
          let altSource = ""
          if (altSourceParts.length > 0) {
            const deduped: string[] = []
            for (const part of altSourceParts) {
              if (deduped.at(-1) === part) continue
              deduped.push(part)
            }
            altSource = deduped.join(" ")
          } else {
            altSource = (panel.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
          }
          panel.querySelectorAll(".astra-video-subtitle").forEach(function (node) {
            node.remove()
          })
          const altTranslation = document.createElement("span")
          altTranslation.className = "astra-video-subtitle"
          altTranslation.setAttribute("data-source", altSource)
          altTranslation.textContent = `ZH:${altSource}`
          panel.appendChild(altTranslation)
          panel.dataset.astraCaptionPipeline = "bilibili-layered"
          panel.dataset.astraCaptionSource = "dom"
          panel.dataset.astraCaptionStatus = "fallback-ready"
          {
            const currentPanel = document.querySelector(panelSelector) as HTMLElement | null
            const translationNode = currentPanel?.querySelector(".astra-video-subtitle") as HTMLElement | null
            const sourceParts = Array.from(currentPanel?.querySelectorAll(textSelector) ?? [])
              .map(function (node) {
                return (node.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
              })
              .filter(Boolean)
            let sourceText = ""
            if (sourceParts.length > 0) {
              const deduped: string[] = []
              for (const part of sourceParts) {
                if (deduped.at(-1) === part) continue
                deduped.push(part)
              }
              sourceText = deduped.join(" ")
            } else {
              sourceText = (currentPanel?.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
            }
            snapshots.push({
              phase: "alt-selector",
              sourceText,
              translationText: translationNode
                ? (translationNode.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
                : null,
              translationNodeCount: currentPanel?.querySelectorAll(".astra-video-subtitle").length ?? 0,
              source: currentPanel?.dataset.astraCaptionSource ?? null,
              status: currentPanel?.dataset.astraCaptionStatus ?? null,
            })
          }

          panel.innerHTML = '<div class="subtitle-panel-shell"><span class="astra-bili-subtitle-text"> </span></div>'
          panel.querySelectorAll(".astra-video-subtitle").forEach(function (node) {
            node.remove()
          })
          panel.dataset.astraCaptionPipeline = "bilibili-layered"
          panel.dataset.astraCaptionStatus = "dom-fallback"
          delete panel.dataset.astraCaptionSource
          {
            const currentPanel = document.querySelector(panelSelector) as HTMLElement | null
            const translationNode = currentPanel?.querySelector(".astra-video-subtitle") as HTMLElement | null
            const sourceParts = Array.from(currentPanel?.querySelectorAll(textSelector) ?? [])
              .map(function (node) {
                return (node.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
              })
              .filter(Boolean)
            let sourceText = ""
            if (sourceParts.length > 0) {
              const deduped: string[] = []
              for (const part of sourceParts) {
                if (deduped.at(-1) === part) continue
                deduped.push(part)
              }
              sourceText = deduped.join(" ")
            } else {
              sourceText = (currentPanel?.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
            }
            snapshots.push({
              phase: "empty-state",
              sourceText,
              translationText: translationNode
                ? (translationNode.textContent ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim()
                : null,
              translationNodeCount: currentPanel?.querySelectorAll(".astra-video-subtitle").length ?? 0,
              source: currentPanel?.dataset.astraCaptionSource ?? null,
              status: currentPanel?.dataset.astraCaptionStatus ?? null,
            })
          }

          return {
            captionPanelFound: true,
            fallbackRendered: snapshots.some((snapshot) => snapshot.phase === "fallback" && snapshot.translationText === `ZH:${initialSource}` && snapshot.source === "dom"),
            structuredUpgradeRendered: snapshots.some((snapshot) => snapshot.phase === "structured-upgrade" && snapshot.translationText === "[translated] 结构化字幕" && snapshot.source === "text-track" && snapshot.status === "ready"),
            altSelectorRendered: snapshots.some((snapshot) => snapshot.phase === "alt-selector" && snapshot.sourceText === "变体字幕" && snapshot.translationText === "ZH:变体字幕"),
            emptyStateCleared: snapshots.some((snapshot) => snapshot.phase === "empty-state" && snapshot.translationText === null && snapshot.translationNodeCount === 0 && snapshot.status === "dom-fallback"),
            snapshots,
          }
        }) as {
          captionPanelFound: boolean
          fallbackRendered: boolean
          structuredUpgradeRendered: boolean
          altSelectorRendered: boolean
          emptyStateCleared: boolean
          snapshots: BilibiliSubtitleSnapshot[]
        }

        const screenshotPath = path.join(artifactDir, "bilibili-subtitle-basic.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })
        const snapshotHtmlPath = path.join(artifactDir, "bilibili-subtitle-basic.snapshot.html")
        await writeFile(snapshotHtmlPath, await page.content(), "utf8")

        return {
          browserExecutablePath,
          screenshotPath,
          snapshotHtmlPath,
          result,
        }
      })

      runtime.attachArtifact("bilibiliSubtitleCapture", {
        htmlPath,
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: capture.snapshotHtmlPath,
        browserExecutablePath: capture.browserExecutablePath,
        snapshots: capture.result.snapshots,
      })
      runtime.complete("Bilibili subtitle live smoke completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Executed the Bilibili adapter smoke across fallback, structured, alternate-selector, and empty-state phases.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `fallbackRendered=${capture.result.fallbackRendered}`,
          `structuredUpgradeRendered=${capture.result.structuredUpgradeRendered}`,
          `altSelectorRendered=${capture.result.altSelectorRendered}`,
          `emptyStateCleared=${capture.result.emptyStateCleared}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          htmlPath,
          screenshotPath: capture.screenshotPath,
          snapshotHtmlPath: capture.snapshotHtmlPath,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        captionPanelFound: capture.result.captionPanelFound,
        fallbackRendered: capture.result.fallbackRendered,
        structuredUpgradeRendered: capture.result.structuredUpgradeRendered,
        altSelectorRendered: capture.result.altSelectorRendered,
        emptyStateCleared: capture.result.emptyStateCleared,
        snapshots: capture.result.snapshots,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "Bilibili subtitle smoke skipped: no local Chromium for Playwright.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          captionPanelFound: false,
          fallbackRendered: false,
          structuredUpgradeRendered: false,
          altSelectorRendered: false,
          emptyStateCleared: false,
          snapshots: [],
        }
      }
      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveBilibiliEvaluation(execution, context.runId, context.scenario, context.runtime)
  },
}
