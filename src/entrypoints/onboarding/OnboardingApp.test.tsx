import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

const { saveConfigMock } = vi.hoisted(() => ({
  saveConfigMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  saveConfig: saveConfigMock,
}))

import { LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY } from "@/utils/learning-loop-events"
import { getRecentEvents } from "@/utils/telemetry"
import OnboardingApp from "./OnboardingApp"

const wxtConfigSource = readFileSync("wxt.config.ts", "utf8")

describe("OnboardingApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(async () => {
    vi.clearAllMocks()
    saveConfigMock.mockResolvedValue(undefined)
    window.history.replaceState(null, "", "/onboarding.html")
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)

    await act(async () => {
      root.render(<OnboardingApp />)
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
    window.history.replaceState(null, "", "/onboarding.html")
  })

  function buttonByText(text: string) {
    return Array.from(container.querySelectorAll("button")).find((button) => button.textContent === text) as HTMLButtonElement | undefined
  }

  async function flushApp() {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  async function getLearningLoopTelemetryEvents() {
    await flushApp()
    const events = await getRecentEvents(50)
    return events.filter((event) => event.type === "feature_usage" && event.data.feature === "learning_loop")
  }

  function getMockBrowser() {
    return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: any }).__ASTRA_TEST_BROWSER__
  }

  it("renders the welcome step without changing onboarding defaults", () => {
    expect(container.textContent).toContain("Astra — AI Language Learning")
    expect(container.textContent).toContain("Not just a translator: turn real webpages into sentence explanations")
    expect(container.querySelector('[data-testid="onboarding-ios-bridge-diagnostics"]')).toBeNull()
    expect(container.querySelector('[data-testid="onboarding-permission-certification-frame"]')).toBeNull()
    expect(buttonByText("Get started")).toBeDefined()
  })

  it("renders a truthful permission certification frame only with astraCert", async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    window.history.replaceState(null, "", "/onboarding.html?astraCert=1")
    root = ReactDOM.createRoot(container)
    await act(async () => {
      root.render(<OnboardingApp />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const certificationFrame = container.querySelector('[data-testid="onboarding-permission-certification-frame"]') as HTMLElement
    expect(certificationFrame).toBeTruthy()
    expect(container.querySelector(".astra-onboarding-shell")).toBeNull()
    expect(certificationFrame.textContent).toContain("Let Astra read pages in this build?")
    expect(certificationFrame.textContent).toContain("Current broad access")
    expect(certificationFrame.textContent).toContain("Declared host access")
    expect(certificationFrame.textContent).toContain("activeTab support")
    expect(certificationFrame.textContent).toContain("not a page-only picker")
    expect(certificationFrame.textContent).toContain("Planned site controls")
    expect(certificationFrame.textContent).toContain("page-only and per-site controls remain planned, not shipped")
    expect(certificationFrame.textContent).not.toContain("Just this page")
    expect(certificationFrame.textContent).not.toContain("This site forever")
    expect(certificationFrame.textContent).not.toContain("All sites you visit")
    expect(certificationFrame.textContent).not.toContain("Step 5 of 5")
  })

  it("shows onboarding iOS bridge diagnostics only when bridge state has signal", async () => {
    const browser = getMockBrowser()

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    browser.runtime.sendMessage.mockResolvedValueOnce({
      bridgeAvailable: true,
      status: { lastSessionId: "ios-session-1", lastBootstrapAt: "2026-04-28T12:00:00.000Z" },
      history: [{
        sessionId: "ios-session-1",
        source: "test-bootstrap",
        issuedAt: "2026-04-28T12:00:00.000Z",
        launchURL: "astra-shell://bootstrap",
      }],
    })
    root = ReactDOM.createRoot(container)
    await act(async () => {
      root.render(<OnboardingApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    const diagnostics = container.querySelector('[data-testid="onboarding-ios-bridge-diagnostics"]') as HTMLElement
    expect(diagnostics).toBeTruthy()
    expect(diagnostics.textContent).toContain("iOS bridge: available")
    expect(diagnostics.textContent).toContain("Recent bridge events: 1")
  })

  it("adds closure-loop copy to the feature step", async () => {
    await act(async () => {
      buttonByText("Get started")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })
    // Step Style → Features
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })

    const closureCopy = container.querySelector('[data-testid="onboarding-closure-loop-copy"]') as HTMLElement
    expect(closureCopy?.dataset.copyVariant).toBe("loop_first")
    expect(closureCopy?.textContent).toContain("Not a generic translator")
    expect(closureCopy?.textContent).toContain("Translate → Understand → Save → Review")
    expect(closureCopy?.textContent).toContain("spaced review stay connected")
    const comparisonCopy = container.querySelector('[data-testid="onboarding-differentiation-comparison-copy"]') as HTMLElement
    expect(comparisonCopy?.textContent).toContain("Generic tools stop at output; Astra carries the sentence into practice")
    expect(comparisonCopy?.textContent).toContain("Generic translators answer this page now")
    expect(comparisonCopy?.textContent).toContain("Generic readers make text easier to consume")
    expect(comparisonCopy?.textContent).toContain("Astra links translation, Deep Read, explanation, saved sentence, source context, and spaced review")
    expect(container.textContent).toContain("How Astra Works")

    expect(await getLearningLoopTelemetryEvents()).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "onboarding_closure_viewed",
        source: "onboarding",
        variant: "loop_first",
        step: "features",
      }),
    }))
  })

  it("renders the alternate onboarding closure copy when locally switched", async () => {
    const browser = getMockBrowser()

    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    browser.__storage[LEARNING_LOOP_COPY_VARIANT_STORAGE_KEY] = "outcome_first"
    root = ReactDOM.createRoot(container)
    await act(async () => {
      root.render(<OnboardingApp />)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      buttonByText("Get started")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })
    // Step Style → Features
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })

    const closureCopy = container.querySelector('[data-testid="onboarding-closure-loop-copy"]') as HTMLElement
    expect(closureCopy.dataset.copyVariant).toBe("outcome_first")
    expect(closureCopy.textContent).toContain("Practice from real pages")
    expect(closureCopy.textContent).toContain("One useful sentence → one future review")
  })

  it("records onboarding closure click and completion funnel events locally", async () => {
    await act(async () => {
      buttonByText("Get started")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })
    // Step Style → Features
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Your first outcome starts from the popup")
    const commercialPackageCopy = container.querySelector('[data-testid="onboarding-commercial-package-copy"]') as HTMLElement
    expect(commercialPackageCopy).toBeTruthy()
    expect(commercialPackageCopy.textContent).toContain("Start free -> Build assets -> Keep continuity")
    expect(commercialPackageCopy.textContent).toContain("Astra packages real-page moments into a learning trail")
    expect(commercialPackageCopy.textContent).toContain("Free daily translations start the loop")
    expect(commercialPackageCopy.textContent).toContain("context compounds instead of becoming throwaway lookup")
    expect(commercialPackageCopy.textContent).toContain("Build learning assets: save useful sentences")
    expect(commercialPackageCopy.textContent).toContain("Keep continuity: return to the same trail")
    expect(commercialPackageCopy.textContent).toContain("You stay in control")
    expect(commercialPackageCopy.textContent).toContain("Local beta boundary")
    expect(commercialPackageCopy.textContent).toContain("not unlimited bulk translation")
    expect(commercialPackageCopy.textContent).toContain("billing commitment")
    const firstWinActivationCopy = container.querySelector('[data-testid="onboarding-first-win-activation-copy"]') as HTMLElement
    expect(firstWinActivationCopy).toBeTruthy()
    expect(firstWinActivationCopy.textContent).toContain("First win activation")
    expect(firstWinActivationCopy.textContent).toContain("Save one useful sentence from a real page")
    expect(firstWinActivationCopy.textContent).toContain("Translate a page, open Deep Read, explain one sentence, save it")
    expect(firstWinActivationCopy.textContent).toContain("same page context back")
    const permissionDisclosure = container.querySelector('[data-testid="onboarding-permission-disclosure"]') as HTMLElement
    expect(permissionDisclosure).toBeTruthy()
    expect(permissionDisclosure.textContent).toContain("How Astra accesses pages in this build")
    expect(permissionDisclosure.textContent).toContain("Current build: extension site access")
    expect(permissionDisclosure.textContent).toContain("declares broad host access")
    expect(permissionDisclosure.textContent).toContain("activeTab for toolbar/tab-triggered interactions")
    expect(permissionDisclosure.textContent).toContain("does not persist host grants")
    expect(permissionDisclosure.textContent).toContain("Optional: always on this site")
    expect(permissionDisclosure.textContent).toContain("runtime revoke policy")
    expect(permissionDisclosure.textContent).toContain("Safari/iOS")
    const permissionControls = container.querySelector('[data-testid="onboarding-permission-controls"]') as HTMLElement
    expect(permissionControls).toBeTruthy()
    expect(permissionControls.textContent).toContain("Page only")
    expect(permissionControls.textContent).toContain("Allow this site")
    expect(permissionControls.textContent).toContain("Revoke site")
    expect(permissionDisclosure.textContent).not.toContain("narrower page-only and per-site permission controls are planned, not yet shipped")
    expect(permissionDisclosure.textContent).not.toContain("Do not treat page-only or site-only consent as shipped")
    expect(permissionDisclosure.textContent).not.toContain("All sites you visit")
    expect(container.querySelector('[data-testid="onboarding-permission-certification-frame"]')).toBeNull()
    expect(container.textContent).not.toContain("Let Astra read pages in this build?")
    const accountContinuityCopy = container.querySelector('[data-testid="onboarding-account-continuity-copy"]') as HTMLElement
    expect(accountContinuityCopy).toBeTruthy()
    expect(accountContinuityCopy.textContent).toContain("Account continuity")
    expect(accountContinuityCopy.textContent).toContain("Keep your learning trail when you switch devices")
    const accountContinuityText = accountContinuityCopy.textContent?.toLowerCase() ?? ""
    expect(accountContinuityText).toContain("saved learning cards")
    expect(accountContinuityText).toContain("reading queue")
    expect(accountContinuityText).toContain("study progress")
    expect(accountContinuityCopy.textContent).toContain("review schedules synced safely")
    expect(accountContinuityCopy.textContent).toContain("No billing change")
    const accountContinuityNextAction = container.querySelector('[data-testid="onboarding-account-continuity-next-action-copy"]') as HTMLElement
    expect(accountContinuityNextAction).toBeTruthy()
    expect(accountContinuityNextAction.textContent).toContain("popup sign-in panel")
    const accountContinuityCta = container.querySelector('[data-testid="onboarding-account-continuity-sign-in-cta"]') as HTMLButtonElement
    expect(accountContinuityCta).toBeTruthy()
    expect(accountContinuityCta.textContent).toContain("Sign in to keep continuity")
    await act(async () => {
      accountContinuityCta.click()
      await Promise.resolve()
    })
    expect(getMockBrowser().tabs.create).toHaveBeenCalledWith({
      url: "/popup.html?focus=sign-in",
    })
    expect(container.querySelector('[data-testid="onboarding-value-stack-copy"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="onboarding-value-ladder-copy"]')).toBeFalsy()
    expect(container.querySelector('[data-testid="onboarding-commercial-boundary-copy"]')).toBeFalsy()
    expect(await getLearningLoopTelemetryEvents()).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "onboarding_closure_cta_clicked",
        action: "continue",
        variant: "loop_first",
      }),
    }))

    await act(async () => {
      buttonByText("Start using Astra")?.click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(saveConfigMock).toHaveBeenCalledWith(expect.objectContaining({
      targetLang: "zh-CN",
      languageLevel: "intermediate",
      explainMode: "deep",
    }))
    expect(await getLearningLoopTelemetryEvents()).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "onboarding_completed",
        variant: "loop_first",
        targetLang: "zh-CN",
        languageLevel: "intermediate",
        explainMode: "deep",
      }),
    }))
  })

  it("keeps permission disclosure aligned with the current manifest source", () => {
    expect(wxtConfigSource).toContain('"activeTab"')
    expect(wxtConfigSource).toContain('host_permissions: ["*://*/*"]')
    expect(wxtConfigSource).toContain('optional_host_permissions: ["http://*/*", "https://*/*"]')
    expect(wxtConfigSource).not.toContain("optional_permissions")
  })
})
