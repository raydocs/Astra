import type { QuotaInfo } from "@/utils/astra/quota-types"
import { t } from "@/utils/i18n"

function formatTokenCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

function getBarColor(pct: number): string {
  if (pct < 60) return "var(--astra-success)"
  if (pct < 85) return "var(--astra-warning)"
  return "var(--astra-danger)"
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function renderTabularValues(text: string, values: string[]) {
  const uniqueValues = Array.from(new Set(values.filter(Boolean))).sort((a, b) => b.length - a.length)
  if (uniqueValues.length === 0) return text

  const matcher = new RegExp(`(${uniqueValues.map(escapeRegExp).join("|")})`, "g")
  return text.split(matcher).map((part, index) => (
    uniqueValues.includes(part) ? <span key={`${part}-${index}`} className="astra-tabular">{part}</span> : part
  ))
}

export interface QuotaBarProps {
  quota: QuotaInfo | null
}

export default function QuotaBar({ quota }: QuotaBarProps) {
  if (!quota) return null

  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0
  const color = getBarColor(pct)
  const quotaValues = [`${pct}`, formatTokenCount(quota.used), formatTokenCount(quota.limit)]
  const quotaText = t("popup_quotaToday", quotaValues)

  return (
    <div style={{ marginTop: 6 }}>
      <div
        role="progressbar"
        aria-label="Daily quota usage"
        aria-valuemin={0}
        aria-valuemax={quota.limit}
        aria-valuenow={quota.used}
        style={{
          height: 6,
          background: "var(--astra-border)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginTop: 3 }}>
        {renderTabularValues(quotaText, quotaValues)}
      </div>
    </div>
  )
}
