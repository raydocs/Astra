import { beforeEach, describe, expect, it, vi } from "vitest"

import { isHoverCapable, isTouchPrimaryEnvironment } from "./useViewportProfile"

function mockMatchMedia(queries: Record<string, boolean>) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: queries[query] ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe("useViewportProfile utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("isTouchPrimaryEnvironment", () => {
    it("returns true when pointer is coarse AND hover is none", () => {
      mockMatchMedia({
        "(pointer: coarse)": true,
        "(hover: none)": true,
      })

      expect(isTouchPrimaryEnvironment()).toBe(true)
    })

    it("returns false when pointer is not coarse", () => {
      mockMatchMedia({
        "(pointer: coarse)": false,
        "(hover: none)": true,
      })

      expect(isTouchPrimaryEnvironment()).toBe(false)
    })

    it("returns false when hover is available", () => {
      mockMatchMedia({
        "(pointer: coarse)": true,
        "(hover: none)": false,
      })

      expect(isTouchPrimaryEnvironment()).toBe(false)
    })

    it("returns false when both pointer is fine and hover is available", () => {
      mockMatchMedia({
        "(pointer: coarse)": false,
        "(hover: none)": false,
      })

      expect(isTouchPrimaryEnvironment()).toBe(false)
    })

    it("returns false when matchMedia is unavailable", () => {
      // Simulate environment where matchMedia is not defined
      // @ts-expect-error -- intentionally removing matchMedia
      window.matchMedia = undefined

      expect(isTouchPrimaryEnvironment()).toBe(false)
    })
  })

  describe("isHoverCapable", () => {
    it("returns true when hover media query matches", () => {
      mockMatchMedia({
        "(hover: hover)": true,
      })

      expect(isHoverCapable()).toBe(true)
    })

    it("returns false when hover media query does not match", () => {
      mockMatchMedia({
        "(hover: hover)": false,
      })

      expect(isHoverCapable()).toBe(false)
    })

    it("returns true (safe default) when matchMedia is unavailable", () => {
      // Simulate environment where matchMedia is not defined
      // @ts-expect-error -- intentionally removing matchMedia
      window.matchMedia = undefined

      // The function uses optional chaining: window.matchMedia?.("(hover: hover)")?.matches
      // When matchMedia is undefined, the whole expression is undefined,
      // and `undefined !== false` is true, so the function returns true.
      expect(isHoverCapable()).toBe(true)
    })
  })
})
