import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearInteractionSuppression,
  getInteractionSuppressionState,
  hasActiveTextSelection,
  setInteractionSuppressionReason,
  subscribeToInteractionSuppression,
} from "./interaction-coordination"

// The global setup already calls clearInteractionSuppression() in beforeEach,
// but we repeat it in afterEach here for clarity and to guard against any
// ordering issues within this file.
afterEach(() => {
  clearInteractionSuppression()
})

// ---------------------------------------------------------------------------
// setInteractionSuppressionReason / getInteractionSuppressionState
// ---------------------------------------------------------------------------

describe("setInteractionSuppressionReason", () => {
  it("activates suppression when a reason is set to true", () => {
    setInteractionSuppressionReason("selection-pointer", true)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
  })

  it("deactivates suppression when the reason is set to false", () => {
    setInteractionSuppressionReason("selection-pointer", true)
    setInteractionSuppressionReason("selection-pointer", false)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("keeps suppression active when one of two reasons is cleared", () => {
    setInteractionSuppressionReason("selection-pointer", true)
    setInteractionSuppressionReason("selection-toolbar", true)
    setInteractionSuppressionReason("selection-pointer", false)

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
  })

  it("does not notify listeners when setting an already-active reason again", () => {
    setInteractionSuppressionReason("selection-pointer", true)

    const listener = vi.fn()
    const unsub = subscribeToInteractionSuppression(listener)
    listener.mockClear() // ignore the immediate call on subscribe

    setInteractionSuppressionReason("selection-pointer", true) // no-op

    expect(listener).not.toHaveBeenCalled()
    unsub()
  })

  it("does not notify listeners when clearing an already-inactive reason", () => {
    // Ensure reason is not active
    const listener = vi.fn()
    const unsub = subscribeToInteractionSuppression(listener)
    listener.mockClear()

    setInteractionSuppressionReason("selection-pointer", false) // no-op

    expect(listener).not.toHaveBeenCalled()
    unsub()
  })
})

// ---------------------------------------------------------------------------
// getInteractionSuppressionState
// ---------------------------------------------------------------------------

describe("getInteractionSuppressionState", () => {
  it("returns hoverSuppressed=false when no reasons are active", () => {
    expect(getInteractionSuppressionState()).toEqual({ hoverSuppressed: false })
  })

  it("returns hoverSuppressed=true when any reason is active", () => {
    setInteractionSuppressionReason("selection-toolbar", true)

    expect(getInteractionSuppressionState()).toEqual({ hoverSuppressed: true })
  })
})

// ---------------------------------------------------------------------------
// clearInteractionSuppression
// ---------------------------------------------------------------------------

describe("clearInteractionSuppression", () => {
  it("clears all reasons when called with no arguments", () => {
    setInteractionSuppressionReason("selection-pointer", true)
    setInteractionSuppressionReason("selection-toolbar", true)

    clearInteractionSuppression()

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("clears all reasons when called with an empty array", () => {
    setInteractionSuppressionReason("selection-pointer", true)

    clearInteractionSuppression([])

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("clears only the specified reason when called with a list", () => {
    setInteractionSuppressionReason("selection-pointer", true)
    setInteractionSuppressionReason("selection-toolbar", true)

    clearInteractionSuppression(["selection-pointer"])

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(true)
  })

  it("clears multiple specified reasons at once", () => {
    setInteractionSuppressionReason("selection-pointer", true)
    setInteractionSuppressionReason("selection-toolbar", true)

    clearInteractionSuppression(["selection-pointer", "selection-toolbar"])

    expect(getInteractionSuppressionState().hoverSuppressed).toBe(false)
  })

  it("is a no-op (no notification) when called with no args and no active reasons", () => {
    const listener = vi.fn()
    const unsub = subscribeToInteractionSuppression(listener)
    listener.mockClear()

    clearInteractionSuppression() // nothing to clear

    expect(listener).not.toHaveBeenCalled()
    unsub()
  })

  it("notifies listeners when all reasons are cleared", () => {
    setInteractionSuppressionReason("selection-pointer", true)

    const listener = vi.fn()
    const unsub = subscribeToInteractionSuppression(listener)
    listener.mockClear()

    clearInteractionSuppression()

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({ hoverSuppressed: false })
    unsub()
  })
})

// ---------------------------------------------------------------------------
// subscribeToInteractionSuppression
// ---------------------------------------------------------------------------

describe("subscribeToInteractionSuppression", () => {
  it("fires the listener immediately with the current state on subscribe", () => {
    setInteractionSuppressionReason("selection-toolbar", true)

    const listener = vi.fn()
    const unsub = subscribeToInteractionSuppression(listener)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({ hoverSuppressed: true })

    unsub()
  })

  it("fires the listener on subsequent state changes", () => {
    const listener = vi.fn()
    const unsub = subscribeToInteractionSuppression(listener)
    listener.mockClear()

    setInteractionSuppressionReason("selection-pointer", true)

    expect(listener).toHaveBeenCalledOnce()
    expect(listener).toHaveBeenCalledWith({ hoverSuppressed: true })

    unsub()
  })

  it("the returned unsubscribe function stops future notifications", () => {
    const listener = vi.fn()
    const unsub = subscribeToInteractionSuppression(listener)
    listener.mockClear()

    unsub()

    setInteractionSuppressionReason("selection-pointer", true)

    expect(listener).not.toHaveBeenCalled()
  })

  it("supports multiple independent subscribers", () => {
    const listenerA = vi.fn()
    const listenerB = vi.fn()

    const unsubA = subscribeToInteractionSuppression(listenerA)
    const unsubB = subscribeToInteractionSuppression(listenerB)
    listenerA.mockClear()
    listenerB.mockClear()

    setInteractionSuppressionReason("selection-pointer", true)

    expect(listenerA).toHaveBeenCalledOnce()
    expect(listenerB).toHaveBeenCalledOnce()

    unsubA()
    listenerA.mockClear()
    listenerB.mockClear()

    setInteractionSuppressionReason("selection-toolbar", true)

    // listenerA was unsubscribed; listenerB should still fire
    expect(listenerA).not.toHaveBeenCalled()
    expect(listenerB).toHaveBeenCalledOnce()

    unsubB()
  })
})

// ---------------------------------------------------------------------------
// hasActiveTextSelection
// ---------------------------------------------------------------------------

describe("hasActiveTextSelection", () => {
  it("returns false when the document has no selection", () => {
    // jsdom provides a real Selection object; by default it is collapsed / empty
    expect(hasActiveTextSelection(document)).toBe(false)
  })

  it("returns false for a collapsed (caret) selection", () => {
    // Create a text node and collapse the selection onto a single position
    const p = document.createElement("p")
    p.textContent = "Hello world"
    document.body.appendChild(p)

    const range = document.createRange()
    range.setStart(p.firstChild!, 2)
    range.collapse(true) // collapsed = caret only

    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(hasActiveTextSelection(document)).toBe(false)

    sel.removeAllRanges()
  })

  it("returns false when the selection contains only whitespace", () => {
    const p = document.createElement("p")
    p.textContent = "   "
    document.body.appendChild(p)

    const range = document.createRange()
    range.selectNodeContents(p.firstChild!)

    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(hasActiveTextSelection(document)).toBe(false)

    sel.removeAllRanges()
  })

  it("returns true when the selection contains non-empty text", () => {
    const p = document.createElement("p")
    p.textContent = "Hello world"
    document.body.appendChild(p)

    const range = document.createRange()
    range.selectNodeContents(p.firstChild!)

    const sel = document.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)

    expect(hasActiveTextSelection(document)).toBe(true)

    sel.removeAllRanges()
  })

  it("accepts an explicit document argument", () => {
    // The default document in jsdom has no active selection
    expect(hasActiveTextSelection(document)).toBe(false)
  })
})
