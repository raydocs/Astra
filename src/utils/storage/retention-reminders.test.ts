import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEFAULT_RETENTION_REMINDER_POLICY,
  RETENTION_REMINDER_POLICY_STORAGE_KEY,
  deriveRetentionReminderStatus,
  disableRetentionReminders,
  pauseRetentionRemindersForDays,
  readRetentionReminderPolicy,
} from "./retention-reminders"

describe("retention reminder policy", () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-05-28T12:00:00.000Z"))
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: { storage: { local: { remove: (keys: string | string[]) => Promise<void> } } } }).__ASTRA_TEST_BROWSER__
    await browser.storage.local.remove(RETENTION_REMINDER_POLICY_STORAGE_KEY)
  })

  it("caps calm reminder readiness to Today Review, Continue Reading, and Weekly Digest metadata", () => {
    const status = deriveRetentionReminderStatus(DEFAULT_RETENTION_REMINDER_POLICY, {
      dueReviewCount: 7,
      continueReadingCount: 2,
      weeklyDigestReady: true,
      now: Date.now(),
    })

    expect(status.summary).toBe("3 calm reminders ready.")
    expect(status.items.map((item) => item.id)).toEqual(["today_review", "continue_reading", "weekly_digest"])
    expect(status.items).toHaveLength(3)
    expect(JSON.stringify(status)).not.toContain("streak")
    expect(JSON.stringify(status)).not.toContain("hurry")
  })

  it("disabled state suppresses reminder readiness", async () => {
    await disableRetentionReminders({ now: Date.now() })
    const policy = await readRetentionReminderPolicy()
    const status = deriveRetentionReminderStatus(policy, {
      dueReviewCount: 3,
      continueReadingCount: 1,
      weeklyDigestReady: true,
      now: Date.now(),
    })

    expect(status.enabled).toBe(false)
    expect(status.suppressedReason).toBe("disabled")
    expect(status.items).toEqual([])
    expect(status.summary).toBe("Reminders are off.")
  })

  it("paused state suppresses reminder readiness until the pause expires", async () => {
    const now = Date.now()
    await pauseRetentionRemindersForDays(7, { now })
    const policy = await readRetentionReminderPolicy()

    expect(deriveRetentionReminderStatus(policy, {
      dueReviewCount: 1,
      continueReadingCount: 1,
      weeklyDigestReady: true,
      now: now + 6 * 24 * 60 * 60 * 1000,
    })).toMatchObject({ paused: true, suppressedReason: "paused", items: [] })

    expect(deriveRetentionReminderStatus(policy, {
      dueReviewCount: 1,
      continueReadingCount: 1,
      weeklyDigestReady: true,
      now: now + 8 * 24 * 60 * 60 * 1000,
    }).items.map((item) => item.id)).toEqual(["today_review", "continue_reading", "weekly_digest"])
  })

  it("stores only policy metadata and no page content or private URL", async () => {
    await pauseRetentionRemindersForDays(3, { now: Date.now() })
    const browser = (globalThis as unknown as { __ASTRA_TEST_BROWSER__: { __storage: Record<string, unknown> } }).__ASTRA_TEST_BROWSER__
    const stored = JSON.stringify(browser.__storage[RETENTION_REMINDER_POLICY_STORAGE_KEY])

    expect(stored).toContain("pausedUntil")
    expect(stored).not.toContain("https://private.example/secret?token=abc")
    expect(stored).not.toContain("full transcript")
    expect(stored).not.toContain("selected sentence")
  })
})
