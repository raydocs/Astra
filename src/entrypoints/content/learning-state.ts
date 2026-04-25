type LearningSurface = "selection_toolbar" | "hover_translate"

export interface LearningStateSnapshot {
  savesThisSession: number
  hasSavedThisSession: boolean
  lastSavedSurface: LearningSurface | null
  lastSavedAt: number | null
  lastDueCount: number | null
}

type LearningStateListener = (snapshot: LearningStateSnapshot) => void

const IDLE_LEARNING_STATE: LearningStateSnapshot = {
  savesThisSession: 0,
  hasSavedThisSession: false,
  lastSavedSurface: null,
  lastSavedAt: null,
  lastDueCount: null,
}

let currentSnapshot: LearningStateSnapshot = { ...IDLE_LEARNING_STATE }
const listeners = new Set<LearningStateListener>()

function cloneSnapshot(snapshot: LearningStateSnapshot): LearningStateSnapshot {
  return {
    ...snapshot,
  }
}

export function getLearningState(): LearningStateSnapshot {
  return cloneSnapshot(currentSnapshot)
}

export function subscribeLearningState(listener: LearningStateListener): () => void {
  listeners.add(listener)
  listener(getLearningState())

  return () => {
    listeners.delete(listener)
  }
}

export function markSessionSave(surface: LearningSurface, dueCount: number | null = null): void {
  currentSnapshot = {
    savesThisSession: currentSnapshot.savesThisSession + 1,
    hasSavedThisSession: true,
    lastSavedSurface: surface,
    lastSavedAt: Date.now(),
    lastDueCount: dueCount,
  }

  for (const listener of listeners) {
    listener(getLearningState())
  }
}

export function __resetLearningStateForTests(): void {
  currentSnapshot = { ...IDLE_LEARNING_STATE }
}
