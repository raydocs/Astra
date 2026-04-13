import { createHash } from "node:crypto"
import { createServer } from "node:http"
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { chromium, type Browser, type BrowserContext, type Page } from "playwright"

export const DEFAULT_LIVE_ARTIFACT_ROOT = path.resolve(process.cwd(), "bench-live-results")
export const DEFAULT_EXTENSION_PATH = path.resolve(process.cwd(), ".output/chrome-mv3")
export const DEFAULT_BROWSER_CANDIDATES = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  // Linux (CI runners)
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
] as const

export class LiveBrowserUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LiveBrowserUnavailableError"
  }
}

export class ExtensionBuildNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExtensionBuildNotFoundError"
  }
}

export interface ExtensionBrowserContext {
  context: BrowserContext
  page: Page
  extensionId: string
  extensionPath: string
  browserExecutablePath: string
  /** Must be called in a finally block to clean up the persistent context. */
  close: () => Promise<void>
}

export interface MaterializedFixturePage {
  artifactDir: string
  htmlPath: string
  url: string
  fixtureHtml: string
}

export interface ServedFixturePage extends MaterializedFixturePage {
  origin: string
  close: () => Promise<void>
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Extra Chromium flags for extension-loaded persistent contexts on Linux CI
 * (xvfb + Playwright Chromium): avoids hangs from sandbox/GPU/shm defaults.
 */
function extensionPersistentContextExtraArgs(): string[] {
  if (process.env.CI !== "true") {
    return []
  }

  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-zygote",
  ]
}

/** Playwright Chromium often hangs on launchPersistentContext+extensions on Linux CI; Google Chrome channel is reliable. */
function googleChromeChannelForExtensionLive(): boolean {
  return process.env.CI === "true" && process.env.ASTRA_BENCH_LIVE_USE_GOOGLE_CHROME === "1"
}

function extensionPersistentContextEnv(): NodeJS.ProcessEnv | undefined {
  if (process.env.CI !== "true") {
    return undefined
  }

  return {
    ...process.env,
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS ?? "/dev/null",
  }
}

function extractExtensionIdFromUrl(url: string): string | null {
  const match = url.match(/^chrome-extension:\/\/([a-z]{32})\//)
  return match?.[1] ?? null
}

function deriveExtensionIdFromManifestKey(manifestKey: string): string {
  const manifestKeyBuffer = Buffer.from(manifestKey, "base64")
  const hex = createHash("sha256").update(manifestKeyBuffer).digest("hex").slice(0, 32)
  const alphabet = "abcdefghijklmnop"

  return Array.from(hex)
    .map((char) => alphabet[Number.parseInt(char, 16)] ?? "a")
    .join("")
}

async function resolveExtensionIdFromManifestKey(extensionPath?: string): Promise<string | null> {
  try {
    const manifestPath = await resolveExtensionManifestPath(extensionPath)
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      key?: string
    }

    return manifest.key ? deriveExtensionIdFromManifestKey(manifest.key) : null
  } catch {
    return null
  }
}

async function resolveExtensionIdFromExtensionsPage(
  context: BrowserContext,
  timeoutMs: number,
): Promise<string | null> {
  const page = await context.newPage()

  try {
    await page.goto("chrome://extensions/", {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    })
    await page.waitForTimeout(1_500)

    return await page.evaluate(() => {
      const extensionIdPattern = /^[a-z]{32}$/
      const seen = new Set<Node>()
      const foundIds = new Set<string>()

      const visit = (node: Node | null) => {
        if (!node || seen.has(node)) return
        seen.add(node)

        if (node instanceof Element) {
          const candidates = [
            node.getAttribute("id"),
            node.getAttribute("item-id"),
            node.getAttribute("data-extension-id"),
          ]
          for (const candidate of candidates) {
            if (candidate && extensionIdPattern.test(candidate)) {
              foundIds.add(candidate)
            }
          }

          if (node.shadowRoot) {
            visit(node.shadowRoot)
          }
        }

        for (const child of node.childNodes) {
          visit(child)
        }
      }

      visit(document)
      const ids = Array.from(foundIds)
      return ids.length === 1 ? ids[0] : (ids[0] ?? null)
    })
  } catch {
    return null
  } finally {
    try {
      await page.close()
    } catch {
      // ignore cleanup failures
    }
  }
}

export async function resolveExtensionId(
  context: BrowserContext,
  timeoutMs = 10_000,
  extensionPath?: string,
): Promise<string> {
  const deadline = Date.now() + timeoutMs

  const maybeWaitForServiceWorker = async () => {
    try {
      const worker = await context.waitForEvent("serviceworker", {
        timeout: Math.max(250, deadline - Date.now()),
      })
      return extractExtensionIdFromUrl(worker.url())
    } catch {
      return null
    }
  }

  while (Date.now() < deadline) {
    const backgroundPages = typeof (context as BrowserContext & {
      backgroundPages?: () => Array<{ url: () => string }>
    }).backgroundPages === "function"
      ? (context as BrowserContext & {
          backgroundPages: () => Array<{ url: () => string }>
        }).backgroundPages()
      : []

    for (const page of backgroundPages) {
      const extensionId = extractExtensionIdFromUrl(page.url())
      if (extensionId) {
        return extensionId
      }
    }

    const serviceWorkers = typeof (context as BrowserContext & {
      serviceWorkers?: () => Array<{ url: () => string }>
    }).serviceWorkers === "function"
      ? (context as BrowserContext & {
          serviceWorkers: () => Array<{ url: () => string }>
        }).serviceWorkers()
      : []

    for (const worker of serviceWorkers) {
      const extensionId = extractExtensionIdFromUrl(worker.url())
      if (extensionId) {
        return extensionId
      }
    }

    for (const page of context.pages()) {
      const extensionId = extractExtensionIdFromUrl(page.url())
      if (extensionId) {
        return extensionId
      }
    }

    const awaitedExtensionId = await maybeWaitForServiceWorker()
    if (awaitedExtensionId) {
      return awaitedExtensionId
    }

    await delay(100)
  }

  const manifestKeyId = await resolveExtensionIdFromManifestKey(extensionPath)
  if (manifestKeyId) {
    return manifestKeyId
  }

  const extensionsPageId = await resolveExtensionIdFromExtensionsPage(context, Math.max(2_000, timeoutMs))
  if (extensionsPageId) {
    return extensionsPageId
  }

  throw new ExtensionBuildNotFoundError(
    "Unable to resolve the loaded extension ID from background pages, service workers, extension pages, or chrome://extensions.",
  )
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

export async function serveMaterializedFixturePage(
  fixturePage: MaterializedFixturePage,
  options: { host?: string } = {},
): Promise<ServedFixturePage> {
  const host = options.host ?? "localhost"
  const html = await readFile(fixturePage.htmlPath, "utf8")

  const server = createServer((request, response) => {
    if (request.url === "/" || request.url === "/index.html") {
      response.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      })
      response.end(html)
      return
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" })
    response.end("Not found")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, host, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Unable to determine local server address for live fixture page.")
  }

  const origin = `http://${host}:${address.port}`

  return {
    ...fixturePage,
    origin,
    url: `${origin}/index.html`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    },
  }
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

/**
 * Launches a Chrome browser with the Astra extension loaded via --load-extension.
 *
 * This is the key enabler for extension-loaded live scenarios that need to test
 * the real content script bootstrap, storage APIs, runtime messaging, and
 * Shadow DOM overlay mounting — none of which can be tested in JSDOM.
 *
 * Usage:
 *   const extCtx = await withExtensionBrowserPage()
 *   try {
 *     await extCtx.page.goto(url)
 *     // ... test against the real extension
 *   } finally {
 *     await extCtx.close()
 *   }
 *
 * @param options.extensionPath - Path to the built Chrome extension directory (default: .output/chrome-mv3)
 * @param options.initialUrl - URL to navigate to after extension loads (default: about:blank)
 * @param options.waitForExtensionInject - Max ms to wait for the extension to inject into the page (default: 5000)
 *   Set to 0 to skip waiting for injection (useful when navigating to pages that shouldn't trigger the extension).
 * @param options.storageState - Initial chrome.storage.local state to inject before the extension loads.
 *   This is essential for site-automation scenarios where alwaysTranslate must be pre-configured.
 */
export async function withExtensionBrowserPage(options: {
  extensionPath?: string
  initialUrl?: string
  waitForExtensionInject?: number
  storageState?: Record<string, unknown>
} = {}): Promise<ExtensionBrowserContext> {
  const extensionPath = options.extensionPath ?? DEFAULT_EXTENSION_PATH
  const initialUrl = options.initialUrl ?? "about:blank"
  const waitForInject = options.waitForExtensionInject ?? 5000

  const useChromeChannel = googleChromeChannelForExtensionLive()

  let browserExecutablePath: string
  if (useChromeChannel) {
    browserExecutablePath = "google-chrome (Playwright channel: chrome)"
  } else {
    const resolved = await resolveLiveBrowserExecutablePath({
      candidates: [chromium.executablePath(), ...DEFAULT_BROWSER_CANDIDATES],
    })
    if (!resolved) {
      throw new LiveBrowserUnavailableError(
        "No supported Chrome/Chromium browser executable was found for the extension-loaded live scenario.",
      )
    }
    browserExecutablePath = resolved
  }

  const extensionPathExists = await pathExists(extensionPath)
  if (!extensionPathExists) {
    throw new ExtensionBuildNotFoundError(
      `Chrome extension build not found at ${extensionPath}. Run "pnpm build" first to create the extension output.`,
    )
  }

  const userDataDir = path.join(DEFAULT_LIVE_ARTIFACT_ROOT, `_extension-profile-${Date.now()}`)

  let context: BrowserContext
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      ...(useChromeChannel
        ? { channel: "chrome" as const }
        : { executablePath: browserExecutablePath }),
      headless: false,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        ...extensionPersistentContextExtraArgs(),
        `--load-extension=${extensionPath}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-default-apps",
        "--disable-popup-blocking",
        "--disable-sync",
        "--disable-extensions-except=" + extensionPath,
      ],
      viewport: {
        width: 1280,
        height: 900,
      },
      timeout: process.env.CI === "true" ? 240_000 : 180_000,
      env: extensionPersistentContextEnv(),
    })
  } catch (error) {
    throw normalizeLiveBrowserLaunchFailure(error, browserExecutablePath)
  }

  const page = context.pages()[0] ?? await context.newPage()
  if (initialUrl !== "about:blank") {
    await page.goto(initialUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })

    if (waitForInject > 0) {
      try {
        await page.waitForFunction(
          () => !!document.getElementById("astra-float-ball-host")
            || !!document.getElementById("astra-hover-translate-host")
            || !!(document.querySelector("[data-astra-injected]")),
          { timeout: waitForInject },
        )
      } catch {
        // Some pages (chrome://, non-http) intentionally exclude extension injection
      }
    }
  }

  const extensionId = await resolveExtensionId(context, 10_000, extensionPath)
  const extensionPagePath = await resolveExtensionPagePath(extensionPath)

  if (options.storageState && Object.keys(options.storageState).length > 0) {
    const setupPage = await context.newPage()
    await setupPage.goto(`chrome-extension://${extensionId}/${extensionPagePath}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    })
    await setupPage.waitForFunction(
      `typeof chrome !== "undefined" && !!chrome.storage?.local`,
      { timeout: 10_000 },
    )
    await setupPage.evaluate(async (storageState) => {
      const extensionChrome = (globalThis as unknown as {
        chrome?: {
          storage?: {
            local?: {
              set: (value: Record<string, unknown>) => Promise<void>
            }
          }
        }
      }).chrome

      if (!extensionChrome?.storage?.local) {
        throw new Error("chrome.storage.local is unavailable in the extension setup page")
      }

      await extensionChrome.storage.local.set(storageState)
    }, options.storageState)
    await setupPage.close()
    if (initialUrl !== "about:blank") {
      await page.bringToFront()
    }
  }

  if (initialUrl === "about:blank") {
    await page.goto(initialUrl, { waitUntil: "domcontentloaded", timeout: 15_000 })
  }

  return {
    context,
    page,
    extensionId,
    extensionPath,
    browserExecutablePath,
    async close() {
      try { await context.close() } catch { /* already closed */ }
      try { await rm(userDataDir, { recursive: true, force: true }) } catch { /* best-effort cleanup */ }
    },
  }
}

export async function resolveExtensionManifestPath(extensionPath?: string): Promise<string> {
  const resolvedPath = extensionPath ?? DEFAULT_EXTENSION_PATH
  const manifestPath = path.join(resolvedPath, "manifest.json")
  const exists = await pathExists(manifestPath)
  if (!exists) {
    throw new ExtensionBuildNotFoundError(
      `Extension manifest not found at ${manifestPath}. Run "pnpm build" first.`,
    )
  }
  return manifestPath
}

export async function resolveExtensionPopupPath(extensionPath?: string): Promise<string> {
  const manifestPath = await resolveExtensionManifestPath(extensionPath)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    action?: { default_popup?: string }
  }

  const popupPath = manifest.action?.default_popup
  if (!popupPath) {
    throw new ExtensionBuildNotFoundError(
      `No action.default_popup entry was found in manifest ${manifestPath}.`,
    )
  }

  return popupPath.replace(/^\//, "")
}

export async function openExtensionActionPopup(options: {
  context: BrowserContext
  extensionId: string
  extensionPath?: string
  timeoutMs?: number
  page?: Page
}): Promise<Page> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const popupPath = await resolveExtensionPopupPath(options.extensionPath)
  const popupUrlPrefix = `chrome-extension://${options.extensionId}/${popupPath}`
  const knownPages = new Set(options.context.pages())
  const existingServiceWorker = options.context.serviceWorkers()[0] ?? null
  const serviceWorker = existingServiceWorker ?? await options.context.waitForEvent("serviceworker", {
    timeout: timeoutMs,
  }).catch(() => null)

  if (options.page) {
    await options.page.bringToFront()
  }

  if (serviceWorker) {
    await serviceWorker.evaluate(async () => {
      const actionApi = (globalThis as typeof globalThis & {
        chrome?: {
          action?: {
            openPopup?: () => Promise<void>
          }
        }
      }).chrome?.action

      if (!actionApi?.openPopup) {
        throw new Error("chrome.action.openPopup is unavailable in the extension worker.")
      }

      await actionApi.openPopup()
    })
  } else {
    const fallbackPage = options.page ?? options.context.pages()[0] ?? await options.context.newPage()

    await fallbackPage.evaluate((url) => {
      globalThis.open(url, "_blank", "noopener,noreferrer")
    }, popupUrlPrefix).catch(() => undefined)

    await delay(500)

    const hasPopupPage = options.context.pages().some((page) => !knownPages.has(page) && page.url().startsWith(popupUrlPrefix))
    if (!hasPopupPage) {
      const cdp = await options.context.newCDPSession(fallbackPage)
      await cdp.send("Target.createTarget", {
        url: popupUrlPrefix,
        background: false,
      })
    }
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    for (const page of options.context.pages()) {
      if (!knownPages.has(page) && page.url().startsWith(popupUrlPrefix)) {
        await page.waitForLoadState("domcontentloaded", {
          timeout: Math.max(250, deadline - Date.now()),
        })
        return page
      }
    }
    await delay(100)
  }

  const existingPopupPage = options.context.pages().find((page) => page.url().startsWith(popupUrlPrefix))
  if (existingPopupPage) {
    await existingPopupPage.waitForLoadState("domcontentloaded", { timeout: timeoutMs })
    return existingPopupPage
  }

  throw new Error(`Timed out waiting for extension popup page ${popupUrlPrefix}.`)
}

export async function resolveExtensionPagePath(extensionPath?: string): Promise<string> {
  const manifestPath = await resolveExtensionManifestPath(extensionPath)
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    action?: { default_popup?: string }
    options_ui?: { page?: string }
    options_page?: string
  }

  const candidate = manifest.options_ui?.page
    ?? manifest.options_page
    ?? manifest.action?.default_popup

  if (!candidate) {
    throw new ExtensionBuildNotFoundError(
      `No extension HTML page was found in manifest ${manifestPath} to seed chrome.storage.local.`,
    )
  }

  return candidate.replace(/^\//, "")
}
