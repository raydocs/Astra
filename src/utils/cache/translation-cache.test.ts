import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearTranslationCache,
  cleanExpiredCache,
  getCachedTranslation,
  getCachedTranslations,
  getCacheStats,
  setCachedTranslation,
  type TranslationCacheContext,
} from "./translation-cache"

const openAiNanoContext: TranslationCacheContext = {
  providerId: "openai",
  model: "gpt-5.4-nano",
  connectionMode: "astra",
  routingKey: "astra",
  languageLevel: "intermediate",
}

const geminiFlashContext: TranslationCacheContext = {
  providerId: "gemini",
  model: "gemini-3.1-flash-lite-preview",
  connectionMode: "custom",
  routingKey: "https://gemini.example/v1",
  languageLevel: "advanced",
}

describe("translation-cache", () => {
  beforeEach(async () => {
    await clearTranslationCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("set + get", () => {
    it("stores and retrieves a translation", async () => {
      await setCachedTranslation("Hello", "zh-CN", "你好")
      const result = await getCachedTranslation("Hello", "zh-CN")
      expect(result).toBe("你好")
    })

    it("returns null for a cache miss", async () => {
      const result = await getCachedTranslation("Goodbye", "zh-CN")
      expect(result).toBeNull()
    })

    it("distinguishes different target languages", async () => {
      await setCachedTranslation("Hello", "zh-CN", "你好")
      await setCachedTranslation("Hello", "ja", "こんにちは")

      expect(await getCachedTranslation("Hello", "zh-CN")).toBe("你好")
      expect(await getCachedTranslation("Hello", "ja")).toBe("こんにちは")
    })

    it("updates an existing entry when set is called again", async () => {
      await setCachedTranslation("Hello", "zh-CN", "你好")
      await setCachedTranslation("Hello", "zh-CN", "你好世界")

      const result = await getCachedTranslation("Hello", "zh-CN")
      expect(result).toBe("你好世界")
    })

    it("isolates entries by translation cache context", async () => {
      await setCachedTranslation("Hello", "zh-CN", "你好", openAiNanoContext)
      await setCachedTranslation("Hello", "zh-CN", "您好", geminiFlashContext)

      expect(await getCachedTranslation("Hello", "zh-CN", openAiNanoContext)).toBe("你好")
      expect(await getCachedTranslation("Hello", "zh-CN", geminiFlashContext)).toBe("您好")
      expect(await getCachedTranslation("Hello", "zh-CN", {
        ...openAiNanoContext,
        model: "gpt-5.4-mini",
      })).toBeNull()
      expect(await getCachedTranslation("Hello", "zh-CN", {
        ...openAiNanoContext,
        sourceLang: "en",
      })).toBeNull()
      expect(await getCachedTranslation("Hello", "zh-CN", {
        ...openAiNanoContext,
        requestContextKey: JSON.stringify({ terminologyGlossary: "Astra => 阿斯特拉" }),
      })).toBeNull()
    })
  })

  describe("TTL expiry", () => {
    it("returns null for an expired entry", async () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      vi.spyOn(Date, "now").mockReturnValue(thirtyOneDaysAgo)

      await setCachedTranslation("Hello", "zh-CN", "你好")

      vi.spyOn(Date, "now").mockRestore()

      const result = await getCachedTranslation("Hello", "zh-CN")
      expect(result).toBeNull()
    })

    it("returns value for a non-expired entry", async () => {
      const twentyNineDaysAgo = Date.now() - 29 * 24 * 60 * 60 * 1000
      vi.spyOn(Date, "now").mockReturnValue(twentyNineDaysAgo)

      await setCachedTranslation("Hello", "zh-CN", "你好")

      vi.spyOn(Date, "now").mockRestore()

      const result = await getCachedTranslation("Hello", "zh-CN")
      expect(result).toBe("你好")
    })
  })

  describe("batch get", () => {
    it("returns cached entries by index", async () => {
      await setCachedTranslation("Hello", "zh-CN", "你好", openAiNanoContext)
      await setCachedTranslation("World", "zh-CN", "世界", openAiNanoContext)

      const results = await getCachedTranslations([
        { text: "Hello", targetLang: "zh-CN", cacheContext: openAiNanoContext },
        { text: "Unknown", targetLang: "zh-CN", cacheContext: openAiNanoContext },
        { text: "World", targetLang: "zh-CN", cacheContext: openAiNanoContext },
        { text: "Hello", targetLang: "zh-CN", cacheContext: geminiFlashContext },
      ])

      expect(results.size).toBe(2)
      expect(results.get(0)).toBe("你好")
      expect(results.has(1)).toBe(false)
      expect(results.get(2)).toBe("世界")
      expect(results.has(3)).toBe(false)
    })

    it("tracks lookup and write metrics by cache bucket", async () => {
      await setCachedTranslation("Hello", "zh-CN", "你好", openAiNanoContext)
      await setCachedTranslation("World", "zh-CN", "世界", openAiNanoContext)
      await setCachedTranslation("Hello", "zh-CN", "您好", geminiFlashContext)

      await getCachedTranslations([
        { text: "Hello", targetLang: "zh-CN", cacheContext: openAiNanoContext },
        { text: "Unknown", targetLang: "zh-CN", cacheContext: openAiNanoContext },
        { text: "Hello", targetLang: "zh-CN", cacheContext: geminiFlashContext },
      ])

      const stats = await getCacheStats()
      expect(stats.count).toBe(3)
      expect(stats.writes).toBe(3)
      expect(stats.lookups).toBe(3)
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(2 / 3)
      expect(stats.buckets).toEqual(expect.arrayContaining([
        expect.objectContaining({
          providerId: "openai",
          model: "gpt-5.4-nano",
          lookups: 2,
          hits: 1,
          misses: 1,
          writes: 2,
        }),
        expect.objectContaining({
          providerId: "gemini",
          model: "gemini-3.1-flash-lite-preview",
          lookups: 1,
          hits: 1,
          misses: 0,
          writes: 1,
        }),
      ]))
    })
  })

  describe("cleanExpiredCache", () => {
    it("removes expired entries and keeps fresh ones", async () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      vi.spyOn(Date, "now").mockReturnValue(thirtyOneDaysAgo)
      await setCachedTranslation("Old", "zh-CN", "旧的")
      vi.spyOn(Date, "now").mockRestore()

      await setCachedTranslation("New", "zh-CN", "新的")

      const deleted = await cleanExpiredCache()
      expect(deleted).toBe(1)

      expect(await getCachedTranslation("Old", "zh-CN")).toBeNull()
      expect(await getCachedTranslation("New", "zh-CN")).toBe("新的")
    })
  })

  describe("getCacheStats", () => {
    it("prunes expired entries before reporting stats", async () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      vi.spyOn(Date, "now").mockReturnValue(thirtyOneDaysAgo)
      await setCachedTranslation("Expired", "zh-CN", "过期")
      vi.spyOn(Date, "now").mockRestore()

      const freshCreatedAtLowerBound = Date.now()
      await setCachedTranslation("Fresh", "zh-CN", "新鲜")
      const freshCreatedAtUpperBound = Date.now()

      const stats = await getCacheStats()
      expect(stats.count).toBe(1)
      expect(stats.oldestMs).toBeGreaterThanOrEqual(freshCreatedAtLowerBound)
      expect(stats.oldestMs).toBeLessThanOrEqual(freshCreatedAtUpperBound)
      expect(await getCachedTranslation("Fresh", "zh-CN")).toBe("新鲜")
    })

    it("returns count and oldest timestamp", async () => {
      const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
      vi.spyOn(Date, "now").mockReturnValue(fiveDaysAgo)
      await setCachedTranslation("First", "zh-CN", "第一")
      vi.spyOn(Date, "now").mockRestore()

      await setCachedTranslation("Second", "zh-CN", "第二")

      const stats = await getCacheStats()
      expect(stats.count).toBe(2)
      expect(stats.oldestMs).toBe(fiveDaysAgo)
      expect(stats.writes).toBe(2)
    })

    it("returns current time as oldest when cache is empty", async () => {
      const before = Date.now()
      const stats = await getCacheStats()
      expect(stats.count).toBe(0)
      expect(stats.oldestMs).toBeGreaterThanOrEqual(before)
      expect(stats.lookups).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.writes).toBe(0)
      expect(stats.buckets).toEqual([])
    })
  })

  describe("clearTranslationCache", () => {
    it("removes all entries", async () => {
      await setCachedTranslation("Hello", "zh-CN", "你好")
      await setCachedTranslation("World", "zh-CN", "世界")

      await clearTranslationCache()

      expect(await getCachedTranslation("Hello", "zh-CN")).toBeNull()
      expect(await getCachedTranslation("World", "zh-CN")).toBeNull()

      const stats = await getCacheStats()
      expect(stats.count).toBe(0)
    })
  })
})
