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
}

export default function TranslationStatusCard({
  phase,
  targetLang,
  presentation,
  hostname,
  progress,
  lastError,
  siteEnabled,
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
      {lastError && (
        <div style={warningStyle}>{lastError.message}</div>
      )}
      {!siteEnabled && (
        <div style={warningStyle}>{t("status_siteDisabled")}</div>
      )}
    </div>
  )
}
