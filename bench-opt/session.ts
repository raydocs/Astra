export type BenchOptSessionPhase =
  | "running"
  | "compacting"
  | "handoff"
  | "paused"
  | "completed"

export interface BenchOptSessionBudgets {
  maxIterations: number
  maxWallClockMs: number
  maxCheckpointHistory: number
  maxCompactionHistory: number
  maxHandoffHistory: number
  maxNoteHistory: number
  maxArtifactHistory: number
}

export interface BenchOptSessionProgress {
  iteration: number
  completedIterations: number
  wallClockMs: number
}

export interface BenchOptSessionHistory {
  notes: string[]
  checkpointIds: string[]
  compactionIds: string[]
  handoffIds: string[]
  artifactPaths: string[]
}

export interface BenchOptSessionResumeState {
  checkpointId: string | null
  compactionId: string | null
  handoffId: string | null
}

export interface BenchOptSessionResumePatch {
  checkpointId?: string | null
  compactionId?: string | null
  handoffId?: string | null
}

export interface BenchOptSessionState {
  schemaVersion: 1
  bounded: true
  sessionId: string
  runId: string
  objective: string
  createdAt: string
  updatedAt: string
  phase: BenchOptSessionPhase
  budgets: BenchOptSessionBudgets
  progress: BenchOptSessionProgress
  history: BenchOptSessionHistory
  resume: BenchOptSessionResumeState
}

export interface BenchOptSessionCreateInput {
  sessionId: string
  runId: string
  objective: string
  createdAt?: string
  updatedAt?: string
  phase?: BenchOptSessionPhase
  budgets?: Partial<BenchOptSessionBudgets>
  progress?: Partial<BenchOptSessionProgress>
  history?: Partial<BenchOptSessionHistory>
  resume?: Partial<BenchOptSessionResumeState>
}

export interface BenchOptSessionTouchInput {
  phase?: BenchOptSessionPhase
  updatedAt?: string
  iteration?: number
  completedIterations?: number
  wallClockMs?: number
  resume?: BenchOptSessionResumePatch
}

export interface BenchOptSessionUpdateInput extends BenchOptSessionTouchInput {
  notes?: readonly (string | null | undefined)[]
  checkpointIds?: readonly (string | null | undefined)[]
  compactionIds?: readonly (string | null | undefined)[]
  handoffIds?: readonly (string | null | undefined)[]
  artifactPaths?: readonly (string | null | undefined)[]
}

export const BENCH_OPT_SESSION_DEFAULT_BUDGETS: BenchOptSessionBudgets = {
  maxIterations: 12,
  maxWallClockMs: 6 * 60 * 60 * 1000,
  maxCheckpointHistory: 8,
  maxCompactionHistory: 4,
  maxHandoffHistory: 4,
  maxNoteHistory: 12,
  maxArtifactHistory: 8,
}

const STRING_LIMITS = {
  id: 160,
  note: 240,
  path: 500,
  objective: 400,
} as const

function normalizeTimestamp(value: string | undefined, fallback: string) {
  const candidate = value?.trim()
  if (!candidate) {
    return fallback
  }

  return Number.isFinite(Date.parse(candidate)) ? candidate : fallback
}

function sanitizeBenchOptSegment(value: string | null | undefined, fallback: string) {
  const normalized = clampBenchOptText(value, STRING_LIMITS.id)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized.length > 0 ? normalized : fallback
}

function sanitizeBenchOptStrings(
  values: readonly (string | null | undefined)[] | undefined,
  limit: number,
) {
  return (values ?? [])
    .map((value) => clampBenchOptText(value, limit))
    .filter((value) => value.length > 0)
}

function normalizeNumber(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
}

function normalizeResume(resume: Partial<BenchOptSessionResumeState> | undefined): BenchOptSessionResumeState {
  return {
    checkpointId: resume?.checkpointId ?? null,
    compactionId: resume?.compactionId ?? null,
    handoffId: resume?.handoffId ?? null,
  }
}

function mergeResume(
  current: BenchOptSessionResumeState,
  patch: BenchOptSessionResumePatch | undefined,
): BenchOptSessionResumeState {
  if (!patch) {
    return current
  }

  return {
    checkpointId: patch.checkpointId === undefined ? current.checkpointId : patch.checkpointId,
    compactionId: patch.compactionId === undefined ? current.compactionId : patch.compactionId,
    handoffId: patch.handoffId === undefined ? current.handoffId : patch.handoffId,
  }
}

function normalizeHistory(history: Partial<BenchOptSessionHistory> | undefined, budgets: BenchOptSessionBudgets) {
  return {
    notes: clampBenchOptList(
      sanitizeBenchOptStrings(history?.notes, STRING_LIMITS.note),
      budgets.maxNoteHistory,
    ),
    checkpointIds: clampBenchOptList(
      sanitizeBenchOptStrings(history?.checkpointIds, STRING_LIMITS.id),
      budgets.maxCheckpointHistory,
    ),
    compactionIds: clampBenchOptList(
      sanitizeBenchOptStrings(history?.compactionIds, STRING_LIMITS.id),
      budgets.maxCompactionHistory,
    ),
    handoffIds: clampBenchOptList(
      sanitizeBenchOptStrings(history?.handoffIds, STRING_LIMITS.id),
      budgets.maxHandoffHistory,
    ),
    artifactPaths: clampBenchOptList(
      sanitizeBenchOptStrings(history?.artifactPaths, STRING_LIMITS.path),
      budgets.maxArtifactHistory,
    ),
  }
}

function appendBenchOptHistoryEntry(
  current: readonly string[],
  additions: readonly (string | null | undefined)[] | undefined,
  limit: number,
  textLimit: number,
) {
  if (!additions) {
    return [...current]
  }

  const sanitized = sanitizeBenchOptStrings(additions, textLimit)
  if (sanitized.length === 0) {
    return [...current]
  }

  return clampBenchOptList([...current, ...sanitized], limit)
}

function updateBenchOptSessionHistory(
  session: BenchOptSessionState,
  input: BenchOptSessionUpdateInput,
) {
  return {
    notes: appendBenchOptHistoryEntry(
      session.history.notes,
      input.notes,
      session.budgets.maxNoteHistory,
      STRING_LIMITS.note,
    ),
    checkpointIds: appendBenchOptHistoryEntry(
      session.history.checkpointIds,
      input.checkpointIds,
      session.budgets.maxCheckpointHistory,
      STRING_LIMITS.id,
    ),
    compactionIds: appendBenchOptHistoryEntry(
      session.history.compactionIds,
      input.compactionIds,
      session.budgets.maxCompactionHistory,
      STRING_LIMITS.id,
    ),
    handoffIds: appendBenchOptHistoryEntry(
      session.history.handoffIds,
      input.handoffIds,
      session.budgets.maxHandoffHistory,
      STRING_LIMITS.id,
    ),
    artifactPaths: appendBenchOptHistoryEntry(
      session.history.artifactPaths,
      input.artifactPaths,
      session.budgets.maxArtifactHistory,
      STRING_LIMITS.path,
    ),
  }
}

export function clampBenchOptText(value: string | null | undefined, limit: number = STRING_LIMITS.note) {
  const text = (value ?? "").trim()
  return text.length > limit ? text.slice(0, limit) : text
}

export function clampBenchOptList<T>(items: readonly T[] | undefined, limit: number): T[] {
  const safeLimit = Math.max(0, limit)
  if (safeLimit === 0) {
    return []
  }

  const values = [...(items ?? [])]
  return values.length > safeLimit ? values.slice(values.length - safeLimit) : values
}

export function deriveBenchOptArtifactId(prefix: string, sessionId: string, suffix: string) {
  const normalizedPrefix = sanitizeBenchOptSegment(prefix, "item")
  const normalizedSessionId = sanitizeBenchOptSegment(sessionId, "session")
  const normalizedSuffix = sanitizeBenchOptSegment(suffix, "item")

  return [normalizedPrefix, normalizedSessionId, normalizedSuffix].join("-")
}

export function deriveBenchOptNextSessionId(
  sessionId: string,
  iteration: number,
  mode: "same-session" | "fresh-session",
) {
  if (mode === "same-session") {
    return sanitizeBenchOptSegment(sessionId, "session")
  }

  return deriveBenchOptArtifactId("session", sessionId, `${Math.max(1, iteration + 1)}`)
}

export function createBenchOptSessionState(input: BenchOptSessionCreateInput): BenchOptSessionState {
  const createdAt = normalizeTimestamp(input.createdAt, new Date().toISOString())
  const updatedAt = normalizeTimestamp(input.updatedAt, createdAt)
  const budgets = {
    ...BENCH_OPT_SESSION_DEFAULT_BUDGETS,
    ...(input.budgets ?? {}),
  }

  return {
    schemaVersion: 1,
    bounded: true,
    sessionId: sanitizeBenchOptSegment(input.sessionId, "session"),
    runId: sanitizeBenchOptSegment(input.runId, "run"),
    objective: clampBenchOptText(input.objective, STRING_LIMITS.objective),
    createdAt,
    updatedAt,
    phase: input.phase ?? "running",
    budgets,
    progress: {
      iteration: normalizeNumber(input.progress?.iteration, 0),
      completedIterations: normalizeNumber(input.progress?.completedIterations, 0),
      wallClockMs: normalizeNumber(input.progress?.wallClockMs, 0),
    },
    history: normalizeHistory(input.history, budgets),
    resume: normalizeResume(input.resume),
  }
}

export function resumeBenchOptSessionState(
  session: BenchOptSessionState,
  input: {
    runId: string
    objective?: string
    phase?: BenchOptSessionPhase
    updatedAt?: string
    iteration?: number
    completedIterations?: number
    wallClockMs?: number
    notes?: readonly (string | null | undefined)[]
    artifactPaths?: readonly (string | null | undefined)[]
    resume?: BenchOptSessionResumePatch
  },
): BenchOptSessionState {
  const resumed = createBenchOptSessionState({
    sessionId: session.sessionId,
    runId: input.runId,
    objective: input.objective ?? session.objective,
    createdAt: session.createdAt,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    phase: input.phase ?? "running",
    budgets: session.budgets,
    progress: {
      iteration: input.iteration ?? session.progress.iteration,
      completedIterations: input.completedIterations ?? session.progress.completedIterations,
      wallClockMs: input.wallClockMs ?? session.progress.wallClockMs,
    },
    history: session.history,
    resume: {
      ...session.resume,
      ...(input.resume ?? {}),
    },
  })

  return updateBenchOptSessionState(resumed, {
    notes: input.notes,
    artifactPaths: input.artifactPaths,
    resume: input.resume,
  })
}

export function updateBenchOptSessionState(
  session: BenchOptSessionState,
  input: BenchOptSessionUpdateInput = {},
): BenchOptSessionState {
  return {
    ...session,
    phase: input.phase ?? session.phase,
    updatedAt: normalizeTimestamp(input.updatedAt, new Date().toISOString()),
    progress: {
      iteration: normalizeNumber(input.iteration, session.progress.iteration),
      completedIterations: normalizeNumber(input.completedIterations, session.progress.completedIterations),
      wallClockMs: normalizeNumber(input.wallClockMs, session.progress.wallClockMs),
    },
    history: updateBenchOptSessionHistory(session, input),
    resume: mergeResume(session.resume, input.resume),
  }
}

export function touchBenchOptSessionState(
  session: BenchOptSessionState,
  input: BenchOptSessionTouchInput = {},
): BenchOptSessionState {
  return updateBenchOptSessionState(session, input)
}

export function appendBenchOptSessionNote(session: BenchOptSessionState, note: string) {
  return updateBenchOptSessionState(session, { notes: [note] })
}

export function appendBenchOptSessionArtifactPath(session: BenchOptSessionState, artifactPath: string) {
  return updateBenchOptSessionState(session, { artifactPaths: [artifactPath] })
}

export function appendBenchOptSessionCheckpointId(session: BenchOptSessionState, checkpointId: string) {
  return updateBenchOptSessionState(session, { checkpointIds: [checkpointId] })
}

export function appendBenchOptSessionCompactionId(session: BenchOptSessionState, compactionId: string) {
  return updateBenchOptSessionState(session, { compactionIds: [compactionId] })
}

export function appendBenchOptSessionHandoffId(session: BenchOptSessionState, handoffId: string) {
  return updateBenchOptSessionState(session, { handoffIds: [handoffId] })
}

export function getBenchOptSessionElapsedMs(session: BenchOptSessionState, now = new Date()) {
  const startedAt = Date.parse(session.createdAt)
  const currentTime = now.getTime()

  if (!Number.isFinite(startedAt) || !Number.isFinite(currentTime)) {
    return 0
  }

  return Math.max(0, currentTime - startedAt)
}

export function isBenchOptSessionOverBudget(session: BenchOptSessionState, now = new Date()) {
  return session.progress.iteration >= session.budgets.maxIterations
    || getBenchOptSessionElapsedMs(session, now) >= session.budgets.maxWallClockMs
}
