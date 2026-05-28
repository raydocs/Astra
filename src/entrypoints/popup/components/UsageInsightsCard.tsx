import { t } from "@/utils/i18n"
import type { TranslationUsageEvent, TranslationUsageAggregate, TranslationUsageSummary, RequestSource } from "@/utils/storage/translation-usage"
import type { TranslationCacheStats } from "@/types/messages"
import { PopupMetricCard } from "./PopupDesignPrimitives"

export interface UsageInsightsCardProps {
  summary: TranslationUsageSummary | null
  cacheStats?: TranslationCacheStats | null
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toString()
}

function formatIncludedWork(_usd: number): string {
  return t("popup_usageCostFree")
}

function formatRoute(event: TranslationUsageEvent): string {
  if (event.route === "fallback") return "Astra automatic retry"
  if (event.route === "direct" || event.route === "relay") return "Astra automatic"
  return "Astra managed"
}

function getSourceLabel(source: RequestSource): string {
  const labels: Record<RequestSource, string> = {
    "page-translation": t("popup_usageSourcePage"),
    "selection": t("popup_usageSourceSelection"),
    "hover": t("popup_usageSourceHover"),
    "input": t("popup_usageSourceInput"),
    "pdf": t("popup_usageSourcePdf"),
    "epub": t("popup_usageSourceEpub"),
    "subtitle": t("popup_usageSourceSubtitle"),
  }
  return labels[source]
}

function MetricGrid({ aggregate, label }: { aggregate: TranslationUsageAggregate; label: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--astra-text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 6 }}>
        <MetricCell label={t("popup_usageMetricRequests")} value={aggregate.requests.toString()} />
        <MetricCell label={t("popup_usageMetricTokensIn")} value={formatCompactCount(aggregate.estimatedInputTokens)} />
        <MetricCell label={t("popup_usageMetricEstCost")} value={formatIncludedWork(aggregate.estimatedCostUsd)} />
        <MetricCell label={t("popup_usageMetricChars")} value={formatCompactCount(Math.round(aggregate.chars / 5))} />
        <MetricCell label="Auto retries" value={aggregate.fallbackRequests.toString()} color={aggregate.fallbackRequests > 0 ? "var(--astra-warning)" : undefined} />
        <MetricCell label={t("popup_usageMetricFailed")} value={aggregate.failedRequests.toString()} color={aggregate.failedRequests > 0 ? "var(--astra-danger)" : undefined} />
      </div>
    </div>
  )
}

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return <PopupMetricCard label={label} value={value} valueColor={color} />
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function formatBucketLabel(bucketKey: string): string {
  try {
    const parsed = JSON.parse(bucketKey) as { languageLevel?: string; routingKey?: string }
    const parts = [parsed.languageLevel, parsed.routingKey]
      .filter((value): value is string => Boolean(value && value !== "default"))
    return parts.length > 0 ? parts.join(" · ") : "default"
  } catch {
    return "default"
  }
}

function CacheDiagnostics({ stats }: { stats: TranslationCacheStats }) {
  const topBuckets = stats.buckets.slice(0, 3)
  const hasActivity = stats.lookups > 0 || stats.count > 0 || stats.writes > 0

  return (
    <div
      data-testid="translation-cache-diagnostics"
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: "1px solid var(--astra-border)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--astra-text-primary)" }}>
        Saved translations
      </div>
      {!hasActivity ? (
        <div style={{ marginTop: 6, fontSize: 11, color: "var(--astra-text-muted)", lineHeight: 1.45 }}>
          Astra will save matching translations for faster reuse once you translate a page.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 6, marginTop: 6 }}>
            <MetricCell label="saved" value={formatCompactCount(stats.count)} />
            <MetricCell label="reuse rate" value={formatPercent(stats.hitRate)} color={stats.hitRate > 0 ? "var(--astra-success)" : undefined} />
            <MetricCell label="reused" value={`${formatCompactCount(stats.hits)} / ${formatCompactCount(stats.lookups)}`} />
            <MetricCell label="new saves" value={formatCompactCount(stats.writes)} />
          </div>
          {topBuckets.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {topBuckets.map((bucket) => (
                <div
                  key={bucket.bucketKey}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 10,
                    color: "var(--astra-text-muted)",
                  }}
                >
                  <span>{formatBucketLabel(bucket.bucketKey)}</span>
                  <span className="astra-tabular">{formatPercent(bucket.hitRate)} · {bucket.hits}/{bucket.lookups}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div style={{ marginTop: 6, fontSize: 10, color: "var(--astra-text-hint)", lineHeight: 1.4 }}>
        Astra saved this translation for faster reuse. Reuse counts stay local and your original text is not displayed.
      </div>
    </div>
  )
}

function SourceDistribution({ bySource }: { bySource: Partial<Record<RequestSource, number>> }) {
  const entries = Object.entries(bySource).filter(([, v]) => v && v > 0) as [RequestSource, number][]
  if (entries.length === 0) return null
  const total = entries.reduce((s, [, v]) => s + v, 0)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--astra-text-secondary)", marginBottom: 4 }}>{t("popup_usageBySource")}</div>
      <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden" }}>
        {entries.map(([source, count]) => (
          <div
            key={source}
            style={{
              flex: count,
              background: source === "page-translation" ? "var(--astra-brand)"
                : source === "selection" ? "var(--astra-info)"
                  : source === "hover" ? "var(--astra-brand-muted)"
                    : "var(--astra-text-hint)",
            }}
            title={`${getSourceLabel(source)}: ${count} (${Math.round((count / total) * 100)}%)`}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {entries.map(([source, count]) => (
          <span key={source} style={{ fontSize: 10, color: "var(--astra-text-muted)" }}>
            {getSourceLabel(source)} <span className="astra-tabular">{count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function UsageInsightsCard({ summary, cacheStats }: UsageInsightsCardProps) {
  if (!summary) return null

  const noUsage = summary.session.requests === 0 && summary.today.requests === 0

  return (
    <section style={{
      marginTop: 12,
      background: "var(--astra-bg-primary)",
      border: "1px solid var(--astra-border)",
      borderRadius: 10,
      padding: 12,
    }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--astra-text-primary)" }}>
        Astra activity
      </div>

      {noUsage ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--astra-text-muted)", lineHeight: 1.5 }}>
          {t("popup_usageEmpty")}
        </div>
      ) : (
        <>
          <MetricGrid aggregate={summary.today} label={t("popup_usageTodayLabel")} />
          <MetricGrid aggregate={summary.session} label={t("popup_usageSessionLabel")} />

          <SourceDistribution bySource={summary.today.bySource} />

          {summary.today.avgDurationMs > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--astra-text-muted)" }}>
              {t("popup_usageAvgResponse", String(summary.today.avgDurationMs))}
            </div>
          )}

          {summary.lastEvent && (
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--astra-border)",
              fontSize: 11,
              color: "var(--astra-text-muted)",
              lineHeight: 1.5,
            }}
            >
              <strong style={{ color: "var(--astra-text-secondary)" }}>{t("popup_usageLastLabel")}:</strong>{" "}
              {formatRoute(summary.lastEvent)}
              {!summary.lastEvent.success && summary.lastEvent.errorCode
                ? ` · ${summary.lastEvent.errorCode}`
                : ""}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--astra-text-hint)", lineHeight: 1.45 }}>
        These are local reading activity counts for this device. Daily reading is included while Astra handles the service path automatically.
      </div>

      {cacheStats && <CacheDiagnostics stats={cacheStats} />}
    </section>
  )
}
