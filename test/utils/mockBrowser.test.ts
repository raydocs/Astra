import { describe, expect, it, vi } from "vitest"

import { createMockBrowser } from "./mockBrowser"

describe("mockBrowser listener buses", () => {
  it("emits runtime messages to registered listeners", async () => {
    const browser = createMockBrowser()
    const listener = vi.fn()
    const sendResponse = vi.fn()

    browser.runtime.onMessage.addListener(listener)
    await browser.__emitRuntimeMessage({ type: "ping" }, { id: "sender" }, sendResponse)

    expect(listener).toHaveBeenCalledWith({ type: "ping" }, { id: "sender" }, sendResponse)
  })

  it("emits command events to registered listeners", async () => {
    const browser = createMockBrowser()
    const listener = vi.fn()

    browser.commands.onCommand.addListener(listener)
    await browser.__emitCommand("toggleTranslate")

    expect(listener).toHaveBeenCalledWith("toggleTranslate")
  })

  it("supports symmetric removeListener on command and install events", async () => {
    const browser = createMockBrowser()
    const commandListener = vi.fn()
    const installListener = vi.fn()

    browser.commands.onCommand.addListener(commandListener)
    browser.runtime.onInstalled.addListener(installListener)
    browser.commands.onCommand.removeListener(commandListener)
    browser.runtime.onInstalled.removeListener(installListener)

    await browser.__emitCommand("toggleTranslate")
    await browser.__emitInstalled({ reason: "install" })

    expect(commandListener).not.toHaveBeenCalled()
    expect(installListener).not.toHaveBeenCalled()
  })
})
