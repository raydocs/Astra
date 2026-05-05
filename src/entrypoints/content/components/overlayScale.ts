import type React from "react"
import style1TokenCss from "@/assets/astra-style1-tokens.css?raw"

const DEFAULT_OVERLAY_FONT_SCALE = 0.92
const MIN_OVERLAY_FONT_SCALE = 0.5
const MAX_OVERLAY_FONT_SCALE = 2

export const OVERLAY_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

export const OVERLAY_STYLE_TOKENS = {
  brand: "var(--astra-style-accent-primary, Highlight)",
  brandHover: "var(--astra-style-accent-primary-hover, Highlight)",
  brandActive: "var(--astra-style-accent-primary-active, Highlight)",
  brandMuted: "var(--astra-style-accent-muted, color-mix(in srgb, Highlight 8%, transparent))",
  brandMutedStrong: "color-mix(in srgb, var(--astra-style-accent-primary, Highlight) 14%, transparent)",
  brandBorder: "var(--astra-style-accent-border, color-mix(in srgb, Highlight 25%, transparent))",
  brandBorderStrong: "color-mix(in srgb, var(--astra-style-accent-primary, Highlight) 34%, transparent)",
  surface: "var(--astra-style-bg-surface, Canvas)",
  surfaceElevated: "var(--astra-style-bg-elevated, Canvas)",
  surfaceSubtle: "var(--astra-style-bg-subtle, Field)",
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
} as const

const OVERLAY_STYLE1_TOKEN_CSS = style1TokenCss
  .replace(":root,\n[data-astra-theme=\"light\"]", ":host,\n:host([data-astra-theme=\"light\"])")
  .replace("[data-astra-theme=\"dark\"]", ":host([data-astra-theme=\"dark\"])")

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
    border: `1px solid ${OVERLAY_STYLE_TOKENS.brandBorder}`,
    boxShadow: OVERLAY_STYLE_TOKENS.shadowLg,
    background: OVERLAY_STYLE_TOKENS.surface,
  }
}
