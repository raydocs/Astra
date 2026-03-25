import {
  IDLE_TRANSLATION_SNAPSHOT,
  type TranslationSnapshot,
} from "@/types/translation"

type TranslationStateListener = (snapshot: TranslationSnapshot) => void

let currentSnapshot: TranslationSnapshot = { ...IDLE_TRANSLATION_SNAPSHOT }
const listeners = new Set<TranslationStateListener>()

function cloneSnapshot(snapshot: TranslationSnapshot): TranslationSnapshot {
  return {
    ...snapshot,
    lastError: snapshot.lastError ? { ...snapshot.lastError } : null,
    progress: { ...snapshot.progress },
    presentation: { ...snapshot.presentation },
    site: { ...snapshot.site },
  }
}

export function getTranslationState(): TranslationSnapshot {
  return cloneSnapshot(currentSnapshot)
}

export function setTranslationState(snapshot: TranslationSnapshot): void {
  currentSnapshot = cloneSnapshot(snapshot)

  for (const listener of listeners) {
    listener(getTranslationState())
  }
}

export function subscribeTranslationState(
  listener: TranslationStateListener,
): () => void {
  listeners.add(listener)
  listener(getTranslationState())

  return () => {
    listeners.delete(listener)
  }
}
