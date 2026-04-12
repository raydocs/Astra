import type { TranslationProgressSnapshot, TranslationError } from "@/types/translation"
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
  onRetryFailed?: () => void
}

export default function TranslationStatusCard({
  phase,
  targetLang,
  presentation,
  hostname,
  progress,
  lastError,
  siteEnabled,
  onRetryFailed,
}: TranslationStatusCardProps) {
  return (
    <div style={statusCardStyle}>
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
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
          queued {progress.queuedBlocks} · in-flight {progress.inFlightBlocks} · failed {progress.failedBlocks}
        </div>
      )}
      {progress && progress.failedBlocks > 0 && onRetryFailed && (
        <button
          type="button"
          onClick={onRetryFailed}
          style={{
            marginTop: 8,
            padding: "4px 10px",
            fontSize: 12,
            background: "#f59e0b",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Retry {progress.failedBlocks} failed block{progress.failedBlocks === 1 ? "" : "s"}
        </button>
      )}
      {lastError && (
        <div style={warningStyle}>{lastError.message}</div>
      )}
      {!siteEnabled && (
        <div style={warningStyle}>{t("status_siteDisabled")}</div>
      )}
    </div>
  )
}
