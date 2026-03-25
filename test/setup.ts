import { beforeEach, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "./utils/mockBrowser"

beforeEach(() => {
  setMockBrowser(createMockBrowser())
  vi.restoreAllMocks()
  document.body.innerHTML = ""
  document.head.innerHTML = ""
})
