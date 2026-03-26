import Dexie from "dexie"

interface CachedTranslation {
  id?: number
  hash: string           // SHA-256 of sourceText + targetLang
  sourceText: string
  targetLang: string
  translation: string
  createdAt: number
}

class TranslationCacheDB extends Dexie {
  translations!: Dexie.Table<CachedTranslation, number>

  constructor() {
    super("astra-translation-cache")
    this.version(1).stores({
      translations: "++id, hash, createdAt",
    })
  }
}

const db = new TranslationCacheDB()
const TTL_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

async function computeHash(text: string, targetLang: string): Promise<string> {
  const data = new TextEncoder().encode(`${text}|${targetLang}`)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function getCachedTranslation(
  sourceText: string,
  targetLang: string,
): Promise<string | null> {
  const hash = await computeHash(sourceText, targetLang)
  const entry = await db.translations.where("hash").equals(hash).first()
  if (!entry) return null
  if (Date.now() - entry.createdAt > TTL_MS) {
    await db.translations.delete(entry.id!)
    return null
  }
  return entry.translation
}

export async function setCachedTranslation(
  sourceText: string,
  targetLang: string,
  translation: string,
): Promise<void> {
  const hash = await computeHash(sourceText, targetLang)
  const existing = await db.translations.where("hash").equals(hash).first()
  if (existing) {
    await db.translations.update(existing.id!, {
      translation,
      createdAt: Date.now(),
    })
  } else {
    await db.translations.add({
      hash,
      sourceText,
      targetLang,
      translation,
      createdAt: Date.now(),
    })
  }
}

export async function getCachedTranslations(
  entries: Array<{ text: string; targetLang: string }>,
): Promise<Map<number, string>> {
  const results = new Map<number, string>()
  for (let i = 0; i < entries.length; i++) {
    const cached = await getCachedTranslation(
      entries[i].text,
      entries[i].targetLang,
    )
    if (cached !== null) results.set(i, cached)
  }
  return results
}

export async function cleanExpiredCache(): Promise<number> {
  const cutoff = Date.now() - TTL_MS
  return db.translations.where("createdAt").below(cutoff).delete()
}

export async function getCacheStats(): Promise<{
  count: number
  oldestMs: number
}> {
  const count = await db.translations.count()
  const oldest = await db.translations.orderBy("createdAt").first()
  return { count, oldestMs: oldest?.createdAt ?? Date.now() }
}

export async function clearTranslationCache(): Promise<void> {
  await db.translations.clear()
}
