/**
 * Generates a styled bilingual card as an HTML string for sharing.
 */
export function generateBilingualCard(
  original: string,
  translation: string,
  url: string,
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")

  return [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;',
    "max-width:480px;border-radius:8px;overflow:hidden;",
    'border:1px solid #e5e7eb;background:#fff;">',

    // Original
    '<div style="padding:14px 16px;font-size:15px;line-height:1.6;color:#1f2937;">',
    esc(original),
    "</div>",

    // Divider
    '<hr style="margin:0;border:none;border-top:1px solid #e5e7eb;">',

    // Translation
    '<div style="padding:14px 16px;font-size:15px;line-height:1.6;color:#6366f1;">',
    esc(translation),
    "</div>",

    // Footer
    '<div style="padding:8px 16px;font-size:12px;color:#9ca3af;background:#f9fafb;',
    'border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">',
    `<span>${esc(url)}</span>`,
    "<span>Translated by Astra</span>",
    "</div>",

    "</div>",
  ].join("")
}

/**
 * Returns a plain-text representation of the bilingual card for clipboard fallback.
 */
export function generateBilingualPlainText(
  original: string,
  translation: string,
): string {
  return `${original}\n---\n${translation}\n\n\u2014 Astra`
}

/**
 * Copy a bilingual card as rich HTML to the clipboard.
 * Falls back to plain text when the ClipboardItem API is unavailable.
 */
export async function copyBilingualCard(
  original: string,
  translation: string,
  url: string,
): Promise<void> {
  const html = generateBilingualCard(original, translation, url)
  const plain = generateBilingualPlainText(original, translation)

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      })
      await navigator.clipboard.write([item])
      return
    } catch {
      // Fall through to plain-text fallback.
    }
  }

  // Plain-text fallback
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(plain)
      return
    } catch {
      // Fall through.
    }
  }
}
