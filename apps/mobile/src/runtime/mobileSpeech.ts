import * as Speech from "expo-speech"

const MAX_SPEECH_TEXT_LENGTH = 280

export type MobileSpeechStatus = "speaking" | "empty" | "unavailable" | "error"

export interface MobileSpeechResult {
  status: MobileSpeechStatus
  message: string
}

export function normalizeMobileSpeechText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SPEECH_TEXT_LENGTH)
}

export async function speakMobileText(text: string): Promise<MobileSpeechResult> {
  const normalizedText = normalizeMobileSpeechText(text)
  if (!normalizedText) return { status: "empty", message: "Nothing to speak on this card." }

  try {
    await Speech.stop()
    Speech.speak(normalizedText)
    return { status: "speaking", message: "Playing card audio." }
  } catch {
    return { status: "error", message: "Could not play speech on this phone." }
  }
}
