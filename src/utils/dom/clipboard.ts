export async function copyTextToClipboard(
  text: string,
  doc: Document = document,
): Promise<void> {
  const normalized = text ?? ""

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(normalized)
      return
    } catch {
      // Fall back to the legacy copy path below.
    }
  }

  const textarea = doc.createElement("textarea")
  textarea.value = normalized
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  textarea.style.pointerEvents = "none"

  doc.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    if (typeof doc.execCommand !== "function" || !doc.execCommand("copy")) {
      throw new Error("Clipboard copy command failed.")
    }
  } finally {
    textarea.remove()
  }
}
