import { useId, type ButtonHTMLAttributes, type ComponentPropsWithoutRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react"

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

export type AstraButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger"
export type AstraButtonSize = "sm" | "md" | "lg"

export interface AstraButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AstraButtonVariant
  size?: AstraButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
}

export function AstraButton({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  className,
  children,
  type = "button",
  ...props
}: AstraButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cx("astra-ui-button", `astra-ui-button--${variant}`, `astra-ui-button--${size}`, className)}
    >
      {icon ? <span className="astra-ui-button__icon">{icon}</span> : null}
      {children ? <span className="astra-ui-button__label">{children}</span> : null}
      {iconRight ? <span className="astra-ui-button__icon astra-ui-button__icon--right">{iconRight}</span> : null}
    </button>
  )
}

export interface AstraCardProps extends ComponentPropsWithoutRef<"div"> {
  elevated?: boolean
  interactive?: boolean
  padded?: boolean
}

export function AstraCard({ elevated = false, interactive = false, padded = true, className, ...props }: AstraCardProps) {
  return (
    <div
      {...props}
      className={cx(
        "astra-ui-card",
        elevated && "astra-ui-card--elevated",
        interactive && "astra-ui-card--interactive",
        !padded && "astra-ui-card--flush",
        className,
      )}
    />
  )
}

export type AstraPillTone = "default" | "accent" | "success" | "warning" | "danger" | "muted"

export interface AstraPillProps extends ComponentPropsWithoutRef<"span"> {
  tone?: AstraPillTone
}

export function AstraPill({ tone = "default", className, ...props }: AstraPillProps) {
  return <span {...props} className={cx("astra-ui-pill", `astra-ui-pill--${tone}`, className)} />
}

export interface AstraStatusPillProps extends AstraPillProps {
  live?: "off" | "polite" | "assertive"
}

export function AstraStatusPill({ live = "off", role, ...props }: AstraStatusPillProps) {
  return <AstraPill {...props} role={role ?? (live === "off" ? undefined : "status")} aria-live={live === "off" ? undefined : live} />
}

export interface AstraToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> {
  pressed: boolean
  label?: ReactNode
}

export function AstraToggle({ pressed, label, className, type = "button", children, ...props }: AstraToggleProps) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={pressed}
      data-pressed={pressed ? "true" : "false"}
      className={cx("astra-ui-toggle", className)}
    >
      <span className="astra-ui-toggle__track" aria-hidden="true">
        <span className="astra-ui-toggle__thumb" />
      </span>
      {label ?? children ? <span className="astra-ui-toggle__label">{label ?? children}</span> : null}
    </button>
  )
}

export interface AstraSegmentedOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface AstraSegmentedControlProps extends Omit<ComponentPropsWithoutRef<"div">, "onChange"> {
  options: readonly AstraSegmentedOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}

export function AstraSegmentedControl({ options, value, onChange, ariaLabel, className, ...props }: AstraSegmentedControlProps) {
  return (
    <div {...props} role="group" aria-label={ariaLabel} className={cx("astra-ui-segmented", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="astra-ui-segmented__option"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export interface AstraTextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  inputClassName?: string
}

export function AstraTextField({ label, hint, error, id, inputClassName, className, ...props }: AstraTextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const describedBy = [props["aria-describedby"], hintId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <div className={cx("astra-ui-field", className)}>
      {label ? <label className="astra-ui-field__label" htmlFor={inputId}>{label}</label> : null}
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        className={cx("astra-ui-input", inputClassName)}
      />
      {hint ? <span id={hintId} className="astra-ui-field__hint">{hint}</span> : null}
      {error ? <span id={errorId} className="astra-ui-field__error">{error}</span> : null}
    </div>
  )
}

export interface AstraSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  hint?: ReactNode
  selectClassName?: string
}

export function AstraSelect({ label, hint, id, selectClassName, className, children, ...props }: AstraSelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId
  const hintId = hint ? `${selectId}-hint` : undefined
  const describedBy = [props["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined

  return (
    <div className={cx("astra-ui-field", className)}>
      {label ? <label className="astra-ui-field__label" htmlFor={selectId}>{label}</label> : null}
      <select {...props} id={selectId} aria-describedby={describedBy} className={cx("astra-ui-input", "astra-ui-select", selectClassName)}>
        {children}
      </select>
      {hint ? <span id={hintId} className="astra-ui-field__hint">{hint}</span> : null}
    </div>
  )
}

export interface AstraProgressProps extends Omit<ComponentPropsWithoutRef<"div">, "aria-label" | "aria-describedby"> {
  value: number
  max?: number
  label?: ReactNode
  progressLabel?: string
  progressDescribedBy?: string
}

export function AstraProgress({ value, max = 100, label, progressLabel, progressDescribedBy, className, ...props }: AstraProgressProps) {
  const generatedId = useId()
  const labelId = label ? `${generatedId}-label` : undefined
  const boundedValue = Math.min(Math.max(value, 0), max)
  const percent = max > 0 ? (boundedValue / max) * 100 : 0

  return (
    <div {...props} className={cx("astra-ui-progress", className)}>
      {label ? <div id={labelId} className="astra-ui-progress__label">{label}</div> : null}
      <div
        className="astra-ui-progress__track"
        role="progressbar"
        aria-label={label ? undefined : progressLabel}
        aria-labelledby={labelId}
        aria-describedby={progressDescribedBy}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={boundedValue}
      >
        <span className="astra-ui-progress__bar" style={{ inlineSize: `${percent}%` }} />
      </div>
    </div>
  )
}

export interface AstraEmptyStateProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  eyebrow?: ReactNode
  title: ReactNode
  action?: ReactNode
}

export function AstraEmptyState({ eyebrow, title, action, className, children, ...props }: AstraEmptyStateProps) {
  return (
    <section {...props} className={cx("astra-ui-empty", className)}>
      {eyebrow ? <p className="astra-ui-empty__eyebrow">{eyebrow}</p> : null}
      <h2 className="astra-ui-empty__title">{title}</h2>
      {children ? <div className="astra-ui-empty__copy">{children}</div> : null}
      {action ? <div className="astra-ui-empty__action">{action}</div> : null}
    </section>
  )
}

export interface AstraSectionHeadingProps extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  eyebrow?: ReactNode
  title: ReactNode
  action?: ReactNode
}

export function AstraSectionHeading({ eyebrow, title, action, className, children, ...props }: AstraSectionHeadingProps) {
  return (
    <div {...props} className={cx("astra-ui-section-heading", className)}>
      <div>
        {eyebrow ? <p className="astra-ui-section-heading__eyebrow">{eyebrow}</p> : null}
        <h2 className="astra-ui-section-heading__title">{title}</h2>
        {children ? <div className="astra-ui-section-heading__copy">{children}</div> : null}
      </div>
      {action ? <div className="astra-ui-section-heading__action">{action}</div> : null}
    </div>
  )
}
