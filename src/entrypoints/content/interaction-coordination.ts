export type InteractionSuppressionReason = "selection-pointer" | "selection-toolbar"

export interface InteractionSuppressionState {
  hoverSuppressed: boolean
}

type InteractionSuppressionListener = (state: InteractionSuppressionState) => void

const activeReasons = new Set<InteractionSuppressionReason>()
const listeners = new Set<InteractionSuppressionListener>()

function snapshot(): InteractionSuppressionState {
  return {
    hoverSuppressed: activeReasons.size > 0,
  }
}

function notify(): void {
  const state = snapshot()
  listeners.forEach((listener) => listener(state))
}

export function getInteractionSuppressionState(): InteractionSuppressionState {
  return snapshot()
}

export function setInteractionSuppressionReason(
  reason: InteractionSuppressionReason,
  active: boolean,
): void {
  const hadReason = activeReasons.has(reason)

  if (active && !hadReason) {
    activeReasons.add(reason)
    notify()
    return
  }

  if (!active && hadReason) {
    activeReasons.delete(reason)
    notify()
  }
}

export function clearInteractionSuppression(
  reasons?: InteractionSuppressionReason[],
): void {
  if (!reasons || reasons.length === 0) {
    if (activeReasons.size === 0) return
    activeReasons.clear()
    notify()
    return
  }

  let changed = false
  for (const reason of reasons) {
    if (activeReasons.delete(reason)) {
      changed = true
    }
  }

  if (changed) {
    notify()
  }
}

export function subscribeToInteractionSuppression(
  listener: InteractionSuppressionListener,
): () => void {
  listeners.add(listener)
  listener(snapshot())
  return () => {
    listeners.delete(listener)
  }
}

export function hasActiveTextSelection(doc: Document = document): boolean {
  const selection = doc.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false
  }

  return selection.toString().trim().length > 0
}
