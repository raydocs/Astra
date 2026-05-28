import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadRelayEnv } from "./config"
import { FileOpsAuditLogStore } from "./ops-audit-log-store"

function createEnv(path: string) {
  return loadRelayEnv({
    ASTRA_RELAY_DATA_DIR: join(path, "data"),
    ASTRA_OPS_AUDIT_LOG_PATH: join(path, "ops-audit-log.json"),
  })
}

describe("FileOpsAuditLogStore", () => {
  it("serializes concurrent audit records without dropping entries", async () => {
    const dir = await mkdtemp(join(tmpdir(), "astra-ops-audit-"))
    const env = createEnv(dir)
    const store = new FileOpsAuditLogStore(env)

    const writes = Array.from({ length: 20 }, (_, index) => store.record({
      actor: "operator",
      action: "ops_user_lookup",
      operatorToken: `operator-token-${index}`,
      subjectUserId: `usr_${index}`,
      metadata: { index },
      privacy: { contentIncluded: false, contentAccess: "metadata_only" },
    }))

    const summaryBeforeAwaitingWrites = await store.summarize("2026-05-27T00:00:00.000Z", 25)
    await Promise.all(writes)

    expect(summaryBeforeAwaitingWrites.totalEvents).toBe(20)
    expect(summaryBeforeAwaitingWrites.recent).toHaveLength(20)
    expect(new Set(summaryBeforeAwaitingWrites.recent.map((entry) => entry.subjectUserId)).size).toBe(20)
    expect(summaryBeforeAwaitingWrites.byAction).toContainEqual({ action: "ops_user_lookup", count: 20 })

    const raw = JSON.parse(await readFile(env.opsAuditLogPath ?? "", "utf8")) as {
      entries: Array<{ subjectUserId: string | null }>
    }
    expect(raw.entries).toHaveLength(20)
    expect(new Set(raw.entries.map((entry) => entry.subjectUserId)).size).toBe(20)
  })
})
