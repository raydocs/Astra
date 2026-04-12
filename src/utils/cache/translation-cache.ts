import Dexie from "dexie"

export interface TranslationCacheContext {
  providerId?: string
  model?: string
  connectionMode?: string
  routingKey?: string
  languageLevel?: string
  sourceLang?: string
  requestContextKey?: string
}

export interface TranslationCacheBucketStats {
  bucketKey: string
  providerId: string
  model: string
  connectionMode: string
  lookups: number
  hits: number
  misses: number
  writes: number
  hitRate: number
  lastAccessedAt: number
}

interface CachedTranslation {
  id?: number
  hash: string
  bucketKey: string
  providerId: string
  model: string
  connectionMode: string
  sourceText: string
  targetLang: string
  translation: string
  createdAt: number
}

interface TranslationCacheMetricRecord {
  bucketKey: string
  providerId: string
  model: string
  connectionMode: string
  lookups: number
  hits: number
  misses: number
  writes: number
  lastAccessedAt: number
}

class TranslationCacheDB extends Dexie {
  translations!: Dexie.Table<CachedTranslation, number>
  metrics!: Dexie.Table<TranslationCacheMetricRecord, string>

  constructor() {
    super("astra-translation-cache")
    this.version(1).stores({
      translations: "++id, hash, createdAt",
    })
    this.version(2).stores({
      translations: "++id, hash, createdAt, bucketKey, providerId, model, connectionMode",
      metrics: "&bucketKey, providerId, model, connectionMode, lastAccessedAt",
    })
  }
}

const db = new TranslationCacheDB()
const TTL_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

function normalizeCacheContext(context?: TranslationCacheContext) {
  return {
    providerId: context?.providerId?.trim() || "default",
    model: context?.model?.trim() || "default",
    connectionMode: context?.connectionMode?.trim() || "default",
    routingKey: context?.routingKey?.trim() || "default",
    languageLevel: context?.languageLevel?.trim() || "default",
    sourceLang: context?.sourceLang?.trim() || "default",
    requestContextKey: context?.requestContextKey?.trim() || "default",
  }
}

function createCacheContextKey(context?: TranslationCacheContext): string {
  return JSON.stringify(normalizeCacheContext(context))
}

function createBucketInfo(context?: TranslationCacheContext) {
  const normalized = normalizeCacheContext(context)
  return {
    bucketKey: JSON.stringify({
      providerId: normalized.providerId,
      model: normalized.model,
      connectionMode: normalized.connectionMode,
      routingKey: normalized.routingKey,
      languageLevel: normalized.languageLevel,
    }),
    providerId: normalized.providerId,
    model: normalized.model,
    connectionMode: normalized.connectionMode,
  }
}

async function computeHash(
  text: string,
  targetLang: string,
  context?: TranslationCacheContext,
): Promise<string> {
  const contextKey = createCacheContextKey(context)
  const data = new TextEncoder().encode(`${contextKey}|${text}|${targetLang}`)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function updateMetricRecord(
  context: TranslationCacheContext | undefined,
  patch: Partial<Pick<TranslationCacheMetricRecord, "lookups" | "hits" | "misses" | "writes">>,
): Promise<void> {
  const bucket = createBucketInfo(context)
  const now = Date.now()

  await db.transaction("rw", db.metrics, async () => {
    const existing = await db.metrics.get(bucket.bucketKey)

    if (existing) {
      await db.metrics.put({
        ...existing,
        lookups: existing.lookups + (patch.lookups ?? 0),
        hits: existing.hits + (patch.hits ?? 0),
        misses: existing.misses + (patch.misses ?? 0),
        writes: existing.writes + (patch.writes ?? 0),
        lastAccessedAt: now,
      })
      return
    }

    await db.metrics.put({
      bucketKey: bucket.bucketKey,
      providerId: bucket.providerId,
      model: bucket.model,
      connectionMode: bucket.connectionMode,
      lookups: patch.lookups ?? 0,
      hits: patch.hits ?? 0,
      misses: patch.misses ?? 0,
      writes: patch.writes ?? 0,
      lastAccessedAt: now,
    })
  })
}

export async function getCachedTranslation(
  sourceText: string,
  targetLang: string,
  context?: TranslationCacheContext,
): Promise<string | null> {
  const hash = await computeHash(sourceText, targetLang, context)
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
  context?: TranslationCacheContext,
): Promise<void> {
  const hash = await computeHash(sourceText, targetLang, context)
  const bucket = createBucketInfo(context)
  const existing = await db.translations.where("hash").equals(hash).first()
  if (existing) {
    await db.translations.update(existing.id!, {
      bucketKey: bucket.bucketKey,
      providerId: bucket.providerId,
      model: bucket.model,
      connectionMode: bucket.connectionMode,
      translation,
      createdAt: Date.now(),
    })
  } else {
    await db.translations.add({
      hash,
      bucketKey: bucket.bucketKey,
      providerId: bucket.providerId,
      model: bucket.model,
      connectionMode: bucket.connectionMode,
      sourceText,
      targetLang,
      translation,
      createdAt: Date.now(),
    })
  }

  await updateMetricRecord(context, { writes: 1 })
}

export async function getCachedTranslations(
  entries: Array<{ text: string; targetLang: string; cacheContext?: TranslationCacheContext }>,
): Promise<Map<number, string>> {
  const results = new Map<number, string>()

  // 1. Batch-compute all SHA-256 hashes in parallel
  const hashes = await Promise.all(
    entries.map((entry) => computeHash(entry.text, entry.targetLang, entry.cacheContext)),
  )

  // 2. Single multi-key Dexie query
  const rows = await db.translations.where("hash").anyOf(hashes).toArray()
  const rowsByHash = new Map<string, CachedTranslation>()
  for (const row of rows) {
    rowsByHash.set(row.hash, row)
  }

  // 3. Map results back, preserving order and TTL/expiry logic
  const expiredIds: number[] = []
  const now = Date.now()
  const aggregates = new Map<string, {
    cacheContext?: TranslationCacheContext
    lookups: number
    hits: number
    misses: number
  }>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const bucketKey = createBucketInfo(entry.cacheContext).bucketKey
    const aggregate = aggregates.get(bucketKey) ?? {
      cacheContext: entry.cacheContext,
      lookups: 0,
      hits: 0,
      misses: 0,
    }
    aggregate.lookups += 1

    const row = rowsByHash.get(hashes[i])
    if (row && now - row.createdAt <= TTL_MS) {
      results.set(i, row.translation)
      aggregate.hits += 1
    } else {
      if (row) {
        expiredIds.push(row.id!)
      }
      aggregate.misses += 1
    }

    aggregates.set(bucketKey, aggregate)
  }

  // Clean up expired entries
  if (expiredIds.length > 0) {
    await db.translations.bulkDelete(expiredIds)
  }

  await Promise.all(Array.from(aggregates.values()).map((aggregate) => updateMetricRecord(
    aggregate.cacheContext,
    {
      lookups: aggregate.lookups,
      hits: aggregate.hits,
      misses: aggregate.misses,
    },
  )))

  return results
}

export async function cleanExpiredCache(): Promise<number> {
  const cutoff = Date.now() - TTL_MS
  return db.translations.where("createdAt").below(cutoff).delete()
}

export async function getCacheStats(): Promise<{
  count: number
  oldestMs: number
  lookups: number
  hits: number
  misses: number
  writes: number
  hitRate: number
  buckets: TranslationCacheBucketStats[]
}> {
  await cleanExpiredCache()
  const count = await db.translations.count()
  const oldest = await db.translations.orderBy("createdAt").first()
  const metrics = await db.metrics.toArray()
  const lookups = metrics.reduce((sum, metric) => sum + metric.lookups, 0)
  const hits = metrics.reduce((sum, metric) => sum + metric.hits, 0)
  const misses = metrics.reduce((sum, metric) => sum + metric.misses, 0)
  const writes = metrics.reduce((sum, metric) => sum + metric.writes, 0)
  const buckets = metrics
    .map((metric) => ({
      ...metric,
      hitRate: metric.lookups > 0 ? metric.hits / metric.lookups : 0,
    }))
    .sort((left, right) => right.lookups - left.lookups || right.writes - left.writes)

  return {
    count,
    oldestMs: oldest?.createdAt ?? Date.now(),
    lookups,
    hits,
    misses,
    writes,
    hitRate: lookups > 0 ? hits / lookups : 0,
    buckets,
  }
}

export async function clearTranslationCache(): Promise<void> {
  await db.translations.clear()
  await db.metrics.clear()
}
