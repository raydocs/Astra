import { describe, expect, it } from "vitest"

import { summarizeProviderRoute } from "./routing-metadata"

describe("routing metadata helpers", () => {
  it("classifies direct requests", () => {
    expect(summarizeProviderRoute(["direct"], "direct")).toBe("direct")
    expect(summarizeProviderRoute(["direct"], null)).toBe("direct")
  })

  it("classifies relay requests", () => {
    expect(summarizeProviderRoute(["relay"], "relay")).toBe("relay")
    expect(summarizeProviderRoute(["relay"], null)).toBe("relay")
  })

  it("classifies fallback chains", () => {
    expect(summarizeProviderRoute(["direct", "relay"], "relay")).toBe("fallback")
  })

  it("returns null when no transport was attempted", () => {
    expect(summarizeProviderRoute([], null)).toBeNull()
  })
})
