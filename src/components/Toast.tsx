import type { HTMLAttributes, ReactNode } from "react"

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

export type ToastVariant = "info" | "success" | "warning" | "error"
export type ToastViewportPlacement = "top" | "bottom"

export interface ToastAction {
  label: ReactNode
  onClick: () => void
  disabled?: boolean
  ariaLabel?: string
}

export interface ToastProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: ToastVariant
  title?: ReactNode
  action?: ToastAction
  onDismiss?: () => void
  dismissLabel?: string
}

export interface ToastViewportProps extends HTMLAttributes<HTMLDivElement> {
  placement?: ToastViewportPlacement
}

export function ToastViewport({
  placement = "bottom",
  children,
  className,
  role,
  "aria-label": ariaLabel,
  ...rest
}: ToastViewportProps) {
  return (
    <div
      {...rest}
      role={role ?? "region"}
      aria-label={ariaLabel ?? "Notifications"}
      data-placement={placement}
      className={cx("astra-toast-viewport", className)}
    >
      {children}
    </div>
  )
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
  "aria-atomic": ariaAtomic,
  ...rest
}: ToastProps) {
  const resolvedRole = role ?? (variant === "error" ? "alert" : "status")
  const resolvedLive = ariaLive ?? (variant === "error" ? "assertive" : "polite")

  return (
    <div
      {...rest}
      role={resolvedRole}
      aria-live={resolvedLive}
      aria-atomic={ariaAtomic ?? true}
      data-variant={variant}
      className={cx("astra-toast", className)}
    >
      <div className="astra-toast__body">
        {title ? <p className="astra-toast__title">{title}</p> : null}
        {children ? <div className="astra-toast__message">{children}</div> : null}
        {action ? (
          <div className="astra-toast__actions">
            <button
              type="button"
              className="astra-btn-secondary"
              aria-label={action.ariaLabel}
              onClick={action.onClick}
              disabled={action.disabled}
            >
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
