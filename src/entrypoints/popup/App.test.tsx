import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
  readConfigMock,
  saveConfigMock,
  getActiveTabTranslationStateMock,
  startActiveTabTranslationMock,
  stopActiveTabTranslationMock,
} = vi.hoisted(() => ({
  readConfigMock: vi.fn(),
  saveConfigMock: vi.fn(),
  getActiveTabTranslationStateMock: vi.fn(),
  startActiveTabTranslationMock: vi.fn(),
  stopActiveTabTranslationMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/extension/messages", () => ({
  getActiveTabTranslationState: getActiveTabTranslationStateMock,
  startActiveTabTranslation: startActiveTabTranslationMock,
  stopActiveTabTranslation: stopActiveTabTranslationMock,
}))

import type { AstraConfig } from "@/types/config"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import App from "./App"

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

function createIdleState() {
  return {
    ok: true as const,
    state: {
      phase: "idle" as const,
      sessionId: 1,
      targetLang: "zh-CN",
      lastError: null,
      progress: {
        totalBlocks: 0,
        queuedBlocks: 0,
        inFlightBlocks: 0,
        translatedBlocks: 0,
        failedBlocks: 0,
      },
      presentation: {
        mode: "bilingual" as const,
        theme: "default" as const,
      },
      site: {
        hostname: "example.com",
        enabled: true,
        alwaysTranslate: false,
      },
    },
  }
}

describe("popup App", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root
  let browserMock: any

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    browserMock = (globalThis as { __ASTRA_TEST_BROWSER__?: any }).__ASTRA_TEST_BROWSER__
    browserMock.tabs.query.mockResolvedValue([{ id: 1, url: "https://example.com/article" }])

    readConfigMock.mockResolvedValue(createConfig())
    saveConfigMock.mockImplementation(async (input: Partial<AstraConfig>) => createConfig(input))
    getActiveTabTranslationStateMock.mockResolvedValue(createIdleState())
    startActiveTabTranslationMock.mockResolvedValue(createIdleState())
    stopActiveTabTranslationMock.mockResolvedValue(createIdleState())

    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<App />)
      await Promise.resolve()
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
    vi.useRealTimers()
  })

  function getButtons() {
    return Array.from(container.querySelectorAll("button")) as HTMLButtonElement[]
  }

  function getSiteEnabledCheckbox() {
    return container.querySelector('input[type="checkbox"]') as HTMLInputElement
  }

  async function flushApp() {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("keeps translate enabled until site disable is saved", async () => {
    const [translateButton] = getButtons()
    expect(translateButton.textContent).toBe("翻译此页")
    expect(translateButton.disabled).toBe(false)

    const siteEnabledCheckbox = getSiteEnabledCheckbox()
    expect(siteEnabledCheckbox.checked).toBe(true)

    await act(async () => {
      siteEnabledCheckbox.click()
      await Promise.resolve()
    })

    expect(translateButton.disabled).toBe(false)
    expect(container.textContent).not.toContain("Astra 已在此站点禁用")

    await act(async () => {
      translateButton.click()
      await Promise.resolve()
    })

    expect(startActiveTabTranslationMock).toHaveBeenCalledWith({
      targetLang: "zh-CN",
      translationMode: "bilingual",
      translationTheme: "default",
      contentScope: "page",
    })
  })

  it("applies the disabled site state only after save", async () => {
    saveConfigMock.mockResolvedValueOnce(createConfig({
      sites: {
        "example.com": {
          enabled: false,
          alwaysTranslate: false,
        },
      },
    }))

    const siteEnabledCheckbox = getSiteEnabledCheckbox()
    const saveButton = getButtons().find((button) => button.textContent?.includes("保存设置"))!
    const translateButton = getButtons().find((button) => button.textContent === "翻译此页")!

    await act(async () => {
      siteEnabledCheckbox.click()
      await Promise.resolve()
    })

    await act(async () => {
      saveButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    await flushApp()

    expect(stopActiveTabTranslationMock).toHaveBeenCalledTimes(1)
    expect(translateButton.disabled).toBe(true)
    expect(container.textContent).toContain("Astra 已在此站点禁用")
  })

  it("preserves unsaved draft edits when popup refreshes on focus", async () => {
    const siteEnabledCheckbox = getSiteEnabledCheckbox()

    await act(async () => {
      siteEnabledCheckbox.click()
      await Promise.resolve()
    })

    expect(siteEnabledCheckbox.checked).toBe(false)

    readConfigMock.mockResolvedValue(createConfig())

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
      await vi.runAllTimersAsync()
    })
    await flushApp()

    expect(getSiteEnabledCheckbox().checked).toBe(false)
  })
})
