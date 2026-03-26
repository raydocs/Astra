import { browser } from "#imports"

import { AstraSessionSchema, type AstraSession } from "@/types/auth"

export const ASTRA_AUTH_STORAGE_KEY = "astra.auth.v1"

function normalizeSession(value: unknown): AstraSession | null {
  const parsed = AstraSessionSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export async function readAstraSession(): Promise<AstraSession | null> {
  const stored = await browser.storage.local.get(ASTRA_AUTH_STORAGE_KEY)
  const session = normalizeSession(stored[ASTRA_AUTH_STORAGE_KEY])

  if (!session && stored[ASTRA_AUTH_STORAGE_KEY] !== undefined) {
    await browser.storage.local.remove(ASTRA_AUTH_STORAGE_KEY)
  }

  return session
}

export async function saveAstraSession(session: AstraSession): Promise<AstraSession> {
  const normalized = AstraSessionSchema.parse(session)
  await browser.storage.local.set({
    [ASTRA_AUTH_STORAGE_KEY]: normalized,
  })
  return normalized
}

export async function clearAstraSession(): Promise<void> {
  await browser.storage.local.remove(ASTRA_AUTH_STORAGE_KEY)
}
