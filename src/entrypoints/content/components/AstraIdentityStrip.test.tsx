import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { AstraIdentityStrip } from "./AstraIdentityStrip"

describe("AstraIdentityStrip", () => {
  let container: HTMLDivElement
  let root: Root

  const render = async (targetLang?: string | null) => {
    await act(async () => {
      root.render(<AstraIdentityStrip targetLang={targetLang} />)
      await Promise.resolve()
    })
  }

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

  it("renders Astra brand and shared star icon", async () => {
    await render("zh-CN")

    const strip = container.querySelector("[data-testid='astra-identity-strip']") as HTMLDivElement | null
    expect(strip?.textContent).toContain("Astra")

    const starPath = container.querySelector("[data-testid='astra-identity-strip-star'] path")
    expect(starPath?.getAttribute("d")).toBe("M12 2 L14.5 9 L22 9.5 L16 14.5 L18 22 L12 17.5 L6 22 L8 14.5 L2 9.5 L9.5 9 Z")
  })

  it("renders human-readable target-language labels with raw-code fallback", async () => {
    await render("zh-CN")

    const mappedPill = container.querySelector("[data-testid='astra-identity-strip-target-lang']") as HTMLSpanElement | null
    expect(mappedPill?.textContent).toBe("中文")

    await render("xx-YY")
    const fallbackPill = container.querySelector("[data-testid='astra-identity-strip-target-lang']") as HTMLSpanElement | null
    expect(fallbackPill?.textContent).toBe("xx-YY")

    await render(null)
    const withoutTargetPill = container.querySelector("[data-testid='astra-identity-strip-target-lang']")
    expect(withoutTargetPill).toBeNull()
  })

  it("scales strip sizing with fontScale", async () => {
    await act(async () => {
      root.render(<AstraIdentityStrip targetLang="zh-CN" fontScale={1.25} />)
      await Promise.resolve()
    })

    const strip = container.querySelector("[data-testid='astra-identity-strip']") as HTMLDivElement | null
    const targetLangPill = container.querySelector("[data-testid='astra-identity-strip-target-lang']") as HTMLSpanElement | null

    expect(strip?.style.minHeight).toBe("30px")
    expect(targetLangPill?.style.fontSize).toBe("13.75px")
  })
})
