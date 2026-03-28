import { installBenchBrowser, type TranslationBatchPayload } from "../../runtime/browser"
import { exportBilingualSrt, exportBilingualVtt, parseSubtitles, type SubtitleCue, type SubtitleFormat } from "../../../src/entrypoints/subtitle-reader/subtitle-parser"

export type SubtitleFilePreviewMode = "bilingual" | "translation-only"

export interface SubtitleFileFixture {
  fileName: string
  content: string
  previewMode: SubtitleFilePreviewMode
}

export interface SubtitleFileHarnessExecution {
  fileCount: number
  fileNames: string[]
  formatsSeen: SubtitleFormat[]
  cueCount: number
  translationRequestCount: number
  translatedCueCount: number
  previewSectionCount: number
  previewRowCount: number
  exportFormats: Array<"srt" | "vtt">
  sourceTimingPreserved: boolean
  exportTimingPreserved: boolean
  warnings: string[]
  previewWarnings: string[]
  translateCallContexts: Array<Record<string, unknown> | null>
  privacyContextLeakCount: number
  fileSummaries: Array<{
    fileName: string
    format: SubtitleFormat
    cueCount: number
    warnings: string[]
    previewMode: SubtitleFilePreviewMode
  }>
}

export interface SubtitleFileHarnessResult {
  execution: SubtitleFileHarnessExecution
  renderedHtml: string
  translateCalls: Array<{
    payload: TranslationBatchPayload
    durationMs: number
  }>
}

function normalizeTimecode(timecode: string) {
  return timecode.replace(",", ".")
}

function parseTimecodeSeconds(timecode: string) {
  const normalized = normalizeTimecode(timecode)
  const match = normalized.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{1,3})$/)
  if (!match) return Number.NaN
  const [, hh, mm, ss, ms] = match
  return Number(hh) * 3600 + Number(mm) * 60 + Number(ss) + Number(ms.padEnd(3, "0")) / 1000
}

function detectCueWarnings(cues: SubtitleCue[]) {
  const warnings: string[] = []
  for (let index = 0; index < cues.length; index += 1) {
    const cue = cues[index]
    const start = parseTimecodeSeconds(cue.startTime)
    const end = parseTimecodeSeconds(cue.endTime)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      warnings.push(`cue ${cue.index} has invalid timing (${cue.startTime} -> ${cue.endTime})`)
    }

    const previous = cues[index - 1]
    if (previous) {
      const previousEnd = parseTimecodeSeconds(previous.endTime)
      if (Number.isFinite(previousEnd) && Number.isFinite(start) && start < previousEnd) {
        warnings.push(`cue ${cue.index} overlaps cue ${previous.index}`)
      }
    }
  }
  return warnings
}

function renderExportPreview(cues: SubtitleCue[], translations: Map<number, string>) {
  const bilingualRows = cues.map((cue, index) => {
    const translation = translations.get(index) ?? ""
    return `
      <tr data-role="subtitle-row" data-cue-index="${index}">
        <td>${cue.index}</td>
        <td data-role="subtitle-time">${cue.startTime} --> ${cue.endTime}</td>
        <td data-role="subtitle-source">${cue.text.replace(/\n/g, "<br />")}</td>
        <td data-role="subtitle-translation">${translation ? translation.replace(/\n/g, "<br />") : ""}</td>
      </tr>
    `
  }).join("")

  const translationOnlyRows = cues.map((cue, index) => {
    const translation = translations.get(index) ?? ""
    return `
      <tr data-role="subtitle-row" data-cue-index="${index}">
        <td>${cue.index}</td>
        <td data-role="subtitle-time">${cue.startTime} --> ${cue.endTime}</td>
        <td data-role="subtitle-source">${translation ? translation.replace(/\n/g, "<br />") : ""}</td>
      </tr>
    `
  }).join("")

  return { bilingualRows, translationOnlyRows }
}

function normalizeTranslateCallContext(context: TranslationBatchPayload["context"]): Record<string, unknown> | null {
  if (!context || typeof context !== "object") {
    return null
  }
  return context as Record<string, unknown>
}

export async function runSubtitleFileHarness(fixtures: SubtitleFileFixture[]): Promise<SubtitleFileHarnessResult> {
  const browser = installBenchBrowser({
    config: {
      targetLang: "zh-CN",
      privacyMode: false,
      provider: {
        id: "openai",
        accessToken: "bench-token",
        apiKey: "",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
    },
  })

  const fileSummaries: SubtitleFileHarnessExecution["fileSummaries"] = []
  const fileNames: string[] = []
  const formatsSeen = new Set<SubtitleFormat>()
  const warnings: string[] = []
  const previewWarnings: string[] = []
  const renderedSections: string[] = []
  const exportFormats = new Set<"srt" | "vtt">()
  let cueCount = 0
  let translatedCueCount = 0
  let translationRequestCount = 0
  let sourceTimingPreserved = true
  let exportTimingPreserved = true

  for (const fixture of fixtures) {
    fileNames.push(fixture.fileName)
    const parsed = parseSubtitles(fixture.content)
    formatsSeen.add(parsed.format)
    const cueWarnings = detectCueWarnings(parsed.cues)
    warnings.push(...cueWarnings)
    previewWarnings.push(...cueWarnings)
    cueCount += parsed.cues.length

    const runtime = browser.browser.runtime as unknown as {
      sendMessage: (message: {
        type: string
        payload: {
          texts: string[]
          targetLang: string
          task: string
        }
      }) => Promise<{
        type: string
        payload?: {
          translations: string[]
        }
      }>
    }

    const response = await runtime.sendMessage({
      type: "runtime/translate-batch",
      payload: {
        texts: parsed.cues.map((cue) => cue.text.replace(/\n/g, " ")),
        targetLang: "zh-CN",
        task: "translate",
      },
    })

    if (response.type !== "runtime/translate-batch:success" || !response.payload) {
      throw new Error(`Unexpected subtitle-file translation response: ${JSON.stringify(response)}`)
    }

    translationRequestCount += 1
    const payload = response.payload
    const translations = new Map<number, string>()
    parsed.cues.forEach((cue, index) => {
      translations.set(index, payload.translations[index] ?? "")
    })
    translatedCueCount += parsed.cues.length
    exportFormats.add("srt")
    exportFormats.add("vtt")

    const bilingualSrt = exportBilingualSrt(parsed.cues, translations)
    const bilingualVtt = exportBilingualVtt(parsed.cues, translations)
    sourceTimingPreserved = sourceTimingPreserved && parsed.cues.every((cue) => cue.rawTimeline.includes(cue.startTime))
    exportTimingPreserved = exportTimingPreserved && bilingualVtt.includes("WEBVTT") && bilingualSrt.includes("-->")

    const { bilingualRows, translationOnlyRows } = renderExportPreview(parsed.cues, translations)
    renderedSections.push(`
      <section data-role="subtitle-file-section" data-file-name="${fixture.fileName}" data-format="${parsed.format}" data-preview-mode="${fixture.previewMode}">
        <header>
          <h2>${fixture.fileName}</h2>
          <p data-role="subtitle-file-meta">format=${parsed.format}; cues=${parsed.cues.length}; previewMode=${fixture.previewMode}</p>
        </header>
        <div data-role="subtitle-file-warning"${cueWarnings.length ? "" : " hidden"}>${cueWarnings.join(" | ")}</div>
        <div data-role="subtitle-file-preview" data-mode="bilingual">
          <table>
            <tbody>${bilingualRows}</tbody>
          </table>
        </div>
        <div data-role="subtitle-file-preview" data-mode="translation-only">
          <table>
            <tbody>${translationOnlyRows}</tbody>
          </table>
        </div>
        <textarea data-role="subtitle-file-export-srt" readonly>${bilingualSrt.replace(/</g, "&lt;")}</textarea>
        <textarea data-role="subtitle-file-export-vtt" readonly>${bilingualVtt.replace(/</g, "&lt;")}</textarea>
      </section>
    `)

    fileSummaries.push({
      fileName: fixture.fileName,
      format: parsed.format,
      cueCount: parsed.cues.length,
      warnings: cueWarnings,
      previewMode: fixture.previewMode,
    })
  }

  const renderedHtml = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Astra Subtitle File Reader Harness</title>
      <style>
        body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 1080px; line-height: 1.6; color: #0f172a; }
        main { display: grid; gap: 20px; }
        section { padding: 16px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        [data-role="subtitle-file-warning"] { color: #b45309; background: #fffbeb; border: 1px solid #fcd34d; padding: 8px 10px; border-radius: 10px; margin: 12px 0; }
        [data-role="subtitle-file-preview"] { margin-top: 12px; }
        [data-role="subtitle-file-preview"][data-mode="translation-only"] { margin-top: 16px; }
        textarea { width: 100%; min-height: 120px; margin-top: 10px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; font-family: ui-monospace, SFMono-Regular, monospace; font-size: 12px; }
      </style>
    </head>
    <body>
      <main data-astra-subtitle-file-reader>
        <header>
          <h1>Astra Subtitle File Reader</h1>
          <p data-role="subtitle-file-summary">${fileNames.length} file(s); cues=${cueCount}; requests=${translationRequestCount}</p>
        </header>
        ${renderedSections.join("\n")}
      </main>
    </body>
  </html>`

  return {
    execution: {
      fileCount: fileNames.length,
      fileNames,
      formatsSeen: [...formatsSeen],
      cueCount,
      translationRequestCount,
      translatedCueCount,
      previewSectionCount: fileSummaries.length,
      previewRowCount: cueCount,
      exportFormats: [...exportFormats],
      sourceTimingPreserved,
      exportTimingPreserved,
      warnings,
      previewWarnings,
      translateCallContexts: browser.getTranslateCalls().map((call) => normalizeTranslateCallContext(call.payload.context)),
      privacyContextLeakCount: browser.getTranslateCalls().filter((call) => normalizeTranslateCallContext(call.payload.context) !== null).length,
      fileSummaries,
    },
    renderedHtml,
    translateCalls: browser.getTranslateCalls().map((call) => ({
      payload: call.payload,
      durationMs: call.durationMs,
    })),
  }
}
