export function isTopFrame(): boolean {
  try {
    return window === window.top
  } catch {
    // Cross-origin frames throw on window.top access
    return false
  }
}

export function getFrameId(): string {
  if (isTopFrame()) return "top"
  // Generate a stable-ish ID for this frame
  try {
    return `frame-${window.location.href.replace(/[^a-z0-9]/gi, "").slice(0, 32)}`
  } catch {
    return `frame-${Math.random().toString(36).slice(2, 10)}`
  }
}
