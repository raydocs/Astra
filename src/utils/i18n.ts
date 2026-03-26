import { browser } from "#imports"

export function t(key: string, substitutions?: string | string[]): string {
  try {
    // Cast needed: WXT generates strict literal-union overloads for getMessage,
    // but we accept any string key so callers don't need to import the union type.
    return (browser.i18n.getMessage as (name: string, subs?: string | string[]) => string)(key, substitutions) || key
  } catch {
    return key
  }
}
