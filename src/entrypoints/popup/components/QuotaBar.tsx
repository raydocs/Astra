import type { QuotaInfo } from "@/utils/astra/quota-types"
import { t } from "@/utils/i18n"

function formatTokenCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return `${n}`
}

function getBarColor(pct: number): string {
  if (pct < 60) return "#22c55e"
  if (pct < 85) return "#eab308"
  return "#ef4444"
}

export interface QuotaBarProps {
  quota: QuotaInfo | null
}

export default function QuotaBar({ quota }: QuotaBarProps) {
  if (!quota) return null

  const pct = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0
  const color = getBarColor(pct)

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          height: 6,
          background: "#e2e8f0",
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
      <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
        {t("popup_quotaToday", [`${pct}`, formatTokenCount(quota.used), formatTokenCount(quota.limit)])}
      </div>
    </div>
  )
}
