import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, setMock } = vi.hoisted(() => ({ getMock: vi.fn(), setMock: vi.fn() }))

vi.mock("#imports", () => ({
  browser: { storage: { local: { get: getMock, set: setMock } } },
}))

import { getAdvancedControlsOptIn, setAdvancedControlsOptIn } from "./advanced-controls"

const KEY = "astra:advanced-controls-opt-in"

describe("advanced-controls opt-in storage", () => {
  beforeEach(() => {
    getMock.mockReset()
    setMock.mockReset()
  })

  it("reads true only when the stored flag is exactly true", async () => {
    getMock.mockResolvedValueOnce({ [KEY]: true })
    expect(await getAdvancedControlsOptIn()).toBe(true)

    getMock.mockResolvedValueOnce({})
    expect(await getAdvancedControlsOptIn()).toBe(false)

    getMock.mockResolvedValueOnce({ [KEY]: "true" }) // truthy but not boolean true
    expect(await getAdvancedControlsOptIn()).toBe(false)
  })

  it("defaults to false (zero-config) when storage throws", async () => {
    getMock.mockRejectedValueOnce(new Error("nope"))
    expect(await getAdvancedControlsOptIn()).toBe(false)
  })

  it("persists the opt-in under the dedicated local key", async () => {
    setMock.mockResolvedValueOnce(undefined)
    await setAdvancedControlsOptIn(true)
    expect(setMock).toHaveBeenCalledWith({ [KEY]: true })
  })
})
