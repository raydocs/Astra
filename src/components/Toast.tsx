import type { HTMLAttributes, ReactNode } from "react"

export type ToastVariant = "info" | "success" | "warning" | "error"

export interface ToastAction {
  label: ReactNode
  onClick: () => void
  disabled?: boolean
}

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: ToastVariant
  title?: ReactNode
  action?: ToastAction
  onDismiss?: () => void
  dismissLabel?: string
}

export function Toast({
  variant = "info",
  title,
  children,
  action,
  onDismiss,
  dismissLabel = "Dismiss notification",
  className,
  role,
  "aria-live": ariaLive,
  ...rest
}: ToastProps) {
  const resolvedRole = role ?? (variant === "error" ? "alert" : "status")
  const resolvedLive = ariaLive ?? (variant === "error" ? "assertive" : "polite")
  const toastClassName = ["astra-toast", className].filter(Boolean).join(" ")

  return (
    <div {...rest} role={resolvedRole} aria-live={resolvedLive} data-variant={variant} className={toastClassName}>
      <div className="astra-toast__body">
        {title ? <p className="astra-toast__title">{title}</p> : null}
        {children ? <div className="astra-toast__message">{children}</div> : null}
        {action ? (
          <div className="astra-toast__actions">
            <button type="button" className="astra-btn-secondary" onClick={action.onClick} disabled={action.disabled}>
              {action.label}
            </button>
          </div>
        ) : null}
      </div>
      {onDismiss ? (
        <button type="button" className="astra-toast__dismiss" aria-label={dismissLabel} onClick={onDismiss}>
          ×
        </button>
      ) : null}
    </div>
  )
}
