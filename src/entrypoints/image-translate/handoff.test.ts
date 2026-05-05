import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  consumeImageTranslateHandoff,
  createImageTranslateHandoff,
  IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY,
  IMAGE_TRANSLATE_HANDOFF_TTL_MS,
} from "./handoff"

describe("image translate context-menu handoff storage", () => {
  let browserMock: ReturnType<typeof createMockBrowser>

  beforeEach(() => {
    browserMock = setMockBrowser(createMockBrowser()) as ReturnType<typeof createMockBrowser>
  })

  it("creates a short-lived handoff and consumes it once", async () => {
    const now = 1_000
    const handoff = await createImageTranslateHandoff({
      imageUrl: "https://example.com/menu.svg",
      pageUrl: "https://example.com/article",
      pageTitle: "Example Article",
    }, now)

    expect(handoff.token).toMatch(/^img_/)
    expect(handoff.expiresAt).toBe(now + IMAGE_TRANSLATE_HANDOFF_TTL_MS)
    expect(browserMock.__storage[IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY]).toEqual({
      [handoff.token]: handoff,
    })

    await expect(consumeImageTranslateHandoff(handoff.token, now + 1)).resolves.toEqual({
      ok: true,
      handoff,
    })
    await expect(consumeImageTranslateHandoff(handoff.token, now + 2)).resolves.toEqual({
      ok: false,
      reason: "missing",
    })
  })

  it("stores captured image bytes only inside the one-shot handoff", async () => {
    const now = 3_000
    const handoff = await createImageTranslateHandoff({
      imageUrl: "https://example.com/private/menu.svg",
      captured: {
        dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        mimeType: "image/svg+xml",
        fileName: "captured-menu.svg",
        byteLength: 11,
      },
    }, now)

    expect(browserMock.__storage[IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY]).toEqual({
      [handoff.token]: handoff,
    })

    await expect(consumeImageTranslateHandoff(handoff.token, now + 1)).resolves.toEqual({
      ok: true,
      handoff,
    })
    expect(browserMock.__storage[IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY]).toEqual({})
  })

  it("rejects expired handoffs and prunes stale entries", async () => {
    const handoff = await createImageTranslateHandoff({
      imageUrl: "https://example.com/expired.png",
    }, 2_000)

    await expect(consumeImageTranslateHandoff(handoff.token, 2_000 + IMAGE_TRANSLATE_HANDOFF_TTL_MS + 1)).resolves.toEqual({
      ok: false,
      reason: "expired",
    })
    expect(browserMock.__storage[IMAGE_TRANSLATE_HANDOFF_STORAGE_KEY]).toEqual({})
  })

  it("returns invalid for empty tokens", async () => {
    await expect(consumeImageTranslateHandoff("   ")).resolves.toEqual({
      ok: false,
      reason: "invalid",
    })
  })
})
