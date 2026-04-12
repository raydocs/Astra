import { afterEach, describe, expect, it, vi } from "vitest"

import { importReadableArticleFromUrl } from "./article-import"

describe("importReadableArticleFromUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("prefers the platform base URL when one is provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input)
      if (requestUrl === "https://platform.astra.example/v1/import/article") {
        return new Response(JSON.stringify({
          url: "https://example.com/readable",
          title: "Platform Imported Article",
          hostname: "example.com",
          byline: "Platform Writer",
          scope: "article",
          summary: "Platform summary",
          blocks: ["Platform paragraph."],
        }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const imported = await importReadableArticleFromUrl("https://example.com/readable", {
      apiBaseUrl: "https://relay.astra.example/v1",
      platformBaseUrl: "https://platform.astra.example",
    })

    expect(imported.title).toBe("Platform Imported Article")
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://platform.astra.example/v1/import/article",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-astra-import-surface": "web",
        },
      }),
    )
  })

  it("falls back to browser import when the platform path is unavailable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input)

      if (requestUrl === "https://platform.astra.example/v1/import/article") {
        return new Response(JSON.stringify({
          error: { message: "Temporary edge outage" },
        }), {
          status: 502,
          headers: { "content-type": "application/json; charset=utf-8" },
        })
      }

      if (requestUrl === "https://example.com/readable") {
        return new Response(`
          <html>
            <head><title>Browser Imported Article</title></head>
            <body>
              <article>
                <h1>Browser Imported Article</h1>
                <div class="byline">Browser Writer</div>
                <p>Browser paragraph one.</p>
                <p>Browser paragraph two.</p>
                <p>Browser paragraph three.</p>
              </article>
            </body>
          </html>
        `, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })
      }

      throw new Error(`Unexpected fetch url: ${requestUrl}`)
    })

    const imported = await importReadableArticleFromUrl("https://example.com/readable", {
      platformBaseUrl: "https://platform.astra.example",
    })

    expect(imported.title).toBe("Browser Imported Article")
    expect(imported.byline).toBe("Browser Writer")
    expect(imported.blocks).toEqual(expect.arrayContaining([
      "Browser paragraph one.",
      "Browser paragraph two.",
    ]))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})