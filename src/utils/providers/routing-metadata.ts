export type ProviderTransport = "direct" | "relay"
export type ProviderRoute = "direct" | "relay" | "fallback"

export function summarizeProviderRoute(
  attemptedTransports: readonly ProviderTransport[],
  finalTransport: ProviderTransport | null,
): ProviderRoute | null {
  const attemptedDirect = attemptedTransports.includes("direct")
  const attemptedRelay = attemptedTransports.includes("relay")

  if (attemptedDirect && attemptedRelay) {
    return "fallback"
  }

  if (finalTransport === "direct" || attemptedDirect) {
    return "direct"
  }

  if (finalTransport === "relay" || attemptedRelay) {
    return "relay"
  }

  return null
}
