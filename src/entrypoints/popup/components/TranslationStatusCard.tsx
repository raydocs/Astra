import { useEffect, useMemo, useRef, type ChangeEvent } from "react"
import {
  DEFAULT_SUBTITLE_QUALITY_CONTROLS,
  type SubtitleQualityControls,
  type SubtitleQualityPresetName,
} from "@/types/config"
import type { TranslationProgressSnapshot, TranslationError, SubtitleQualitySnapshot } from "@/types/translation"
import { t } from "@/utils/i18n"
import { statusCardStyle, statusRowStyle, warningStyle } from "./styles"

export interface TranslationStatusCardProps {
  phase: string
  targetLang: string
  presentation: { mode: string; theme: string }
  hostname: string | null
  progress: TranslationProgressSnapshot | null
  lastError: TranslationError | null
  siteEnabled: boolean
  subtitleQuality?: SubtitleQualitySnapshot | null
  subtitleQualityControls?: SubtitleQualityControls
  subtitleQualityTrend?: SubtitleQualityTrendPoint[]
  onSubtitleQualityControlsChange?: (patch: Partial<SubtitleQualityControls>) => void
  onSubtitleDiagnosticsExport?: () => void
  subtitleDiagnosticsExportStatus?: string | null
  onRetryFailed?: () => void
}

type SubtitleAnomalyTier = "latency" | "jitter" | "fallback"
type SubtitleQualityNumericControlField =
  | "popupPollIntervalMs"
  | "freshnessThresholdMs"
  | "adaptivePresetCooldownMs"

export interface SubtitleQualityTrendPoint {
  capturedAt: number
  freshnessMs: number
  pendingRequestCount: number
  cacheSize: number
}

interface SubtitleQualityPreset {
  name: SubtitleQualityPresetName
  label: string
  summary: string
  patch: Partial<SubtitleQualityControls>
}

interface SubtitleAnomalyAlert {
  tier: SubtitleAnomalyTier
  label: string
  summary: string
  signals: string[]
  remediationHint: string
  controlAction: {
    label: string
    ariaLabel: string
    patch: Partial<SubtitleQualityControls>
  }
}

const SUBTITLE_QC_PRESETS: Record<SubtitleQualityPresetName, SubtitleQualityPreset> = {
  live: {
    name: "live",
    label: "Live preset",
    summary: "Fast local QC checks for active or stale subtitles.",
    patch: {
      popupPollIntervalMs: 750,
      freshnessThresholdMs: 2_500,
    },
  },
  standard: {
    name: "standard",
    label: "Standard preset",
    summary: "Balanced local QC checks for normal subtitle sessions.",
    patch: DEFAULT_SUBTITLE_QUALITY_CONTROLS,
  },
  saver: {
    name: "saver",
    label: "Saver preset",
    summary: "Slower local QC checks when subtitles are stable.",
    patch: {
      popupPollIntervalMs: 5_000,
      freshnessThresholdMs: 15_000,
    },
  },
}

function buildSubtitlePresetPatch(
  preset: SubtitleQualityPreset,
  source: "auto" | "manual",
  appliedAt?: number,
): Partial<SubtitleQualityControls> {
  return {
    ...preset.patch,
    adaptivePresetName: preset.name,
    ...(source === "auto" && appliedAt !== undefined
      ? { adaptivePresetLastAppliedAt: appliedAt }
      : {}),
    ...(source === "manual"
      ? { adaptivePresetManualOverrideLocked: true }
      : {}),
  }
}

function doesPresetMatchControls(
  preset: SubtitleQualityPreset,
  controls: SubtitleQualityControls,
): boolean {
  return controls.adaptivePresetName === preset.name
    && (preset.patch.popupPollIntervalMs === undefined || preset.patch.popupPollIntervalMs === controls.popupPollIntervalMs)
    && (preset.patch.freshnessThresholdMs === undefined || preset.patch.freshnessThresholdMs === controls.freshnessThresholdMs)
}

function formatCooldownLabel(valueMs: number): string {
  if (valueMs < 60_000) return `${Math.round(valueMs / 1000)}s`
  return `${Math.round(valueMs / 60_000)}m`
}

function includesAny(value: string, needles: string[]): boolean {
  const normalized = value.toLowerCase()
  return needles.some((needle) => normalized.includes(needle))
}

function formatTrendValue(kind: "freshnessMs" | "pendingRequestCount" | "cacheSize", value: number): string {
  if (kind === "freshnessMs") return `${Math.round(value / 1000)}s`
  return String(value)
}

function buildTrendSparkline(points: SubtitleQualityTrendPoint[], kind: "freshnessMs" | "pendingRequestCount" | "cacheSize"): string {
  const samples = points.slice(-8).map((point) => point[kind])
  if (samples.length === 0) return "·"
  const min = Math.min(...samples)
  const max = Math.max(...samples)
  const glyphs = "▁▂▃▄▅▆▇█"

  return samples.map((sample) => {
    if (max === min) return glyphs[0]
    const index = Math.round(((sample - min) / (max - min)) * (glyphs.length - 1))
    return glyphs[index] ?? glyphs[0]
  }).join("")
}

export function suggestSubtitleQualityPreset(
  subtitleQuality: SubtitleQualitySnapshot,
  subtitleFreshnessMs: number | null,
  subtitleQualityControls: SubtitleQualityControls,
): SubtitleQualityPreset {
  const anomalies = subtitleQuality.anomalies.join(" ").toLowerCase()
  const isStale = subtitleFreshnessMs !== null && subtitleFreshnessMs > subtitleQualityControls.freshnessThresholdMs
  const hasLatencyPressure = subtitleQuality.pendingRequestCount > 0
    || isStale
    || includesAny(anomalies, ["delay", "latency", "pending", "slow", "stale", "timeout", "waiting"])
  if (hasLatencyPressure) return SUBTITLE_QC_PRESETS.live

  const isStableReady = subtitleQuality.status === "ready"
    && subtitleQuality.pendingRequestCount === 0
    && subtitleQuality.anomalies.length === 0
    && subtitleQuality.cacheSize >= 8
  if (isStableReady) return SUBTITLE_QC_PRESETS.saver

  return SUBTITLE_QC_PRESETS.standard
}

export function deriveSubtitleAnomalyAlerts(
  subtitleQuality: SubtitleQualitySnapshot,
  subtitleFreshnessMs: number | null,
  subtitleQualityControls: SubtitleQualityControls,
): SubtitleAnomalyAlert[] {
  const anomalies = subtitleQuality.anomalies.map((item) => item.trim()).filter(Boolean)
  const alerts: SubtitleAnomalyAlert[] = []

  const latencySignals = [
    ...(subtitleFreshnessMs !== null && subtitleFreshnessMs > subtitleQualityControls.freshnessThresholdMs
      ? [`snapshot ${Math.round(subtitleFreshnessMs / 1000)}s old`]
      : []),
    ...(subtitleQuality.pendingRequestCount > 0
      ? [`${subtitleQuality.pendingRequestCount} pending request${subtitleQuality.pendingRequestCount === 1 ? "" : "s"}`]
      : []),
    ...anomalies.filter((item) => includesAny(item, ["delay", "latency", "pending", "slow", "stale", "timeout", "waiting"])),
  ]
  if (latencySignals.length > 0) {
    alerts.push({
      tier: "latency",
      label: "Latency alert",
      summary: "Captions may be late or stale.",
      signals: latencySignals,
      remediationHint: "Local-only: sample the QC snapshot a little faster or export diagnostics before changing translation settings.",
      controlAction: {
        label: "Check QC faster",
        ariaLabel: "Check Subtitle QC faster for latency alert",
        patch: {
          popupPollIntervalMs: Math.max(500, subtitleQualityControls.popupPollIntervalMs - 250),
        },
      },
    })
  }

  const jitterSignals = anomalies.filter((item) => includesAny(item, ["duplicate", "jitter", "race", "reorder", "unstable", "flicker"]))
  if (jitterSignals.length > 0) {
    alerts.push({
      tier: "jitter",
      label: "Jitter alert",
      summary: "Caption updates may be unstable.",
      signals: jitterSignals,
      remediationHint: "Local-only: slow popup QC sampling to reduce inspection noise, then export diagnostics if the signal persists.",
      controlAction: {
        label: "Sample QC slower",
        ariaLabel: "Sample Subtitle QC slower for jitter alert",
        patch: {
          popupPollIntervalMs: Math.min(30000, subtitleQualityControls.popupPollIntervalMs + 500),
        },
      },
    })
  }

  const routeText = [subtitleQuality.pipeline, subtitleQuality.source, subtitleQuality.status]
    .filter((item): item is string => Boolean(item))
    .join(" ")
  const fallbackSignals = [
    ...(includesAny(routeText, ["fallback", "dom"])
      ? [routeText]
      : []),
    ...anomalies.filter((item) => includesAny(item, ["fallback", "missing-track", "dom"])),
  ]
  if (fallbackSignals.length > 0) {
    alerts.push({
      tier: "fallback",
      label: "Fallback alert",
      summary: "A fallback subtitle route is active.",
      signals: fallbackSignals,
      remediationHint: "Local-only: widen the freshness window while fallback settles, or export diagnostics for manual review.",
      controlAction: {
        label: "Widen fresh window",
        ariaLabel: "Widen Subtitle QC freshness window for fallback alert",
        patch: {
          freshnessThresholdMs: Math.min(60000, subtitleQualityControls.freshnessThresholdMs + 5000),
        },
      },
    })
  }

  return alerts
}

export default function TranslationStatusCard({
  phase,
  targetLang,
  presentation,
  hostname,
  progress,
  lastError,
  siteEnabled,
  subtitleQuality,
  subtitleQualityControls = DEFAULT_SUBTITLE_QUALITY_CONTROLS,
  subtitleQualityTrend = [],
  onSubtitleQualityControlsChange,
  onSubtitleDiagnosticsExport,
  subtitleDiagnosticsExportStatus,
  onRetryFailed,
}: TranslationStatusCardProps) {
  const lastAutoSwitchSignatureRef = useRef<string | null>(null)
  const normalizedSubtitleQualityControls = useMemo(() => ({
    ...DEFAULT_SUBTITLE_QUALITY_CONTROLS,
    ...subtitleQualityControls,
  }), [subtitleQualityControls])
  const subtitleFreshnessMs = subtitleQuality ? Math.max(0, Date.now() - subtitleQuality.capturedAt) : null
  const subtitleFreshnessLabel = subtitleFreshnessMs === null
    ? "unknown"
    : subtitleFreshnessMs <= normalizedSubtitleQualityControls.freshnessThresholdMs
      ? "fresh"
      : `${Math.round(subtitleFreshnessMs / 1000)}s old`
  const subtitleAnomalyAlerts = subtitleQuality
    ? deriveSubtitleAnomalyAlerts(subtitleQuality, subtitleFreshnessMs, normalizedSubtitleQualityControls)
    : []
  const subtitlePreset = subtitleQuality
    ? suggestSubtitleQualityPreset(subtitleQuality, subtitleFreshnessMs, normalizedSubtitleQualityControls)
    : null
  const currentSubtitleTrendPoint = subtitleQuality
    ? {
        capturedAt: subtitleQuality.capturedAt,
        freshnessMs: subtitleFreshnessMs ?? 0,
        pendingRequestCount: subtitleQuality.pendingRequestCount,
        cacheSize: subtitleQuality.cacheSize,
      }
    : null
  const subtitleTrendPoints = subtitleQualityTrend.length > 0
    ? subtitleQualityTrend.slice(-8)
    : currentSubtitleTrendPoint
      ? [currentSubtitleTrendPoint]
      : []

  const lastAutoSwitchAt = normalizedSubtitleQualityControls.adaptivePresetLastAppliedAt ?? 0
  const autoSwitchCooldownRemainingMs = Math.max(
    0,
    normalizedSubtitleQualityControls.adaptivePresetCooldownMs - (Date.now() - lastAutoSwitchAt),
  )
  const autoSwitchEligible = Boolean(
    subtitlePreset
    && normalizedSubtitleQualityControls.adaptivePresetAutoSwitchEnabled
    && !normalizedSubtitleQualityControls.adaptivePresetManualOverrideLocked
    && autoSwitchCooldownRemainingMs === 0,
  )

  useEffect(() => {
    if (!subtitleQuality?.active || !subtitlePreset || !onSubtitleQualityControlsChange) return
    if (!normalizedSubtitleQualityControls.adaptivePresetAutoSwitchEnabled) return
    if (normalizedSubtitleQualityControls.adaptivePresetManualOverrideLocked) return

    const now = Date.now()
    const lastAppliedAt = normalizedSubtitleQualityControls.adaptivePresetLastAppliedAt ?? 0
    if (now - lastAppliedAt < normalizedSubtitleQualityControls.adaptivePresetCooldownMs) return
    if (doesPresetMatchControls(subtitlePreset, normalizedSubtitleQualityControls)) return

    const signature = `${subtitleQuality.capturedAt}:${subtitlePreset.name}:${lastAppliedAt}`
    if (lastAutoSwitchSignatureRef.current === signature) return
    lastAutoSwitchSignatureRef.current = signature

    onSubtitleQualityControlsChange(buildSubtitlePresetPatch(subtitlePreset, "auto", now))
  }, [
    normalizedSubtitleQualityControls,
    onSubtitleQualityControlsChange,
    subtitlePreset,
    subtitleQuality?.active,
    subtitleQuality?.capturedAt,
  ])

  const handleSubtitleControlChange = (field: SubtitleQualityNumericControlField) => (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = Number.parseInt(event.currentTarget.value, 10)
    if (!Number.isFinite(value)) return
    onSubtitleQualityControlsChange?.({
      [field]: value,
      ...(field === "adaptivePresetCooldownMs"
        ? {}
        : { adaptivePresetManualOverrideLocked: true }),
    })
  }

  const handleSubtitleAutoSwitchToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const enabled = event.currentTarget.checked
    onSubtitleQualityControlsChange?.({
      adaptivePresetAutoSwitchEnabled: enabled,
      ...(enabled ? { adaptivePresetManualOverrideLocked: false } : {}),
    })
  }

  const handleSubtitleManualLockToggle = (event: ChangeEvent<HTMLInputElement>) => {
    onSubtitleQualityControlsChange?.({
      adaptivePresetManualOverrideLocked: event.currentTarget.checked,
    })
  }

  const handleSubtitleAlertControlAction = (alert: SubtitleAnomalyAlert) => {
    onSubtitleQualityControlsChange?.({
      ...alert.controlAction.patch,
      adaptivePresetManualOverrideLocked: true,
    })
  }

  const handleSubtitlePresetApply = () => {
    if (!subtitlePreset) return
    onSubtitleQualityControlsChange?.(buildSubtitlePresetPatch(subtitlePreset, "manual"))
  }

  const alertActionButtonStyle = {
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 700,
    border: "1px solid currentColor",
    borderRadius: 6,
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
  }

  return (
    <div style={statusCardStyle} aria-live="polite">
      <div style={statusRowStyle}>
        <span>{t("status_status")}</span>
        <strong>{phase}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>{t("status_targetLang")}</span>
        <strong>{targetLang}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>{t("status_modeTheme")}</span>
        <strong>{presentation.mode} / {presentation.theme}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>{t("status_site")}</span>
        <strong>{hostname ?? t("status_currentPage")}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>{t("status_progress")}</span>
        <strong>
          {progress
            ? `${progress.translatedBlocks}/${progress.totalBlocks}`
            : "0/0"}
        </strong>
      </div>
      {progress && phase !== "idle" && (
        <div style={{ fontSize: 12, color: "var(--astra-text-muted)", marginTop: 6 }}>
          queued {progress.queuedBlocks} · in-flight {progress.inFlightBlocks} · failed {progress.failedBlocks}
        </div>
      )}
      {subtitleQuality?.active && (
        <div
          data-testid="subtitle-qc-panel"
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--astra-border)",
            fontSize: 12,
            color: "var(--astra-text-muted)",
          }}
        >
          <div style={statusRowStyle}>
            <span>Subtitle QC</span>
            <strong>{subtitleQuality.surface} · {subtitleQuality.platform ?? "unknown"}</strong>
          </div>
          <div style={statusRowStyle}>
            <span>Pipeline</span>
            <strong>{subtitleQuality.pipeline ?? "observing"} / {subtitleQuality.source ?? "unknown"}</strong>
          </div>
          <div style={statusRowStyle}>
            <span>Status</span>
            <strong>{subtitleQuality.status} · {subtitleFreshnessLabel}</strong>
          </div>
          <div style={{ marginTop: 6 }}>
            overlays {subtitleQuality.translatedNodeCount} · source chars {subtitleQuality.sourceTextLength} · pending {subtitleQuality.pendingRequestCount} · cache {subtitleQuality.cacheSize}
          </div>
          {subtitleTrendPoints.length > 0 && (
            <div data-testid="subtitle-qc-trends" style={{ marginTop: 8, display: "grid", gap: 4 }}>
              {([
                ["freshness", "freshnessMs"],
                ["pending", "pendingRequestCount"],
                ["cache", "cacheSize"],
              ] as const).map(([label, kind]) => {
                const latest = subtitleTrendPoints[subtitleTrendPoints.length - 1]?.[kind] ?? 0
                return (
                  <div key={kind} data-testid={`subtitle-qc-trend-${label}`} style={statusRowStyle}>
                    <span>{label} trend</span>
                    <strong aria-label={`Subtitle QC ${label} trend`}>
                      {buildTrendSparkline(subtitleTrendPoints, kind)} · {formatTrendValue(kind, latest)}
                    </strong>
                  </div>
                )
              })}
            </div>
          )}
          {subtitlePreset && (
            <div
              data-testid="subtitle-qc-preset-suggestion"
              style={{
                marginTop: 8,
                padding: 8,
                border: "1px solid var(--astra-border)",
                borderRadius: 8,
                background: "var(--astra-bg-primary)",
              }}
            >
              <div style={statusRowStyle}>
                <span>Suggested local preset</span>
                <strong>{subtitlePreset.name}</strong>
              </div>
              <div style={{ marginTop: 4 }}>{subtitlePreset.summary}</div>
              <div data-testid="subtitle-qc-auto-switch-status" style={{ marginTop: 4 }}>
                Auto-switch {normalizedSubtitleQualityControls.adaptivePresetAutoSwitchEnabled ? "on" : "off"}
                {" · current "}
                {normalizedSubtitleQualityControls.adaptivePresetName}
                {" · cooldown "}
                {formatCooldownLabel(normalizedSubtitleQualityControls.adaptivePresetCooldownMs)}
                {normalizedSubtitleQualityControls.adaptivePresetManualOverrideLocked ? " · manual lock active" : ""}
                {autoSwitchEligible ? " · ready to apply locally" : ""}
              </div>
              {onSubtitleQualityControlsChange && (
                <button
                  type="button"
                  data-testid="subtitle-qc-preset-apply"
                  aria-label={`Apply ${subtitlePreset.label}`}
                  onClick={handleSubtitlePresetApply}
                  style={{ ...alertActionButtonStyle, marginTop: 6, color: "var(--astra-info)" }}
                >
                  Apply {subtitlePreset.label}
                </button>
              )}
            </div>
          )}
          <div
            data-testid="subtitle-qc-controls"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 8,
            }}
          >
            <label htmlFor="subtitle-qc-poll-interval-ms" style={{ display: "grid", gap: 3 }}>
              <span>Poll interval (ms)</span>
              <input
                id="subtitle-qc-poll-interval-ms"
                aria-label="Subtitle QC poll interval"
                type="number"
                min={500}
                max={30000}
                step={250}
                value={subtitleQualityControls.popupPollIntervalMs}
                onChange={handleSubtitleControlChange("popupPollIntervalMs")}
                style={{ width: "100%" }}
              />
            </label>
            <label htmlFor="subtitle-qc-freshness-threshold-ms" style={{ display: "grid", gap: 3 }}>
              <span>Fresh threshold (ms)</span>
              <input
                id="subtitle-qc-freshness-threshold-ms"
                aria-label="Subtitle QC freshness threshold"
                type="number"
                min={1000}
                max={60000}
                step={500}
                value={subtitleQualityControls.freshnessThresholdMs}
                onChange={handleSubtitleControlChange("freshnessThresholdMs")}
                style={{ width: "100%" }}
              />
            </label>
            <label htmlFor="subtitle-qc-adaptive-auto-switch" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                id="subtitle-qc-adaptive-auto-switch"
                data-testid="subtitle-qc-auto-switch-toggle"
                aria-label="Enable Subtitle QC adaptive preset auto-switch"
                type="checkbox"
                checked={normalizedSubtitleQualityControls.adaptivePresetAutoSwitchEnabled}
                onChange={handleSubtitleAutoSwitchToggle}
              />
              <span>Auto-switch presets</span>
            </label>
            <label htmlFor="subtitle-qc-manual-override-lock" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                id="subtitle-qc-manual-override-lock"
                data-testid="subtitle-qc-manual-lock-toggle"
                aria-label="Lock Subtitle QC manual override"
                type="checkbox"
                checked={normalizedSubtitleQualityControls.adaptivePresetManualOverrideLocked}
                onChange={handleSubtitleManualLockToggle}
              />
              <span>Manual override lock</span>
            </label>
            <label htmlFor="subtitle-qc-adaptive-cooldown-ms" style={{ display: "grid", gap: 3 }}>
              <span>Auto cooldown (ms)</span>
              <input
                id="subtitle-qc-adaptive-cooldown-ms"
                aria-label="Subtitle QC adaptive preset cooldown"
                type="number"
                min={5000}
                max={300000}
                step={5000}
                value={normalizedSubtitleQualityControls.adaptivePresetCooldownMs}
                onChange={handleSubtitleControlChange("adaptivePresetCooldownMs")}
                style={{ width: "100%" }}
              />
            </label>
          </div>
          {subtitleQuality.anomalies.length > 0 && (
            <div style={warningStyle}>Anomalies: {subtitleQuality.anomalies.join(", ")}</div>
          )}
          {subtitleAnomalyAlerts.length > 0 && (
            <div data-testid="subtitle-qc-anomaly-tiers" style={{ marginTop: 8, display: "grid", gap: 6 }}>
              {subtitleAnomalyAlerts.map((alert) => (
                <div
                  key={alert.tier}
                  data-testid={`subtitle-qc-alert-${alert.tier}`}
                  style={{
                    ...warningStyle,
                    marginTop: 0,
                    background: alert.tier === "fallback" ? "var(--astra-info-bg)" : warningStyle.background,
                    borderColor: alert.tier === "fallback" ? "var(--astra-info-border)" : warningStyle.borderColor,
                    color: alert.tier === "fallback" ? "var(--astra-info)" : warningStyle.color,
                  }}
                >
                  <strong>{alert.label}</strong>: {alert.summary} Signals: {alert.signals.join(", ")}
                  <div style={{ marginTop: 4 }}>Remediation: {alert.remediationHint}</div>
                  {(onSubtitleQualityControlsChange || onSubtitleDiagnosticsExport) && (
                    <div
                      data-testid={`subtitle-qc-alert-${alert.tier}-actions`}
                      style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}
                    >
                      {onSubtitleQualityControlsChange && (
                        <button
                          type="button"
                          data-testid={`subtitle-qc-action-${alert.tier}-control`}
                          aria-label={alert.controlAction.ariaLabel}
                          onClick={() => handleSubtitleAlertControlAction(alert)}
                          style={alertActionButtonStyle}
                        >
                          {alert.controlAction.label}
                        </button>
                      )}
                      {onSubtitleDiagnosticsExport && (
                        <button
                          type="button"
                          data-testid={`subtitle-qc-action-${alert.tier}-export`}
                          aria-label={`Export local diagnostics for ${alert.label}`}
                          onClick={onSubtitleDiagnosticsExport}
                          style={alertActionButtonStyle}
                        >
                          Export diagnostics
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {onSubtitleDiagnosticsExport && (
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                data-testid="subtitle-qc-export-diagnostics"
                onClick={onSubtitleDiagnosticsExport}
                className="astra-btn-secondary"
                style={{ width: "100%", padding: "6px 8px", fontSize: 12, fontWeight: 700 }}
              >
                Export local diagnostics JSON
              </button>
              {subtitleDiagnosticsExportStatus && (
                <div role="status" aria-live="polite" style={{ fontSize: 11, color: "var(--astra-text-secondary)", marginTop: 4 }}>
                  {subtitleDiagnosticsExportStatus}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {progress && progress.failedBlocks > 0 && onRetryFailed && (
        <button
          type="button"
          onClick={onRetryFailed}
          className="astra-cursor-pointer"
          style={{
            marginTop: 8,
            padding: "4px 10px",
            fontSize: 12,
            background: "var(--astra-warning)",
            color: "var(--astra-text-on-brand)",
            border: "none",
            borderRadius: 4,
          }}
        >
          Retry {progress.failedBlocks} failed block{progress.failedBlocks === 1 ? "" : "s"}
        </button>
      )}
      {lastError && (
        <div role="status" aria-live="assertive" style={warningStyle}>{lastError.message}</div>
      )}
      {!siteEnabled && (
        <div role="status" aria-live="polite" style={warningStyle}>{t("status_siteDisabled")}</div>
      )}
    </div>
  )
}
