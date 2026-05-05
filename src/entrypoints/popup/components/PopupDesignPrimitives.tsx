import type { ReactNode } from "react"

export type PopupStatusTone = "ready" | "warning" | "muted"

export function PopupShell({ children }: { children: ReactNode }) {
  return (
    <div className="astra-quiet-shell astra-popup-shell" data-astra="quiet">
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
}: {
  title: string
  subtitle?: string
  statusLabel?: string
  statusTone?: PopupStatusTone
  onOpenSettings: () => void
}) {
  return (
    <header className="astra-quiet-header">
      <div className="astra-quiet-header__copy">
        <div className="astra-quiet-wordmark">{title}</div>
        {subtitle && <div className="astra-quiet-header__subtitle">{subtitle}</div>}
        {statusLabel && (
          <div className="astra-quiet-header__status">
            <span className="astra-status-dot" data-tone={statusTone} aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onOpenSettings}
        className="astra-popup-icon-btn astra-quiet-header__settings"
        title="Settings"
        aria-label="Settings"
      >
        Settings
      </button>
    </header>
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
