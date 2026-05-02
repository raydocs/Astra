import type { LearningContinuitySyncStatus } from "@/types/messages"

export interface LearningContinuityCommitCardProps {
  status: LearningContinuitySyncStatus | null
  syncInFlight?: boolean
  onSyncNow: () => void
}

function formatCommitTimestamp(value: string | null | undefined): string {
  if (!value) return "not yet"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function resolveCommitState(status: LearningContinuitySyncStatus | null, syncInFlight: boolean) {
  const errorMessage = status?.lastError ?? status?.stateLastError ?? null
  const lastSuccessAt = status?.stateLastSuccessAt ?? null
  const queued = status?.queued === true

  if (syncInFlight || status?.inFlight) {
    return {
      label: "syncing",
      tone: "info" as const,
      detail: queued ? "Commit running; another change is queued." : "Commit running now.",
      actionLabel: "Syncing…",
      disabled: true,
      isRetry: false,
    }
  }

  if (queued) {
    return {
      label: "queued",
      tone: "info" as const,
      detail: "A continuity commit is queued after the active sync finishes.",
      actionLabel: "Sync now",
      disabled: true,
      isRetry: false,
    }
  }

  if (errorMessage) {
    return {
      label: "error-retry",
      tone: "danger" as const,
      detail: errorMessage,
      actionLabel: "Retry sync",
      disabled: false,
      isRetry: true,
    }
  }

  if (lastSuccessAt) {
    return {
      label: "synced",
      tone: "success" as const,
      detail: `Last synced ${formatCommitTimestamp(lastSuccessAt)}.` ,
      actionLabel: "Sync now",
      disabled: false,
      isRetry: false,
    }
  }

  return {
    label: "ready-to-sync",
    tone: "neutral" as const,
    detail: "Ready to commit local learning changes when you choose.",
    actionLabel: "Sync now",
    disabled: false,
    isRetry: false,
  }
}

const toneStyles = {
  success: { background: "var(--astra-success-bg)", color: "var(--astra-success)", border: "var(--astra-success-border)" },
  info: { background: "var(--astra-info-bg)", color: "var(--astra-info)", border: "var(--astra-info-border)" },
  danger: { background: "var(--astra-danger-bg)", color: "var(--astra-danger)", border: "var(--astra-danger-border)" },
  neutral: { background: "var(--astra-bg-subtle)", color: "var(--astra-text-secondary)", border: "var(--astra-border)" },
}

export default function LearningContinuityCommitCard({
  status,
  syncInFlight = false,
  onSyncNow,
}: LearningContinuityCommitCardProps) {
  const state = resolveCommitState(status, syncInFlight)
  const tone = toneStyles[state.tone]
  const lastFinishedAt = status?.lastFinishedAt ?? status?.stateLastRunAt ?? null

  return (
    <section
      data-testid="learning-continuity-commit-card"
      aria-label="Learning continuity commit"
      style={{
        marginTop: 12,
        background: "var(--astra-bg-card)",
        border: "1px solid var(--astra-popup-border-warm)",
        borderRadius: 12,
        padding: 12,
        boxShadow: "var(--astra-popup-shadow-warm-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--astra-popup-text-warm-strong)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Learning continuity commit
          </div>
          <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 4, lineHeight: 1.45 }}>
            Config, vocabulary, reading history, and study progress sync across signed-in devices.
          </div>
        </div>
        <span
          data-testid="learning-continuity-commit-state"
          style={{
            flex: "0 0 auto",
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${tone.border}`,
            background: tone.background,
            color: tone.color,
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {state.label}
        </span>
      </div>

      <div style={{ fontSize: 12, color: state.tone === "danger" ? "var(--astra-danger)" : "var(--astra-text-secondary)", marginTop: 8, lineHeight: 1.45 }}>
        {state.detail}
      </div>
      {lastFinishedAt && !status?.stateLastSuccessAt && (
        <div style={{ fontSize: 11, color: "var(--astra-text-hint)", marginTop: 2 }}>
          Last attempt {formatCommitTimestamp(lastFinishedAt)}.
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--astra-text-muted)", marginTop: 8, lineHeight: 1.45 }}>
        Local-first: you can keep studying offline; SRS schedule remains local-only.
      </div>

      <button
        type="button"
        data-testid="learning-continuity-sync-now"
        className={state.isRetry ? "astra-btn-secondary" : "astra-btn-primary"}
        onClick={onSyncNow}
        disabled={state.disabled}
        style={{ width: "100%", marginTop: 10, padding: "8px 10px", fontSize: 13, fontWeight: 700 }}
      >
        {state.actionLabel}
      </button>
    </section>
  )
}
