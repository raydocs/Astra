let currentUtterance: SpeechSynthesisUtterance | null = null

export function speak(text: string, lang?: string): void {
  stopSpeaking()
  const utterance = new SpeechSynthesisUtterance(text)
  if (lang) utterance.lang = lang
  utterance.rate = 0.9
  currentUtterance = utterance
  speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  speechSynthesis.cancel()
  currentUtterance = null
}

export function isSpeaking(): boolean {
  return speechSynthesis.speaking
}
