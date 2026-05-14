import {
  clampBenchOptList,
  clampBenchOptText,
  deriveBenchOptArtifactId,
  updateBenchOptSessionState,
  type BenchOptSessionPhase,
  type BenchOptSessionState,
} from "./session.ts"

export type BenchOptCheckpointKind = "snapshot" | "resume" | "handoff"

export interface BenchOptCheckpointArtifacts {
  sessionStatePath: string | null
  reportPath: string | null
  compactionPath: string | null
  handoffPath: string | null
  otherPaths: string[]
}

export interface BenchOptCheckpointArtifact {
  schemaVersion: 1
  bounded: true
  checkpointId: string
  sessionId: string
  runId: string
  createdAt: string
  phase: BenchOptSessionPhase
  iteration: number
  kind: BenchOptCheckpointKind
  reason: string
  summary: {
    objective: string
    checkpointCount: number
    compactionCount: number
    handoffCount: number
    wallClockMs: number
    notes: string[]
  }
  artifacts: BenchOptCheckpointArtifacts
}

export interface BenchOptCheckpointCreateInput {
  checkpointId?: string
  createdAt?: string
  kind?: BenchOptCheckpointKind
  reason?: string
  sessionStatePath?: string | null
  reportPath?: string | null
  compactionPath?: string | null
  handoffPath?: string | null
  otherPaths?: string[]
  notes?: string[]
}

function normalizeTimestamp(value: string | undefined, fallback: string) {
  const candidate = value?.trim()
  if (!candidate) {
    return fallback
  }

  return Number.isFinite(Date.parse(candidate)) ? candidate : fallback
}

function normalizeNullablePath(value: string | null | undefined) {
  const candidate = clampBenchOptText(value, 500)
  return candidate.length > 0 ? candidate : null
}

function normalizePaths(paths: readonly string[] | undefined, limit: number) {
  return clampBenchOptList(
    (paths ?? [])
      .map((entry) => clampBenchOptText(entry, 500))
      .filter((entry) => entry.length > 0),
    limit,
  )
}

export function createBenchOptCheckpoint(
  session: BenchOptSessionState,
  input: BenchOptCheckpointCreateInput = {},
): BenchOptCheckpointArtifact {
  const createdAt = normalizeTimestamp(input.createdAt, new Date().toISOString())
  const kind = input.kind ?? "snapshot"
  const checkpointId = input.checkpointId
    ?? deriveBenchOptArtifactId("checkpoint", session.sessionId, `${session.progress.iteration}-${kind}`)
  const reason = clampBenchOptText(
    input.reason ?? `Checkpoint created at iteration ${session.progress.iteration} for ${session.phase} session state.`,
    240,
  )
  const notes = clampBenchOptList(
    (input.notes ?? [])
      .map((entry) => clampBenchOptText(entry, 240))
      .filter((entry) => entry.length > 0),
    session.budgets.maxNoteHistory,
  )

  return {
    schemaVersion: 1,
    bounded: true,
    checkpointId,
    sessionId: session.sessionId,
    runId: session.runId,
    createdAt,
    phase: session.phase,
    iteration: session.progress.iteration,
    kind,
    reason,
    summary: {
      objective: session.objective,
      checkpointCount: session.history.checkpointIds.length + 1,
      compactionCount: session.history.compactionIds.length,
      handoffCount: session.history.handoffIds.length,
      wallClockMs: session.progress.wallClockMs,
      notes,
    },
    artifacts: {
      sessionStatePath: normalizeNullablePath(input.sessionStatePath),
      reportPath: normalizeNullablePath(input.reportPath),
      compactionPath: normalizeNullablePath(input.compactionPath),
      handoffPath: normalizeNullablePath(input.handoffPath),
      otherPaths: normalizePaths(input.otherPaths, session.budgets.maxArtifactHistory),
    },
  }
}

export function recordBenchOptCheckpoint(
  session: BenchOptSessionState,
  checkpoint: BenchOptCheckpointArtifact,
) {
  return updateBenchOptSessionState(session, {
    checkpointIds: [checkpoint.checkpointId],
    notes: checkpoint.summary.notes,
    artifactPaths: [
      checkpoint.artifacts.sessionStatePath,
      checkpoint.artifacts.reportPath,
      checkpoint.artifacts.compactionPath,
      checkpoint.artifacts.handoffPath,
      ...checkpoint.artifacts.otherPaths,
    ].filter((entry): entry is string => typeof entry === "string" && entry.length > 0),
    resume: {
      checkpointId: checkpoint.checkpointId,
    },
  })
}
