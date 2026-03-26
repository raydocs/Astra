import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { readConfigMock, translateTextsMock } = vi.hoisted(() => ({
  readConfigMock: vi.fn(() => Promise.resolve({
    version: 1,
    targetLang: "zh-CN",
    hoverTrigger: "alt" as const,
    provider: {
      id: "openai" as const,
      accessToken: "astra-token",
      relayBaseURL: "https://astra.example/v1",
      model: "gpt-5.4-nano",
    },
    presentation: {
      mode: "bilingual" as const,
      theme: "default" as const,
    },
    sites: {},
  })),
  translateTextsMock: vi.fn(),
}))

vi.mock("@/utils/storage/config", () => ({
  readConfig: readConfigMock,
}))

vi.mock("@/utils/translate/translate", () => ({
  translateTexts: translateTextsMock,
}))

import { mountPageFixture } from "../../../test/utils/contentHarness"
import {
  flushMicrotasks,
  installMockIntersectionObserver,
} from "../../../test/utils/domFixture"
import { startPageTranslation, stopPageTranslation } from "./page-translate"

describe("page translation fixtures", () => {
  beforeEach(() => {
    translateTextsMock.mockReset()
    readConfigMock.mockReset()
    readConfigMock.mockResolvedValue({
      version: 1,
      targetLang: "zh-CN",
      hoverTrigger: "alt",
      provider: {
        id: "openai",
        accessToken: "astra-token",
        relayBaseURL: "https://astra.example/v1",
        model: "gpt-5.4-nano",
      },
      presentation: {
        mode: "bilingual",
        theme: "default",
      },
      sites: {},
    })
    installMockIntersectionObserver()
  })

  it("can drive page translation from a reusable article fixture smoke test", async () => {
    mountPageFixture("article-basic", {
      title: "Fixture article",
      metaDescription: "Fixture for smoke testing page translation.",
      url: "/fixtures/article-basic",
    })

    translateTextsMock.mockImplementation(async ({ texts }: { texts: string[] }) => ({
      ok: true,
      translations: texts.map((text) => `ZH:${text.slice(0, 16)}`),
    }))

    await startPageTranslation({ targetLang: "zh-CN" })
    await flushMicrotasks()

    expect(translateTextsMock).toHaveBeenCalled()
    expect(translateTextsMock).toHaveBeenCalledWith(expect.objectContaining({
      targetLang: "zh-CN",
      context: expect.objectContaining({
        pageUrl: `${window.location.origin}/fixtures/article-basic`,
        metaDescription: "Fixture for smoke testing page translation.",
      }),
    }))
    expect(document.querySelector("[data-astra-translation='1']")).not.toBeNull()
  })

  afterEach(() => {
    stopPageTranslation()
  })
})
