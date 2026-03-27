import { describe, expect, it } from "vitest"

import {
  createBenchOptSessionState,
  deriveBenchOptArtifactId,
  getBenchOptSessionElapsedMs,
  isBenchOptSessionOverBudget,
  resumeBenchOptSessionState,
  touchBenchOptSessionState,
  updateBenchOptSessionState,
} from "./session.ts"
import {
  createBenchOptCheckpoint,
  recordBenchOptCheckpoint,
} from "./checkpoints.ts"
import {
  createBenchOptCompactionMetadata,
  recordBenchOptCompaction,
  shouldBenchOptCompactSession,
} from "./compaction.ts"
import {
  createBenchOptSessionHandoffArtifact,
  recordBenchOptSessionHandoff,
} from "./handoff.ts"

function createSession() {
  return createBenchOptSessionState({
    sessionId: "session 01",
    runId: "run-01",
    objective: "Keep the optimizer bounded while it runs for hours.",
    createdAt: "2026-03-26T00:00:00.000Z",
    budgets: {
      maxIterations: 4,
      maxWallClockMs: 1_000,
      maxCheckpointHistory: 2,
      maxCompactionHistory: 2,
      maxHandoffHistory: 2,
      maxNoteHistory: 2,
      maxArtifactHistory: 2,
    },
    progress: {
      iteration: 3,
      completedIterations: 2,
      wallClockMs: 250,
    },
    history: {
      notes: ["note-1", "note-2", "note-3"],
      checkpointIds: ["cp-1", "cp-2", "cp-3"],
      compactionIds: ["cx-1", "cx-2", "cx-3"],
      handoffIds: ["hf-1", "hf-2", "hf-3"],
      artifactPaths: ["a-1", "a-2", "a-3"],
    },
    resume: {
      checkpointId: "resume-checkpoint",
      compactionId: "resume-compaction",
      handoffId: "resume-handoff",
    },
  })
}

describe("bench-opt phase 4 scaffolding", () => {
  it("creates bounded session state and updates it without growing history forever", () => {
    const session = createSession()

    expect(session.schemaVersion).toBe(1)
    expect(session.bounded).toBe(true)
    expect(session.sessionId).toBe("session-01")
    expect(session.objective).toBe("Keep the optimizer bounded while it runs for hours.")
    expect(session.history.notes).toEqual(["note-2", "note-3"])
    expect(session.history.checkpointIds).toEqual(["cp-2", "cp-3"])
    expect(session.history.compactionIds).toEqual(["cx-2", "cx-3"])
    expect(session.history.handoffIds).toEqual(["hf-2", "hf-3"])
    expect(session.history.artifactPaths).toEqual(["a-2", "a-3"])

    const touched = touchBenchOptSessionState(session, {
      phase: "compacting",
      iteration: 3,
      completedIterations: 3,
      wallClockMs: 900,
      resume: {
        checkpointId: "resume-checkpoint-2",
      },
      updatedAt: "2026-03-26T00:05:00.000Z",
    })

    expect(touched.phase).toBe("compacting")
    expect(touched.progress.iteration).toBe(3)
    expect(touched.progress.completedIterations).toBe(3)
    expect(touched.progress.wallClockMs).toBe(900)
    expect(touched.resume.checkpointId).toBe("resume-checkpoint-2")
    expect(isBenchOptSessionOverBudget(touched, new Date("2026-03-26T00:00:00.500Z"))).toBe(false)
    expect(shouldBenchOptCompactSession(touched, { trigger: "manual" })).toBe(true)
    expect(shouldBenchOptCompactSession(touched)).toBe(true)
    expect(getBenchOptSessionElapsedMs(touched, new Date("2026-03-26T00:00:01.000Z"))).toBe(1_000)
    expect(deriveBenchOptArtifactId("checkpoint", touched.sessionId, "resume")).toBe("checkpoint-session-01-resume")

    const updated = updateBenchOptSessionState(session, {
      phase: "running",
      iteration: 4,
      completedIterations: 4,
      wallClockMs: 1_100,
      notes: ["note-4"],
      checkpointIds: ["cp-4"],
      compactionIds: ["cx-4"],
      handoffIds: ["hf-4"],
      artifactPaths: ["a-4"],
      resume: {
        checkpointId: "resume-checkpoint-3",
        compactionId: "resume-compaction-3",
        handoffId: "resume-handoff-3",
      },
    })

    expect(updated.phase).toBe("running")
    expect(updated.progress.iteration).toBe(4)
    expect(updated.progress.completedIterations).toBe(4)
    expect(updated.progress.wallClockMs).toBe(1_100)
    expect(updated.resume).toEqual({
      checkpointId: "resume-checkpoint-3",
      compactionId: "resume-compaction-3",
      handoffId: "resume-handoff-3",
    })
    expect(updated.history.notes).toEqual(["note-3", "note-4"])
    expect(updated.history.checkpointIds).toEqual(["cp-3", "cp-4"])
    expect(updated.history.compactionIds).toEqual(["cx-3", "cx-4"])
    expect(updated.history.handoffIds).toEqual(["hf-3", "hf-4"])
    expect(updated.history.artifactPaths).toEqual(["a-3", "a-4"])
  })

  it("creates checkpoint artifacts and records them onto the session", () => {
    const session = createSession()
    const checkpoint = createBenchOptCheckpoint(session, {
      reason: "Capture the current state before compaction.",
      notes: ["first", "second", "third"],
      sessionStatePath: "/tmp/astra/session.json",
      reportPath: "/tmp/astra/report.json",
      compactionPath: "/tmp/astra/compaction.json",
      handoffPath: "/tmp/astra/handoff.json",
      otherPaths: ["/tmp/astra/extra-1.json", "/tmp/astra/extra-2.json", "/tmp/astra/extra-3.json"],
    })

    expect(checkpoint.schemaVersion).toBe(1)
    expect(checkpoint.bounded).toBe(true)
    expect(checkpoint.kind).toBe("snapshot")
    expect(checkpoint.summary.notes).toEqual(["second", "third"])
    expect(checkpoint.artifacts.otherPaths).toEqual(["/tmp/astra/extra-2.json", "/tmp/astra/extra-3.json"])

    const updated = recordBenchOptCheckpoint(session, checkpoint)
    expect(updated.history.checkpointIds.at(-1)).toBe(checkpoint.checkpointId)
    expect(updated.resume.checkpointId).toBe(checkpoint.checkpointId)
    expect(updated.history.notes).toEqual(["second", "third"])
    expect(updated.history.artifactPaths).toEqual(["/tmp/astra/extra-2.json", "/tmp/astra/extra-3.json"])
  })

  it("creates compaction metadata and carries a bounded snapshot forward", () => {
    const session = createSession()
    const compaction = createBenchOptCompactionMetadata(session, {
      strategy: "fresh-session",
      reason: "Context is growing too quickly.",
      retainedNotes: ["keep-1", "keep-2", "keep-3"],
      carryForwardArtifactPaths: ["/tmp/astra/keep-a", "/tmp/astra/keep-b", "/tmp/astra/keep-c"],
      retainedCheckpointId: "retain-checkpoint",
    })

    expect(compaction.schemaVersion).toBe(1)
    expect(compaction.bounded).toBe(true)
    expect(compaction.strategy).toBe("fresh-session")
    expect(compaction.after.resumeMode).toBe("fresh-session")
    expect(compaction.after.retainedNotes).toEqual(["keep-2", "keep-3"])
    expect(compaction.carryForward.artifactPaths).toEqual(["/tmp/astra/keep-b", "/tmp/astra/keep-c"])
    expect(shouldBenchOptCompactSession(session, { trigger: "context-growth" })).toBe(true)

    const updated = recordBenchOptCompaction(session, compaction)
    expect(updated.history.compactionIds.at(-1)).toBe(compaction.compactionId)
    expect(updated.resume.compactionId).toBe(compaction.compactionId)
    expect(updated.resume.checkpointId).toBe("retain-checkpoint")
    expect(updated.history.notes).toEqual(["keep-2", "keep-3"])
    expect(updated.history.artifactPaths).toEqual(["/tmp/astra/keep-b", "/tmp/astra/keep-c"])
  })

  it("creates handoff artifacts for resume and reset flows", () => {
    const session = createSession()
    const handoff = createBenchOptSessionHandoffArtifact(session, {
      kind: "reset",
      target: "fresh-session",
      reason: "Reset after compaction and hand off the compacted state.",
      resumeSessionId: "session-02",
      notes: ["handoff-note-1", "handoff-note-2", "handoff-note-3"],
      carryForwardCheckpointIds: ["cp-a", "cp-b", "cp-c"],
      carryForwardCompactionIds: ["cx-a", "cx-b", "cx-c"],
      carryForwardArtifactPaths: ["/tmp/astra/one", "/tmp/astra/two", "/tmp/astra/three"],
    })

    expect(handoff.schemaVersion).toBe(1)
    expect(handoff.bounded).toBe(true)
    expect(handoff.kind).toBe("reset")
    expect(handoff.target).toBe("fresh-session")
    expect(handoff.nextSession.sessionId).toBe("session-02")
    expect(handoff.carryForward.notes).toEqual(["handoff-note-2", "handoff-note-3"])
    expect(handoff.carryForward.checkpointIds).toEqual(["cp-b", "cp-c"])
    expect(handoff.carryForward.compactionIds).toEqual(["cx-b", "cx-c"])
    expect(handoff.carryForward.artifactPaths).toEqual(["/tmp/astra/two", "/tmp/astra/three"])

    const updated = recordBenchOptSessionHandoff(session, handoff)
    expect(updated.phase).toBe("handoff")
    expect(updated.history.handoffIds.at(-1)).toBe(handoff.handoffId)
    expect(updated.resume.handoffId).toBe(handoff.handoffId)
    expect(updated.resume.checkpointId).toBe(handoff.checkpointId)
    expect(updated.resume.compactionId).toBe(handoff.compactionId)
    expect(updated.history.notes).toEqual(["handoff-note-2", "handoff-note-3"])
    expect(updated.history.artifactPaths).toEqual(["/tmp/astra/two", "/tmp/astra/three"])
  })

  it("marks a session over budget when iteration or wall clock caps are exceeded", () => {
    const iterationLimited = updateBenchOptSessionState(
      createSession(),
      {
        iteration: 4,
      },
    )

    expect(isBenchOptSessionOverBudget(iterationLimited)).toBe(true)
  })

  it("resumes a prior session without resetting history and merges the incoming resume patch", () => {
    const session = createSession()

    const resumed = resumeBenchOptSessionState(session, {
      runId: "run-02",
      objective: "Resume the same bounded optimizer objective.",
      phase: "running",
      iteration: 4,
      completedIterations: 3,
      wallClockMs: 800,
      notes: ["resume-note"],
      artifactPaths: ["/tmp/astra/resume.json"],
      resume: {
        checkpointId: "resume-checkpoint-4",
        handoffId: "resume-handoff-4",
      },
    })

    expect(resumed.sessionId).toBe(session.sessionId)
    expect(resumed.runId).toBe("run-02")
    expect(resumed.createdAt).toBe(session.createdAt)
    expect(resumed.objective).toBe("Resume the same bounded optimizer objective.")
    expect(resumed.phase).toBe("running")
    expect(resumed.progress.iteration).toBe(4)
    expect(resumed.progress.completedIterations).toBe(3)
    expect(resumed.progress.wallClockMs).toBe(800)
    expect(resumed.history.notes).toEqual(["note-3", "resume-note"])
    expect(resumed.history.checkpointIds).toEqual(session.history.checkpointIds)
    expect(resumed.history.compactionIds).toEqual(session.history.compactionIds)
    expect(resumed.history.handoffIds).toEqual(session.history.handoffIds)
    expect(resumed.history.artifactPaths).toEqual(["a-3", "/tmp/astra/resume.json"])
    expect(resumed.resume).toEqual({
      checkpointId: "resume-checkpoint-4",
      compactionId: session.resume.compactionId,
      handoffId: "resume-handoff-4",
    })
  })
})
