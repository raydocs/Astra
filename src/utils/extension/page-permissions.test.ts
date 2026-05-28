import { beforeEach, describe, expect, it, vi } from "vitest"

import { createMockBrowser, setMockBrowser } from "../../../test/utils/mockBrowser"
import { findForbiddenUserCopyTerms } from "../copy-dictionary"
import {
  PAGE_ACCESS_POLICY_STORAGE_KEY,
  getPageAccessState,
  isPageAccessAllowedForUrl,
  requestPageAccess,
  revokePageAccess,
  reconcileBrowserPermissionEvent,
} from "./page-permissions"

function getMockBrowser(): ReturnType<typeof createMockBrowser> {
  return (globalThis as unknown as { __ASTRA_TEST_BROWSER__: ReturnType<typeof createMockBrowser> })
    .__ASTRA_TEST_BROWSER__
}

describe("page permission utility", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setMockBrowser(createMockBrowser())
    const browser = getMockBrowser()
    browser.tabs.query.mockResolvedValue([
      { id: 7, url: "https://example.com/article", lastAccessed: 10 },
      { id: 8, url: "https://other.test/", lastAccessed: 1 },
    ])
    browser.permissions.contains.mockResolvedValue(false)
    browser.permissions.request.mockResolvedValue(true)
    browser.permissions.remove.mockResolvedValue(true)
  })

  it("requests this-site access for only the current origin", async () => {
    const browser = getMockBrowser()

    const result = await requestPageAccess("site")

    expect(result.ok).toBe(true)
    expect(result.message).toBe("Astra will remember this site.")
    expect(findForbiddenUserCopyTerms(result.message)).toEqual([])
    expect(browser.permissions.request).toHaveBeenCalledWith({ origins: ["https://example.com/*"] })
    expect(browser.permissions.request).not.toHaveBeenCalledWith({ origins: ["https://*/*", "http://*/*"] })
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({
      sites: {
        "https://example.com": expect.objectContaining({ state: "granted", scope: "site" }),
      },
    })
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({
      type: "astra/page-access-changed",
      payload: expect.objectContaining({ scope: "site", granted: true, origin: "https://example.com" }),
    }))
    expect(browser.tabs.sendMessage).not.toHaveBeenCalledWith(8, expect.anything())
  })

  it("uses page-only access without persisting host permissions", async () => {
    const browser = getMockBrowser()

    const result = await requestPageAccess("page")

    expect(result.ok).toBe(true)
    expect(result.message).toBe("Astra can help on this page once.")
    expect(findForbiddenUserCopyTerms(result.message)).toEqual([])
    expect(browser.permissions.request).not.toHaveBeenCalled()
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toBeUndefined()
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({
      type: "astra/page-access-changed",
      payload: expect.objectContaining({ scope: "page", granted: true, browserPermissionChanged: false }),
    }))
  })

  it("revokes a site in browser permissions and runtime policy", async () => {
    const browser = getMockBrowser()

    const result = await revokePageAccess("site")

    expect(result.ok).toBe(true)
    expect(browser.permissions.remove).toHaveBeenCalledWith({ origins: ["https://example.com/*"] })
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({
      sites: {
        "https://example.com": expect.objectContaining({ state: "revoked", scope: "site" }),
      },
    })
    await expect(isPageAccessAllowedForUrl("https://example.com/article")).resolves.toBe(false)
    await expect(isPageAccessAllowedForUrl("https://other.test/article")).resolves.toBe(true)
  })

  it("restores a runtime-revoked site without recording a denied browser grant", async () => {
    const browser = getMockBrowser()
    browser.permissions.request.mockResolvedValue(false)
    browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY] = {
      version: 1,
      allSitesGranted: false,
      sites: {
        "https://example.com": {
          state: "revoked",
          scope: "site",
          updatedAt: "2026-05-13T00:00:00.000Z",
          source: "runtime-policy",
        },
      },
    }

    const result = await requestPageAccess("site")

    expect(result.ok).toBe(true)
    expect(result.browserPermissionChanged).toBe(false)
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({
      sites: {
        "https://example.com": expect.objectContaining({ state: "granted", source: "runtime-policy" }),
      },
    })
  })

  it("does not persist a new grant when the browser denies an optional permission request", async () => {
    const browser = getMockBrowser()
    browser.permissions.request.mockResolvedValue(false)

    const result = await requestPageAccess("site")

    expect(result.ok).toBe(false)
    expect(result.message).toBe("Your browser did not confirm the site choice.")
    expect(findForbiddenUserCopyTerms(result.message)).toEqual([])
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toBeUndefined()
  })

  it("maps browser permission removal events to policy and broadcasts", async () => {
    const browser = getMockBrowser()

    await reconcileBrowserPermissionEvent({ origins: ["https://example.com/*"] }, false)

    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({
      sites: {
        "https://example.com": expect.objectContaining({ state: "revoked", source: "browser-event" }),
      },
    })
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({
      payload: expect.objectContaining({ action: "changed", granted: false }),
    }))
  })

  it("preserves all origins from multi-origin browser permission events", async () => {
    const browser = getMockBrowser()

    await reconcileBrowserPermissionEvent({ origins: ["https://example.com/*", "https://second.test/*"] }, false)

    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({
      sites: {
        "https://example.com": expect.objectContaining({ state: "revoked" }),
        "https://second.test": expect.objectContaining({ state: "revoked" }),
      },
    })
  })

  it("reports all-sites grants separately from current-origin grants", async () => {
    const browser = getMockBrowser()

    const result = await requestPageAccess("all-sites")
    const state = await getPageAccessState()

    expect(result.message).toBe("Astra can help on all supported sites.")
    expect(findForbiddenUserCopyTerms(result.message)).toEqual([])
    expect(browser.permissions.request).toHaveBeenCalledWith({ origins: ["http://*/*", "https://*/*"] })
    expect(state.allSitesGranted).toBe(true)
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({
      payload: expect.objectContaining({ scope: "all-sites", granted: true }),
    }))
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(8, expect.objectContaining({
      payload: expect.objectContaining({ scope: "all-sites", granted: true }),
    }))
  })

  it("lets a page grant restore a runtime-revoked site without persisting browser host permissions", async () => {
    const browser = getMockBrowser()
    browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY] = {
      version: 1,
      allSitesGranted: false,
      allSitesState: null,
      sites: {
        "https://example.com": {
          state: "revoked",
          scope: "site",
          updatedAt: "2026-05-13T00:00:00.000Z",
          source: "runtime-policy",
        },
      },
    }

    const result = await requestPageAccess("page")

    expect(result.ok).toBe(true)
    expect(result.message).toBe("Astra can help on this page once.")
    expect(findForbiddenUserCopyTerms(result.message)).toEqual([])
    expect(browser.permissions.request).not.toHaveBeenCalled()
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({
      sites: {
        "https://example.com": expect.objectContaining({ state: "granted", source: "runtime-policy" }),
      },
    })
    await expect(isPageAccessAllowedForUrl("https://example.com/article")).resolves.toBe(true)
  })

  it("all-sites grant clears site revokes so the broad runtime grant is effective", async () => {
    const browser = getMockBrowser()
    browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY] = {
      version: 1,
      allSitesGranted: false,
      allSitesState: null,
      sites: {
        "https://example.com": {
          state: "revoked",
          scope: "site",
          updatedAt: "2026-05-13T00:00:00.000Z",
          source: "runtime-policy",
        },
      },
    }

    const result = await requestPageAccess("all-sites")

    expect(result.ok).toBe(true)
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({
      allSitesState: "granted",
      sites: {},
    })
    await expect(isPageAccessAllowedForUrl("https://example.com/article")).resolves.toBe(true)
  })

  it("all-sites revoke disables runtime access even when broad host permissions remain in the manifest", async () => {
    const browser = getMockBrowser()
    browser.permissions.contains.mockResolvedValue(true)
    browser.permissions.remove.mockResolvedValue(false)

    const result = await revokePageAccess("all-sites")

    expect(result.ok).toBe(true)
    expect(result.message).toBe("Astra is paused on supported sites.")
    expect(findForbiddenUserCopyTerms(result.message)).toEqual([])
    expect(result.browserPermissionChanged).toBe(false)
    expect(result.state.allSitesGranted).toBe(false)
    expect(browser.__storage[PAGE_ACCESS_POLICY_STORAGE_KEY]).toMatchObject({ allSitesState: "revoked" })
    await expect(isPageAccessAllowedForUrl("https://other.test/article")).resolves.toBe(false)
  })
})
