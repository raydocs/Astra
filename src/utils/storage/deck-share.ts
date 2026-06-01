/**
 * Shareable decks — user-initiated export/import of saved cards.
 *
 * This is the wedge-safe form of "shared decks": the Strategic Non-Goals gate
 * explicitly prefers user-initiated share/export over a default social surface,
 * so this is a plain, portable, UNSIGNED file (distinct from the signed curated
 * theme packs). It is privacy-safe by construction: a deck carries only the
 * learning content (word, meaning, sentence, explanation) and deliberately omits
 * source URLs, SRS state, and any account/device identity.
 */
import { z } from "zod"

import type { VocabularyEntry } from "@/utils/storage/vocabulary-core"

export const SHAREABLE_DECK_FORMAT = "astra-deck"
export const SHAREABLE_DECK_VERSION = 1
export const MAX_SHAREABLE_DECK_CARDS = 2000

export const ShareableDeckCardSchema = z.object({
  text: z.string().trim().min(1),
  translation: z.string().optional(),
  context: z.string().optional(),
  explanation: z.string().optional(),
})

export const ShareableDeckSchema = z.object({
  format: z.literal(SHAREABLE_DECK_FORMAT),
  version: z.number().int().positive(),
  name: z.string().optional(),
  exportedAt: z.number().int().nonnegative().optional(),
  cards: z.array(ShareableDeckCardSchema).min(1).max(MAX_SHAREABLE_DECK_CARDS),
})

export type ShareableDeckCard = z.infer<typeof ShareableDeckCardSchema>
export type ShareableDeck = z.infer<typeof ShareableDeckSchema>

type DeckSourceEntry = Pick<VocabularyEntry, "text" | "translation" | "context" | "explanation">

/**
 * Build a portable deck from saved entries. Deduplicates by lowercased text and
 * strips everything except the learning content (no URLs, no SRS, no identity).
 * `now` is passed in so the function stays pure/testable.
 */
export function buildShareableDeck(
  entries: readonly DeckSourceEntry[],
  options: { name?: string; now: number },
): ShareableDeck {
  const cards: ShareableDeckCard[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const text = entry.text.trim()
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cards.push({
      text,
      ...(entry.translation?.trim() ? { translation: entry.translation.trim() } : {}),
      ...(entry.context?.trim() ? { context: entry.context.trim() } : {}),
      ...(entry.explanation?.trim() ? { explanation: entry.explanation.trim() } : {}),
    })
    if (cards.length >= MAX_SHAREABLE_DECK_CARDS) break
  }
  const name = options.name?.trim()
  return {
    format: SHAREABLE_DECK_FORMAT,
    version: SHAREABLE_DECK_VERSION,
    ...(name ? { name } : {}),
    exportedAt: options.now,
    cards,
  }
}

export function serializeShareableDeck(deck: ShareableDeck): string {
  return JSON.stringify(deck, null, 2)
}

export type ShareableDeckParseResult =
  | { ok: true; deck: ShareableDeck }
  | { ok: false; error: string }

/**
 * Parse + validate an imported deck from a JSON string or a parsed object.
 * Returns a friendly error rather than throwing, so import UIs can show it.
 */
export function parseShareableDeck(raw: unknown): ShareableDeckParseResult {
  let candidate: unknown = raw
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw)
    } catch {
      return { ok: false, error: "This file is not valid JSON." }
    }
  }
  const isObject = typeof candidate === "object" && candidate !== null
  if (isObject && (candidate as { format?: unknown }).format !== SHAREABLE_DECK_FORMAT) {
    return { ok: false, error: "This is not an Astra deck file." }
  }
  const parsed = ShareableDeckSchema.safeParse(candidate)
  if (!parsed.success) {
    return { ok: false, error: "This deck file is missing or has invalid cards." }
  }
  return { ok: true, deck: parsed.data }
}
