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
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--astra-text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 6 }}>
        <MetricCell label={t("popup_usageMetricRequests")} value={aggregate.requests.toString()} />
        <MetricCell label={t("popup_usageMetricTokensIn")} value={formatCompactCount(aggregate.estimatedInputTokens)} />
        <MetricCell label={t("popup_usageMetricEstCost")} value={formatCost(aggregate.estimatedCostUsd)} />
        <MetricCell label={t("popup_usageMetricChars")} value={formatCompactCount(aggregate.chars)} />
        <MetricCell label={t("popup_usageMetricFallbacks")} value={aggregate.fallbackRequests.toString()} color={aggregate.fallbackRequests > 0 ? "var(--astra-warning)" : undefined} />
        <MetricCell label={t("popup_usageMetricFailed")} value={aggregate.failedRequests.toString()} color={aggregate.failedRequests > 0 ? "var(--astra-danger)" : undefined} />
      </div>
    </div>
  )
}

function MetricCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: "4px 6px",
      background: "var(--astra-bg-card)",
      border: "1px solid var(--astra-border)",
      borderRadius: 6,
    }}
    >
      <div className="astra-tabular" style={{ fontSize: 13, fontWeight: 700, color: color ?? "var(--astra-text-primary)" }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--astra-text-hint)", marginTop: 1 }}>{label}</div>
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
              background: source === "page-translation" ? "var(--astra-accent-warm)"
                : source === "selection" ? "var(--astra-accent-warm-hover)"
                  : source === "hover" ? "var(--astra-accent-warm)"
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

export default function UsageInsightsCard({ summary }: UsageInsightsCardProps) {
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
        {t("popup_usageTitle")}
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
              {summary.lastEvent.providerId} / {summary.lastEvent.model} · {formatRoute(summary.lastEvent)}
              {summary.lastEvent.estimatedCostUsd != null && summary.lastEvent.estimatedCostUsd > 0
                ? <> · <span className="astra-tabular">{formatCost(summary.lastEvent.estimatedCostUsd)}</span></>
                : ""}
              {!summary.lastEvent.success && summary.lastEvent.errorCode
                ? ` · ${summary.lastEvent.errorCode}`
                : ""}
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 8, fontSize: 11, color: "var(--astra-text-hint)", lineHeight: 1.45 }}>
        {t("popup_usageLiveOnly")}
      </div>
    </section>
  )
}
