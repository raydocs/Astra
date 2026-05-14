/**
 * System-aware Astra theme.
 *
 * Returns the pair of attribute values that drive the design tokens:
 *   { astraTheme: "light" | "dark", astraDirection: "quiet" | "twilight" }
 *
 * Reads `prefers-color-scheme` and updates reactively. When matchMedia is
 * unavailable (test environments without jsdom/happy-dom matchMedia stub),
 * defaults to the warm-paper Quiet Reader direction.
 *
 * The two attributes both gate the same token blocks in
 * astra-style1-tokens.css; we ship both so legacy CSS that targets either
 * selector continues to work.
 */

import { useEffect, useState } from "react"

export type AstraThemeMode = "light" | "dark"
export type AstraDirection = "quiet" | "twilight"

export interface AstraTheme {
  astraTheme: AstraThemeMode
  astraDirection: AstraDirection
}

const DARK_QUERY = "(prefers-color-scheme: dark)"

function queryTheme(): AstraTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return { astraTheme: "light", astraDirection: "quiet" }
  }

  const dark = window.matchMedia(DARK_QUERY).matches
  return dark
    ? { astraTheme: "dark", astraDirection: "twilight" }
    : { astraTheme: "light", astraDirection: "quiet" }
}

export function useAstraTheme(): AstraTheme {
  const [theme, setTheme] = useState<AstraTheme>(queryTheme)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mql = window.matchMedia(DARK_QUERY)
    const update = () => setTheme(queryTheme())

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update)
      return () => mql.removeEventListener("change", update)
    }

    mql.addListener(update)
    return () => mql.removeListener(update)
  }, [])

  return theme
}
