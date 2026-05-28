import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"

const { saveConfigMock, updateLearningProfileMock } = vi.hoisted(() => ({
  saveConfigMock: vi.fn(),
  updateLearningProfileMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  saveConfig: saveConfigMock,
}))

vi.mock("@/utils/storage/learning-profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage/learning-profile")>()
  return {
    ...actual,
    updateLearningProfile: updateLearningProfileMock,
  }
})

import { findForbiddenUserCopyTerms } from "@/utils/copy-dictionary"
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
    updateLearningProfileMock.mockResolvedValue(undefined)
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

  function expectRenderedCopyIsPlain(element: HTMLElement = container) {
    expect(findForbiddenUserCopyTerms(element.textContent ?? "")).toEqual([])
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
    expect(container.textContent).toContain("Astra — just read. We handle the AI.")
    expect(container.textContent).toContain("No setup")
    expect(container.textContent).toContain("free public beta")
    expect(container.textContent).toContain("paid upgrades are not available during beta")
    expect(container.textContent).toContain("Managed by Astra")
    expect(container.textContent).not.toContain("sign in with a membership")
    expect(container.querySelector('[data-testid="onboarding-ios-bridge-diagnostics"]')).toBeNull()
    expect(container.querySelector('[data-testid="onboarding-permission-certification-frame"]')).toBeNull()
    expect(buttonByText("Get started")).toBeDefined()
    expectRenderedCopyIsPlain()
  })

  it("announces step progress and moves focus to the active step region", async () => {
    let stepRegion = container.querySelector('[data-testid="onboarding-step-region"]') as HTMLDivElement
    expect(stepRegion).toBeTruthy()
    expect(stepRegion.getAttribute("role")).toBe("region")
    expect(stepRegion.getAttribute("aria-live")).toBe("polite")
    expect(stepRegion.getAttribute("aria-label")).toBe("Step 1 of 4: Welcome")
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain("Welcome")

    await act(async () => {
      buttonByText("Get started")?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    stepRegion = container.querySelector('[data-testid="onboarding-step-region"]') as HTMLDivElement
    expect(stepRegion.getAttribute("aria-label")).toBe("Step 2 of 4: Languages")
    expect(document.activeElement).toBe(stepRegion)
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain("Languages")
  })

  it("supports keyboard radio selection for onboarding choices", async () => {
    await act(async () => {
      buttonByText("Get started")?.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    const levelGroup = container.querySelector('[aria-labelledby="onboarding-language-level-label"]') as HTMLElement
    expect(levelGroup?.getAttribute("role")).toBe("radiogroup")
    let levelOptions = Array.from(levelGroup.querySelectorAll('[role="radio"]')) as HTMLButtonElement[]
    expect(levelOptions.map((option) => option.getAttribute("aria-label"))).toEqual([
      "Beginner: Simple explanations, basic vocabulary",
      "Intermediate: Balanced explanations with grammar context",
      "Advanced: Detailed analysis with nuanced explanations",
    ])
    expect(levelOptions[1]?.getAttribute("aria-checked")).toBe("true")

    levelOptions[1]?.focus()
    await act(async () => {
      levelOptions[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
      await Promise.resolve()
    })

    levelOptions = Array.from(levelGroup.querySelectorAll('[role="radio"]')) as HTMLButtonElement[]
    expect(levelOptions[2]?.getAttribute("aria-checked")).toBe("true")
    expect(document.activeElement).toBe(levelOptions[2])

    const goalGroup = container.querySelector('[aria-labelledby="onboarding-primary-goal-label"]') as HTMLElement
    const goalOptions = Array.from(goalGroup.querySelectorAll('[role="radio"]')) as HTMLButtonElement[]
    expect(goalGroup?.getAttribute("role")).toBe("radiogroup")
    expect(goalOptions[0]?.getAttribute("aria-checked")).toBe("true")

    goalOptions[0]?.focus()
    await act(async () => {
      goalOptions[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }))
      await Promise.resolve()
    })

    expect(goalOptions[2]?.getAttribute("aria-checked")).toBe("true")
    expect(document.activeElement).toBe(goalOptions[2])
  })

  it("keeps first-run setup to the three activation questions", async () => {
    await act(async () => {
      buttonByText("Get started")?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Three essentials are enough")
    expect(container.querySelector("#onboarding-source-language")).toBeNull()
    expect(container.querySelector("#onboarding-target-language")).toBeTruthy()
    expect(container.textContent).not.toContain("What language are you learning?")
    expect(container.textContent).toContain("I want translations in:")
    expect(container.textContent).toContain("Your language level:")
    expect(container.textContent).toContain("I mainly want to use Astra to:")
    expect(container.textContent).not.toContain("How should Astra explain sentences?")
    expect(container.textContent).not.toContain("How would you like the translation to feel?")
    expect(container.textContent).not.toContain("Display")
    expect(container.textContent).not.toContain("Style")
    expect(container.textContent).toContain("Source language and explanation style stay adjustable later in Settings")
    expectRenderedCopyIsPlain()
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
    expect(certificationFrame.textContent).toContain("Let Astra help on this page?")
    expect(certificationFrame.textContent).toContain("Ask first")
    expect(certificationFrame.textContent).toContain("Astra helps when you choose")
    expect(certificationFrame.textContent).toContain("Page once")
    expect(certificationFrame.textContent).toContain("Remember or pause")
    expect(certificationFrame.textContent).toContain("pause this site later")
    expectRenderedCopyIsPlain(certificationFrame)
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
    expectRenderedCopyIsPlain()

    expect(await getLearningLoopTelemetryEvents()).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "onboarding_closure_viewed",
        source: "onboarding",
        variant: "loop_first",
        step: "loop",
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

    const closureCopy = container.querySelector('[data-testid="onboarding-closure-loop-copy"]') as HTMLElement
    expect(closureCopy.dataset.copyVariant).toBe("outcome_first")
    expect(closureCopy.textContent).toContain("Practice from real pages")
    expect(closureCopy.textContent).toContain("One useful sentence → one future review")
    expectRenderedCopyIsPlain()
  })

  it("offers a sample lesson from the ready step", async () => {
    await act(async () => {
      buttonByText("Get started")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })

    const sampleCta = container.querySelector('[data-testid="onboarding-try-sample-lesson-cta"]') as HTMLButtonElement
    expect(sampleCta).toBeTruthy()
    expect(sampleCta.textContent).toContain("Try Astra on a sample page")

    await act(async () => {
      sampleCta.click()
      await Promise.resolve()
    })

    expect(getMockBrowser().tabs.create).toHaveBeenCalledWith({
      url: "/sample-lesson.html",
    })
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
    await act(async () => {
      buttonByText("Continue")?.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain("Your first outcome starts from the popup")
    expect(container.textContent).toContain("Free beta first. Translation just works.")
    expect(container.textContent).toContain("Paid upgrades are not launched")
    expect(container.textContent).toContain("the free beta includes a daily use limit")
    expect(container.textContent).not.toContain("Buy Astra once")
    expect(container.textContent).not.toContain("membership when needed")
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
    expect(permissionDisclosure.textContent).toContain("How Astra helps on pages")
    expect(permissionDisclosure.textContent).toContain("Ready when you ask")
    expect(permissionDisclosure.textContent).toContain("Page once")
    expect(permissionDisclosure.textContent).toContain("Remember this site")
    expect(permissionDisclosure.textContent).toContain("Chrome, Firefox, or Safari may show their own confirmation")
    const permissionControls = container.querySelector('[data-testid="onboarding-permission-controls"]') as HTMLElement
    expect(permissionControls).toBeTruthy()
    expect(permissionControls.textContent).toContain("Page once")
    expect(permissionControls.textContent).toContain("Remember this site")
    expect(permissionControls.textContent).toContain("Pause this site")
    expect(permissionDisclosure.textContent).not.toContain("narrower page-only and per-site permission controls are planned, not yet shipped")
    expect(permissionDisclosure.textContent).not.toContain("Do not treat page-only or site-only consent as shipped")
    expect(permissionDisclosure.textContent).not.toContain("All sites you visit")
    expect(container.querySelector('[data-testid="onboarding-permission-certification-frame"]')).toBeNull()
    expect(container.textContent).not.toContain("Let Astra read pages in this build?")
    expectRenderedCopyIsPlain()
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
    const readyStepEvents = await getLearningLoopTelemetryEvents()
    expect(readyStepEvents).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "onboarding_started",
        source: "onboarding",
        variant: "loop_first",
      }),
    }))
    expect(readyStepEvents).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "onboarding_closure_cta_clicked",
        action: "continue",
        variant: "loop_first",
      }),
    }))
    expect(readyStepEvents).toContainEqual(expect.objectContaining({
      data: expect.objectContaining({
        event: "pro_value_seen",
        source: "onboarding",
        surface: "onboarding_account_continuity",
        trigger: "continuity_value",
        variant: "loop_first",
        billingAvailable: false,
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
    expect(updateLearningProfileMock).toHaveBeenCalledWith(expect.objectContaining({
      targetLang: "zh-CN",
      languageLevel: "intermediate",
      explainMode: "deep",
      primaryGoal: "read_articles_docs",
      personalizationEnabled: true,
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
