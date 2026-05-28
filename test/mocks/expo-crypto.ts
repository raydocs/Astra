export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(byteCount).fill(7)
}

export async function getRandomBytesAsync(byteCount: number): Promise<Uint8Array> {
  return getRandomBytes(byteCount)
}
