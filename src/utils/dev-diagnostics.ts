// Shared gate for technical diagnostics surfaces (pipeline / phase / subtitle QC
// internals). Ordinary users must never see provider / model / pipeline / QC
// jargon — the zero-config promise. Diagnostics show only in dev builds or when a
// curious/advanced user explicitly opts in with ?debug=1.
export function shouldShowDebugDiagnostics(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).get("debug") === "1"
  } catch {
    return false
  }
}
