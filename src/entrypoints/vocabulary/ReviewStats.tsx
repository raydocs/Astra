import type { BoxDistribution } from "@/utils/srs/leitner"

interface ReviewStatsProps {
  distribution: BoxDistribution
  dueCount: number
}

const BOX_COLORS: Record<number, string> = {
  1: "#ef4444", // red
  2: "#f97316", // orange
  3: "#eab308", // yellow
  4: "#22c55e", // green
  5: "#10b981", // emerald
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

  const containerStyle: React.CSSProperties = {
    marginBottom: 20,
    padding: "14px 16px",
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
  }

  const summaryStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  }

  const barContainerStyle: React.CSSProperties = {
    display: "flex",
    height: 20,
    borderRadius: 6,
    overflow: "hidden",
    background: "#f1f5f9",
    marginBottom: 8,
  }

  const legendStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 11,
    color: "#64748b",
  }

  const legendDotStyle = (color: string): React.CSSProperties => ({
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: 4,
    background: color,
    marginRight: 4,
  })

  return (
    <div style={containerStyle}>
      <div style={summaryStyle}>
        <span><strong style={{ color: "#d97706" }}>{dueCount}</strong> due today</span>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <span><strong style={{ color: "#10b981" }}>{mastered}</strong> mastered</span>
        <span style={{ color: "#cbd5e1" }}>|</span>
        <span><strong style={{ color: "#0f172a" }}>{total}</strong> total</span>
      </div>

      <div style={barContainerStyle}>
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
            {box.label} ({box.count})
          </span>
        ))}
      </div>
    </div>
  )
}
