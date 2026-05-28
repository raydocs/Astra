import { isValidElement, type ReactElement, type ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("react-native", () => ({
  Linking: { openURL: vi.fn() },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}))

import { sampleMobileReviewSnapshot } from "../domain/review"
import { LibraryRow } from "./LibraryScreen"

type ElementWithProps = ReactElement<{
  accessibilityHint?: string
  accessibilityLabel?: string
  accessibilityRole?: string
  children?: ReactNode
  onPress?: () => void
}>

function findElementByAccessibilityLabel(node: ReactNode, accessibilityLabel: string): ElementWithProps | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElementByAccessibilityLabel(child, accessibilityLabel)
      if (match) return match
    }
    return null
  }

  if (!isValidElement(node)) return null

  const element = node as ElementWithProps
  if (element.props.accessibilityLabel === accessibilityLabel) return element

  return findElementByAccessibilityLabel(element.props.children, accessibilityLabel)
}

describe("LibraryScreen", () => {
  it("wires saved Library item Speak to the selected saved item", () => {
    const onSpeakSavedItem = vi.fn()
    const item = sampleMobileReviewSnapshot.savedItems[0]
    const source = sampleMobileReviewSnapshot.sources[0]

    const row = LibraryRow({ item, source, onSpeak: onSpeakSavedItem })
    const speakButton = findElementByAccessibilityLabel(row, "Speak resilient")

    expect(speakButton).toBeTruthy()
    expect(speakButton?.props.accessibilityRole).toBe("button")
    expect(speakButton?.props.accessibilityHint).toBe("Read this saved expression aloud")

    speakButton?.props.onPress?.()

    expect(onSpeakSavedItem).toHaveBeenCalledTimes(1)
    expect(onSpeakSavedItem).toHaveBeenCalledWith(item)
  })

  it("does not show saved Library item Speak when no speak handler is provided", () => {
    const item = sampleMobileReviewSnapshot.savedItems[0]
    const source = sampleMobileReviewSnapshot.sources[0]

    const row = LibraryRow({ item, source })

    expect(findElementByAccessibilityLabel(row, "Speak resilient")).toBeNull()
  })
})
