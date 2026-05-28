import { browser } from "#imports"

export const PAGE_ACCESS_POLICY_STORAGE_KEY = "astra.page_access_policy.v1"

export type PageAccessScope = "page" | "site" | "all-sites"
export type PageAccessAction = "granted" | "revoked" | "changed"
export type PageAccessPolicyState = "granted" | "revoked"

export interface PageAccessPolicyEntry {
  state: PageAccessPolicyState
  scope: Exclude<PageAccessScope, "page">
  updatedAt: string
  source: "browser-permissions" | "runtime-policy" | "browser-event"
}

export interface PageAccessPolicy {
  version: 1
  allSitesGranted: boolean
  allSitesState: PageAccessPolicyState | null
  sites: Record<string, PageAccessPolicyEntry>
}

export interface PageAccessState {
  tabId: number | null
  url: string | null
  origin: string | null
  sitePattern: string | null
  permissionsApiAvailable: boolean
  activeTabAvailable: boolean
  siteGranted: boolean
  allSitesGranted: boolean
  runtimeSiteState: PageAccessPolicyState | null
  effectiveAccess: boolean
  limitations: string[]
}

export interface PageAccessChangeMessage {
  type: "astra/page-access-changed"
  payload: {
    action: PageAccessAction
    scope: PageAccessScope
    origin: string | null
    sitePattern: string | null
    tabId?: number
    url?: string
    granted: boolean
    browserPermissionChanged: boolean
    reason?: string
    timestamp: string
  }
}

export interface PageAccessActionResult {
  ok: boolean
  state: PageAccessState
  message: string
  browserPermissionChanged: boolean
}

type TabLike = { id?: number; url?: string; lastAccessed?: number; active?: boolean }

const ALL_SITE_PATTERNS = ["http://*/*", "https://*/*"] as const

function createDefaultPolicy(): PageAccessPolicy {
  return {
    version: 1,
    allSitesGranted: false,
    allSitesState: null,
    sites: {},
  }
}

function normalizePolicy(value: unknown): PageAccessPolicy {
  if (typeof value !== "object" || value === null) return createDefaultPolicy()
  const candidate = value as Partial<PageAccessPolicy>
  const sites = typeof candidate.sites === "object" && candidate.sites !== null
    ? Object.fromEntries(
        Object.entries(candidate.sites).filter((entry): entry is [string, PageAccessPolicyEntry] => {
          const value = entry[1] as Partial<PageAccessPolicyEntry> | undefined
          return !!value
            && (value.state === "granted" || value.state === "revoked")
            && (value.scope === "site" || value.scope === "all-sites")
            && typeof value.updatedAt === "string"
        }),
      )
    : {}

  return {
    version: 1,
    allSitesGranted: candidate.allSitesGranted === true,
    allSitesState: candidate.allSitesState === "granted" || candidate.allSitesState === "revoked" ? candidate.allSitesState : null,
    sites,
  }
}

async function readPolicy(): Promise<PageAccessPolicy> {
  const stored = await browser.storage.local.get(PAGE_ACCESS_POLICY_STORAGE_KEY)
  return normalizePolicy(stored[PAGE_ACCESS_POLICY_STORAGE_KEY])
}

async function writePolicy(policy: PageAccessPolicy): Promise<void> {
  await browser.storage.local.set({ [PAGE_ACCESS_POLICY_STORAGE_KEY]: policy })
}

function isHttpUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url)
}

function normalizeOrigin(url: string | null | undefined): string | null {
  if (!isHttpUrl(url)) return null
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}`
  } catch {
    return null
  }
}

export function getSitePatternForUrl(url: string | null | undefined): string | null {
  if (!isHttpUrl(url)) return null
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.hostname}/*`
  } catch {
    return null
  }
}

export function getOriginKeyForUrl(url: string | null | undefined): string | null {
  return normalizeOrigin(url)
}

function getOriginKeyForPattern(pattern: string): string | null {
  const match = /^(https?:\/\/[^/*]+)\/\*$/.exec(pattern)
  return match?.[1] ?? null
}

function permissionsApiAvailable(): boolean {
  return !!browser.permissions
    && typeof browser.permissions.contains === "function"
    && typeof browser.permissions.request === "function"
    && typeof browser.permissions.remove === "function"
}

async function containsOrigins(origins: readonly string[]): Promise<boolean> {
  if (!browser.permissions?.contains) return false
  try {
    return await browser.permissions.contains({ origins: [...origins] })
  } catch {
    return false
  }
}

async function requestOrigins(origins: readonly string[]): Promise<boolean> {
  if (!browser.permissions?.request) return false
  try {
    return await browser.permissions.request({ origins: [...origins] })
  } catch {
    return false
  }
}

async function removeOrigins(origins: readonly string[]): Promise<boolean> {
  if (!browser.permissions?.remove) return false
  try {
    return await browser.permissions.remove({ origins: [...origins] })
  } catch {
    return false
  }
}

function pickHttpTabs(tabs: readonly TabLike[]) {
  return tabs.filter(
    (tab): tab is TabLike & { id: number; url: string } =>
      typeof tab.id === "number" && isHttpUrl(tab.url),
  )
}

export async function resolvePermissionTab(): Promise<{ id: number; url: string } | null> {
  const allTabs = await browser.tabs.query({})
  const httpTabs = pickHttpTabs(allTabs).sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))
  if (httpTabs[0]) return { id: httpTabs[0].id, url: httpTabs[0].url }

  const [active] = await browser.tabs.query({ active: true, currentWindow: true })
  if (active?.id && isHttpUrl(active.url)) return { id: active.id, url: active.url }
  return null
}

export async function getPageAccessState(tab?: { id: number; url: string } | null): Promise<PageAccessState> {
  const target = tab === undefined ? await resolvePermissionTab() : tab
  const url = target?.url ?? null
  const origin = getOriginKeyForUrl(url)
  const sitePattern = getSitePatternForUrl(url)
  const policy = await readPolicy()
  const runtimeSiteState = origin ? policy.sites[origin]?.state ?? null : null
  const siteGranted = sitePattern ? await containsOrigins([sitePattern]) : false
  const browserAllSitesGranted = await containsOrigins(ALL_SITE_PATTERNS)
  const effectiveAccess = runtimeSiteState === "granted"
    ? true
    : runtimeSiteState === "revoked"
      ? false
      : policy.allSitesState === "revoked"
        ? false
        : true

  const limitations: string[] = []
  if (!target) limitations.push("No active http(s) tab is available.")
  if (!permissionsApiAvailable()) limitations.push("browser.permissions is unavailable in this browser/runtime.")
  if (siteGranted || browserAllSitesGranted) {
    limitations.push("The current manifest still declares broad host access, so browser-level revoke may be reported as unchanged while Astra's runtime policy still stops automation.")
  }

  return {
    tabId: target?.id ?? null,
    url,
    origin,
    sitePattern,
    permissionsApiAvailable: permissionsApiAvailable(),
    activeTabAvailable: !!target,
    siteGranted,
    allSitesGranted: policy.allSitesState === "revoked" ? false : browserAllSitesGranted || policy.allSitesGranted || policy.allSitesState === "granted",
    runtimeSiteState,
    effectiveAccess,
    limitations,
  }
}

function buildChangeMessage(params: {
  action: PageAccessAction;
  scope: PageAccessScope;
  state: PageAccessState;
  granted: boolean;
  browserPermissionChanged: boolean;
  reason?: string;
}): PageAccessChangeMessage {
  return {
    type: "astra/page-access-changed",
    payload: {
      action: params.action,
      scope: params.scope,
      origin: params.state.origin,
      sitePattern: params.state.sitePattern,
      ...(params.state.tabId != null ? { tabId: params.state.tabId } : {}),
      ...(params.state.url ? { url: params.state.url } : {}),
      granted: params.granted,
      browserPermissionChanged: params.browserPermissionChanged,
      ...(params.reason ? { reason: params.reason } : {}),
      timestamp: new Date().toISOString(),
    },
  }
}

function shouldNotifyTab(tab: TabLike, message: PageAccessChangeMessage): tab is TabLike & { id: number; url: string } {
  if (typeof tab.id !== "number" || !isHttpUrl(tab.url)) return false
  if (message.payload.scope === "all-sites") return true
  if (message.payload.scope === "page") return message.payload.tabId === tab.id
  return message.payload.origin !== null && getOriginKeyForUrl(tab.url) === message.payload.origin
}

export async function broadcastPageAccessChange(message: PageAccessChangeMessage): Promise<void> {
  try {
    await browser.runtime.sendMessage(message)
  } catch {
    // No extension page may be listening; content tabs are notified below.
  }

  let tabs: TabLike[] = []
  try {
    tabs = await browser.tabs.query({})
  } catch {
    return
  }

  await Promise.all(tabs.filter((tab) => shouldNotifyTab(tab, message)).map(async (tab) => {
    try {
      await browser.tabs.sendMessage(tab.id, message)
    } catch {
      // Content script may not be injected or may not be reachable in this tab.
    }
  }))
}

async function updatePolicyForSite(origin: string, entry: PageAccessPolicyEntry | null): Promise<void> {
  const policy = await readPolicy()
  if (entry) {
    policy.sites[origin] = entry
  } else {
    delete policy.sites[origin]
  }
  await writePolicy(policy)
}

export async function requestPageAccess(scope: PageAccessScope, tab?: { id: number; url: string } | null): Promise<PageAccessActionResult> {
  const initialState = await getPageAccessState(tab)
  if (!initialState.url || !initialState.origin || !initialState.sitePattern) {
    return {
      ok: false,
      state: initialState,
      message: "Open Astra on a webpage to change page choices.",
      browserPermissionChanged: false,
    }
  }

  if (scope === "page") {
    if (initialState.runtimeSiteState === "revoked") {
      await updatePolicyForSite(initialState.origin, {
        state: "granted",
        scope: "site",
        updatedAt: new Date().toISOString(),
        source: "runtime-policy",
      })
    }
    const nextState = await getPageAccessState({ id: initialState.tabId!, url: initialState.url })
    const message = buildChangeMessage({
      action: "granted",
      scope,
      state: nextState,
      granted: true,
      browserPermissionChanged: false,
      reason: "Page access is temporary and is not remembered for later.",
    })
    await broadcastPageAccessChange(message)
    return {
      ok: true,
      state: nextState,
      message: "Astra can help on this page once.",
      browserPermissionChanged: false,
    }
  }

  const origins = scope === "all-sites" ? ALL_SITE_PATTERNS : [initialState.sitePattern]
  const alreadyGranted = await containsOrigins(origins)
  const requestedGrant = alreadyGranted ? false : await requestOrigins(origins)
  const granted = alreadyGranted || requestedGrant
  const canRestoreRuntimeSite = scope === "site" && initialState.runtimeSiteState === "revoked"
  if (!granted && !canRestoreRuntimeSite) {
    return {
      ok: false,
      state: initialState,
      message: permissionsApiAvailable()
        ? "Your browser did not confirm the site choice."
        : "This browser cannot show the site confirmation here.",
      browserPermissionChanged: false,
    }
  }

  const now = new Date().toISOString()
  if (scope === "all-sites") {
    const policy = await readPolicy()
    policy.allSitesGranted = true
    policy.allSitesState = "granted"
    policy.sites = Object.fromEntries(Object.entries(policy.sites).filter(([, entry]) => entry.state !== "revoked"))
    await writePolicy(policy)
  } else {
    await updatePolicyForSite(initialState.origin, {
      state: "granted",
      scope: "site",
      updatedAt: now,
      source: granted ? "browser-permissions" : "runtime-policy",
    })
  }

  const nextState = await getPageAccessState({ id: initialState.tabId!, url: initialState.url })
  const message = buildChangeMessage({
    action: "granted",
    scope,
    state: nextState,
    granted: true,
    browserPermissionChanged: requestedGrant,
  })
  await broadcastPageAccessChange(message)

  return {
    ok: true,
    state: nextState,
    message: scope === "all-sites"
      ? "Astra can help on all supported sites."
      : granted
        ? "Astra will remember this site."
        : "Astra will help on this site again.",
    browserPermissionChanged: requestedGrant,
  }
}

export async function revokePageAccess(scope: Exclude<PageAccessScope, "page">, tab?: { id: number; url: string } | null): Promise<PageAccessActionResult> {
  const initialState = await getPageAccessState(tab)
  if (!initialState.url || !initialState.origin || !initialState.sitePattern) {
    return {
      ok: false,
      state: initialState,
      message: "Open Astra on a webpage to change page choices.",
      browserPermissionChanged: false,
    }
  }

  const origins = scope === "all-sites" ? ALL_SITE_PATTERNS : [initialState.sitePattern]
  const browserPermissionChanged = await removeOrigins(origins)
  const now = new Date().toISOString()

  if (scope === "all-sites") {
    const policy = await readPolicy()
    policy.allSitesGranted = false
    policy.allSitesState = "revoked"
    await writePolicy(policy)
  } else {
    await updatePolicyForSite(initialState.origin, {
      state: "revoked",
      scope: "site",
      updatedAt: now,
      source: browserPermissionChanged ? "browser-permissions" : "runtime-policy",
    })
  }

  const nextState = await getPageAccessState({ id: initialState.tabId!, url: initialState.url })
  const message = buildChangeMessage({
    action: "revoked",
    scope,
    state: nextState,
    granted: false,
    browserPermissionChanged,
  })
  await broadcastPageAccessChange(message)

  return {
    ok: true,
    state: nextState,
    message: scope === "all-sites"
      ? "Astra is paused on supported sites."
      : "Astra is paused on this site.",
    browserPermissionChanged,
  }
}

export async function isPageAccessAllowedForUrl(url: string): Promise<boolean> {
  const origin = getOriginKeyForUrl(url)
  if (!origin) return true
  const policy = await readPolicy()
  const siteState = policy.sites[origin]?.state ?? null
  if (siteState === "granted") return true
  if (siteState === "revoked") return false
  return policy.allSitesState !== "revoked"
}

export function isPageAccessAllowedByPolicyValue(url: string, value: unknown): boolean {
  const origin = getOriginKeyForUrl(url)
  if (!origin) return true
  const policy = normalizePolicy(value)
  const siteState = policy.sites[origin]?.state ?? null
  if (siteState === "granted") return true
  if (siteState === "revoked") return false
  return policy.allSitesState !== "revoked"
}

export function isPageAccessChangeMessage(value: unknown): value is PageAccessChangeMessage {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Partial<PageAccessChangeMessage>
  if (candidate.type !== "astra/page-access-changed") return false
  const payload = candidate.payload as Partial<PageAccessChangeMessage["payload"]> | undefined
  return !!payload
    && (payload.action === "granted" || payload.action === "revoked" || payload.action === "changed")
    && (payload.scope === "page" || payload.scope === "site" || payload.scope === "all-sites")
    && typeof payload.granted === "boolean"
    && typeof payload.browserPermissionChanged === "boolean"
}

export function doesPageAccessChangeAffectUrl(message: PageAccessChangeMessage, url: string): boolean {
  if (message.payload.scope === "all-sites") return isHttpUrl(url)
  if (message.payload.scope === "page") return message.payload.url === url
  return message.payload.origin !== null && getOriginKeyForUrl(url) === message.payload.origin
}

export async function reconcileBrowserPermissionEvent(
  permissions: { origins?: string[] },
  granted: boolean,
): Promise<void> {
  const origins = permissions.origins ?? []
  const affectsAllSites = ALL_SITE_PATTERNS.every((pattern) => origins.includes(pattern))
  const now = new Date().toISOString()
  const policy = await readPolicy()
  const siteChanges = origins
    .filter((originPattern) => !ALL_SITE_PATTERNS.includes(originPattern as typeof ALL_SITE_PATTERNS[number]))
    .map((originPattern) => ({ originPattern, origin: getOriginKeyForPattern(originPattern) }))
    .filter((entry): entry is { originPattern: string; origin: string } => entry.origin !== null)

  if (affectsAllSites) {
    policy.allSitesGranted = granted
    policy.allSitesState = granted ? "granted" : "revoked"
  }

  siteChanges.forEach(({ origin }) => {
    policy.sites[origin] = {
      state: granted ? "granted" : "revoked",
      scope: "site",
      updatedAt: now,
      source: "browser-event",
    }
  })

  if (affectsAllSites || siteChanges.length > 0) {
    await writePolicy(policy)
  }

  if (affectsAllSites) {
    await broadcastPageAccessChange({
      type: "astra/page-access-changed",
      payload: {
        action: "changed",
        scope: "all-sites",
        origin: null,
        sitePattern: null,
        granted,
        browserPermissionChanged: true,
        timestamp: now,
      },
    })
  }

  await Promise.all(siteChanges.map(async ({ originPattern, origin }) => {
    await broadcastPageAccessChange({
      type: "astra/page-access-changed",
      payload: {
        action: "changed",
        scope: "site",
        origin,
        sitePattern: originPattern,
        granted,
        browserPermissionChanged: true,
        timestamp: now,
      },
    })
  }))
}
