import { setTimeout as delay } from "node:timers/promises"

/** Playwright removed `page.waitForTimeout`; use Node-side delay instead. */
export function sleep(ms: number): Promise<void> {
  return delay(ms)
}
