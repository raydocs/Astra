/** Minimal Bilibili-style subtitle fixture for live smoke (Month 4). */

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export function buildBilibiliSubtitleFixtureHtml(options: {
  title?: string
  url?: string
  captionLines?: string[]
} = {}) {
  const title = options.title ?? "Astra Bilibili Subtitle Fixture"
  const url = options.url ?? "https://www.bilibili.com/video/BV1astraLive"
  const lines = options.captionLines ?? ["字幕一行", "第二行"]
  const textHtml = lines
    .map((line) => `<div class="bpx-player-subtitle-panel-text">${escapeHtml(line)}</div>`)
    .join("")

  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\" />",
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    "body { font-family: system-ui, sans-serif; margin: 24px; }",
    "video { width: 100%; max-width: 640px; background: #000; }",
    ".bpx-player-subtitle-panel { margin-top: 12px; padding: 12px; border: 1px solid #fb7299; border-radius: 8px; background: #1a1a2e; color: #fff; }",
    ".bpx-player-subtitle-panel-text { margin: 4px 0; }",
    "</style></head><body>",
    `<main data-astra-url="${escapeHtml(url)}">`,
    '  <video id="astra-bilibili-video" controls muted playsinline></video>',
    `  <div class="bpx-player-subtitle-panel">${textHtml}</div>`,
    "</main></body></html>",
  ].join("\n")
}
