import path from "node:path"
import { pathToFileURL } from "node:url"

import type { PageTranslationExecution } from "../../bench/evaluators/page-translation"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveEvaluationResult, LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { runSourceBackedPageTranslation } from "../source-runtime"
import { buildLivePageTranslationEvaluation } from "./helpers/page-translation"

const TARGET_LANG = "zh-CN"
const TITLE_TEXT = "Astra full page title proof"
const NAV_TEXT = "Navigation proof link for full page translation"
const MAIN_TEXT = "Main article proof paragraph for full page translation."
const FOOTER_TEXT = "Footer proof copy for full page translation."
const SHADOW_TEXT = "Open shadow root proof paragraph for page translation."

const FIXTURE_HTML = `
  <nav aria-label="Proof navigation">
    <p>${NAV_TEXT}</p>
  </nav>
  <main id="main">
    <article>
      <h1>${TITLE_TEXT}</h1>
      <p>${MAIN_TEXT}</p>
      <div id="astra-shadow-proof-host"></div>
    </article>
  </main>
  <footer><p>${FOOTER_TEXT}</p></footer>
`

interface FullPageTitleShadowProof {
  titleTranslated: boolean
  translatedTitle: string
  navTranslated: boolean
  footerTranslated: boolean
  shadowTranslated: boolean
  navRequested: boolean
  footerRequested: boolean
  shadowRequested: boolean
}

interface LiveFullPageTitleShadowExecution extends LiveScenarioExecution {
  pageTranslation: PageTranslationExecution
  fullPageTitleShadowProof: FullPageTitleShadowProof
}

function installShadowProofContent(doc: Document): void {
  const host = doc.getElementById("astra-shadow-proof-host")
  if (!host) throw new Error("Shadow proof host was missing from fixture.")
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" })
  const paragraph = doc.createElement("p")
  paragraph.textContent = SHADOW_TEXT
  shadow.appendChild(paragraph)
}

function inspectTranslatedDocument(doc: Document): Omit<FullPageTitleShadowProof, "navRequested" | "footerRequested" | "shadowRequested"> {
  const host = doc.getElementById("astra-shadow-proof-host")
  return {
    titleTranslated: doc.title.startsWith("ZH:"),
    translatedTitle: doc.title,
    navTranslated: Boolean(doc.querySelector("nav [data-astra-translation='1']")),
    footerTranslated: Boolean(doc.querySelector("footer [data-astra-translation='1']")),
    shadowTranslated: Boolean(host?.shadowRoot?.querySelector("[data-astra-translation='1']")),
  }
}

function buildRequestProof(sourceResult: Awaited<ReturnType<typeof runSourceBackedPageTranslation>>): FullPageTitleShadowProof {
  const requestTexts = sourceResult.translateCalls.flatMap((call) => call.payload.texts)
  const inspected = sourceResult.proof as Omit<FullPageTitleShadowProof, "navRequested" | "footerRequested" | "shadowRequested"> | undefined

  return {
    titleTranslated: inspected?.titleTranslated === true,
    translatedTitle: typeof inspected?.translatedTitle === "string" ? inspected.translatedTitle : "",
    navTranslated: inspected?.navTranslated === true,
    footerTranslated: inspected?.footerTranslated === true,
    shadowTranslated: inspected?.shadowTranslated === true,
    navRequested: requestTexts.some((text) => text.includes(NAV_TEXT)),
    footerRequested: requestTexts.some((text) => text.includes(FOOTER_TEXT)),
    shadowRequested: requestTexts.some((text) => text.includes(SHADOW_TEXT)),
  }
}

export const pageTranslationFullPageTitleShadowSourceScenario: LiveScenarioDefinition<LiveFullPageTitleShadowExecution> = {
  id: "bench-live/page-translation-full-page-title-shadow-source",
  title: "Live page translation full-page title and shadow source",
  surface: "page-translation",
  fixture: "page:full-page-title-shadow",
  description:
    "Runs the real page-translation source module with explicit full_page scope and proves title, nav/footer, and open shadow-root content are translated.",
  tags: ["playwright", "page-translation", "browser", "source-backed", "full-page", "shadow-dom", "title"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting full-page/title/shadow source-backed page translation proof.")

    try {
      const artifactDir = await prepareLiveArtifactDir(context.runId)
      const translatedHtmlPath = path.join(artifactDir, "full-page-title-shadow.source.snapshot.html")

      const sourceResult = await runSourceBackedPageTranslation({
        fixtureHtml: FIXTURE_HTML,
        url: "https://example.com/bench-live/full-page-title-shadow",
        title: TITLE_TEXT,
        targetLang: TARGET_LANG,
        contentScope: "full_page",
        translationMode: "bilingual",
        snapshotHtmlPath: translatedHtmlPath,
        mutateDocument: installShadowProofContent,
        inspectDocument: inspectTranslatedDocument,
      })
      const proof = buildRequestProof(sourceResult)

      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.goto(pathToFileURL(translatedHtmlPath).href, { waitUntil: "domcontentloaded" })
        await page.waitForSelector("article h1 [data-astra-translation='1']", { timeout: 10_000 })
        const screenshotPath = path.join(artifactDir, "full-page-title-shadow.source.png")
        await page.screenshot({ path: screenshotPath, fullPage: true })
        return { browserExecutablePath, screenshotPath }
      })

      runtime.attachArtifact("pageTranslationCapture", {
        screenshotPath: capture.screenshotPath,
        snapshotHtmlPath: translatedHtmlPath,
        requestCount: sourceResult.requestCount,
      })
      runtime.attachArtifact("fullPageTitleShadowProof", proof)
      runtime.attachArtifact("browser", { executablePath: capture.browserExecutablePath })

      runtime.complete("Full-page/title/shadow page translation proof completed.")
      const snapshot = runtime.snapshot()

      return {
        status: snapshot.status,
        summary: "Executed full_page source translation and proved title, nav/footer, and open shadow-root translation signals.",
        notes: [
          `Browser executable: ${capture.browserExecutablePath}`,
          `Artifact directory: ${artifactDir}`,
          `Translate requests: ${sourceResult.requestCount}`,
          `Translated title: ${proof.translatedTitle}`,
        ],
        artifacts: {
          browserExecutablePath: capture.browserExecutablePath,
          screenshotPath: capture.screenshotPath,
          snapshotHtmlPath: translatedHtmlPath,
          translateCalls: sourceResult.translateCalls,
          proof,
        },
        runtime: snapshot,
        startedAt: snapshot.startedAt,
        finishedAt: snapshot.finishedAt,
        pageTranslation: sourceResult.pageTranslation,
        fullPageTitleShadowProof: proof,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary: "The full-page/title/shadow source proof ran, but no supported local browser executable was available for artifact capture.",
          notes: [error.message],
          artifacts: { browserAvailability: "missing" },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          pageTranslation: {
            translatedNodeCount: 0,
            expectedNodeCount: 0,
            translationMarkerCount: 0,
            hiddenSourceCount: 0,
            requestCount: 0,
            skippedInteractiveTranslations: 0,
            translatedTexts: [],
            expectedTexts: [],
            snapshotPhase: "idle",
            failedBlocks: 0,
            notes: ["browser-unavailable"],
          },
          fullPageTitleShadowProof: {
            titleTranslated: false,
            translatedTitle: "",
            navTranslated: false,
            footerTranslated: false,
            shadowTranslated: false,
            navRequested: false,
            footerRequested: false,
            shadowRequested: false,
          },
        }
      }
      throw error
    }
  },
  async evaluate(execution, context) {
    const base = buildLivePageTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      successSummary: "Full-page/title/shadow source translation matched the page-translation benchmark contract.",
      failureSummary: "Full-page/title/shadow source translation diverged from the page-translation benchmark contract.",
    }) as Partial<LiveEvaluationResult>
    const proof = execution.fullPageTitleShadowProof ?? {
      titleTranslated: false,
      translatedTitle: "",
      navTranslated: false,
      footerTranslated: false,
      shadowTranslated: false,
      navRequested: false,
      footerRequested: false,
      shadowRequested: false,
    }
    const proofIssues: string[] = []
    if (!proof.titleTranslated) proofIssues.push("Document title was not translated.")
    if (!proof.navTranslated || !proof.navRequested) proofIssues.push("Full-page navigation content was not translated/requested.")
    if (!proof.footerTranslated || !proof.footerRequested) proofIssues.push("Full-page footer content was not translated/requested.")
    if (!proof.shadowTranslated || !proof.shadowRequested) proofIssues.push("Open shadow-root content was not translated/requested.")

    const skipped = execution.status === "skipped"
    const toleratedFullPageIssues = new Set(["Interactive elements received Astra translation markers."])
    const baseIssues = (base.issues ?? []).filter((issue) => {
      const message = issue.split(" (")[0]
      return !toleratedFullPageIssues.has(message)
    })
    const baseNextActions = (base.nextActions ?? []).filter((action) => !toleratedFullPageIssues.has(action))
    const basePass = base.pass === true || ((base.issues ?? []).length > 0 && baseIssues.length === 0)
    const pass = !skipped && basePass && proofIssues.length === 0
    return {
      ...base,
      status: skipped ? "skipped" : pass ? "pass" : "fail",
      pass,
      score: skipped ? 0 : pass ? 100 : Math.min(base.score ?? 0, 80),
      summary: pass
        ? "Full-page/title/shadow source proof passed: title, nav/footer, and open shadow-root content were translated."
        : "Full-page/title/shadow source proof failed one or more required signals.",
      issues: [...baseIssues, ...proofIssues],
      nextActions: proofIssues.length === 0
        ? baseNextActions
        : [...baseNextActions, "Inspect page translation extraction for full_page, title translation, or open shadow-root traversal."],
      artifacts: {
        ...(base.artifacts ?? {}),
        fullPageTitleShadowProof: proof,
      },
    } as unknown as Partial<LiveEvaluationResult>
  },
}
