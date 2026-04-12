import { describe, expect, it } from "vitest"

import { buildAstraAnonymousIdentity } from "./anonymous-identity"

describe("astra anonymous identity", () => {
  it("returns deterministic identity material for the same installId", async () => {
    const first = await buildAstraAnonymousIdentity({ installId: "install-demo" })
    const second = await buildAstraAnonymousIdentity({ installId: "install-demo" })

    expect(first).toEqual(second)
    expect(first.seed).toBe("install:install-demo")
    expect(first.email).toMatch(/@astra\.anonymous$/)
    expect(first.userId).toMatch(/^usr_[a-f0-9]{12}$/)
    expect(first.placeholderPassword).toMatch(/^anon-/)
  })

  it("returns distinct identity material for different entropy sources", async () => {
    const first = await buildAstraAnonymousIdentity({ entropy: "entropy-a" })
    const second = await buildAstraAnonymousIdentity({ entropy: "entropy-b" })

    expect(first.email).not.toBe(second.email)
    expect(first.userId).not.toBe(second.userId)
  })
})
