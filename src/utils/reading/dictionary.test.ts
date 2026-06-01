import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

const { getURLMock } = vi.hoisted(() => ({
  getURLMock: vi.fn(),
}))

vi.mock("#imports", () => ({
  browser: {
    runtime: {
      getURL: getURLMock,
    },
  },
}))

import {
  isDictionaryLookupCandidate,
  lookupDictionary,
  lookupInLexicon,
  normalizeDictionaryKey,
  resetDictionaryLexiconForTests,
  type PackagedLexicon,
  type Lexicon,
} from "./dictionary"

const lexicon: Lexicon = {
  resilience: { ipa: "ri'ziliәns", gloss: "弹回，有弹力，恢复力" },
  run: { ipa: "rʌn", gloss: "跑，赛跑" },
}

const packagedLexicon: PackagedLexicon = {
  entries: lexicon,
  aliases: {
    ran: "run",
  },
}

describe("dictionary lookup", () => {
  beforeEach(() => {
    getURLMock.mockReset()
    resetDictionaryLexiconForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("normalizes selections to a lowercased headword key", () => {
    expect(normalizeDictionaryKey("  Resilience ")).toBe("resilience")
    expect(normalizeDictionaryKey("RUN")).toBe("run")
  })

  it("treats only single English headwords as lookup candidates", () => {
    expect(isDictionaryLookupCandidate("resilience")).toBe(true)
    expect(isDictionaryLookupCandidate("well-being")).toBe(true)
    expect(isDictionaryLookupCandidate("give up")).toBe(false) // phrase
    expect(isDictionaryLookupCandidate("韧性")).toBe(false) // CJK
    expect(isDictionaryLookupCandidate("")).toBe(false)
  })

  it("returns the entry on a case-insensitive hit and null on a miss", () => {
    expect(lookupInLexicon(lexicon, "Resilience")).toEqual({ ipa: "ri'ziliәns", gloss: "弹回，有弹力，恢复力" })
    expect(lookupInLexicon(lexicon, "ubiquitous")).toBeNull()
    expect(lookupInLexicon(lexicon, "give up")).toBeNull()
  })

  it("resolves packaged inflection aliases without duplicating dictionary entries", () => {
    expect(lookupInLexicon(packagedLexicon, "ran")).toEqual({ ipa: "rʌn", gloss: "跑，赛跑" })
  })

  it("loads the packaged lexicon once and resolves dictionary hits through extension URLs", async () => {
    getURLMock.mockReturnValue("chrome-extension://astra/dictionary/en-zh-common.json")
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => lexicon,
    }))
    vi.stubGlobal("fetch", fetchMock)

    await expect(lookupDictionary("Resilience")).resolves.toEqual({ ipa: "ri'ziliәns", gloss: "弹回，有弹力，恢复力" })
    await expect(lookupDictionary("RUN")).resolves.toEqual({ ipa: "rʌn", gloss: "跑，赛跑" })

    expect(getURLMock).toHaveBeenCalledWith("/dictionary/en-zh-common.json")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("falls back to null when the packaged lexicon cannot be read", async () => {
    getURLMock.mockReturnValue("chrome-extension://astra/dictionary/en-zh-common.json")
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })))

    await expect(lookupDictionary("Resilience")).resolves.toBeNull()
  })

  it("keeps common irregular inflections in the generated asset", () => {
    const asset = JSON.parse(readFileSync(resolve(process.cwd(), "public/dictionary/en-zh-common.json"), "utf8")) as PackagedLexicon

    expect(lookupInLexicon(asset, "went")).toEqual(lookupInLexicon(asset, "go"))
    expect(lookupInLexicon(asset, "mice")).toEqual(lookupInLexicon(asset, "mouse"))
    expect(lookupInLexicon(asset, "ran")).toEqual(lookupInLexicon(asset, "run"))
  })
})
