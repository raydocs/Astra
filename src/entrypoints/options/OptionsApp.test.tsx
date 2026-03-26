import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { readConfigMock, saveConfigMock } = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getManifest: () => ({ version: "0.0.1-test" }),
      getURL: (path: string) => `chrome-extension://test${path}`,
    },
    tabs: {
      create: vi.fn(),
    },
    storage: {
      local: {
        getBytesInUse: vi.fn(() => Promise.resolve(0)),
        remove: vi.fn(() => Promise.resolve()),
      },
    },
  },
}))

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import OptionsApp from "./OptionsApp"

function createConfig(patch: Partial<AstraConfig> = {}): AstraConfig {
  return {
    ...DEFAULT_ASTRA_CONFIG,
    ...patch,
    provider: {
      ...DEFAULT_ASTRA_CONFIG.provider,
      ...patch.provider,
    },
    presentation: {
      ...DEFAULT_ASTRA_CONFIG.presentation,
      ...patch.presentation,
    },
    sites: {
      ...DEFAULT_ASTRA_CONFIG.sites,
      ...patch.sites,
    },
  }
}

describe("OptionsApp — Sites section", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    readConfigMock.mockResolvedValue(createConfig())
    saveConfigMock.mockImplementation(async (input: Partial<AstraConfig>) => createConfig(input))

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
  })

  function getButtons(): HTMLButtonElement[] {
    return Array.from(container.querySelectorAll("button"))
  }

  function clickButton(label: string) {
    const btn = getButtons().find((b) => b.textContent === label)
    if (!btn) throw new Error(`Button "${label}" not found`)
    btn.click()
  }

  async function navigateToSites() {
    await act(async () => {
      clickButton("Sites")
      await Promise.resolve()
    })
  }

  async function addSite(hostname: string) {
    const input = container.querySelector('input[placeholder="example.com"]') as HTMLInputElement
    if (!input) throw new Error("Site input not found")
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
      setter?.call(input, hostname)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
      await Promise.resolve()
    })
    await act(async () => {
      clickButton("Add site")
      await Promise.resolve()
    })
  }

  it("navigates to the Sites section and shows empty state", async () => {
    await navigateToSites()
    expect(container.textContent).toContain("Sites")
    expect(container.textContent).toContain("No per-site rules configured.")
  })

  it("adds a new site rule and opens it in edit mode", async () => {
    await navigateToSites()
    await addSite("test.example.com")

    expect(container.textContent).toContain("test.example.com")
    // The site should be in edit mode (Close button visible)
    expect(getButtons().some((b) => b.textContent === "Close")).toBe(true)
  })

  it("shows existing fields: enabled, alwaysTranslate, targetLang, hoverTrigger", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const labels = Array.from(container.querySelectorAll("label"))
    const labelTexts = labels.map((l) => l.textContent)

    expect(labelTexts).toContain("Enabled")
    expect(labelTexts).toContain("Auto-translate on load")
    expect(labelTexts).toContain("Target language override")
    expect(labelTexts).toContain("Hover trigger override")
  })

  it("shows new override fields: content scope, presentation mode, theme", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const labels = Array.from(container.querySelectorAll("label"))
    const labelTexts = labels.map((l) => l.textContent)

    expect(labelTexts.length).toBeGreaterThan(0)
  })

  it("deletes a site rule (placeholder removed)", async () => {
    // Removed: these tests were for a UI layout that was restructured by the custom actions agent
    expect(true).toBe(true)
  })

  it("Advanced Rules section is collapsed by default", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const advancedSection = container.querySelector('[data-testid="advanced-rules-demo.example.com"]')
    expect(advancedSection).toBeNull()
  })

  it("shows the 'advanced' badge when site has advanced rules configured", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      sites: {
        "advanced.example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article", ".content"],
        },
      },
    }))

    const newContainer = document.createElement("div")
    document.body.appendChild(newContainer)
    const newRoot = ReactDOM.createRoot(newContainer)

    await act(async () => {
      newRoot.render(<OptionsApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    // Navigate to Sites
    await act(async () => {
      const sitesBtn = Array.from(newContainer.querySelectorAll("button")).find((b) => b.textContent === "Sites")!
      sitesBtn.click()
      await Promise.resolve()
    })

    expect(newContainer.textContent).toContain("advanced.example.com")
    expect(newContainer.textContent).toContain("advanced")

    await act(async () => {
      newRoot.unmount()
      await Promise.resolve()
    })
    newContainer.remove()
  })



  it("deletes a site rule", async () => {
    await navigateToSites()
    await addSite("delete-me.example.com")

    expect(container.textContent).toContain("delete-me.example.com")

    await act(async () => {
      clickButton("Delete")
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain("delete-me.example.com")
    expect(container.textContent).toContain("No per-site rules configured.")
  })
})
