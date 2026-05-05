import {
  IDLE_TRANSLATION_SNAPSHOT,
  type TranslationRuntimeDiagnostics,
  type TranslationSnapshot,
} from "@/types/translation"

type TranslationStateListener = (snapshot: TranslationSnapshot) => void

let currentSnapshot: TranslationSnapshot = { ...IDLE_TRANSLATION_SNAPSHOT }
const listeners = new Set<TranslationStateListener>()

function cloneDiagnostics(diagnostics: TranslationRuntimeDiagnostics | undefined): TranslationRuntimeDiagnostics | undefined {
  if (!diagnostics) return undefined

  return {
    ...diagnostics,
    siteRules: diagnostics.siteRules
      ? {
          ...diagnostics.siteRules,
          filterStages: diagnostics.siteRules.filterStages?.map((stage) => ({ ...stage })),
          selectors: {
            ...diagnostics.siteRules.selectors,
            configured: [...diagnostics.siteRules.selectors.configured],
            valid: [...diagnostics.siteRules.selectors.valid],
            invalid: [...diagnostics.siteRules.selectors.invalid],
          },
          excludeSelectors: {
            ...diagnostics.siteRules.excludeSelectors,
            configured: [...diagnostics.siteRules.excludeSelectors.configured],
            valid: [...diagnostics.siteRules.excludeSelectors.valid],
            invalid: [...diagnostics.siteRules.excludeSelectors.invalid],
          },
        }
      : undefined,
  }
}

function cloneSnapshot(snapshot: TranslationSnapshot): TranslationSnapshot {
  return {
    ...snapshot,
    lastError: snapshot.lastError ? { ...snapshot.lastError } : null,
    progress: { ...snapshot.progress },
    presentation: { ...snapshot.presentation },
    site: { ...snapshot.site },
    diagnostics: cloneDiagnostics(snapshot.diagnostics),
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
