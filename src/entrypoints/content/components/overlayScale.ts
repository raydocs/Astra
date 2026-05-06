import type React from "react"
import style1TokenCss from "@/assets/astra-style1-tokens.css?raw"

const DEFAULT_OVERLAY_FONT_SCALE = 0.92
const MIN_OVERLAY_FONT_SCALE = 0.5
const MAX_OVERLAY_FONT_SCALE = 2

export const OVERLAY_FONT_FAMILY =
  '"Inter Tight", "Söhne", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif'
export const OVERLAY_FONT_FAMILY_SERIF =
  '"Source Serif 4", "Source Serif Pro", "Tiempos Text", "Songti SC", "Noto Serif SC", Georgia, serif'
export const OVERLAY_FONT_FAMILY_MONO =
  '"JetBrains Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'

export const OVERLAY_STYLE_TOKENS = {
  brand: "var(--astra-style-accent-primary, Highlight)",
  brandHover: "var(--astra-style-accent-primary-hover, Highlight)",
  brandActive: "var(--astra-style-accent-primary-active, Highlight)",
  brandMuted: "var(--astra-style-accent-muted, color-mix(in srgb, Highlight 8%, transparent))",
  brandMutedStrong: "color-mix(in srgb, var(--astra-style-accent-primary, Highlight) 14%, transparent)",
  brandBorder: "var(--astra-style-accent-border, color-mix(in srgb, Highlight 25%, transparent))",
  brandBorderStrong: "color-mix(in srgb, var(--astra-style-accent-primary, Highlight) 34%, transparent)",
  accent: "var(--astra-style-accent, Highlight)",
  accentHover: "var(--astra-style-accent-hover, Highlight)",
  accentSoft: "var(--astra-style-accent-soft, color-mix(in srgb, Highlight 8%, transparent))",
  accentLine: "var(--astra-style-accent-line, color-mix(in srgb, Highlight 22%, transparent))",
  hl: "var(--astra-style-hl, Highlight)",
  hlSoft: "var(--astra-style-hl-soft, color-mix(in srgb, Highlight 10%, transparent))",
  surface: "var(--astra-style-bg-surface, Canvas)",
  surfaceElevated: "var(--astra-style-bg-elevated, Canvas)",
  surfaceSubtle: "var(--astra-style-bg-subtle, Field)",
  bgPage: "var(--astra-style-bg-page, Canvas)",
  bgSunken: "var(--astra-style-bg-sunken, Field)",
  bgHover: "var(--astra-style-bg-hover, Field)",
  ink1: "var(--astra-style-ink-1, CanvasText)",
  ink2: "var(--astra-style-ink-2, color-mix(in srgb, CanvasText 72%, transparent))",
  ink3: "var(--astra-style-ink-3, color-mix(in srgb, CanvasText 56%, transparent))",
  ink4: "var(--astra-style-ink-4, GrayText)",
  line1: "var(--astra-style-line-1, ButtonBorder)",
  line2: "var(--astra-style-line-2, color-mix(in srgb, ButtonBorder 72%, CanvasText))",
  textPrimary: "var(--astra-style-text-primary, CanvasText)",
  textSecondary: "var(--astra-style-text-secondary, color-mix(in srgb, CanvasText 72%, transparent))",
  textMuted: "var(--astra-style-text-muted, color-mix(in srgb, CanvasText 56%, transparent))",
  textHint: "var(--astra-style-text-hint, GrayText)",
  textInverse: "var(--astra-style-text-inverse, HighlightText)",
  borderSubtle: "var(--astra-style-border-subtle, ButtonBorder)",
  borderStrong: "var(--astra-style-border-strong, color-mix(in srgb, ButtonBorder 72%, CanvasText))",
  shadowLg: "var(--astra-style-shadow-lg, 0 8px 24px color-mix(in srgb, CanvasText 10%, transparent))",
  focusRing: "var(--astra-style-focus-ring, 0 0 0 3px color-mix(in srgb, Highlight 30%, transparent))",
  success: "var(--astra-style-success, LinkText)",
  successBg: "var(--astra-style-success-bg, color-mix(in srgb, LinkText 12%, Canvas))",
  successBorder: "var(--astra-style-success-border, color-mix(in srgb, LinkText 30%, transparent))",
  info: "var(--astra-style-info, LinkText)",
  infoBg: "var(--astra-style-info-bg, color-mix(in srgb, LinkText 10%, Canvas))",
  infoBorder: "var(--astra-style-info-border, color-mix(in srgb, LinkText 30%, transparent))",
  warning: "var(--astra-style-warning, MarkText)",
  warningBg: "var(--astra-style-warning-bg, Mark)",
  warningBorder: "var(--astra-style-warning-border, color-mix(in srgb, MarkText 34%, transparent))",
  danger: "var(--astra-style-danger, MarkText)",
  tooltipBg: "color-mix(in srgb, var(--astra-style-text-primary, CanvasText) 86%, transparent)",
  ok: "var(--astra-style-ok, LinkText)",
  warn: "var(--astra-style-warn, MarkText)",
} as const

const OVERLAY_STYLE1_TOKEN_CSS = style1TokenCss
  .replace(
    ":root,\n[data-astra-theme=\"light\"],\n[data-astra=\"quiet\"]",
    ":host,\n:host([data-astra-theme=\"light\"]),\n:host([data-astra=\"quiet\"])",
  )
  .replace(
    "[data-astra-theme=\"dark\"],\n[data-astra=\"twilight\"]",
    ":host([data-astra-theme=\"dark\"]),\n:host([data-astra=\"twilight\"])",
  )

export function createOverlayStyle1TokenStyleElement(): HTMLStyleElement {
  const style = document.createElement("style")
  style.textContent = OVERLAY_STYLE1_TOKEN_CSS
  return style
}

export function resolveOverlayFontScale(fontScale?: number | null): number {
  if (typeof fontScale !== "number" || Number.isNaN(fontScale)) {
    return DEFAULT_OVERLAY_FONT_SCALE
  }

  return Math.min(MAX_OVERLAY_FONT_SCALE, Math.max(MIN_OVERLAY_FONT_SCALE, fontScale))
}

function formatScaledValue(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`
}

export function overlayPx(basePx: number, fontScale?: number | null): string {
  const resolved = resolveOverlayFontScale(fontScale)
  return `${formatScaledValue(basePx * resolved)}px`
}

export function overlayRem(basePx: number, fontScale?: number | null): string {
  const resolved = resolveOverlayFontScale(fontScale)
  return `${formatScaledValue((basePx * resolved) / 16)}rem`
}

export function createOverlayCardStyle(fontScale?: number | null): React.CSSProperties {
  return {
    fontFamily: OVERLAY_FONT_FAMILY,
    borderRadius: overlayPx(12, fontScale),
    border: `1px solid ${OVERLAY_STYLE_TOKENS.line1}`,
    boxShadow: OVERLAY_STYLE_TOKENS.shadowLg,
    background: OVERLAY_STYLE_TOKENS.surfaceElevated,
  }
}
