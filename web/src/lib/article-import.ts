import { z } from "zod"

import { normalizeApiBaseUrl } from "./astra-web"
import { extractReadableDocumentMetadata, resolveExtractionPlan } from "@/utils/dom/extraction"

export interface ImportedReadableArticle {
  url: string
  title: string
  hostname: string
  byline: string | null
  scope: "article" | "page"
  summary: string | null
  blocks: string[]
}

interface ImportReadableArticleOptions {
  apiBaseUrl?: string | null
  platformBaseUrl?: string | null
}

class ServerArticleImportError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ServerArticleImportError"
  }
}

const ImportedReadableArticleSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string().trim().min(1),
  hostname: z.string().trim().min(1),
  byline: z.string().trim().min(1).nullable().default(null),
  scope: z.enum(["article", "page"]),
  summary: z.string().trim().min(1).nullable().default(null),
  blocks: z.array(z.string().trim().min(1)).default([]),
})

function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error("Enter an article URL first.")
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Only http(s) article URLs are supported.")
    }
    return parsed.toString()
  } catch (error) {
    if (error instanceof Error && error.message === "Only http(s) article URLs are supported.") {
      throw error
    }
    throw new Error("Enter a valid absolute URL, including https://.", { cause: error })
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: { message?: string }; message?: string }
    return payload.error?.message || payload.message || fallback
  } catch {
    return fallback
  }
}

async function importReadableArticleViaRelay(
  url: string,
  baseUrl: string,
): Promise<ImportedReadableArticle> {
  let response: Response
  try {
    response = await fetch(`${normalizeApiBaseUrl(baseUrl)}/import/article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-astra-import-surface": "web",
      },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new ServerArticleImportError("The Astra article import path is unavailable.", 0)
  }

  if (!response.ok) {
    throw new ServerArticleImportError(
      await readErrorMessage(response, `Astra article import failed with status ${response.status}.`),
      response.status,
    )
  }

  return ImportedReadableArticleSchema.parse(await response.json())
}

async function importReadableArticleInBrowser(normalizedUrl: string): Promise<ImportedReadableArticle> {
  let response: Response
  try {
    response = await fetch(normalizedUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
    })
  } catch {
    throw new Error("This URL could not be fetched directly in the browser. This wave only supports imports that allow normal browser fetch access.")
  }

  if (!response.ok) {
    throw new Error(`Article import failed with status ${response.status}.`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType && !/html|xhtml/i.test(contentType)) {
    throw new Error("The imported URL did not return an HTML document.")
  }

  const html = await response.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")
  const plan = resolveExtractionPlan(doc, "article")
  const blocks = plan.blocks
    .map((block) => block.text.trim())
    .filter(Boolean)

  if (blocks.length === 0) {
    throw new Error("The imported URL did not expose readable article text. Pages that depend on scripts or block direct fetches are out of scope for this wave.")
  }

  const parsedUrl = new URL(normalizedUrl)
  const metadata = extractReadableDocumentMetadata(doc, normalizedUrl)
  return {
    url: parsedUrl.toString(),
    title: metadata.title,
    hostname: parsedUrl.hostname,
    byline: metadata.byline,
    scope: plan.scope,
    summary: plan.summary,
    blocks,
  }
}

function shouldFallBackToBrowserImport(error: unknown): boolean {
  return error instanceof ServerArticleImportError
    && (error.status === 0 || error.status === 404 || error.status === 405 || error.status >= 500)
}

export async function importReadableArticleFromUrl(
  url: string,
  options: ImportReadableArticleOptions = {},
): Promise<ImportedReadableArticle> {
  const normalizedUrl = normalizeUrl(url)
  const preferredBaseUrl = options.platformBaseUrl?.trim() || options.apiBaseUrl?.trim()

  if (preferredBaseUrl) {
    try {
      return await importReadableArticleViaRelay(normalizedUrl, preferredBaseUrl)
    } catch (error) {
      if (!shouldFallBackToBrowserImport(error)) {
        throw error
      }
    }
  }

  return importReadableArticleInBrowser(normalizedUrl)
}
