import type { ReactNode } from "react"
import { useAstraTheme } from "@/utils/ui/useAstraTheme"

export type PopupStatusTone = "ready" | "warning" | "muted"

export function PopupShell({ children, className }: { children: ReactNode; className?: string }) {
  const { astraTheme, astraDirection } = useAstraTheme()
  return (
    <div
      className={["astra-quiet-shell astra-popup-shell", className].filter(Boolean).join(" ")}
      data-astra={astraDirection}
      data-astra-theme={astraTheme}
    >
      {children}
    </div>
  )
}

export function PopupHeader({
  title,
  subtitle,
  statusLabel,
  statusTone = "muted",
  onOpenSettings,
  onOpenLibrary,
  libraryAriaLabel = "Library",
  settingsAriaLabel = "Settings",
}: {
  title: string
  subtitle?: string
  statusLabel?: string
  statusTone?: PopupStatusTone
  onOpenSettings: () => void
  /** Design: list icon — opens Library / vocabulary */
  onOpenLibrary?: () => void
  libraryAriaLabel?: string
  settingsAriaLabel?: string
}) {
  return (
    <header className="astra-quiet-header">
      <div className="astra-quiet-header__copy">
        <div className="astra-quiet-wordmark">
          <svg
            className="astra-quiet-wordmark__mark"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 4l1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4L12 4z" />
            <circle cx="19" cy="5" r="0.6" fill="currentColor" />
            <circle cx="5" cy="18" r="0.6" fill="currentColor" />
            <circle cx="20" cy="17" r="0.4" fill="currentColor" />
          </svg>
          <span>{title}</span>
        </div>
        {subtitle && <div className="astra-quiet-header__subtitle">{subtitle}</div>}
        {statusLabel && (
          <div className="astra-quiet-header__status">
            <span className="astra-status-dot" data-tone={statusTone} aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
        )}
      </div>
      <div className="astra-quiet-header__toolbar">
        {onOpenLibrary && (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="astra-popup-toolbar-btn"
            title={libraryAriaLabel}
            aria-label={libraryAriaLabel}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="astra-popup-toolbar-btn"
          title={settingsAriaLabel}
          aria-label={settingsAriaLabel}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  )
}

/** Quiet Reader toggle — ink track when on (matches design canvas). */
export function PopupToggle({
  pressed,
  onPressedChange,
  disabled = false,
  ariaLabel,
}: {
  pressed: boolean
  onPressedChange: (next: boolean) => void
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      className="astra-popup-toggle"
      data-pressed={pressed ? "true" : "false"}
      onClick={() => onPressedChange(!pressed)}
    >
      <span className="astra-popup-toggle__thumb" aria-hidden="true" />
    </button>
  )
}

export function PopupGroupCard({
  eyebrow,
  children,
  className,
}: {
  eyebrow?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={["astra-popup-group", className].filter(Boolean).join(" ")}>
      {eyebrow && <div className="astra-quiet-eyebrow">{eyebrow}</div>}
      <div className="astra-group-card">{children}</div>
    </section>
  )
}

export function PopupSettingRow({
  icon,
  title,
  subtitle,
  accessory,
  onClick,
  disabled = false,
  last = false,
  testId,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string
  accessory?: ReactNode
  onClick?: () => void
  disabled?: boolean
  last?: boolean
  testId?: string
}) {
  const content = (
    <>
      {icon && <span className="astra-setting-row__icon" aria-hidden="true">{icon}</span>}
      <span className="astra-setting-row__body">
        <span className="astra-setting-row__title">{title}</span>
        {subtitle && <span className="astra-setting-row__subtitle">{subtitle}</span>}
      </span>
      {accessory && <span className="astra-setting-row__accessory">{accessory}</span>}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className="astra-setting-row astra-setting-row--button"
        data-last={last ? "true" : undefined}
        data-testid={testId}
        onClick={onClick}
        disabled={disabled}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="astra-setting-row" data-last={last ? "true" : undefined} data-testid={testId}>
      {content}
    </div>
  )
}

export function PopupSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div className="astra-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="astra-segmented__option"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function PopupMetricCard({
  label,
  value,
  hint,
  valueColor,
}: {
  label: string
  value: string | number
  hint?: string
  valueColor?: string
}) {
  return (
    <div className="astra-metric-card">
      <div className="astra-metric-card__label">{label}</div>
      <div className="astra-metric-card__value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      {hint && <div className="astra-metric-card__hint">{hint}</div>}
    </div>
  )
}
