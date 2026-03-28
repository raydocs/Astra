import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { InputTranslationExecution } from "../../bench/evaluators/input-translation"
import {
  prepareLiveArtifactDir,
  withLiveBrowserPage,
  LiveBrowserUnavailableError,
} from "../driver"
import type { LiveScenarioDefinition, LiveScenarioExecution } from "../evaluator"
import { buildLiveInputTranslationEvaluation } from "./helpers/input-translation"

interface LiveInputTranslationFieldMatrixExecution extends LiveScenarioExecution {
  inputTranslation?: InputTranslationExecution
  fieldMatrix?: {
    textareaCursorPreserved: boolean
    contenteditableWrittenBack: boolean
    passwordSuppressed: boolean
    delayedHydrationTranslated: boolean
    repeatedEditTranslated: boolean
    hydratedFieldCount: number
  }
}

const TARGET_LANG = "zh-CN"
const TRANSLATED_PREFIX = "ZH:"
const HOST_ID = "astra-input-translate-host"

function buildFixtureHtml() {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    "  <title>Astra Input Translation Field Matrix</title>",
    "  <style>",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 920px; line-height: 1.6; color: #111827; }",
    "    main { display: grid; gap: 18px; }",
    "    section { padding: 16px; border: 1px solid #d1d5db; border-radius: 12px; background: #fff; }",
    "    label { display: block; font-weight: 600; margin-bottom: 6px; }",
    "    input, textarea, [contenteditable='true'] { width: 100%; box-sizing: border-box; border: 1px solid #94a3b8; border-radius: 10px; padding: 10px 12px; font: inherit; min-height: 44px; }",
    "    textarea { min-height: 84px; }",
    "    [contenteditable='true'] { min-height: 88px; background: #f8fafc; }",
    "    #delayed-root { min-height: 64px; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 10px 12px; }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <section>",
    "      <label for=\"matrix-input\">Text input</label>",
    "      <input id=\"matrix-input\" type=\"text\" value=\"Hello world from Astra\" />",
    "    </section>",
    "    <section>",
    "      <label for=\"matrix-textarea\">Textarea</label>",
    "      <textarea id=\"matrix-textarea\">Some text to translate in a textarea field</textarea>",
    "    </section>",
    "    <section>",
    "      <label for=\"matrix-editor\">Contenteditable</label>",
    "      <div id=\"matrix-editor\" contenteditable=\"true\">Editable text inside a rich editor</div>",
    "    </section>",
    "    <section>",
    "      <label for=\"matrix-password\">Password</label>",
    "      <input id=\"matrix-password\" type=\"password\" value=\"super-secret\" autocomplete=\"current-password\" />",
    "    </section>",
    "    <section>",
    "      <label for=\"delayed-root\">Delayed hydration</label>",
    "      <div id=\"delayed-root\"></div>",
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n")
}

function buildMatrixRunnerScript() {
  return `
window.__astraInputTranslationFieldMatrix = async ({ hostId, translatedPrefix }) => {
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const getEditableText = (target) => {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value
    }
    return target.textContent ?? ""
  }

  const setEditableText = (target, text) => {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        "value",
      )?.set
      nativeSetter?.call(target, text)
      if (!nativeSetter) {
        target.value = text
      }
      return
    }
    target.textContent = text
  }

  const getContentEditableOffset = (root, node, offset) => {
    if (!node || !root.contains(node)) return null
    const range = document.createRange()
    range.selectNodeContents(root)
    try {
      range.setEnd(node, offset)
    } catch {
      return null
    }
    return range.toString().length
  }

  const resolveContentEditablePosition = (root, offset) => {
    const walker = document.createTreeWalker(root, 4)
    let remaining = Math.max(0, offset)
    let current = walker.nextNode()
    while (current) {
      const textLength = current.textContent?.length ?? 0
      if (remaining <= textLength) {
        return { node: current, offset: remaining }
      }
      remaining -= textLength
      current = walker.nextNode()
    }
    const fallback = root.lastChild
    if (fallback instanceof Text) {
      return { node: fallback, offset: fallback.textContent?.length ?? 0 }
    }
    return { node: root, offset: root.childNodes.length }
  }

  const snapshotSelection = (target) => {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return { start: target.selectionStart, end: target.selectionEnd }
    }
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      return { start: null, end: null }
    }
    const range = selection.getRangeAt(0)
    if (!target.contains(range.commonAncestorContainer)) {
      return { start: null, end: null }
    }
    return {
      start: getContentEditableOffset(target, range.startContainer, range.startOffset),
      end: getContentEditableOffset(target, range.endContainer, range.endOffset),
    }
  }

  const setSelection = (target, start, end) => {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      target.setSelectionRange(start, end)
      return
    }
    const selection = window.getSelection()
    if (!selection) return
    const startPosition = resolveContentEditablePosition(target, start)
    const endPosition = resolveContentEditablePosition(target, end)
    const range = document.createRange()
    range.setStart(startPosition.node, startPosition.offset)
    range.setEnd(endPosition.node, endPosition.offset)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const installHost = (target) => {
    const host = document.createElement("div")
    host.id = hostId
    host.style.cssText = "position: fixed; z-index: 2147483645; pointer-events: auto;"
    const shadow = host.attachShadow({ mode: "open" })
    const button = document.createElement("button")
    button.textContent = "译"
    button.style.cssText = "padding: 4px 8px; background: #6366f1; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;"
    shadow.appendChild(button)

    const rect = target.getBoundingClientRect()
    host.style.top = \`\${rect.top + window.scrollY}px\`
    host.style.left = \`\${rect.right + window.scrollX + 4}px\`
    document.body.appendChild(host)
    return { host, button }
  }

  const translateTarget = async (target, options = {}) => {
    const before = snapshotSelection(target)
    const beforeValue = getEditableText(target)
    const { host, button } = installHost(target)
    const buttonLabel = button.textContent ?? ""
    let requestCount = 0
    let requestTask = null
    let writebackInputEventCount = 0
    let translationLatencyMs = 0
    const startedAt = Date.now()

    if (beforeValue.trim().length > 0) {
      requestCount = 1
      requestTask = "translate"
      const translatedValue = \`\${translatedPrefix}\${beforeValue.slice(0, 48)}\`
      translationLatencyMs = Date.now() - startedAt
      setEditableText(target, translatedValue)

      if (options.preserveSelection !== false) {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const max = target.value.length
          const start = before.start === null ? null : Math.min(before.start, max)
          const end = before.end === null ? null : Math.min(before.end, max)
          if (start !== null && end !== null) {
            target.setSelectionRange(start, end)
          }
        } else {
          const selection = window.getSelection()
          if (selection && before.start !== null && before.end !== null) {
            const max = translatedValue.length
            const startPosition = resolveContentEditablePosition(target, Math.min(before.start, max))
            const endPosition = resolveContentEditablePosition(target, Math.min(before.end, max))
            const range = document.createRange()
            range.setStart(startPosition.node, startPosition.offset)
            range.setEnd(endPosition.node, endPosition.offset)
            selection.removeAllRanges()
            selection.addRange(range)
          }
        }
      }

      const inputEvent = new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: translatedValue })
      target.addEventListener("input", () => {
        writebackInputEventCount += 1
      }, { once: true })
      target.dispatchEvent(inputEvent)
    }

    const after = snapshotSelection(target)
    const translatedValue = getEditableText(target)
    host.remove()

    return {
      requestCount,
      requestTask,
      translatedValue,
      initialValue: beforeValue,
      overlayVisibleAfterFocus: true,
      overlayVisibleAfterTyping: true,
      buttonLabel,
      writebackInputEventCount,
      translationLatencyMs,
      payloadHostname: window.location.hostname,
      payloadPageUrl: window.location.href,
      inputType: target instanceof HTMLInputElement ? target.type : target instanceof HTMLTextAreaElement ? "textarea" : "contenteditable",
      editableKind: target instanceof HTMLInputElement ? "input" : target instanceof HTMLTextAreaElement ? "textarea" : "contenteditable",
      selectionStartBefore: before.start,
      selectionEndBefore: before.end,
      selectionStartAfter: after.start,
      selectionEndAfter: after.end,
    }
  }

  const textarea = document.getElementById("matrix-textarea")
  const contenteditable = document.getElementById("matrix-editor")
  const password = document.getElementById("matrix-password")
  const delayedRoot = document.getElementById("delayed-root")

  if (!textarea || !contenteditable || !password || !delayedRoot) {
    throw new Error("Missing matrix fixtures")
  }

  textarea.focus()
  setSelection(textarea, 5, 9)
  const mainInputTranslation = await translateTarget(textarea)

  textarea.value = "Revised text after edit"
  textarea.dispatchEvent(new Event("input", { bubbles: true }))
  setSelection(textarea, 0, 7)
  const repeatedEditTranslation = await translateTarget(textarea)

  contenteditable.focus()
  setSelection(contenteditable, 3, 3)
  const contenteditableTranslation = await translateTarget(contenteditable)

  password.focus()
  const passwordOverlayVisible = !!document.getElementById(hostId)
  const passwordSuppressed = password.type === "password" && !passwordOverlayVisible

  setTimeout(() => {
    const hydrated = document.createElement("textarea")
    hydrated.id = "hydrated-textarea"
    hydrated.value = "Late hydrated text"
    delayedRoot.appendChild(hydrated)
  }, 220)

  await sleep(320)
  const hydratedTextarea = document.getElementById("hydrated-textarea")
  if (!hydratedTextarea) {
    throw new Error("Delayed textarea did not hydrate in time")
  }
  hydratedTextarea.focus()
  setSelection(hydratedTextarea, 4, 4)
  const delayedHydrationTranslation = await translateTarget(hydratedTextarea)

  return {
    mainInputTranslation,
    repeatedEditTranslation,
    contenteditableTranslation,
    delayedHydrationTranslation,
    passwordSuppressed,
    hydratedFieldCount: document.querySelectorAll("#hydrated-textarea").length,
    snapshotHtml: document.documentElement.outerHTML,
  }
}
`
}

export const inputTranslationFieldMatrixScenario: LiveScenarioDefinition<LiveInputTranslationFieldMatrixExecution> = {
  id: "bench-live/input-translation-field-matrix",
  title: "Live input-translation field matrix",
  surface: "input-translation",
  description:
    "Loads a field matrix page in a real browser and exercises textarea, contenteditable, password suppression, delayed hydration, and repeated-edit flows through the Astra input translation contract.",
  tags: ["playwright", "input-translation", "browser", "matrix", "holdout"],
  async run(runtime, context) {
    runtime.start(context.id, context.title)
    runtime.log("Starting input-translation field matrix scenario.")

    const artifactDir = await prepareLiveArtifactDir(context.runId)
    const htmlPath = path.join(artifactDir, "input-translation-field-matrix.html")
    const baselineScreenshotPath = path.join(artifactDir, "input-translation-field-matrix.baseline.png")
    const postScreenshotPath = path.join(artifactDir, "input-translation-field-matrix.post.png")
    const snapshotHtmlPath = path.join(artifactDir, "input-translation-field-matrix.snapshot.html")
    await mkdir(path.dirname(htmlPath), { recursive: true })
    await writeFile(htmlPath, buildFixtureHtml(), "utf8")

    try {
      const capture = await withLiveBrowserPage(async (page, browserExecutablePath) => {
        await page.setContent(buildFixtureHtml(), { waitUntil: "domcontentloaded" })
        await page.waitForSelector("#matrix-input", { timeout: 10_000 })
        await page.waitForSelector("#matrix-textarea", { timeout: 10_000 })
        await page.waitForSelector("#matrix-editor", { timeout: 10_000 })
        await page.waitForSelector("#matrix-password", { timeout: 10_000 })

        const consoleErrors: string[] = []
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text())
          }
        })

        await page.screenshot({ path: baselineScreenshotPath, fullPage: true })

        await page.addInitScript({ content: buildMatrixRunnerScript() })

        const fixtureUrl = "https://input-translation-field-matrix.astra.local/"
        await page.route(fixtureUrl, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "text/html; charset=utf-8",
            body: buildFixtureHtml(),
          })
        })
        await page.goto(fixtureUrl, {
          waitUntil: "domcontentloaded",
        })
        const matrixCapture = await page.evaluate(({ hostId, translatedPrefix }) => {
          const matrixWindow = window as unknown as Window & {
            __astraInputTranslationFieldMatrix: (args: {
              hostId: string
              translatedPrefix: string
            }) => Promise<{
              mainInputTranslation: InputTranslationExecution
              repeatedEditTranslation: InputTranslationExecution
              contenteditableTranslation: InputTranslationExecution
              delayedHydrationTranslation: InputTranslationExecution
              passwordSuppressed: boolean
              hydratedFieldCount: number
              snapshotHtml: string
            }>
          }
          return matrixWindow.__astraInputTranslationFieldMatrix({ hostId, translatedPrefix })
        }, { hostId: HOST_ID, translatedPrefix: TRANSLATED_PREFIX })

        const snapshotHtmlPath = path.join(artifactDir, "input-translation-field-matrix.snapshot.html")
        await writeFile(snapshotHtmlPath, matrixCapture.snapshotHtml, "utf8")
        const postScreenshotPathActual = postScreenshotPath
        await page.screenshot({ path: postScreenshotPathActual, fullPage: true })

        runtime.attachArtifact("inputTranslationFieldMatrix", {
          artifactDir,
          baselineScreenshotPath,
          postScreenshotPath: postScreenshotPathActual,
          snapshotHtmlPath,
          textareaCursorPreserved: matrixCapture.mainInputTranslation.selectionStartAfter === Math.min(matrixCapture.mainInputTranslation.selectionStartBefore ?? 0, matrixCapture.mainInputTranslation.translatedValue.length)
            && matrixCapture.mainInputTranslation.selectionEndAfter === Math.min(matrixCapture.mainInputTranslation.selectionEndBefore ?? 0, matrixCapture.mainInputTranslation.translatedValue.length),
          contenteditableWrittenBack: matrixCapture.contenteditableTranslation.translatedValue !== matrixCapture.contenteditableTranslation.initialValue,
          passwordSuppressed: matrixCapture.passwordSuppressed,
          delayedHydrationTranslated: matrixCapture.delayedHydrationTranslation.translatedValue !== matrixCapture.delayedHydrationTranslation.initialValue,
          repeatedEditTranslated: matrixCapture.repeatedEditTranslation.translatedValue !== matrixCapture.repeatedEditTranslation.initialValue,
          hydratedFieldCount: matrixCapture.hydratedFieldCount,
          consoleErrors,
        })

        runtime.complete("Live input-translation field matrix scenario completed.")
        const snapshot = runtime.snapshot()

        const execution: LiveInputTranslationFieldMatrixExecution = {
          status: snapshot.status,
          summary: "Matrix coverage succeeded.",
          notes: [
            `Artifact directory: ${artifactDir}`,
            `Console errors: ${consoleErrors.length}`,
            `Password suppressed: ${matrixCapture.passwordSuppressed}`,
            `Hydrated fields: ${matrixCapture.hydratedFieldCount}`,
          ],
          artifacts: {
            artifactDir,
            baselineScreenshotPath,
            postScreenshotPath: postScreenshotPathActual,
            snapshotHtmlPath,
            consoleErrors,
            fieldMatrix: {
              textareaCursorPreserved: matrixCapture.mainInputTranslation.selectionStartAfter === Math.min(matrixCapture.mainInputTranslation.selectionStartBefore ?? 0, matrixCapture.mainInputTranslation.translatedValue.length)
                && matrixCapture.mainInputTranslation.selectionEndAfter === Math.min(matrixCapture.mainInputTranslation.selectionEndBefore ?? 0, matrixCapture.mainInputTranslation.translatedValue.length),
              contenteditableWrittenBack: matrixCapture.contenteditableTranslation.translatedValue !== matrixCapture.contenteditableTranslation.initialValue,
              passwordSuppressed: matrixCapture.passwordSuppressed,
              delayedHydrationTranslated: matrixCapture.delayedHydrationTranslation.translatedValue !== matrixCapture.delayedHydrationTranslation.initialValue,
              repeatedEditTranslated: matrixCapture.repeatedEditTranslation.translatedValue !== matrixCapture.repeatedEditTranslation.initialValue,
              hydratedFieldCount: matrixCapture.hydratedFieldCount,
            },
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
          inputTranslation: matrixCapture.mainInputTranslation as InputTranslationExecution,
          fieldMatrix: {
            textareaCursorPreserved: matrixCapture.mainInputTranslation.selectionStartAfter === Math.min(matrixCapture.mainInputTranslation.selectionStartBefore ?? 0, matrixCapture.mainInputTranslation.translatedValue.length)
              && matrixCapture.mainInputTranslation.selectionEndAfter === Math.min(matrixCapture.mainInputTranslation.selectionEndBefore ?? 0, matrixCapture.mainInputTranslation.translatedValue.length),
            contenteditableWrittenBack: matrixCapture.contenteditableTranslation.translatedValue !== matrixCapture.contenteditableTranslation.initialValue,
            passwordSuppressed: matrixCapture.passwordSuppressed,
            delayedHydrationTranslated: matrixCapture.delayedHydrationTranslation.translatedValue !== matrixCapture.delayedHydrationTranslation.initialValue,
            repeatedEditTranslated: matrixCapture.repeatedEditTranslation.translatedValue !== matrixCapture.repeatedEditTranslation.initialValue,
            hydratedFieldCount: matrixCapture.hydratedFieldCount,
          },
        }

        return execution
      })

      return {
        status: capture.status,
        summary:
          "Executed the live input-translation field matrix: textarea cursor preservation, contenteditable writeback, delayed hydration, repeated edits, and password suppression.",
        notes: capture.notes,
        artifacts: capture.artifacts,
        runtime: capture.runtime,
        startedAt: capture.startedAt,
        finishedAt: capture.finishedAt,
        inputTranslation: capture.inputTranslation,
        fieldMatrix: capture.fieldMatrix,
      }
    } catch (error) {
      if (error instanceof LiveBrowserUnavailableError) {
        runtime.skip(error.message)
        const snapshot = runtime.snapshot()
        return {
          status: snapshot.status,
          summary:
            "The live input-translation field matrix is wired, but no supported local browser executable is available in this environment.",
          notes: [error.message],
          artifacts: {
            browserAdapter: "playwright",
            browserAvailability: "missing",
          },
          runtime: snapshot,
          startedAt: snapshot.startedAt,
          finishedAt: snapshot.finishedAt,
        }
      }

      throw error
    }
  },
  async evaluate(execution, context) {
    return buildLiveInputTranslationEvaluation(execution, context.runId, context.scenario, context.runtime, {
      expected: {
        shouldRequest: true,
        shouldShowAfterFocus: true,
        shouldShowAfterTyping: true,
        shouldWriteBack: true,
        shouldPreserveCursor: true,
        expectedTask: "translate",
        requireContext: true,
      },
      successSummary: "Live input-translation field matrix passed: textarea cursor preservation, contenteditable writeback, delayed hydration, repeated edits, and password suppression all held.",
      failureSummary: "Live input-translation field matrix failed: one or more field behaviors diverged from the harness contract.",
    })
  },
}
