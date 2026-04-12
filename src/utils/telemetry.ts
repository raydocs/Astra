import { browser } from "#imports"

export type TelemetryEventType =
  | "translation_error"
  | "provider_fallback"
  | "extension_error"
  | "feature_usage"

export interface TelemetryEvent {
  id: string
  type: TelemetryEventType
  timestamp: number
  data: Record<string, unknown>
}

const STORAGE_KEY = "astra.telemetry.v1"
const MAX_EVENTS = 200

function createEventId(timestamp: number): string {
  return `${timestamp}-${Math.random().toString(36).slice(2, 8)}`
}

function parseStored(raw: unknown): TelemetryEvent[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is TelemetryEvent =>
      e != null &&
      typeof e === "object" &&
      typeof (e as TelemetryEvent).id === "string" &&
      typeof (e as TelemetryEvent).type === "string" &&
      typeof (e as TelemetryEvent).timestamp === "number" &&
      typeof (e as TelemetryEvent).data === "object",
  )
}

async function readEvents(): Promise<TelemetryEvent[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY)
  return parseStored(stored[STORAGE_KEY])
}

async function writeEvents(events: TelemetryEvent[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: events })
}

/**
 * Record a telemetry event locally. Fire-and-forget — errors are silently
 * swallowed so callers never need to handle failures.
 *
 * Events are stored in `browser.storage.local` and are never sent anywhere
 * automatically. They exist only for user-visible diagnostics.
 */
export function trackEvent(event: Omit<TelemetryEvent, "id" | "timestamp"> & { id?: string; timestamp?: number }): void {
  const now = Date.now()
  const full: TelemetryEvent = {
    id: event.id ?? createEventId(now),
    timestamp: event.timestamp ?? now,
    type: event.type,
    data: event.data,
  }

  void (async () => {
    try {
      const existing = await readEvents()
      const updated = [full, ...existing]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_EVENTS)
      await writeEvents(updated)
    } catch {
      // Fire-and-forget — never surface telemetry storage errors
    }
  })()
}

/**
 * Retrieve the most recent telemetry events, newest first.
 */
export async function getRecentEvents(limit = 50): Promise<TelemetryEvent[]> {
  const events = await readEvents()
  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit)
}

/**
 * Remove all stored telemetry events.
 */
export async function clearTelemetry(): Promise<void> {
  await writeEvents([])
}
