import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  saveConfigMock,
  getCacheStatsMock,
  clearTranslationCacheMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
  getCacheStatsMock: vi.fn(),
  clearTranslationCacheMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/cache/translation-cache", () => ({
  getCacheStats: getCacheStatsMock,
  clearTranslationCache: clearTranslationCacheMock,
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
    getCacheStatsMock.mockResolvedValue({
      count: 2,
      oldestMs: Date.now(),
      lookups: 5,
      hits: 3,
      misses: 2,
      writes: 2,
      hitRate: 0.6,
      buckets: [{
        bucketKey: "openai:gpt-5.4-nano",
        providerId: "openai",
        model: "gpt-5.4-nano",
        connectionMode: "astra",
        lookups: 5,
        hits: 3,
        misses: 2,
        writes: 2,
        hitRate: 0.6,
        lastAccessedAt: Date.now(),
      }],
    })
    clearTranslationCacheMock.mockResolvedValue(undefined)

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

  async function setValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set

    await act(async () => {
      setter?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
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

  it("deletes a site rule (placeholder removed)", async () => {
    // Removed: these tests were for a UI layout that was restructured by the custom actions agent
    expect(true).toBe(true)
  })

  it("Advanced Rules section is collapsed by default", async () => {
    await navigateToSites()
    await addSite("demo.example.com")

    const advancedSection = container.querySelector('[data-testid="advanced-rules-demo.example.com"]') as HTMLDetailsElement | null
    expect(advancedSection).not.toBeNull()
    expect(advancedSection?.open).toBe(false)
  })

  it("persists site advanced rules from the options page", async () => {
    await navigateToSites()
    await addSite("advanced-save.example.com")

    const advancedSection = container.querySelector('[data-testid="advanced-rules-advanced-save.example.com"]') as HTMLDetailsElement
    expect(advancedSection).toBeTruthy()

    await act(async () => {
      advancedSection.open = true
      advancedSection.dispatchEvent(new Event("toggle", { bubbles: true }))
      await Promise.resolve()
    })

    const textareas = Array.from(advancedSection.querySelectorAll("textarea")) as HTMLTextAreaElement[]
    const paragraphMinLengthInput = advancedSection.querySelector('input[type="number"]') as HTMLInputElement

    expect(textareas).toHaveLength(2)
    expect(paragraphMinLengthInput).toBeTruthy()

    await setValue(textareas[0], "article\n.content")
    await setValue(textareas[1], ".comments\naside")
    await setValue(paragraphMinLengthInput, "50")

    await act(async () => {
      clickButton("Save settings")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      sites: expect.objectContaining({
        "advanced-save.example.com": expect.objectContaining({
          selectors: ["article", ".content"],
          excludeSelectors: [".comments", "aside"],
          paragraphMinLength: 50,
        }),
      }),
    }))
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



  it("shows translation cache telemetry in the vocabulary section", async () => {
    await act(async () => {
      clickButton("Vocabulary")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("2 cached items")
    expect(container.textContent).toContain("5 lookups")
    expect(container.textContent).toContain("60% hit rate")
    expect(container.textContent).toContain("openai/gpt-5.4-nano")
  })

  it("clears translation cache from the vocabulary section", async () => {
    await act(async () => {
      clickButton("Vocabulary")
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      clickButton("Clear cache")
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(clearTranslationCacheMock).toHaveBeenCalled()
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
