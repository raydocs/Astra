import { readFileSync } from "node:fs"
import path from "node:path"

import { stackElements, setViewport } from "./dom"

const FIXTURE_ROOT = path.resolve(process.cwd(), "test/fixtures/pages")

export type FixtureSource =
  | { kind: "page"; name: string }
  | { kind: "inline"; name: string; html: string }

export interface MountFixtureOptions {
  title?: string
  metaDescription?: string
  url?: string
  viewport?: {
    width?: number
    height?: number
  }
  stackSelector?: string
}

function readFixture(source: FixtureSource): string {
  if (source.kind === "inline") return source.html
  return readFileSync(path.join(FIXTURE_ROOT, `${source.name}.html`), "utf8")
}

export function mountFixture(
  source: FixtureSource,
  options: MountFixtureOptions = {},
) {
  const {
    title = "Astra Bench Fixture",
    metaDescription = "Fixture page for Astra benchmark scenarios.",
    url = "/fixtures/bench",
    viewport,
    stackSelector = "main p, article p, article li, article h1, article h2, blockquote, [data-stack]",
  } = options

  document.head.innerHTML = metaDescription
    ? `<meta name="description" content="${metaDescription}" />`
    : ""
  document.title = title
  document.body.innerHTML = readFixture(source)
  window.history.replaceState({}, "", url)
  setViewport(viewport?.width, viewport?.height)

  const stackable = Array.from(document.querySelectorAll(stackSelector))
    .filter((element) => (element.textContent?.trim().length ?? 0) > 0)

  stackElements(stackable)

  return {
    query(selector: string) {
      const element = document.querySelector(selector)
      return element instanceof HTMLElement ? element : null
    },
    queryAll(selector: string) {
      return Array.from(document.querySelectorAll(selector))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
    },
  }
}
