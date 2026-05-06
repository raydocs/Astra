import type { CSSProperties } from "react"
import type { BoxDistribution } from "@/utils/srs/leitner"

interface ReviewStatsProps {
  distribution: BoxDistribution
  dueCount: number
}

/** Leitner box colors — Quiet Reader light palette (status + accent, not neon). */
const BOX_COLORS: Record<number, string> = {
  1: "var(--astra-danger)",
  2: "var(--astra-warning)",
  3: "var(--astra-hl)",
  4: "var(--astra-info)",
  5: "var(--astra-ok)",
}

const BOX_LABELS: Record<number, string> = {
  1: "New",
  2: "Learning",
  3: "Familiar",
  4: "Good",
  5: "Mastered",
}

export default function ReviewStats({ distribution, dueCount }: ReviewStatsProps) {
  const mastered = distribution.box5
  const total = distribution.total
  const boxes = [
    { key: 1, count: distribution.box1, color: BOX_COLORS[1], label: BOX_LABELS[1] },
    { key: 2, count: distribution.box2, color: BOX_COLORS[2], label: BOX_LABELS[2] },
    { key: 3, count: distribution.box3, color: BOX_COLORS[3], label: BOX_LABELS[3] },
    { key: 4, count: distribution.box4, color: BOX_COLORS[4], label: BOX_LABELS[4] },
    { key: 5, count: distribution.box5, color: BOX_COLORS[5], label: BOX_LABELS[5] },
  ]

  const containerStyle: CSSProperties = {
    marginBottom: 20,
    padding: "14px 16px",
    background: "var(--astra-style-bg-elevated, var(--astra-bg-card))",
    border: "1px solid var(--astra-style-line-1, var(--astra-border))",
    borderRadius: "var(--astra-style-radius-lg, 10px)",
  }

  const summaryStyle: CSSProperties = {
    fontSize: 13,
    color: "var(--astra-text-muted)",
    marginBottom: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  }

  const barContainerStyle: CSSProperties = {
    display: "flex",
    height: 20,
    borderRadius: "var(--astra-style-radius-md, 6px)",
    overflow: "hidden",
    background: "var(--astra-style-bg-sunken, var(--astra-bg-subtle))",
    marginBottom: 8,
  }

  const legendStyle: CSSProperties = {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 11,
    color: "var(--astra-text-muted)",
  }

  const legendDotStyle = (color: string): CSSProperties => ({
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: 4,
    background: color,
    marginRight: 4,
  })

  const sepColor = "var(--astra-style-line-2, var(--astra-border-strong))"

  return (
    <div style={containerStyle}>
      <div style={summaryStyle}>
        <span><strong className="astra-tabular" style={{ color: "var(--astra-warning)" }}>{dueCount}</strong> due today</span>
        <span style={{ color: sepColor }}>|</span>
        <span><strong className="astra-tabular" style={{ color: "var(--astra-ok)" }}>{mastered}</strong> mastered</span>
        <span style={{ color: sepColor }}>|</span>
        <span><strong className="astra-tabular" style={{ color: "var(--astra-ink-1, var(--astra-text-primary))" }}>{total}</strong> total</span>
      </div>

      <div
        style={barContainerStyle}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={mastered}
        aria-label={`${mastered} of ${total} vocabulary items mastered`}
      >
        {total > 0 && boxes.map((box) =>
          box.count > 0 ? (
            <div
              key={box.key}
              title={`Box ${box.key} (${box.label}): ${box.count}`}
              style={{
                flex: box.count,
                background: box.color,
                minWidth: box.count > 0 ? 4 : 0,
                transition: "flex 0.3s ease",
              }}
            />
          ) : null,
        )}
      </div>

      <div style={legendStyle}>
        {boxes.map((box) => (
          <span key={box.key}>
            <span style={legendDotStyle(box.color)} />
            {box.label} (<span className="astra-tabular">{box.count}</span>)
          </span>
        ))}
      </div>
    </div>
  )
}
