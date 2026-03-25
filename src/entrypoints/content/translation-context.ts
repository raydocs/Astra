import type { TranslationRequestContext } from "@/types/messages"

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
