/**
 * Shared viewport/pointer capability detection for responsive UI.
 * Used across popup, options, readers, and content overlays.
 */

import { useEffect, useState } from "react"

export interface ViewportProfile {
  width: number
  height: number
  isCompact: boolean   // width < 640
  isTouchPrimary: boolean // coarse pointer / no hover capability
}

function queryProfile(): ViewportProfile {
  const vv = typeof window !== "undefined" && window.visualViewport
  const width = vv ? vv.width : (typeof window !== "undefined" ? window.innerWidth : 1024)
  const height = vv ? vv.height : (typeof window !== "undefined" ? window.innerHeight : 768)
  const isTouchPrimary = typeof window !== "undefined"
    && window.matchMedia?.("(pointer: coarse)")?.matches === true
    && window.matchMedia?.("(hover: none)")?.matches === true

  return {
    width,
    height,
    isCompact: width < 640,
    isTouchPrimary,
  }
}

/**
 * React hook returning current viewport dimensions and input profile.
 * Listens to resize, orientationchange, and visualViewport events.
 */
export function useViewportProfile(): ViewportProfile {
  const [profile, setProfile] = useState<ViewportProfile>(queryProfile)

  useEffect(() => {
    const update = () => setProfile(queryProfile())

    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)
    window.visualViewport?.addEventListener("resize", update)
    window.visualViewport?.addEventListener("scroll", update)

    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
      window.visualViewport?.removeEventListener("resize", update)
      window.visualViewport?.removeEventListener("scroll", update)
    }
  }, [])

  return profile
}

/**
 * Non-hook check for touch/pointer environment.
 * Use outside React components (e.g., deciding whether to mount).
 */
export function isTouchPrimaryEnvironment(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia?.("(pointer: coarse)")?.matches === true
    && window.matchMedia?.("(hover: none)")?.matches === true
}

/**
 * Check if the environment supports hover (fine pointer).
 */
export function isHoverCapable(): boolean {
  if (typeof window === "undefined") return true // assume desktop in SSR
  return window.matchMedia?.("(hover: hover)")?.matches !== false
}
