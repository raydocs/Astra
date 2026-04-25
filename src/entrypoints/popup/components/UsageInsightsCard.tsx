import { t } from "@/utils/i18n"
import type { TranslationUsageEvent, TranslationUsageAggregate, TranslationUsageSummary, RequestSource } from "@/utils/storage/translation-usage"

export interface UsageInsightsCardProps {
  summary: TranslationUsageSummary | null
}

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return value.toString()
}

function formatCost(usd: number): string {
  if (usd <= 0) return t("popup_usageCostFree")
  if (usd < 0.01) return `<$0.01`
  return `$${usd.toFixed(2)}`
}

function formatRoute(event: TranslationUsageEvent): string {
  if (event.route === "fallback") return t("popup_usageFallbackRoute")
  if (event.route === "direct") return t("popup_usageViaDirect")
  if (event.route === "relay") return t("popup_usageViaRelay")
  return t("popup_usageNoRoute")
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
      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 6 }}>
        <MetricCell label={t("popup_usageMetricRequests")} value={aggregate.requests.toString()} />
        <MetricCell label={t("popup_usageMetricTokensIn")} value={formatCompactCount(aggregate.estimatedInputTokens)} />
        <MetricCell label={t("popup_usageMetricEstCost")} value={formatCost(aggregate.estimatedCostUsd)} />
        <MetricCell label={t("popup_usageMetricChars")} value={formatCompactCount(aggregate.chars)} />
        <MetricCell label={t("popup_usageMetricFallbacks")} value={aggregate.fallbackRequests.toString()} color={aggregate.fallbackRequests > 0 ? "#d97706" : undefined} />
        <MetricCell label={t("popup_usageMetricFailed")} value={aggregate.failedRequests.toString()} color={aggregate.failedRequests > 0 ? "#dc2626" : undefined} />
      </div>
    </div>
  )
}

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: "4px 6px",
      background: "#fff",
      border: "1px solid #f1f5f9",
      borderRadius: 6,
    }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: color ?? "#0f172a" }}>{value}</div>
      <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>{label}</div>
    </div>
  )
}

function SourceDistribution({ bySource }: { bySource: Partial<Record<RequestSource, number>> }) {
  const entries = Object.entries(bySource).filter(([, v]) => v && v > 0) as [RequestSource, number][]
  if (entries.length === 0) return null
  const total = entries.reduce((s, [, v]) => s + v, 0)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>{t("popup_usageBySource")}</div>
      <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden" }}>
        {entries.map(([source, count]) => (
          <div
            key={source}
            style={{
              flex: count,
              background: source === "page-translation" ? "#ea580c"
                : source === "selection" ? "#f97316"
                  : source === "hover" ? "#fb923c"
                    : "#94a3b8",
            }}
            title={`${getSourceLabel(source)}: ${count} (${Math.round((count / total) * 100)}%)`}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        {entries.map(([source, count]) => (
          <span key={source} style={{ fontSize: 10, color: "#64748b" }}>
            {getSourceLabel(source)} {count}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function UsageInsightsCard({ summary }: UsageInsightsCardProps) {
  if (!summary) return null

  const noUsage = summary.session.requests === 0 && summary.today.requests === 0

  return (
    <section style={{
      marginTop: 12,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 10,
      padding: 12,
    }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
        {t("popup_usageTitle")}
      </div>

      {noUsage ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          {t("popup_usageEmpty")}
        </div>
      ) : (
        <>
          <MetricGrid aggregate={summary.today} label={t("popup_usageTodayLabel")} />
          <MetricGrid aggregate={summary.session} label={t("popup_usageSessionLabel")} />

          <SourceDistribution bySource={summary.today.bySource} />

          {summary.today.avgDurationMs > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
              {t("popup_usageAvgResponse", String(summary.today.avgDurationMs))}
            </div>
          )}

          {summary.lastEvent && (
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid #e2e8f0",
              fontSize: 11,
              color: "#64748b",
              lineHeight: 1.5,
            }}
            >
              <strong style={{ color: "#475569" }}>{t("popup_usageLastLabel")}:</strong>{" "}
              {summary.lastEvent.providerId} / {summary.lastEvent.model} · {formatRoute(summary.lastEvent)}
              {summary.lastEvent.estimatedCostUsd != null && summary.lastEvent.estimatedCostUsd > 0
                ? ` · ${formatCost(summary.lastEvent.estimatedCostUsd)}`
                : ""}
              {!summary.lastEvent.success && summary.lastEvent.errorCode
                ? ` · ${summary.lastEvent.errorCode}`
                : ""}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.45 }}>
        {t("popup_usageLiveOnly")}
      </div>
    </section>
  )
}
