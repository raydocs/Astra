import {
  clampBenchOptList,
  clampBenchOptText,
  deriveBenchOptArtifactId,
  deriveBenchOptNextSessionId,
  updateBenchOptSessionState,
  type BenchOptSessionPhase,
  type BenchOptSessionState,
} from "./session.ts"

export type BenchOptSessionHandoffKind = "resume" | "reset"

export type BenchOptSessionHandoffTarget = "same-session" | "fresh-session"

export interface BenchOptSessionHandoffArtifact {
  schemaVersion: 1
  bounded: true
  handoffId: string
  sessionId: string
  runId: string
  createdAt: string
  kind: BenchOptSessionHandoffKind
  target: BenchOptSessionHandoffTarget
  phase: BenchOptSessionPhase
  iteration: number
  checkpointId: string | null
  compactionId: string | null
  reason: string
  nextSession: {
    sessionId: string | null
    objective: string
    resumeMode: BenchOptSessionHandoffTarget
    checkpointId: string | null
    compactionId: string | null
  }
  carryForward: {
    checkpointIds: string[]
    compactionIds: string[]
    artifactPaths: string[]
    notes: string[]
  }
}

export interface BenchOptSessionHandoffInput {
  handoffId?: string
  createdAt?: string
  kind?: BenchOptSessionHandoffKind
  target?: BenchOptSessionHandoffTarget
  checkpointId?: string | null
  compactionId?: string | null
  resumeSessionId?: string | null
  reason?: string
  notes?: string[]
  carryForwardCheckpointIds?: string[]
  carryForwardCompactionIds?: string[]
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

export function createBenchOptSessionHandoffArtifact(
  session: BenchOptSessionState,
  input: BenchOptSessionHandoffInput = {},
): BenchOptSessionHandoffArtifact {
  const createdAt = normalizeTimestamp(input.createdAt, new Date().toISOString())
  const target = input.target
    ?? (input.kind === "reset" || session.phase === "compacting" ? "fresh-session" : "same-session")
  const kind = input.kind ?? (target === "fresh-session" ? "reset" : "resume")
  const handoffId = input.handoffId
    ?? deriveBenchOptArtifactId("handoff", session.sessionId, `${session.progress.iteration}-${kind}`)
  const nextSessionId = normalizeNullable(input.resumeSessionId)
    ?? deriveBenchOptNextSessionId(session.sessionId, session.progress.iteration, target)
  const reason = clampBenchOptText(
    input.reason ?? `Handoff generated for ${session.phase} session state at iteration ${session.progress.iteration}.`,
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
    handoffId,
    sessionId: session.sessionId,
    runId: session.runId,
    createdAt,
    kind,
    target,
    phase: session.phase,
    iteration: session.progress.iteration,
    checkpointId: normalizeNullable(input.checkpointId ?? session.resume.checkpointId),
    compactionId: normalizeNullable(input.compactionId ?? session.resume.compactionId),
    reason,
    nextSession: {
      sessionId: nextSessionId,
      objective: session.objective,
      resumeMode: target,
      checkpointId: normalizeNullable(input.checkpointId ?? session.resume.checkpointId),
      compactionId: normalizeNullable(input.compactionId ?? session.resume.compactionId),
    },
    carryForward: {
      checkpointIds: clampBenchOptList(
        input.carryForwardCheckpointIds ?? session.history.checkpointIds,
        session.budgets.maxCheckpointHistory,
      ),
      compactionIds: clampBenchOptList(
        input.carryForwardCompactionIds ?? session.history.compactionIds,
        session.budgets.maxCompactionHistory,
      ),
      artifactPaths: clampBenchOptList(
        input.carryForwardArtifactPaths ?? session.history.artifactPaths,
        session.budgets.maxArtifactHistory,
      ),
      notes,
    },
  }
}

export function recordBenchOptSessionHandoff(
  session: BenchOptSessionState,
  handoff: BenchOptSessionHandoffArtifact,
) {
  return updateBenchOptSessionState(session, {
    phase: "handoff",
    handoffIds: [handoff.handoffId],
    notes: handoff.carryForward.notes,
    artifactPaths: handoff.carryForward.artifactPaths,
    resume: {
      checkpointId: handoff.checkpointId,
      compactionId: handoff.compactionId,
      handoffId: handoff.handoffId,
    },
  })
}
