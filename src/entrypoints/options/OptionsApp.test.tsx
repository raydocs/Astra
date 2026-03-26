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

    expect(labelTexts).toContain("Content scope override")
    expect(labelTexts).toContain("Presentation mode override")
    expect(labelTexts).toContain("Theme override")
  })

  it("shows Advanced Rules toggle button", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const advancedToggle = container.querySelector('[data-testid="advanced-toggle-demo.example.com"]')
    expect(advancedToggle).toBeTruthy()
    expect(advancedToggle?.textContent).toContain("Advanced Rules")
  })

  it("opens Advanced Rules section and shows selectors, excludeSelectors, paragraphMinLength", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    // Click the Advanced Rules toggle
    await act(async () => {
      const advancedToggle = container.querySelector('[data-testid="advanced-toggle-demo.example.com"]') as HTMLButtonElement
      advancedToggle.click()
      await Promise.resolve()
    })

    const advancedSection = container.querySelector('[data-testid="advanced-rules-demo.example.com"]')
    expect(advancedSection).toBeTruthy()

    const labels = Array.from(container.querySelectorAll("label"))
    const labelTexts = labels.map((l) => l.textContent)
    expect(labelTexts).toContain("Selectors")
    expect(labelTexts).toContain("Exclude selectors")
    expect(labelTexts).toContain("Paragraph minimum length")

    // Check hint texts
    expect(container.textContent).toContain("Limit translation to elements matching these selectors")
    expect(container.textContent).toContain("Skip elements matching these selectors")
    expect(container.textContent).toContain("Minimum text length to translate (default: 0)")
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

  it("displays existing selectors as newline-separated text in the textarea", async () => {
    readConfigMock.mockResolvedValue(createConfig({
      sites: {
        "selectors.example.com": {
          enabled: true,
          alwaysTranslate: false,
          selectors: ["article", "main .content"],
          excludeSelectors: ["nav", "footer"],
          paragraphMinLength: 10,
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

    // Click Edit
    await act(async () => {
      const editBtn = Array.from(newContainer.querySelectorAll("button")).find((b) => b.textContent === "Edit")!
      editBtn.click()
      await Promise.resolve()
    })

    // Open Advanced Rules
    await act(async () => {
      const advToggle = newContainer.querySelector('[data-testid="advanced-toggle-selectors.example.com"]') as HTMLButtonElement
      advToggle.click()
      await Promise.resolve()
    })

    const textareas = Array.from(newContainer.querySelectorAll("textarea")) as HTMLTextAreaElement[]
    expect(textareas.length).toBe(2)

    // First textarea: selectors
    expect(textareas[0].value).toBe("article\nmain .content")
    // Second textarea: excludeSelectors
    expect(textareas[1].value).toBe("nav\nfooter")

    // Number input for paragraphMinLength
    const numberInput = newContainer.querySelector('input[type="number"]') as HTMLInputElement
    expect(numberInput).toBeTruthy()
    expect(numberInput.value).toBe("10")

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
