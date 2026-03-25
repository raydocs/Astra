import type { TranslationProgressSnapshot, TranslationError } from "@/types/translation"
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
        <span>状态</span>
        <strong>{phase}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>目标语言</span>
        <strong>{targetLang}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>模式 / 主题</span>
        <strong>{presentation.mode} / {presentation.theme}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>站点</span>
        <strong>{hostname ?? "当前页面"}</strong>
      </div>
      <div style={statusRowStyle}>
        <span>进度</span>
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
        <div style={warningStyle}>Astra 已在此站点禁用。</div>
      )}
    </div>
  )
}
