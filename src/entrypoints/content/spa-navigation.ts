/**
 * SPA navigation watcher — detects client-side URL changes
 * via history.pushState, history.replaceState, and popstate events.
 */

const DEBOUNCE_MS = 300

export function isSignificantUrlChange(prev: string, next: string): boolean {
  try {
    const prevUrl = new URL(prev)
    const nextUrl = new URL(next)
    // Ignore hash-only changes (same origin + pathname + search, different hash)
    if (
      prevUrl.origin === nextUrl.origin
      && prevUrl.pathname === nextUrl.pathname
      && prevUrl.search === nextUrl.search
    ) {
      return false
    }
    return true
  } catch {
    // If URLs are unparseable, treat as significant
    return prev !== next
  }
}

export function createSPANavigationWatcher(): {
  start(callback: (prevUrl: string, newUrl: string) => void): void
  stop(): void
} {
  let lastUrl = ""
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let popstateHandler: (() => void) | null = null
  let originalPushState: typeof history.pushState | null = null
  let originalReplaceState: typeof history.replaceState | null = null
  let callback: ((prevUrl: string, newUrl: string) => void) | null = null

  function checkUrlChange() {
    // Tests may tear down jsdom / switch to real timers while a debounced timeout is still queued.
    if (typeof window === "undefined" || typeof window.location === "undefined") {
      return
    }

    const currentUrl = window.location.href
    if (currentUrl === lastUrl) return
    if (!isSignificantUrlChange(lastUrl, currentUrl)) {
      lastUrl = currentUrl
      return
    }
    const prevUrl = lastUrl
    lastUrl = currentUrl
    callback?.(prevUrl, currentUrl)
  }

  function debouncedCheck() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      checkUrlChange()
    }, DEBOUNCE_MS)
  }

  return {
    start(cb) {
      callback = cb
      lastUrl = window.location.href

      // Monkey-patch history.pushState
      originalPushState = history.pushState.bind(history)
      history.pushState = function (...args: Parameters<typeof history.pushState>) {
        originalPushState!(...args)
        debouncedCheck()
      }

      // Monkey-patch history.replaceState
      originalReplaceState = history.replaceState.bind(history)
      history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
        originalReplaceState!(...args)
        debouncedCheck()
      }

      // Listen for popstate (back/forward navigation)
      popstateHandler = () => debouncedCheck()
      window.addEventListener("popstate", popstateHandler)
    },

    stop() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }

      if (popstateHandler) {
        window.removeEventListener("popstate", popstateHandler)
        popstateHandler = null
      }

      // Restore original history methods
      if (originalPushState) {
        history.pushState = originalPushState
        originalPushState = null
      }
      if (originalReplaceState) {
        history.replaceState = originalReplaceState
        originalReplaceState = null
      }

      callback = null
    },
  }
}
