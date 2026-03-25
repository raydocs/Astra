import { describe, expect, it } from "vitest"

import {
  DEFAULT_ASTRA_CONFIG,
  resolveSiteTranslationSettings,
  type AstraConfig,
} from "./config"

describe("resolveSiteTranslationSettings", () => {
  it("defaults hover trigger to alt", () => {
    const resolved = resolveSiteTranslationSettings(DEFAULT_ASTRA_CONFIG, "example.com")

    expect(resolved.hoverTrigger).toBe("alt")
  })

  it("inherits global hover trigger when site override is missing", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "disabled",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("disabled")
  })

  it("prefers site hover trigger over global default", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "disabled",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          hoverTrigger: "alt",
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("alt")
  })
})
