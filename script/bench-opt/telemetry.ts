import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-surface score data point recorded at a specific iteration. */
export interface BenchOptTelemetrySurfacePoint {
  surface: string
  averageTotal: number
}

/** A single telemetry event recorded during an optimization session. */
export interface BenchOptTelemetryEvent {
  /** ISO timestamp of when the event occurred. */
  timestamp: string
  /** Category of the event. */
  kind:
    | "iteration-start"
    | "iteration-end"
    | "evaluation-start"
    | "evaluation-end"
    | "candidate-scored"
    | "candidate-kept"
    | "candidate-rejected"
    | "api-call"
    | "session-start"
    | "session-end"
    | "custom"
  /** Free-form metadata associated with the event. */
  metadata: Record<string, unknown>
}

/** Token-usage accumulator. */
export interface BenchOptTelemetryTokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** Cost tracking accumulator. */
export interface BenchOptTelemetryCost {
  apiCalls: number
  tokenUsage: BenchOptTelemetryTokenUsage
  estimatedCostUsd: number
}

/** Performance timing accumulator (milliseconds). */
export interface BenchOptTelemetryPerformance {
  totalDurationMs: number
  iterationDurationsMs: number[]
  evaluationDurationsMs: number[]
}

/** Score trend entry for one iteration. */
export interface BenchOptTelemetryScoreTrend {
  iteration: number
  split: string
  averageTotal: number | null
  surfaces: BenchOptTelemetrySurfacePoint[]
  recordedAt: string
}

/** Full JSON-serializable telemetry snapshot. */
export interface BenchOptTelemetrySnapshot {
  schemaVersion: 1
  sessionId: string
  startedAt: string
  snapshotAt: string
  durationMs: number
  iterations: number
  candidatesEvaluated: number
  candidatesKept: number
  candidatesRejected: number
  cost: BenchOptTelemetryCost
  performance: BenchOptTelemetryPerformance
  scoreTrends: BenchOptTelemetryScoreTrend[]
  events: BenchOptTelemetryEvent[]
}

/** Options for creating a telemetry collector. */
export interface BenchOptTelemetryCollectorOptions {
  /** Session identifier attached to all telemetry. */
  sessionId: string
  /** Root directory for persisting telemetry files. Defaults to "data/bench-opt-results". */
  outputDir?: string
  /** Maximum number of events to keep in memory before auto-flushing. Default 500. */
  maxEventsInMemory?: number
  /** Estimated cost per 1k prompt tokens (USD). Default 0.003. */
  promptTokenCostPer1k?: number
  /** Estimated cost per 1k completion tokens (USD). Default 0.015. */
  completionTokenCostPer1k?: number
}

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/** Telemetry collector with record, snapshot, and flush capabilities. */
export interface BenchOptTelemetryCollector {
  /** Record a telemetry event. */
  record(kind: BenchOptTelemetryEvent["kind"], metadata?: Record<string, unknown>): void
  /** Record token usage from an API call. */
  recordTokenUsage(promptTokens: number, completionTokens: number): void
  /** Record the start of an iteration (starts a timing span). */
  recordIterationStart(iteration: number): void
  /** Record the end of an iteration (closes the timing span). */
  recordIterationEnd(iteration: number): void
  /** Record the start of an evaluation (starts a timing span). */
  recordEvaluationStart(candidateId: string): void
  /** Record the end of an evaluation (closes the timing span). */
  recordEvaluationEnd(candidateId: string): void
  /** Record a score trend data point. */
  recordScoreTrend(trend: BenchOptTelemetryScoreTrend): void
  /** Record a candidate decision (kept or rejected). */
  recordCandidateDecision(candidateId: string, decision: "kept" | "rejected"): void
  /** Produce a JSON-serializable snapshot of all telemetry collected so far. */
  snapshot(): BenchOptTelemetrySnapshot
  /** Persist the current snapshot to disk under the configured output directory. */
  flush(): Promise<string>
}

/**
 * Create a new telemetry collector for an optimization session.
 *
 * The collector accumulates events, timings, token usage, and score trends
 * in memory. Call {@link BenchOptTelemetryCollector.flush flush()} to persist
 * a snapshot to disk.
 *
 * @param options - Collector configuration.
 */
export function createTelemetryCollector(
  options: BenchOptTelemetryCollectorOptions,
): BenchOptTelemetryCollector {
  const sessionId = options.sessionId
  const outputDir = options.outputDir ?? process.env.ASTRA_BENCH_OPT_ARTIFACT_ROOT ?? "data/bench-opt-results"
  const maxEvents = options.maxEventsInMemory ?? 500
  const promptCost1k = options.promptTokenCostPer1k ?? 0.003
  const completionCost1k = options.completionTokenCostPer1k ?? 0.015

  const startedAt = new Date().toISOString()

  let iterations = 0
  let candidatesEvaluated = 0
  let candidatesKept = 0
  let candidatesRejected = 0

  const cost: BenchOptTelemetryCost = {
    apiCalls: 0,
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    estimatedCostUsd: 0,
  }

  const performance: BenchOptTelemetryPerformance = {
    totalDurationMs: 0,
    iterationDurationsMs: [],
    evaluationDurationsMs: [],
  }

  const scoreTrends: BenchOptTelemetryScoreTrend[] = []
  const events: BenchOptTelemetryEvent[] = []

  // Timing spans keyed by a label
  const openSpans = new Map<string, number>()

  function pushEvent(kind: BenchOptTelemetryEvent["kind"], metadata: Record<string, unknown> = {}) {
    events.push({ timestamp: new Date().toISOString(), kind, metadata })

    // Evict oldest events if over limit
    if (events.length > maxEvents) {
      events.splice(0, events.length - maxEvents)
    }
  }

  function elapsedMs(): number {
    return Date.now() - Date.parse(startedAt)
  }

  const collector: BenchOptTelemetryCollector = {
    record(kind, metadata = {}) {
      pushEvent(kind, metadata)
    },

    recordTokenUsage(promptTokens, completionTokens) {
      cost.apiCalls += 1
      cost.tokenUsage.promptTokens += promptTokens
      cost.tokenUsage.completionTokens += completionTokens
      cost.tokenUsage.totalTokens += promptTokens + completionTokens
      cost.estimatedCostUsd =
        (cost.tokenUsage.promptTokens / 1000) * promptCost1k +
        (cost.tokenUsage.completionTokens / 1000) * completionCost1k

      pushEvent("api-call", { promptTokens, completionTokens })
    },

    recordIterationStart(iteration) {
      openSpans.set(`iteration:${iteration}`, Date.now())
      pushEvent("iteration-start", { iteration })
    },

    recordIterationEnd(iteration) {
      const startMs = openSpans.get(`iteration:${iteration}`)
      openSpans.delete(`iteration:${iteration}`)

      const durationMs = startMs !== undefined ? Date.now() - startMs : 0
      performance.iterationDurationsMs.push(durationMs)
      iterations = Math.max(iterations, iteration + 1)

      pushEvent("iteration-end", { iteration, durationMs })
    },

    recordEvaluationStart(candidateId) {
      openSpans.set(`eval:${candidateId}`, Date.now())
      candidatesEvaluated += 1
      pushEvent("evaluation-start", { candidateId })
    },

    recordEvaluationEnd(candidateId) {
      const startMs = openSpans.get(`eval:${candidateId}`)
      openSpans.delete(`eval:${candidateId}`)

      const durationMs = startMs !== undefined ? Date.now() - startMs : 0
      performance.evaluationDurationsMs.push(durationMs)

      pushEvent("evaluation-end", { candidateId, durationMs })
    },

    recordScoreTrend(trend) {
      scoreTrends.push(trend)
    },

    recordCandidateDecision(candidateId, decision) {
      if (decision === "kept") {
        candidatesKept += 1
        pushEvent("candidate-kept", { candidateId })
      } else {
        candidatesRejected += 1
        pushEvent("candidate-rejected", { candidateId })
      }
    },

    snapshot() {
      const totalDurationMs = elapsedMs()
      performance.totalDurationMs = totalDurationMs

      return {
        schemaVersion: 1,
        sessionId,
        startedAt,
        snapshotAt: new Date().toISOString(),
        durationMs: totalDurationMs,
        iterations,
        candidatesEvaluated,
        candidatesKept,
        candidatesRejected,
        cost: { ...cost, tokenUsage: { ...cost.tokenUsage } },
        performance: {
          totalDurationMs,
          iterationDurationsMs: [...performance.iterationDurationsMs],
          evaluationDurationsMs: [...performance.evaluationDurationsMs],
        },
        scoreTrends: [...scoreTrends],
        events: [...events],
      }
    },

    async flush() {
      const snap = collector.snapshot()
      const dir = path.join(outputDir, "telemetry")
      await mkdir(dir, { recursive: true })

      const filename = `telemetry-${sessionId}-${Date.now()}.json`
      const filePath = path.join(dir, filename)
      await writeFile(filePath, JSON.stringify(snap, null, 2))
      return filePath
    },
  }

  // Record session start
  pushEvent("session-start", { sessionId })

  return collector
}

/**
 * Load a previously flushed telemetry snapshot from disk.
 *
 * @param filePath - Path to the telemetry JSON file.
 */
export async function loadTelemetrySnapshot(filePath: string): Promise<BenchOptTelemetrySnapshot | null> {
  try {
    const raw = await readFile(filePath, "utf8")
    return JSON.parse(raw) as BenchOptTelemetrySnapshot
  } catch {
    return null
  }
}
