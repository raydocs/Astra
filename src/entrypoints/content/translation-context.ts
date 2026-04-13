import type { PageStudyContext, TranslationRequestContext } from "@/types/messages"
import {
  ASTRA_SOURCE_SELECTOR,
  ASTRA_TRANSLATION_SELECTOR,
} from "@/utils/dom/inject"
import {
  buildContentSummary,
  collectTextBlocks,
  findContentRoot,
} from "@/utils/dom/traversal"
import { sanitizeTranslationContext } from "@/utils/privacy"
import { readConfig } from "@/utils/storage/config"

let cachedInlineSummary:
  | {
      root: HTMLElement
      pageUrl: string
      pageTitle: string
      mutationVersion: number
      summary: string | undefined
    }
  | null = null
let inlineSummaryMutationVersion = 0
let inlineSummaryObserver: MutationObserver | null = null
let inlineSummaryPopstateListener: (() => void) | null = null

function getElementForNode(node: Node | null): HTMLElement | null {
  if (!node) return null
  return node.nodeType === 1
    ? node as HTMLElement
    : node.parentElement
}

function isWithinAstraInjectedContent(node: Node | null): boolean {
  const element = getElementForNode(node)
  return !!element?.closest(`${ASTRA_TRANSLATION_SELECTOR}, ${ASTRA_SOURCE_SELECTOR}`)
}

function ensureInlineSummaryObserver() {
  if (inlineSummaryObserver || typeof MutationObserver === "undefined" || !document.body) return

  inlineSummaryObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        if (isWithinAstraInjectedContent(mutation.target)) continue
        inlineSummaryMutationVersion += 1
        return
      }

      if (mutation.type === "childList") {
        if (!isWithinAstraInjectedContent(mutation.target)) {
          inlineSummaryMutationVersion += 1
          return
        }

        const hasMeaningfulNode = [...mutation.addedNodes, ...mutation.removedNodes].some(
          node => !isWithinAstraInjectedContent(node),
        )
        if (hasMeaningfulNode) {
          inlineSummaryMutationVersion += 1
          return
        }
      }
    }
  })

  inlineSummaryObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })

  inlineSummaryPopstateListener = () => {
    inlineSummaryMutationVersion += 1
  }
  window.addEventListener("popstate", inlineSummaryPopstateListener)
}

export function disconnectInlineSummaryObserver(): void {
  inlineSummaryObserver?.disconnect()
  inlineSummaryObserver = null
  if (inlineSummaryPopstateListener) {
    window.removeEventListener("popstate", inlineSummaryPopstateListener)
    inlineSummaryPopstateListener = null
  }
  cachedInlineSummary = null
  inlineSummaryMutationVersion = 0
}

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

export async function buildInlineTranslationContext(
  extra: { selectionContext?: string; contextElement?: HTMLElement | null } = {},
): Promise<TranslationRequestContext> {
  ensureInlineSummaryObserver()

  const base = getDocumentTranslationContext()
  const contentRoot = findContentRoot(document)
  const contextElement = extra.contextElement
  const canUseContentSummary = !contextElement || contentRoot.contains(contextElement)

  let contentSummary: string | undefined
  if (canUseContentSummary) {
    const cacheKeyMatches = cachedInlineSummary
      && cachedInlineSummary.root === contentRoot
      && cachedInlineSummary.pageUrl === (base.pageUrl ?? "")
      && cachedInlineSummary.pageTitle === (base.pageTitle ?? "")
      && cachedInlineSummary.mutationVersion === inlineSummaryMutationVersion

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
        mutationVersion: inlineSummaryMutationVersion,
        summary: contentSummary,
      }
    }
  }

  const fullContext: TranslationRequestContext = {
    ...base,
    ...(contentSummary ? { contentSummary } : {}),
    ...(extra.selectionContext ? { selectionContext: extra.selectionContext } : {}),
  }

  const config = await readConfig()
  if (config.privacyMode) {
    return sanitizeTranslationContext(fullContext)
  }

  return fullContext
}

export async function buildPageStudyContext(): Promise<PageStudyContext> {
  const base = await buildInlineTranslationContext()
  const config = await readConfig()

  if (config.privacyMode) {
    return base
  }

  const contentRoot = findContentRoot(document)
  const articleExcerpt = buildContentSummary(collectTextBlocks(contentRoot), {
    maxBlocks: 3,
    maxChars: 650,
  }) ?? undefined

  return {
    ...base,
    ...(articleExcerpt ? { articleExcerpt } : {}),
  }
}
