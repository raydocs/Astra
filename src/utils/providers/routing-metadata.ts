export type ProviderTransport = "direct" | "relay"
export type ProviderRoute = "direct" | "relay" | "fallback"

export type TranslationPathMarkerKind = "basic_direct" | "enhanced_relay" | "fallback" | "unreported"

export interface ProviderRoutingMetadata {
  route?: ProviderRoute | null
  attemptedTransports?: readonly ProviderTransport[]
  finalTransport?: ProviderTransport | null
  fallbackUsed?: boolean
}

export interface TranslationPathMarker {
  version: 1
  kind: TranslationPathMarkerKind
  label: string
  route: ProviderRoute | null
  attemptedTransports: ProviderTransport[]
  finalTransport: ProviderTransport | null
  fallbackUsed: boolean
  detail: string
}

export interface TranslationPathSummary {
  version: 1
  totalBatches: number
  markers: TranslationPathMarker[]
  counts: Record<TranslationPathMarkerKind, number>
  label: string
  details: string[]
  hasFallback: boolean
  kinds: TranslationPathMarkerKind[]
}

const pathMarkerOrder: TranslationPathMarkerKind[] = ["basic_direct", "enhanced_relay", "fallback", "unreported"]

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

function labelForPathMarkerKind(kind: TranslationPathMarkerKind): string {
  if (kind === "basic_direct") return "Basic/direct path"
  if (kind === "enhanced_relay") return "Enhanced/Astra relay path"
  if (kind === "fallback") return "Fallback path"
  return "Path not reported"
}

function detailForPathMarker(metadata: ProviderRoutingMetadata | undefined, kind: TranslationPathMarkerKind): string {
  const attempted = metadata?.attemptedTransports ?? []
  const finalTransport = metadata?.finalTransport ?? null

  if (kind === "fallback") {
    if (attempted[0] === "direct" && attempted.includes("relay") && finalTransport === "relay") {
      return "Direct failed; Astra relay completed the batch."
    }
    if (attempted[0] === "relay" && attempted.includes("direct") && finalTransport === "direct") {
      return "Astra relay failed; direct path completed the batch."
    }
    return "A fallback route completed this batch after another transport was attempted."
  }

  if (kind === "basic_direct") return "Direct runtime path completed the batch."
  if (kind === "enhanced_relay") return "Astra relay runtime path completed the batch."
  return "Runtime did not report which path completed the batch."
}

export function createTranslationPathMarker(metadata?: ProviderRoutingMetadata | null): TranslationPathMarker {
  const route = metadata?.route ?? null
  const attemptedTransports = [...(metadata?.attemptedTransports ?? [])]
  const finalTransport = metadata?.finalTransport ?? null
  const fallbackUsed = Boolean(metadata?.fallbackUsed || route === "fallback")
  const kind: TranslationPathMarkerKind = fallbackUsed || route === "fallback"
    ? "fallback"
    : route === "direct" || finalTransport === "direct"
      ? "basic_direct"
      : route === "relay" || finalTransport === "relay"
        ? "enhanced_relay"
        : "unreported"

  return {
    version: 1,
    kind,
    label: labelForPathMarkerKind(kind),
    route,
    attemptedTransports,
    finalTransport,
    fallbackUsed,
    detail: detailForPathMarker(metadata ?? undefined, kind),
  }
}

export function summarizeTranslationPathMarkers(markers: readonly TranslationPathMarker[]): TranslationPathSummary | undefined {
  if (markers.length === 0) return undefined

  const counts = pathMarkerOrder.reduce((acc, kind) => {
    acc[kind] = markers.filter((marker) => marker.kind === kind).length
    return acc
  }, {} as Record<TranslationPathMarkerKind, number>)
  const kinds = pathMarkerOrder.filter((kind) => counts[kind] > 0)
  const details = kinds.map((kind) => `${counts[kind]} ${labelForPathMarkerKind(kind)}`)
  const hasFallback = counts.fallback > 0

  return {
    version: 1,
    totalBatches: markers.length,
    markers: [...markers],
    counts,
    label: `${markers.length} batch(es): ${details.join(", ")}.`,
    details: [
      ...details,
      ...(hasFallback
        ? Array.from(new Set(markers.filter((marker) => marker.kind === "fallback").map((marker) => marker.detail)))
        : []),
    ],
    hasFallback,
    kinds,
  }
}
