import {
  clampBenchOptList,
  clampBenchOptText,
  deriveBenchOptArtifactId,
  deriveBenchOptNextSessionId,
  getBenchOptSessionElapsedMs,
  isBenchOptSessionOverBudget,
  updateBenchOptSessionState,
  type BenchOptSessionPhase,
  type BenchOptSessionState,
} from "./session.ts"

export type BenchOptCompactionTrigger =
  | "context-growth"
  | "iteration-budget"
  | "wall-clock-budget"
  | "manual"

export type BenchOptCompactionStrategy = "compact-context" | "fresh-session"

export type BenchOptCompactionResumeMode = "same-session" | "fresh-session"

export interface BenchOptCompactionMetadata {
  schemaVersion: 1
  bounded: true
  compactionId: string
  sessionId: string
  runId: string
  createdAt: string
  trigger: BenchOptCompactionTrigger
  strategy: BenchOptCompactionStrategy
  reason: string
  before: {
    phase: BenchOptSessionPhase
    iteration: number
    checkpointId: string | null
    checkpointCount: number
    compactionCount: number
    handoffCount: number
    elapsedMs: number
  }
  after: {
    resumeMode: BenchOptCompactionResumeMode
    resumeSessionId: string | null
    retainedCheckpointId: string | null
    retainedNotes: string[]
  }
  carryForward: {
    checkpointIds: string[]
    compactionIds: string[]
    handoffIds: string[]
    artifactPaths: string[]
  }
}

export interface BenchOptCompactionInput {
  compactionId?: string
  createdAt?: string
  trigger?: BenchOptCompactionTrigger
  strategy?: BenchOptCompactionStrategy
  reason?: string
  retainedCheckpointId?: string | null
  retainedNotes?: string[]
  resumeSessionId?: string | null
  carryForwardCheckpointIds?: string[]
  carryForwardCompactionIds?: string[]
  carryForwardHandoffIds?: string[]
  carryForwardArtifactPaths?: string[]
}

function normalizeTimestamp(value: string | undefined, fallback: string) {
  const candidate = value?.trim()
  if (!candidate) {
    return fallback
  }

  return Number.isFinite(Date.parse(candidate)) ? candidate : fallback
}

function normalizeNullable(value: string | null | undefined) {
  const candidate = clampBenchOptText(value, 240)
  return candidate.length > 0 ? candidate : null
}

function asSafeDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : new Date()
}

export function shouldBenchOptCompactSession(
  session: BenchOptSessionState,
  options: {
    now?: Date
    trigger?: BenchOptCompactionTrigger
  } = {},
) {
  if (options.trigger === "manual") {
    return true
  }

  if (options.trigger === "iteration-budget") {
    return session.progress.iteration >= session.budgets.maxIterations
  }

  if (options.trigger === "wall-clock-budget") {
    const now = options.now ?? new Date()
    return getBenchOptSessionElapsedMs(session, now) >= session.budgets.maxWallClockMs
  }

  if (options.trigger === "context-growth") {
    return session.history.artifactPaths.length >= session.budgets.maxArtifactHistory
  }

  const now = options.now ?? new Date()
  return isBenchOptSessionOverBudget(session, now)
    || session.history.artifactPaths.length >= session.budgets.maxArtifactHistory
}

export function createBenchOptCompactionMetadata(
  session: BenchOptSessionState,
  input: BenchOptCompactionInput = {},
): BenchOptCompactionMetadata {
  const createdAt = normalizeTimestamp(input.createdAt, new Date().toISOString())
  const createdAtDate = asSafeDate(createdAt)
  const strategy = input.strategy ?? "compact-context"
  const trigger = input.trigger
    ?? (session.progress.iteration >= session.budgets.maxIterations
      ? "iteration-budget"
      : getBenchOptSessionElapsedMs(session, createdAtDate) >= session.budgets.maxWallClockMs
        ? "wall-clock-budget"
        : "context-growth")
  const compactionId = input.compactionId
    ?? deriveBenchOptArtifactId("compaction", session.sessionId, `${session.progress.iteration}-${strategy}`)
  const reason = clampBenchOptText(
    input.reason ?? `Compaction triggered by ${trigger} while the session is in ${session.phase} phase.`,
    240,
  )
  const retainedNotes = clampBenchOptList(
    (input.retainedNotes ?? [])
      .map((entry) => clampBenchOptText(entry, 240))
      .filter((entry) => entry.length > 0),
    session.budgets.maxNoteHistory,
  )
  const checkpointIds = clampBenchOptList(
    input.carryForwardCheckpointIds ?? session.history.checkpointIds,
    session.budgets.maxCheckpointHistory,
  )
  const compactionIds = clampBenchOptList(
    input.carryForwardCompactionIds ?? session.history.compactionIds,
    session.budgets.maxCompactionHistory,
  )
  const handoffIds = clampBenchOptList(
    input.carryForwardHandoffIds ?? session.history.handoffIds,
    session.budgets.maxHandoffHistory,
  )
  const artifactPaths = clampBenchOptList(
    input.carryForwardArtifactPaths ?? session.history.artifactPaths,
    session.budgets.maxArtifactHistory,
  )
  const resumeMode: BenchOptCompactionResumeMode = strategy === "fresh-session" ? "fresh-session" : "same-session"
  const resumeSessionId = normalizeNullable(input.resumeSessionId)
    ?? deriveBenchOptNextSessionId(session.sessionId, session.progress.iteration, resumeMode)

  return {
    schemaVersion: 1,
    bounded: true,
    compactionId,
    sessionId: session.sessionId,
    runId: session.runId,
    createdAt,
    trigger,
    strategy,
    reason,
    before: {
      phase: session.phase,
      iteration: session.progress.iteration,
      checkpointId: session.resume.checkpointId,
      checkpointCount: session.history.checkpointIds.length,
      compactionCount: session.history.compactionIds.length,
      handoffCount: session.history.handoffIds.length,
      elapsedMs: getBenchOptSessionElapsedMs(session, createdAtDate),
    },
    after: {
      resumeMode,
      resumeSessionId,
      retainedCheckpointId: normalizeNullable(input.retainedCheckpointId ?? session.resume.checkpointId),
      retainedNotes,
    },
    carryForward: {
      checkpointIds,
      compactionIds,
      handoffIds,
      artifactPaths,
    },
  }
}

export function recordBenchOptCompaction(
  session: BenchOptSessionState,
  compaction: BenchOptCompactionMetadata,
) {
  return updateBenchOptSessionState(session, {
    compactionIds: [compaction.compactionId],
    notes: compaction.after.retainedNotes,
    artifactPaths: compaction.carryForward.artifactPaths,
    resume: {
      checkpointId: compaction.after.retainedCheckpointId,
      compactionId: compaction.compactionId,
    },
  })
}
