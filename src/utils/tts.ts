export function speak(text: string, lang?: string): void {
  stopSpeaking()
  const utterance = new SpeechSynthesisUtterance(text)
  if (lang) utterance.lang = lang
  utterance.rate = 0.9
  speechSynthesis.speak(utterance)
}

export function stopSpeaking(): void {
  speechSynthesis.cancel()
}

export function isSpeaking(): boolean {
  return speechSynthesis.speaking
}
