import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearTranslationCache,
  cleanExpiredCache,
  getCachedTranslation,
  getCachedTranslations,
  getCacheStats,
  setCachedTranslation,
} from "./translation-cache"

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
      await setCachedTranslation("Hello", "zh-CN", "你好")
      await setCachedTranslation("World", "zh-CN", "世界")

      const results = await getCachedTranslations([
        { text: "Hello", targetLang: "zh-CN" },
        { text: "Unknown", targetLang: "zh-CN" },
        { text: "World", targetLang: "zh-CN" },
      ])

      expect(results.size).toBe(2)
      expect(results.get(0)).toBe("你好")
      expect(results.has(1)).toBe(false)
      expect(results.get(2)).toBe("世界")
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
    it("returns count and oldest timestamp", async () => {
      const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
      vi.spyOn(Date, "now").mockReturnValue(fiveDaysAgo)
      await setCachedTranslation("First", "zh-CN", "第一")
      vi.spyOn(Date, "now").mockRestore()

      await setCachedTranslation("Second", "zh-CN", "第二")

      const stats = await getCacheStats()
      expect(stats.count).toBe(2)
      expect(stats.oldestMs).toBe(fiveDaysAgo)
    })

    it("returns current time as oldest when cache is empty", async () => {
      const before = Date.now()
      const stats = await getCacheStats()
      expect(stats.count).toBe(0)
      expect(stats.oldestMs).toBeGreaterThanOrEqual(before)
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
