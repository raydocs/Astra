import { beforeEach, vi } from "vitest"

import { clearInteractionSuppression } from "@/entrypoints/content/interaction-coordination"
import { createMockBrowser, setMockBrowser } from "./utils/mockBrowser"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  setMockBrowser(createMockBrowser())
  vi.restoreAllMocks()
  clearInteractionSuppression()
  document.body.innerHTML = ""
  document.head.innerHTML = ""
})
