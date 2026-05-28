import { act, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Toast, ToastViewport } from "./Toast"

describe("Toast", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
  })

  const render = async (node: ReactNode) => {
    await act(async () => {
      root.render(node)
      await Promise.resolve()
    })
  }

  it("announces non-error toasts politely and atomically by default", async () => {
    await render(
      <Toast variant="success" title="Saved">
        Saved your learning settings.
      </Toast>,
    )

    const toast = container.querySelector(".astra-toast") as HTMLDivElement | null
    expect(toast?.getAttribute("role")).toBe("status")
    expect(toast?.getAttribute("aria-live")).toBe("polite")
    expect(toast?.getAttribute("aria-atomic")).toBe("true")
    expect(toast?.getAttribute("data-variant")).toBe("success")
    expect(toast?.textContent).toContain("Saved")
  })

  it("announces error toasts assertively and preserves action/dismiss labels", async () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()

    await render(
      <Toast
        variant="error"
        title="Save failed"
        action={{ label: "Retry", ariaLabel: "Retry saving settings", onClick: onAction }}
        dismissLabel="Dismiss save error"
        onDismiss={onDismiss}
      >
        We could not save settings. Check your connection and try again.
      </Toast>,
    )

    const toast = container.querySelector(".astra-toast") as HTMLDivElement | null
    expect(toast?.getAttribute("role")).toBe("alert")
    expect(toast?.getAttribute("aria-live")).toBe("assertive")

    const retry = container.querySelector("button[aria-label='Retry saving settings']") as HTMLButtonElement | null
    retry?.click()
    expect(onAction).toHaveBeenCalledTimes(1)

    const dismiss = container.querySelector("button[aria-label='Dismiss save error']") as HTMLButtonElement | null
    dismiss?.click()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})

describe("ToastViewport", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
  })

  it("provides a bounded notification region for non-blocking stacked toasts", async () => {
    await act(async () => {
      root.render(
        <ToastViewport placement="top" aria-label="Astra notifications" className="custom-viewport">
          <Toast>Done loading.</Toast>
        </ToastViewport>,
      )
      await Promise.resolve()
    })

    const viewport = container.querySelector(".astra-toast-viewport") as HTMLDivElement | null
    expect(viewport?.getAttribute("role")).toBe("region")
    expect(viewport?.getAttribute("aria-label")).toBe("Astra notifications")
    expect(viewport?.getAttribute("data-placement")).toBe("top")
    expect(viewport?.className).toContain("custom-viewport")
    expect(viewport?.querySelector(".astra-toast")?.textContent).toContain("Done loading.")
  })
})
