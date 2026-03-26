import { beforeEach, describe, expect, it } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import {
  getVocabularyCount,
  getVocabularyEntries,
  removeVocabularyEntry,
  saveVocabularyEntry,
} from "./vocabulary"

describe("vocabulary storage", () => {
  beforeEach(() => {
    setMockBrowser(createMockBrowser())
  })

  it("saves and retrieves a vocabulary entry", async () => {
    const entry = await saveVocabularyEntry({
      text: "ephemeral",
      translation: "短暂的",
      context: "The ephemeral beauty of cherry blossoms",
      url: "https://example.com/article",
      hostname: "example.com",
    })

    expect(entry.id).toBeTruthy()
    expect(entry.savedAt).toBeGreaterThan(0)
    expect(entry.text).toBe("ephemeral")

    const entries = await getVocabularyEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].text).toBe("ephemeral")
    expect(entries[0].translation).toBe("短暂的")
  })

  it("deduplicates entries with same text and url", async () => {
    await saveVocabularyEntry({
      text: "hello",
      translation: "你好",
      url: "https://example.com/page",
    })

    await saveVocabularyEntry({
      text: "hello",
      translation: "你好（更新）",
      url: "https://example.com/page",
    })

    const entries = await getVocabularyEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].translation).toBe("你好（更新）")
  })

  it("allows same text from different urls", async () => {
    await saveVocabularyEntry({
      text: "hello",
      url: "https://a.com",
    })

    await saveVocabularyEntry({
      text: "hello",
      url: "https://b.com",
    })

    expect(await getVocabularyCount()).toBe(2)
  })

  it("removes an entry by id", async () => {
    const entry = await saveVocabularyEntry({
      text: "remove-me",
    })

    expect(await getVocabularyCount()).toBe(1)
    await removeVocabularyEntry(entry.id)
    expect(await getVocabularyCount()).toBe(0)
  })

  it("prepends new entries (most recent first)", async () => {
    await saveVocabularyEntry({ text: "first" })
    await saveVocabularyEntry({ text: "second" })

    const entries = await getVocabularyEntries()
    expect(entries[0].text).toBe("second")
    expect(entries[1].text).toBe("first")
  })

  it("returns empty array when no entries exist", async () => {
    const entries = await getVocabularyEntries()
    expect(entries).toEqual([])
    expect(await getVocabularyCount()).toBe(0)
  })
})
