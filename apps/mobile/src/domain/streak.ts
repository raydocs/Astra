const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Soft review streak: the run of consecutive UTC days — ending today, or yesterday
 * if today's review hasn't landed yet — on which at least one review happened.
 *
 * Pass every available review timestamp (synced review_schedule `lastReviewedAt`
 * plus locally queued review events). Returns 0 when the most recent review day is
 * older than yesterday, so the UI simply shows nothing rather than any "you broke
 * your streak" pressure — see the no-shame guardrails in src/utils/retention-habits.ts.
 */
export function computeReviewStreak(reviewTimestampsMs: number[], nowMs: number): number {
  const days = new Set<number>()
  for (const timestamp of reviewTimestampsMs) {
    if (Number.isFinite(timestamp) && timestamp > 0) days.add(Math.floor(timestamp / DAY_MS))
  }
  if (days.size === 0) return 0

  const today = Math.floor(nowMs / DAY_MS)
  let anchor: number
  if (days.has(today)) anchor = today
  else if (days.has(today - 1)) anchor = today - 1
  else return 0

  let streak = 0
  for (let day = anchor; days.has(day); day -= 1) streak += 1
  return streak
}

/** Brand-approved soft-progress line. Only render for a real streak (>= 2 days). */
export function reviewStreakCopy(streakDays: number): string {
  return `You came back ${streakDays} days in a row.`
}
