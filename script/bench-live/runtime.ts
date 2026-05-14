export type LiveRuntimeStatus = "idle" | "running" | "completed" | "failed" | "skipped"

export type LiveRuntimeEventKind = "state" | "log" | "artifact" | "checkpoint" | "error"

export interface LiveRuntimeEvent {
  id: number
  at: string
  kind: LiveRuntimeEventKind
  message: string
  details?: Record<string, unknown>
}

export interface LiveRuntimeSnapshot {
  scenarioId: string | null
  scenarioTitle: string | null
  status: LiveRuntimeStatus
  startedAt: string | null
  finishedAt: string | null
  events: LiveRuntimeEvent[]
  artifacts: Record<string, unknown>
}

function nowIso() {
  return new Date().toISOString()
}

function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as T
  }

  if (value === null || typeof value !== "object") {
    return value
  }

  const cloned: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>)) {
    cloned[key] = cloneValue((value as Record<string, unknown>)[key])
  }

  return cloned as T
}

function cloneEvent(event: LiveRuntimeEvent): LiveRuntimeEvent {
  return {
    ...event,
    details: event.details ? cloneValue(event.details) : undefined,
  }
}

function cloneSnapshot(snapshot: LiveRuntimeSnapshot): LiveRuntimeSnapshot {
  return {
    scenarioId: snapshot.scenarioId,
    scenarioTitle: snapshot.scenarioTitle,
    status: snapshot.status,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
    events: snapshot.events.map((event) => cloneEvent(event)),
    artifacts: cloneValue(snapshot.artifacts),
  }
}

function describeValueType(value: unknown) {
  if (Array.isArray(value)) {
    return "array"
  }

  if (value === null) {
    return "null"
  }

  return typeof value
}

export class LiveRuntime {
  private state: LiveRuntimeSnapshot = {
    scenarioId: null,
    scenarioTitle: null,
    status: "idle",
    startedAt: null,
    finishedAt: null,
    events: [],
    artifacts: {},
  }

  private eventCounter = 0

  constructor(initial?: Partial<LiveRuntimeSnapshot>) {
    if (initial) {
      this.state = {
        ...this.state,
        ...initial,
        events: initial.events ? initial.events.map((event) => cloneEvent(event)) : [],
        artifacts: initial.artifacts ? cloneValue(initial.artifacts) : {},
      }
      this.eventCounter = this.state.events.reduce((highest, event) => {
        return Math.max(highest, event.id)
      }, 0)
    }
  }

  private pushEvent(kind: LiveRuntimeEventKind, message: string, details?: Record<string, unknown>) {
    const event: LiveRuntimeEvent = {
      id: this.eventCounter + 1,
      at: nowIso(),
      kind,
      message,
    }

    this.eventCounter = event.id

    if (details && Object.keys(details).length > 0) {
      event.details = cloneValue(details)
    }

    this.state.events.push(event)
    return event
  }

  start(scenarioId: string, scenarioTitle?: string) {
    this.state.scenarioId = scenarioId
    if (typeof scenarioTitle === "string") {
      this.state.scenarioTitle = scenarioTitle
    }
    this.state.status = "running"
    this.state.startedAt = this.state.startedAt ?? nowIso()
    this.state.finishedAt = null
    this.pushEvent("state", `Scenario started: ${scenarioId}`, {
      scenarioId,
      scenarioTitle: this.state.scenarioTitle,
    })
    return this
  }

  begin(scenarioId: string, scenarioTitle?: string) {
    return this.start(scenarioId, scenarioTitle)
  }

  log(message: string, details?: Record<string, unknown>) {
    this.pushEvent("log", message, details)
    return this
  }

  checkpoint(message: string, details?: Record<string, unknown>) {
    this.pushEvent("checkpoint", message, details)
    return this
  }

  attachArtifact(key: string, value: unknown) {
    this.state.artifacts[key] = cloneValue(value)
    this.pushEvent("artifact", `Artifact attached: ${key}`, {
      key,
      valueType: describeValueType(value),
    })
    return this
  }

  complete(message = "Scenario completed") {
    this.state.status = "completed"
    this.state.startedAt = this.state.startedAt ?? nowIso()
    this.state.finishedAt = nowIso()
    this.pushEvent("state", message, {
      status: this.state.status,
    })
    return this
  }

  skip(message = "Scenario skipped") {
    this.state.status = "skipped"
    this.state.startedAt = this.state.startedAt ?? nowIso()
    this.state.finishedAt = nowIso()
    this.pushEvent("state", message, {
      status: this.state.status,
    })
    return this
  }

  fail(error: string | Error) {
    this.state.status = "failed"
    this.state.startedAt = this.state.startedAt ?? nowIso()
    this.state.finishedAt = nowIso()
    this.pushEvent("error", error instanceof Error ? error.message : error, error instanceof Error
      ? {
          name: error.name,
          stack: error.stack,
        }
      : undefined,
    )
    return this
  }

  reset() {
    this.state = {
      scenarioId: null,
      scenarioTitle: null,
      status: "idle",
      startedAt: null,
      finishedAt: null,
      events: [],
      artifacts: {},
    }
    this.eventCounter = 0
    return this
  }

  snapshot(): LiveRuntimeSnapshot {
    return cloneSnapshot(this.state)
  }
}

export function createLiveRuntime(initial?: Partial<LiveRuntimeSnapshot>) {
  return new LiveRuntime(initial)
}
