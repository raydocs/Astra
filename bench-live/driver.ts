import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { chromium, type Browser, type Page } from "playwright"

export const DEFAULT_LIVE_ARTIFACT_ROOT = path.resolve(process.cwd(), "bench-live-results")
export const DEFAULT_BROWSER_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
] as const

export class LiveBrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LiveBrowserUnavailableError"
  }
}

export interface MaterializedFixturePage {
  artifactDir: string
  htmlPath: string
  url: string
  fixtureHtml: string
}

export interface FixtureSmokeCaptureResult {
  artifactDir: string
  browserExecutablePath: string
  htmlPath: string
  url: string
  screenshotPath: string
  snapshotHtmlPath: string
  headingText: string
  articleText: string
  paragraphCount: number
  htmlLength: number
  bodyTextLength: number
}

export async function withLiveBrowserPage<T>(
  callback: (page: Page, browserExecutablePath: string) => Promise<T>,
) {
  const browserExecutablePath = await resolveLiveBrowserExecutablePath()
  if (!browserExecutablePath) {
    throw new LiveBrowserUnavailableError(
      "No supported Chrome/Chromium browser executable was found for the live Playwright scenario.",
    )
  }

  let browser: Browser
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: browserExecutablePath,
    })
  } catch (error) {
    throw normalizeLiveBrowserLaunchFailure(error, browserExecutablePath)
  }

  try {
    const page = await browser.newPage({
      viewport: {
        width: 1280,
        height: 900,
      },
    })

    return await callback(page, browserExecutablePath)
  } finally {
    await browser.close()
  }
}

function normalizeLiveBrowserLaunchFailure(error: unknown, browserExecutablePath: string) {
  const reason = error instanceof Error ? error.message : String(error)
  return new LiveBrowserUnavailableError(
    `Failed to launch live Playwright browser at ${browserExecutablePath}: ${reason}`,
  )
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export async function resolveLiveBrowserExecutablePath(options: {
  overridePath?: string | null
  candidates?: readonly string[]
} = {}) {
  const overridePath = options.overridePath ?? process.env.ASTRA_BENCH_LIVE_BROWSER_PATH ?? null
  const candidates = options.candidates ?? DEFAULT_BROWSER_CANDIDATES

  if (overridePath) {
    return (await pathExists(overridePath)) ? overridePath : null
  }

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  const playwrightExecutablePath = chromium.executablePath()
  if (playwrightExecutablePath && (await pathExists(playwrightExecutablePath))) {
    return playwrightExecutablePath
  }

  return null
}

export async function prepareLiveArtifactDir(runId: string, rootDir = DEFAULT_LIVE_ARTIFACT_ROOT) {
  const artifactDir = path.resolve(rootDir, runId)
  await mkdir(artifactDir, { recursive: true })
  return artifactDir
}

export async function readFixtureHtml(fixtureName: string) {
  const fixturePath = path.resolve(process.cwd(), "test/fixtures/pages", `${fixtureName}.html`)
  return await readFile(fixturePath, "utf8")
}

function renderFixtureDocument(bodyHtml: string, title: string) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${title}</title>`,
    "  <style>",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 860px; line-height: 1.6; color: #111827; }",
    "    article { padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #ffffff; }",
    "    h1 { font-size: 2rem; margin-bottom: 1rem; }",
    "    blockquote { border-left: 4px solid #6366f1; margin: 1rem 0; padding-left: 1rem; color: #4338ca; }",
    "  </style>",
    "</head>",
    "<body>",
    bodyHtml,
    "</body>",
    "</html>",
  ].join("\n")
}

export async function materializeFixturePage(params: {
  runId: string
  fixtureName: string
  title: string
  artifactRoot?: string
}) {
  const artifactDir = await prepareLiveArtifactDir(params.runId, params.artifactRoot)
  const fixtureHtml = await readFixtureHtml(params.fixtureName)
  const htmlPath = path.join(artifactDir, `${params.fixtureName}.html`)
  await writeFile(htmlPath, renderFixtureDocument(fixtureHtml, params.title), "utf8")

  return {
    artifactDir,
    htmlPath,
    url: pathToFileURL(htmlPath).href,
    fixtureHtml,
  } satisfies MaterializedFixturePage
}

export async function captureFixtureSmokeWithPlaywright(params: {
  runId: string
  fixtureName: string
  title: string
  waitForSelector?: string
  artifactRoot?: string
}) {
  const fixturePage = await materializeFixturePage({
    runId: params.runId,
    fixtureName: params.fixtureName,
    title: params.title,
    artifactRoot: params.artifactRoot,
  })

  return await withLiveBrowserPage(async (page, browserExecutablePath) => {
    await page.goto(fixturePage.url, {
      waitUntil: "domcontentloaded",
    })
    await page.waitForSelector(params.waitForSelector ?? "article h1", {
      timeout: 10_000,
    })

    const headingText = (await page.textContent("article h1"))?.trim() ?? ""
    const articleText = await page.locator("article").innerText()
    const paragraphCount = await page.locator("article p").count()
    const snapshotHtml = await page.content()

    const screenshotPath = path.join(fixturePage.artifactDir, `${params.fixtureName}.png`)
    const snapshotHtmlPath = path.join(fixturePage.artifactDir, `${params.fixtureName}.snapshot.html`)

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    })
    await writeFile(snapshotHtmlPath, snapshotHtml, "utf8")

    return {
      artifactDir: fixturePage.artifactDir,
      browserExecutablePath,
      htmlPath: fixturePage.htmlPath,
      url: fixturePage.url,
      screenshotPath,
      snapshotHtmlPath,
      headingText,
      articleText,
      paragraphCount,
      htmlLength: snapshotHtml.length,
      bodyTextLength: articleText.trim().length,
    } satisfies FixtureSmokeCaptureResult
  })
}
