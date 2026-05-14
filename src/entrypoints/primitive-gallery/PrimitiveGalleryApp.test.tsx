import { act } from "react"
import ReactDOM from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import PrimitiveGalleryApp from "./PrimitiveGalleryApp"

describe("PrimitiveGalleryApp", () => {
  let container: HTMLDivElement
  let root: ReactDOM.Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = ReactDOM.createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
      await Promise.resolve()
    })
    container.remove()
    window.history.replaceState(null, "", "/")
  })

  async function renderAt(path: string) {
    window.history.replaceState(null, "", path)
    await act(async () => {
      root.render(<PrimitiveGalleryApp />)
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it("stays locked without the certification trigger", async () => {
    await renderAt("/primitive-gallery.html")

    expect(container.querySelector('[data-testid="astra-primitive-gallery-locked"]')).toBeDefined()
    expect(container.querySelector('[data-testid="astra-primitive-gallery"]')).toBeNull()
    expect(container.textContent).toContain("Astra primitive gallery is hidden")
  })

  it("stays locked when the certification trigger has the wrong value", async () => {
    await renderAt("/primitive-gallery.html?astraCertification=1")

    expect(container.querySelector('[data-testid="astra-primitive-gallery-locked"]')).toBeDefined()
    expect(container.querySelector('[data-testid="astra-primitive-gallery"]')).toBeNull()
  })

  it("renders the reference-shaped shared primitive gallery with the explicit certification trigger", async () => {
    await renderAt("/primitive-gallery.html?astraCertification=ui-primitives")

    expect(container.querySelector('[data-testid="astra-primitive-gallery"]')).toBeDefined()
    expect(container.querySelector('[data-testid="astra-primitive-gallery-locked"]')).toBeNull()
    expect(container.textContent).toContain("The brief")
    expect(container.textContent).toContain("The two directions")
    expect(container.textContent).toContain("Quiet Reader")
    expect(container.textContent).toContain("Constellation")
    expect(container.textContent).toContain("Extension logo — six candidates, scored at every size")
    expect(container.textContent).toContain("components/ui")
  })
})
