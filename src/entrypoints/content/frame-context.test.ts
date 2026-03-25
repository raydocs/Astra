import { describe, expect, it, vi } from "vitest"

import { getFrameId, isTopFrame } from "./frame-context"

describe("frame-context", () => {
  describe("isTopFrame", () => {
    it("returns true when window equals window.top", () => {
      // In jsdom, window === window.top by default
      expect(isTopFrame()).toBe(true)
    })

    it("returns false when window differs from window.top", () => {
      // Simulate a child frame by making window.top return a different object
      const fakeTop = {} as Window & typeof globalThis
      vi.stubGlobal("top", fakeTop)

      expect(isTopFrame()).toBe(false)

      vi.unstubAllGlobals()
    })

    it("returns false when window.top access throws (cross-origin)", () => {
      // Simulate cross-origin restriction where accessing window.top throws
      vi.stubGlobal(
        "top",
        new Proxy({} as Window, {
          get() {
            throw new DOMException("Blocked a frame with origin")
          },
        }),
      )

      // Override the property so that the comparison itself throws
      Object.defineProperty(window, "top", {
        get() {
          throw new DOMException("Blocked a frame with origin")
        },
        configurable: true,
      })

      expect(isTopFrame()).toBe(false)

      // Restore
      Object.defineProperty(window, "top", {
        value: window,
        configurable: true,
        writable: true,
      })
    })
  })

  describe("getFrameId", () => {
    it("returns 'top' for the top frame", () => {
      // In jsdom, window === window.top by default
      expect(getFrameId()).toBe("top")
    })

    it("returns a frame-prefixed id for child frames", () => {
      const fakeTop = {} as Window & typeof globalThis
      vi.stubGlobal("top", fakeTop)

      const id = getFrameId()
      expect(id).toMatch(/^frame-/)
      expect(id.length).toBeGreaterThan("frame-".length)

      vi.unstubAllGlobals()
    })
  })
})
