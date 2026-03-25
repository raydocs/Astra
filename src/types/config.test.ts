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

  it("resolves 'always' hover trigger from global config", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "always",
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("always")
  })

  it("resolves 'always' hover trigger from site-level override", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      hoverTrigger: "alt",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          hoverTrigger: "always",
        },
      },
    }

    const resolved = resolveSiteTranslationSettings(config, "example.com")

    expect(resolved.hoverTrigger).toBe("always")
  })

  it("defaults contentScope to page", () => {
    const resolved = resolveSiteTranslationSettings(DEFAULT_ASTRA_CONFIG, "example.com")
    expect(resolved.contentScope).toBe("page")
  })

  it("inherits global contentScope when site override is missing", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "article",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
        },
      },
    }
    const resolved = resolveSiteTranslationSettings(config, "example.com")
    expect(resolved.contentScope).toBe("article")
  })

  it("prefers site contentScope over global default", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "page",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          contentScope: "article",
        },
      },
    }
    const resolved = resolveSiteTranslationSettings(config, "example.com")
    expect(resolved.contentScope).toBe("article")
  })

  it("prefers override contentScope over site and global", () => {
    const config: AstraConfig = {
      ...DEFAULT_ASTRA_CONFIG,
      contentScope: "page",
      sites: {
        "example.com": {
          enabled: true,
          alwaysTranslate: false,
          contentScope: "page",
        },
      },
    }
    const resolved = resolveSiteTranslationSettings(config, "example.com", { contentScope: "article" })
    expect(resolved.contentScope).toBe("article")
  })
})
