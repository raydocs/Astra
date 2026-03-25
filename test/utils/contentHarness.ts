import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  flushMicrotasks,
  setViewport,
  stackElements,
} from "./domFixture"

export type PageFixtureName =
  | "article-basic"
  | "dynamic-feed"
  | "dense-inline"
  | "forms-and-nav"
  | "nested-blocks"

export interface MountPageFixtureOptions {
  title?: string
  metaDescription?: string
  url?: string
  viewport?: {
    width?: number
    height?: number
  }
  stackSelector?: string
}

const FIXTURE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/pages",
)

function readFixture(name: PageFixtureName): string {
  return readFileSync(path.join(FIXTURE_ROOT, `${name}.html`), "utf8")
}

export function mountPageFixture(
  name: PageFixtureName,
  options: MountPageFixtureOptions = {},
) {
  const {
    title = "Astra Fixture Page",
    metaDescription = "Fixture page for Astra content tests.",
    url = "/fixtures/article",
    viewport,
    stackSelector = "main p, article p, article li, article h1, article h2, blockquote, [data-stack]",
  } = options

  document.head.innerHTML = metaDescription
    ? `<meta name="description" content="${metaDescription}" />`
    : ""
  document.title = title
  document.body.innerHTML = readFixture(name)

  window.history.replaceState({}, "", url)
  setViewport(viewport?.width, viewport?.height)

  const stackable = Array.from(document.querySelectorAll(stackSelector))
    .filter((element) => (element.textContent?.trim().length ?? 0) > 0)
  stackElements(stackable)

  return {
    html: document.body.innerHTML,
    get(selector: string) {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Expected HTMLElement for selector: ${selector}`)
      }
      return element
    },
    query(selector: string) {
      const element = document.querySelector(selector)
      return element instanceof HTMLElement ? element : null
    },
    queryAll(selector: string) {
      return Array.from(document.querySelectorAll(selector))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
    },
    restack(selector = stackSelector) {
      const elements = Array.from(document.querySelectorAll(selector))
        .filter((element) => (element.textContent?.trim().length ?? 0) > 0)
      stackElements(elements)
      return elements
    },
    async flush(times = 2) {
      await flushMicrotasks(times)
    },
  }
}
