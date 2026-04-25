interface AstraIdentityStripProps {
  targetLang?: string | null
}

const TARGET_LANG_LABELS: Record<string, string> = {
  "zh-cn": "中文",
  "zh-tw": "繁體中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  fr: "Français",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  "pt-br": "Português",
}

function getTargetLangLabel(targetLang: string): string {
  return TARGET_LANG_LABELS[targetLang.toLowerCase()] ?? targetLang
}

const styles = {
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 22,
  } as React.CSSProperties,
  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#4338ca",
    letterSpacing: "0.01em",
    lineHeight: 1,
  } as React.CSSProperties,
  langPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    background: "rgba(99, 102, 241, 0.12)",
    color: "#4338ca",
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1,
    padding: "4px 8px",
  } as React.CSSProperties,
}

export function AstraIdentityStrip({ targetLang }: AstraIdentityStripProps) {
  return (
    <div style={styles.root} data-testid="astra-identity-strip">
      <div style={styles.brand}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" data-testid="astra-identity-strip-star">
          <path
            d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
            fill="#6366f1"
          />
        </svg>
        <span>Astra</span>
      </div>
      {targetLang ? (
        <span style={styles.langPill} data-testid="astra-identity-strip-target-lang">{getTargetLangLabel(targetLang)}</span>
      ) : null}
    </div>
  )
}
