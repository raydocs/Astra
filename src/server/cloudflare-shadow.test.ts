import { describe, expect, it, vi } from "vitest"

import { createCloudflareD1Database } from "./cloudflare-shadow"

describe("Cloudflare D1 shadow adapter", () => {
  it("queries the Cloudflare D1 API with SQL and bound params", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      result: [{
        success: true,
        results: [{ id: "usr_shadow_1" }],
        meta: { changes: 1 },
      }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }))

    const db = createCloudflareD1Database({
      accountId: "acct_123",
      databaseId: "db_123",
      apiToken: "token_123",
      fetchImpl: fetchMock as unknown as typeof fetch,
    })

    const row = await db.prepare<{ id: string }>("SELECT id FROM shadow_users WHERE id = ?")
      .bind("usr_shadow_1")
      .first<{ id: string }>()

    expect(row).toEqual({ id: "usr_shadow_1" })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acct_123/d1/database/db_123/query",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token_123",
          "Content-Type": "application/json",
        }),
      }),
    )

    const firstCall = fetchMock.mock.calls.at(0) as unknown[] | undefined
    expect(firstCall).toBeDefined()
    const requestInit = firstCall?.[1] as RequestInit | undefined
    expect(JSON.parse(String(requestInit?.body ?? ""))).toEqual({
      sql: "SELECT id FROM shadow_users WHERE id = ?",
      params: ["usr_shadow_1"],
    })
  })
})
