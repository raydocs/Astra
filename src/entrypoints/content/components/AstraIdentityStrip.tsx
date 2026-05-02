import { OVERLAY_FONT_FAMILY, OVERLAY_STYLE_TOKENS, overlayPx, resolveOverlayFontScale } from "./overlayScale"

interface AstraIdentityStripProps {
  targetLang?: string | null
  fontScale?: number | null
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

function createStyles(fontScale?: number | null) {
  const scale = resolveOverlayFontScale(fontScale)

  return {
    root: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: overlayPx(8, scale),
      minHeight: overlayPx(24, scale),
      borderRadius: overlayPx(10, scale),
      border: `1px solid ${OVERLAY_STYLE_TOKENS.brandBorder}`,
      background: OVERLAY_STYLE_TOKENS.surfaceElevated,
      boxShadow: `inset 0 0 0 999px ${OVERLAY_STYLE_TOKENS.brandMuted}`,
      padding: `${overlayPx(4, scale)} ${overlayPx(8, scale)}`,
      fontFamily: OVERLAY_FONT_FAMILY,
    } as React.CSSProperties,
    brand: {
      display: "inline-flex",
      alignItems: "center",
      gap: overlayPx(6, scale),
      fontSize: overlayPx(12, scale),
      fontWeight: 700,
      color: OVERLAY_STYLE_TOKENS.brandActive,
      letterSpacing: "0.01em",
      lineHeight: 1,
    } as React.CSSProperties,
    langPill: {
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      background: OVERLAY_STYLE_TOKENS.brandMutedStrong,
      color: OVERLAY_STYLE_TOKENS.brandActive,
      fontSize: overlayPx(11, scale),
      fontWeight: 700,
      lineHeight: 1,
      padding: `${overlayPx(4, scale)} ${overlayPx(8, scale)}`,
      border: `1px solid ${OVERLAY_STYLE_TOKENS.brandBorder}`,
      whiteSpace: "nowrap",
      maxWidth: "55%",
      overflow: "hidden",
      textOverflow: "ellipsis",
    } as React.CSSProperties,
  }
}

export function AstraIdentityStrip({ targetLang, fontScale }: AstraIdentityStripProps) {
  const styles = createStyles(fontScale)
  return (
    <div style={styles.root} data-testid="astra-identity-strip">
      <div style={styles.brand}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" data-testid="astra-identity-strip-star">
          <path
            d="M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z"
            fill={OVERLAY_STYLE_TOKENS.brand}
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
