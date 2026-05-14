export interface YouTubeSubtitleFixtureOptions {
  title?: string
  url?: string
  videoId?: string
  containerId?: string
  initialState?: string
  captionLines?: string[]
}

export interface YouTubeCaptionSnapshot {
  sourceText: string
  sourceSegmentTexts: string[]
  translationText: string | null
  translationTexts: string[]
  translationNodeCount: number
  stateLabel: string | null
}

export function normalizeYouTubeCaptionText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function collapseAdjacentDuplicates(parts: string[]): string[] {
  const normalized: string[] = []

  for (const part of parts) {
    const text = normalizeYouTubeCaptionText(part)
    if (!text) continue
    if (normalized.at(-1) === text) continue
    normalized.push(text)
  }

  return normalized
}

export function buildYouTubeCaptionMarkup(
  captionLines: string[],
  options: {
    initialState?: string
    containerId?: string
  } = {},
) {
  const safeLines = captionLines.length > 0 ? captionLines : [""]
  const segments = safeLines
    .map((line) => `<span class="ytp-caption-segment"><span class="ytp-caption-segment-inner">${escapeHtml(line)}</span></span>`)
    .join("")

  return `
    <div class="ytp-caption-window-container" id="${options.containerId ?? "astra-youtube-caption-window"}">
      <div class="ytp-caption-window-bottom" data-astra-playback-state="${escapeHtml(options.initialState ?? "playing")}">
        ${segments}
      </div>
    </div>
  `
}

export function buildYouTubeSubtitleFixtureBody(options: YouTubeSubtitleFixtureOptions = {}) {
  const videoId = options.videoId ?? "astra-youtube-video"
  const containerId = options.containerId ?? "astra-youtube-caption-window"
  const captionLines = options.captionLines ?? ["Welcome to Astra", "subtitle mode"]
  const captionMarkup = buildYouTubeCaptionMarkup(captionLines, {
    initialState: options.initialState ?? "playing",
    containerId,
  })

  return [
    `  <main data-astra-url="${escapeHtml(options.url ?? "/watch?v=astra-youtube-fixture")}">`,
    `    <video id="${escapeHtml(videoId)}" controls muted playsinline></video>`,
    captionMarkup,
    "  </main>",
  ].join("\n")
}

export function buildYouTubeSubtitleFixtureHtml(options: YouTubeSubtitleFixtureOptions = {}) {
  const title = options.title ?? "Astra YouTube Subtitle Fixture"
  const url = options.url ?? "/watch?v=astra-youtube-fixture"
  const bodyHtml = buildYouTubeSubtitleFixtureBody(options)

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '  <meta charset="utf-8" />',
    `  <title>${escapeHtml(title)}</title>`,
    "  <style>",
    "    body { font-family: system-ui, sans-serif; margin: 24px auto; max-width: 960px; line-height: 1.5; }",
    "    video { width: 100%; max-width: 720px; background: #000; display: block; margin-bottom: 16px; }",
    "    .ytp-caption-window-container { position: relative; margin-top: 16px; padding: 12px; border: 1px solid #d1d5db; border-radius: 12px; background: #111827; color: white; }",
    "    .ytp-caption-window-bottom { display: inline-block; background: rgba(17, 24, 39, 0.85); padding: 8px 12px; border-radius: 8px; }",
    "    .ytp-caption-segment { display: inline; }",
    "  </style>",
    "</head>",
    "<body>",
    bodyHtml,
    "</body>",
    "</html>",
  ].join("\n")
}

export function extractYouTubeCaptionSnapshot(container: HTMLElement): YouTubeCaptionSnapshot {
  const bottom = container.querySelector(".ytp-caption-window-bottom") as HTMLElement | null
  const sourceRoot = bottom ?? container

  const sourceSegmentTexts = Array.from(sourceRoot.querySelectorAll(".ytp-caption-segment"))
    .map((segment) => normalizeYouTubeCaptionText(segment.textContent ?? ""))
    .filter((segment) => segment.length > 0)

  const sourceText = collapseAdjacentDuplicates(sourceSegmentTexts).join(" ")
  const translationTexts = Array.from(sourceRoot.querySelectorAll(".astra-video-subtitle"))
    .map((node) => normalizeYouTubeCaptionText(node.textContent ?? ""))
    .filter((segment) => segment.length > 0)

  return {
    sourceText,
    sourceSegmentTexts,
    translationText: translationTexts.at(-1) ?? null,
    translationTexts,
    translationNodeCount: translationTexts.length,
    stateLabel: sourceRoot.getAttribute("data-astra-playback-state"),
  }
}

export function updateYouTubeCaptionMarkup(
  container: HTMLElement,
  captionLines: string[],
  options: {
    stateLabel?: string
  } = {},
) {
  const bottom = container.querySelector(".ytp-caption-window-bottom") ?? container
  bottom.innerHTML = captionLines
    .map((line) => `<span class="ytp-caption-segment"><span class="ytp-caption-segment-inner">${escapeHtml(line)}</span></span>`)
    .join("")
  if (options.stateLabel) {
    bottom.setAttribute("data-astra-playback-state", options.stateLabel)
  }
}
