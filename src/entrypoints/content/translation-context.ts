import type { TranslationRequestContext } from "@/types/messages"
import {
  buildContentSummary,
  collectTextBlocks,
  findContentRoot,
} from "@/utils/dom/traversal"

let cachedInlineSummary:
  | {
      root: HTMLElement
      pageUrl: string
      pageTitle: string
      textLength: number
      summary: string | undefined
    }
  | null = null

export function getDocumentTranslationContext(): Pick<
  TranslationRequestContext,
  "pageTitle" | "pageUrl" | "hostname" | "metaDescription"
> {
  const pageTitle = document.title.trim()
  const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim()
    || document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content?.trim()
    || undefined

  return {
    ...(pageTitle ? { pageTitle } : {}),
    ...(location.origin ? { pageUrl: `${location.origin}${location.pathname}` } : {}),
    ...(window.location.hostname ? { hostname: window.location.hostname } : {}),
    ...(metaDescription ? { metaDescription } : {}),
  }
}

export function buildInlineTranslationContext(
  extra: { selectionContext?: string; contextElement?: HTMLElement | null } = {},
): TranslationRequestContext {
  const base = getDocumentTranslationContext()
  const contentRoot = findContentRoot(document)
  const contextElement = extra.contextElement
  const canUseContentSummary = !contextElement || contentRoot.contains(contextElement)
  const textLength = contentRoot.textContent?.trim().length ?? 0

  let contentSummary: string | undefined
  if (canUseContentSummary) {
    const cacheKeyMatches = cachedInlineSummary
      && cachedInlineSummary.root === contentRoot
      && cachedInlineSummary.pageUrl === (base.pageUrl ?? "")
      && cachedInlineSummary.pageTitle === (base.pageTitle ?? "")
      && cachedInlineSummary.textLength === textLength

    if (cacheKeyMatches && cachedInlineSummary) {
      contentSummary = cachedInlineSummary.summary
    } else {
      contentSummary = buildContentSummary(collectTextBlocks(contentRoot), {
        maxBlocks: 4,
        maxChars: 500,
      }) ?? undefined

      cachedInlineSummary = {
        root: contentRoot,
        pageUrl: base.pageUrl ?? "",
        pageTitle: base.pageTitle ?? "",
        textLength,
        summary: contentSummary,
      }
    }
  }

  return {
    ...base,
    ...(contentSummary ? { contentSummary } : {}),
    ...(extra.selectionContext ? { selectionContext: extra.selectionContext } : {}),
  }
}
