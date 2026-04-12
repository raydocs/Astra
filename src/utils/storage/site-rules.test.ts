import { describe, expect, it } from "vitest"
import { DEFAULT_ASTRA_CONFIG } from "@/types/config"
import type { AstraConfig, SiteConfig } from "@/types/config"
import {
  exportSiteRules,
  exportSingleSiteRule,
  importSiteRules,
} from "./site-rules"

function createConfig(sites: Record<string, SiteConfig> = {}): AstraConfig {
  return { ...DEFAULT_ASTRA_CONFIG, sites }
}

const CUSTOM_RULE: SiteConfig = {
  enabled: true,
  alwaysTranslate: true,
  targetLang: "ja",
  selectors: ["article"],
}

const DEFAULT_RULE: SiteConfig = {
  enabled: true,
  alwaysTranslate: false,
}

describe("site-rules", () => {
  describe("exportSiteRules", () => {
    it("exports non-default site configs as JSON array", () => {
      const config = createConfig({
        "example.com": CUSTOM_RULE,
        "default-site.com": DEFAULT_RULE,
      })

      const json = exportSiteRules(config)
      const parsed = JSON.parse(json)

      expect(parsed).toHaveLength(1)
      expect(parsed[0].hostname).toBe("example.com")
      expect(parsed[0].version).toBe(1)
      expect(parsed[0].rule.alwaysTranslate).toBe(true)
      expect(parsed[0].rule.targetLang).toBe("ja")
    })

    it("exports empty array when no non-default sites exist", () => {
      const config = createConfig({})
      const json = exportSiteRules(config)
      expect(JSON.parse(json)).toEqual([])
    })
  })

  describe("exportSingleSiteRule", () => {
    it("exports a single site rule as JSON object", () => {
      const json = exportSingleSiteRule("example.com", CUSTOM_RULE)
      const parsed = JSON.parse(json)

      expect(parsed.hostname).toBe("example.com")
      expect(parsed.version).toBe(1)
      expect(parsed.rule.alwaysTranslate).toBe(true)
    })
  })

  describe("importSiteRules", () => {
    it("imports a single rule object and merges into config", () => {
      const existing = createConfig({ "keep.com": CUSTOM_RULE })
      const importJson = JSON.stringify({
        hostname: "new.com",
        version: 1,
        rule: { enabled: true, alwaysTranslate: true },
      })

      const result = importSiteRules(importJson, existing)

      expect(result.sites["keep.com"]).toEqual(CUSTOM_RULE)
      expect(result.sites["new.com"]).toEqual({
        enabled: true,
        alwaysTranslate: true,
      })
    })

    it("imports an array of rules", () => {
      const existing = createConfig({})
      const rules = [
        { hostname: "a.com", version: 1, rule: { enabled: true, alwaysTranslate: true } },
        { hostname: "b.com", version: 1, rule: { enabled: false, alwaysTranslate: false } },
      ]

      const result = importSiteRules(JSON.stringify(rules), existing)

      expect(result.sites["a.com"]?.alwaysTranslate).toBe(true)
      expect(result.sites["b.com"]?.enabled).toBe(false)
    })

    it("overrides existing hostname entries", () => {
      const existing = createConfig({
        "example.com": { enabled: true, alwaysTranslate: false, targetLang: "ko" },
      })

      const importJson = JSON.stringify({
        hostname: "example.com",
        version: 1,
        rule: { enabled: true, alwaysTranslate: true, targetLang: "ja" },
      })

      const result = importSiteRules(importJson, existing)
      expect(result.sites["example.com"]?.targetLang).toBe("ja")
      expect(result.sites["example.com"]?.alwaysTranslate).toBe(true)
    })

    it("removes hostname when imported rule is default", () => {
      const existing = createConfig({
        "remove.com": CUSTOM_RULE,
      })

      const importJson = JSON.stringify({
        hostname: "remove.com",
        version: 1,
        rule: DEFAULT_RULE,
      })

      const result = importSiteRules(importJson, existing)
      expect(result.sites["remove.com"]).toBeUndefined()
    })

    it("throws on invalid JSON", () => {
      expect(() => importSiteRules("not json", createConfig())).toThrow()
    })

    it("throws on invalid rule format", () => {
      const invalidJson = JSON.stringify({ hostname: 42, version: 1, rule: {} })
      expect(() => importSiteRules(invalidJson, createConfig())).toThrow()
    })

    it("preserves non-sites config properties", () => {
      const existing = createConfig({})
      const importJson = JSON.stringify({
        hostname: "test.com",
        version: 1,
        rule: { enabled: true, alwaysTranslate: true },
      })

      const result = importSiteRules(importJson, existing)
      expect(result.targetLang).toBe(existing.targetLang)
      expect(result.provider).toEqual(existing.provider)
    })

    it("round-trips through export then import", () => {
      const original = createConfig({
        "site-a.com": CUSTOM_RULE,
        "site-b.com": { enabled: false, alwaysTranslate: false, contentScope: "article" },
      })

      const exported = exportSiteRules(original)
      const imported = importSiteRules(exported, createConfig({}))

      expect(imported.sites["site-a.com"]).toEqual(CUSTOM_RULE)
      expect(imported.sites["site-b.com"]?.contentScope).toBe("article")
    })
  })
})
