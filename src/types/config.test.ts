import { describe, expect, it } from "vitest"

import {
  DEFAULT_ASTRA_CONFIG,
  hasResolvedProviderAccess,
  resolveManagedProviderConfig,
  resolveSiteTranslationSettings,
  type AstraConfig,
} from "./config"
import type { AstraSession } from "./auth"

describe("resolveSiteTranslationSettings", () => {
  const session: AstraSession = {
    version: 1 as const,
    sessionToken: "astra-session",
    relayBaseURL: "https://astra.example/v1",
    email: "user@example.com",
    plan: "pro" as const,
    subscriptionStatus: "active" as const,
    providerEntitlements: ["openai", "gemini"],
    quota: {
      dailyRequestsLimit: 2000,
      dailyCharactersLimit: 500000,
      requestsPerMinuteLimit: 120,
      remainingDailyRequests: 1999,
      remainingDailyCharacters: 499995,
    },
    usage: {
      totalRequests: 1,
      totalCharacters: 5,
      dailyRequestsUsed: 1,
      dailyCharactersUsed: 5,
      lastRequestAt: "2026-03-26T00:00:00.000Z",
      recentEvents: [],
    },
    expiresAt: null,
  }

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

  it("injects the Astra session token into the resolved provider config", () => {
    const provider = resolveManagedProviderConfig(DEFAULT_ASTRA_CONFIG.provider, session)

    expect(provider.accessToken).toBe("astra-session")
    expect(provider.relayBaseURL).toBe("https://astra.example/v1")
    expect(hasResolvedProviderAccess(DEFAULT_ASTRA_CONFIG.provider, session)).toBe(true)
  })
})
