import type { ComponentPropsWithoutRef, SVGProps } from "react"

export interface AstraIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string
  strokeWidth?: number | string
  decorative?: boolean
  title?: string
}

export function AstraIcon({
  size = 16,
  strokeWidth = 1.5,
  decorative = true,
  title,
  children,
  ...props
}: AstraIconProps) {
  const hasAccessibleName = Boolean(title || props["aria-label"] || props["aria-labelledby"])
  const ariaHidden = decorative && !hasAccessibleName ? true : undefined
  const role = hasAccessibleName || decorative === false ? "img" : undefined

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      role={role}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export function IconStar(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M12 3l1.7 5.4 5.6.2-4.5 3.4 1.6 5.4L12 14.2l-4.4 3.2 1.6-5.4-4.5-3.4 5.6-.2L12 3z" />
    </AstraIcon>
  )
}

export function IconBook(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15.5H6a2 2 0 0 0-2 2V4.5z" />
      <path d="M4 19.5A2 2 0 0 1 6 17.5h13" />
    </AstraIcon>
  )
}

export function IconLanguages(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M3 5h10M5 5v2a4 4 0 0 0 4 4M11 5v2a4 4 0 0 1-4 4" />
      <path d="M11 19l4-9 4 9M12.5 16h5" />
    </AstraIcon>
  )
}

export function IconBookmark(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </AstraIcon>
  )
}

export function IconCheck(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </AstraIcon>
  )
}

export function IconClose(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </AstraIcon>
  )
}

export function IconSettings(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 2.5a7 7 0 0 0-1.7 1L5 5.6l-2 3.4L5 10.5a7 7 0 0 0 0 3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.5 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4L19 13a7 7 0 0 0 .1-1z" />
    </AstraIcon>
  )
}

export function IconSearch(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </AstraIcon>
  )
}

export function IconChevronDown(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M6 9l6 6 6-6" />
    </AstraIcon>
  )
}

export function IconArrowRight(props: AstraIconProps) {
  return (
    <AstraIcon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </AstraIcon>
  )
}

export interface AstraMarkProps extends AstraIconProps {
  variant?: "constellation" | "compass"
}

export function AstraMark({ variant = "constellation", size = 22, strokeWidth = 1.4, ...props }: AstraMarkProps) {
  if (variant === "compass") {
    return (
      <AstraIcon size={size} strokeWidth={strokeWidth} {...props}>
        <path d="M12 3.5l1.55 6.95L20.5 12l-6.95 1.55L12 20.5l-1.55-6.95L3.5 12l6.95-1.55L12 3.5z" />
        <path d="M12 8.7V12l2.3 2.3" />
      </AstraIcon>
    )
  }

  return (
    <AstraIcon size={size} strokeWidth={strokeWidth} {...props}>
      <path d="M12 4l1.4 4.6L18 10l-4.6 1.4L12 16l-1.4-4.6L6 10l4.6-1.4L12 4z" />
      <circle cx="19" cy="5" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="20" cy="17" r="0.4" fill="currentColor" stroke="none" />
    </AstraIcon>
  )
}

export interface AstraWordmarkProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  size?: number
  markVariant?: AstraMarkProps["variant"]
  label?: string
}

export function AstraWordmark({ size = 28, markVariant = "constellation", label = "Astra", className, style, ...props }: AstraWordmarkProps) {
  return (
    <span
      className={["astra-ui-wordmark", className].filter(Boolean).join(" ")}
      style={{ fontSize: size, ...style }}
      {...props}
    >
      <AstraMark size={Math.round(size * 0.78)} strokeWidth={1.3} variant={markVariant} />
      <span>{label}</span>
    </span>
  )
}
