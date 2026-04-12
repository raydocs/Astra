import { hashAstraCredentialSecret } from "./credential-hash"

export interface AstraAnonymousIdentityMaterial {
  seed: string
  userId: string
  email: string
  placeholderPassword: string
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function createAnonymousEntropy(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export async function buildAstraAnonymousIdentity(params: {
  installId?: string | null
  entropy?: string | null
} = {}): Promise<AstraAnonymousIdentityMaterial> {
  const installId = normalizeOptionalText(params.installId)
  const entropy = normalizeOptionalText(params.entropy) ?? createAnonymousEntropy()
  const seed = installId ? `install:${installId}` : `entropy:${entropy}`
  const digest = await hashAstraCredentialSecret(seed)
  const email = `anon_${digest.slice(0, 32)}@astra.anonymous`
  const userIdDigest = await hashAstraCredentialSecret(email.trim().toLowerCase())

  return {
    seed,
    userId: `usr_${userIdDigest.slice(0, 12)}`,
    email,
    placeholderPassword: `anon-${digest.slice(32)}`,
  }
}
