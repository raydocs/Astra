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

import { Linking } from "react-native"

import { sampleMobileReviewSnapshot, type SavedItem, type SourceContent } from "../domain/review"
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

  it("opens a saved video moment at its timestamp from the Library row", () => {
    vi.mocked(Linking.openURL).mockClear()
    const source: SourceContent = { sourceId: "vs", type: "video", title: "Demo video", url: "https://www.youtube.com/watch?v=abc123", savedAt: "2026-05-01T00:00:00.000Z" }
    const item: SavedItem = { itemId: "vi", sourceId: "vs", itemType: "sentence", text: "Hello", translation: "你好", savedAt: "2026-05-01T00:00:00.000Z", videoTimestampMs: 75_000 }

    const row = LibraryRow({ item, source })
    const openButton = findElementByAccessibilityLabel(row, "Open source for Hello")

    expect(openButton).toBeTruthy()
    expect(openButton?.props.accessibilityRole).toBe("link")
    openButton?.props.onPress?.()
    expect(Linking.openURL).toHaveBeenCalledWith("https://www.youtube.com/watch?v=abc123&t=75s")
  })

  it("opens the bare source URL for a non-video row and hides Open source when there is no URL", () => {
    vi.mocked(Linking.openURL).mockClear()
    const pageSource: SourceContent = { sourceId: "ps", type: "page", title: "Article", url: "https://example.com/a", savedAt: "2026-05-01T00:00:00.000Z" }
    const pageItem: SavedItem = { itemId: "pi", sourceId: "ps", itemType: "word", text: "ephemeral", translation: "短暂的", savedAt: "2026-05-01T00:00:00.000Z" }

    findElementByAccessibilityLabel(LibraryRow({ item: pageItem, source: pageSource }), "Open source for ephemeral")?.props.onPress?.()
    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com/a")

    // sampleMobileReviewSnapshot sources have no url -> no Open source affordance.
    const noUrlItem = sampleMobileReviewSnapshot.savedItems[0]
    const noUrlRow = LibraryRow({ item: noUrlItem, source: sampleMobileReviewSnapshot.sources[0] })
    expect(findElementByAccessibilityLabel(noUrlRow, `Open source for ${noUrlItem.text}`)).toBeNull()
  })
})
