import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  LEARNING_PROFILE_STORAGE_KEY,
  LEGACY_ONBOARDING_PRIMARY_GOAL_STORAGE_KEY,
  buildLearningProfileFromConfig,
  excludeHostnameFromPersonalization,
  forgetRememberedTerm,
  readLearningProfile,
  rememberPreferredTerm,
  setPersonalizationEnabled,
  updateLearningProfile,
} from "./learning-profile"

describe("learning profile storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("builds a lightweight profile from onboarding config", () => {
    const profile = buildLearningProfileFromConfig({
      targetLang: "zh-CN",
      languageLevel: "beginner",
      explainMode: "exam",
    }, "watch_tutorials")

    expect(profile).toMatchObject({
      targetLang: "zh-CN",
      languageLevel: "beginner",
      explainMode: "exam",
      primaryGoal: "watch_tutorials",
      dailyGoalMinutes: 5,
      personalizationEnabled: true,
      excludedHostnames: [],
      rememberedTerms: [],
    })
  })

  it("hydrates legacy onboarding goal when no profile exists", async () => {
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__
    await browser.storage.local.set({ [LEGACY_ONBOARDING_PRIMARY_GOAL_STORAGE_KEY]: "save_expressions" })

    await expect(readLearningProfile()).resolves.toMatchObject({
      primaryGoal: "save_expressions",
      targetLang: "zh-CN",
    })
  })

  it("persists reversible personalization controls and remembered terms", async () => {
    await updateLearningProfile({
      targetLang: "ja",
      primaryGoal: "interest_reading",
      dailyGoalMinutes: 10,
    })
    await setPersonalizationEnabled(false)
    await excludeHostnameFromPersonalization("News.Example")
    const withTerm = await rememberPreferredTerm({
      sourceTerm: "render",
      preferredTerm: "渲染",
      source: "user_correction",
      hostname: "docs.example",
    })

    expect(withTerm).toMatchObject({
      targetLang: "ja",
      primaryGoal: "interest_reading",
      dailyGoalMinutes: 10,
      personalizationEnabled: false,
      excludedHostnames: ["news.example"],
      rememberedTerms: [expect.objectContaining({
        id: "lp_term_docs.example_render",
        sourceTerm: "render",
        preferredTerm: "渲染",
        source: "user_correction",
        hostname: "docs.example",
      })],
    })

    const withoutTerm = await forgetRememberedTerm(withTerm.rememberedTerms[0].id)
    expect(withoutTerm.rememberedTerms).toHaveLength(0)

    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> }).__ASTRA_TEST_BROWSER__
    const stored = await browser.storage.local.get(LEARNING_PROFILE_STORAGE_KEY)
    expect(stored[LEARNING_PROFILE_STORAGE_KEY]).toMatchObject({
      personalizationEnabled: false,
      excludedHostnames: ["news.example"],
    })
  })
})
