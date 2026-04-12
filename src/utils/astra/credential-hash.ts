const textEncoder = new TextEncoder()

export const ASTRA_CREDENTIAL_HASH_ALGORITHM = "sha256_v1" as const

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(value: string): Uint8Array {
  const normalized = value.trim().toLowerCase()
  if (normalized.length % 2 !== 0) {
    throw new Error("Expected an even-length hex string.")
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let index = 0; index < normalized.length; index += 2) {
    const parsed = Number.parseInt(normalized.slice(index, index + 2), 16)
    if (!Number.isFinite(parsed)) {
      throw new Error("Expected a valid hex string.")
    }
    bytes[index / 2] = parsed
  }
  return bytes
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }

  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index]! ^ b[index]!
  }
  return diff === 0
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error("Web Crypto subtle API is unavailable for Astra credential hashing.")
  }

  const digest = await subtle.digest("SHA-256", textEncoder.encode(value))
  return new Uint8Array(digest)
}

export async function hashAstraCredentialSecret(secret: string): Promise<string> {
  return bytesToHex(await sha256Bytes(secret))
}

export async function verifyAstraCredentialSecret(
  secret: string,
  expectedHash: string,
): Promise<boolean> {
  try {
    const [actualBytes, expectedBytes] = await Promise.all([
      sha256Bytes(secret),
      Promise.resolve(hexToBytes(expectedHash)),
    ])
    return constantTimeEqual(actualBytes, expectedBytes)
  } catch {
    return false
  }
}
