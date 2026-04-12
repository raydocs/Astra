import { describe, expect, it } from "vitest"

import {
  ASTRA_CREDENTIAL_HASH_ALGORITHM,
  hashAstraCredentialSecret,
  verifyAstraCredentialSecret,
} from "./credential-hash"

describe("astra credential hash", () => {
  it("hashes credentials deterministically with the expected algorithm", async () => {
    const first = await hashAstraCredentialSecret("astra-demo-pass")
    const second = await hashAstraCredentialSecret("astra-demo-pass")

    expect(ASTRA_CREDENTIAL_HASH_ALGORITHM).toBe("sha256_v1")
    expect(first).toBe(second)
    expect(first).toMatch(/^[a-f0-9]{64}$/)
  })

  it("verifies matching and mismatched secrets", async () => {
    const hash = await hashAstraCredentialSecret("astra-demo-pass")

    await expect(verifyAstraCredentialSecret("astra-demo-pass", hash)).resolves.toBe(true)
    await expect(verifyAstraCredentialSecret("wrong-pass", hash)).resolves.toBe(false)
    await expect(verifyAstraCredentialSecret("astra-demo-pass", "not-hex")).resolves.toBe(false)
  })
})
