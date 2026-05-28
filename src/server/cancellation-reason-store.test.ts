import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadRelayEnv } from "./config"
import { FileCancellationReasonStore } from "./cancellation-reason-store"

function createEnv(path: string) {
  return loadRelayEnv({
    ASTRA_RELAY_DATA_DIR: join(path, "data"),
    ASTRA_CANCELLATION_REASON_STORE_PATH: join(path, "cancellation-reasons.json"),
  })
}

describe("FileCancellationReasonStore", () => {
  it("serializes concurrent metadata-only cancellation reason records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "astra-cancel-reason-"))
    const env = createEnv(dir)
    const store = new FileCancellationReasonStore(env)

    const writes = Array.from({ length: 20 }, (_, index) => store.record({
      submittedAt: `2026-05-27T00:00:${String(index).padStart(2, "0")}.000Z`,
      subjectUserId: `usr_${index}`,
      subjectEmailHash: "a".repeat(64),
      reason: index % 2 === 0 ? "privacy_concerns" : "too_expensive",
      plan: index % 2 === 0 ? "trial" : "pro",
      source: index % 2 === 0 ? "settings" : "refund_request",
      subscriptionStatus: "active",
      identityMode: "authenticated",
    }))

    const summaryBeforeAwaitingWrites = await store.summarize("2026-05-27T01:00:00.000Z")
    await Promise.all(writes)

    expect(summaryBeforeAwaitingWrites.totalSubmissions).toBe(20)
    expect(summaryBeforeAwaitingWrites.reasonCoverage.coverageRate).toBe(1)
    expect(summaryBeforeAwaitingWrites.byReason).toContainEqual(expect.objectContaining({ reason: "privacy_concerns", count: 10 }))
    expect(summaryBeforeAwaitingWrites.byReason).toContainEqual(expect.objectContaining({ reason: "too_expensive", count: 10 }))
    expect(summaryBeforeAwaitingWrites.bySource).toContainEqual({ source: "settings", count: 10 })
    expect(summaryBeforeAwaitingWrites.bySource).toContainEqual({ source: "refund_request", count: 10 })

    const raw = JSON.parse(await readFile(env.cancellationReasonStorePath ?? "", "utf8")) as {
      records: Array<{ subjectUserId: string; reason: string }>
    }
    expect(raw.records).toHaveLength(20)
    expect(new Set(raw.records.map((entry) => entry.subjectUserId)).size).toBe(20)
  })

  it("does not overwrite retained cancellation feedback when the store is invalid", async () => {
    const dir = await mkdtemp(join(tmpdir(), "astra-cancel-reason-invalid-"))
    const env = createEnv(dir)
    await writeFile(env.cancellationReasonStorePath ?? "", "not-json")

    const store = new FileCancellationReasonStore(env)

    await expect(store.summarize()).rejects.toThrow("invalid JSON")
    await expect(readFile(env.cancellationReasonStorePath ?? "", "utf8")).resolves.toBe("not-json")
  })
})
