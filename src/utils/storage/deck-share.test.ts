import { describe, expect, it } from "vitest"

import {
  buildShareableDeck,
  MAX_SHAREABLE_DECK_CARDS,
  parseShareableDeck,
  serializeShareableDeck,
  SHAREABLE_DECK_FORMAT,
  SHAREABLE_DECK_VERSION,
} from "./deck-share"

const NOW = 1_717_000_000_000

describe("buildShareableDeck", () => {
  it("keeps only learning content — no URL, SRS state, or identity leaks", () => {
    const deck = buildShareableDeck(
      [{ text: "resilience", translation: "韧性", context: "Her resilience helped.", explanation: "why it matters", url: "https://example.com/secret", srsBox: 4 } as never],
      { name: "My deck", now: NOW },
    )
    expect(deck).toEqual({
      format: SHAREABLE_DECK_FORMAT,
      version: SHAREABLE_DECK_VERSION,
      name: "My deck",
      exportedAt: NOW,
      cards: [{ text: "resilience", translation: "韧性", context: "Her resilience helped.", explanation: "why it matters" }],
    })
    const serialized = serializeShareableDeck(deck)
    expect(serialized).not.toContain("example.com")
    expect(serialized).not.toContain("srsBox")
  })

  it("dedupes by lowercased text and drops blank entries", () => {
    const deck = buildShareableDeck(
      [
        { text: "Run", translation: "跑" },
        { text: "run", translation: "again" }, // dup
        { text: "  ", translation: "blank" }, // blank
        { text: "walk" },
      ],
      { now: NOW },
    )
    expect(deck.cards.map((c) => c.text)).toEqual(["Run", "walk"])
    expect(deck.name).toBeUndefined()
  })

  it("caps the deck at the maximum card count", () => {
    const many = Array.from({ length: MAX_SHAREABLE_DECK_CARDS + 50 }, (_, i) => ({ text: `word${i}` }))
    const deck = buildShareableDeck(many, { now: NOW })
    expect(deck.cards).toHaveLength(MAX_SHAREABLE_DECK_CARDS)
  })
})

describe("parseShareableDeck", () => {
  const validDeck = { format: SHAREABLE_DECK_FORMAT, version: 1, cards: [{ text: "resilience", translation: "韧性" }] }

  it("round-trips a built deck through serialize → parse", () => {
    const deck = buildShareableDeck([{ text: "resilience", translation: "韧性" }], { now: NOW })
    const result = parseShareableDeck(serializeShareableDeck(deck))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.deck.cards[0]?.text).toBe("resilience")
  })

  it("accepts both a JSON string and a parsed object", () => {
    expect(parseShareableDeck(validDeck).ok).toBe(true)
    expect(parseShareableDeck(JSON.stringify(validDeck)).ok).toBe(true)
  })

  it("rejects invalid JSON", () => {
    const result = parseShareableDeck("{not json")
    expect(result).toEqual({ ok: false, error: "This file is not valid JSON." })
  })

  it("rejects a file that is not an Astra deck", () => {
    const result = parseShareableDeck({ format: "anki", cards: [] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("not an Astra deck")
  })

  it("rejects a deck with no usable cards", () => {
    expect(parseShareableDeck({ format: SHAREABLE_DECK_FORMAT, version: 1, cards: [] }).ok).toBe(false)
    expect(parseShareableDeck({ format: SHAREABLE_DECK_FORMAT, version: 1, cards: [{ translation: "x" }] }).ok).toBe(false)
  })
})
