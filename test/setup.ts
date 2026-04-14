import { beforeEach, vi } from "vitest"

import { clearInteractionSuppression } from "@/entrypoints/content/interaction-coordination"
import { createMockBrowser, setMockBrowser } from "./utils/mockBrowser"
import { resetDomFixtureGlobals } from "./utils/domFixture"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  vi.useRealTimers()
  setMockBrowser(createMockBrowser())
  vi.restoreAllMocks()
  clearInteractionSuppression()
  resetDomFixtureGlobals()
  window.history.replaceState({}, "", "/")
  document.body.innerHTML = ""
  document.head.innerHTML = ""
  document.title = ""
})
