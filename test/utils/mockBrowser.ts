import { vi } from "vitest"

type StorageData = Record<string, unknown>

function cloneStorageSubset(storage: StorageData, keys?: string | string[]) {
  if (typeof keys === "string") {
    return { [keys]: storage[keys] }
  }

  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, storage[key]]))
  }

  return { ...storage }
}

export function createMockBrowser(initialStorage: StorageData = {}) {
  const storage: StorageData = { ...initialStorage }

  return {
    __storage: storage,
    storage: {
      local: {
        get: vi.fn((keys?: string | string[]) => Promise.resolve(cloneStorageSubset(storage, keys))),
        set: vi.fn((values: StorageData) => {
          Object.assign(storage, values)
          return Promise.resolve()
        }),
        clear: vi.fn(() => {
          Object.keys(storage).forEach((key) => {
            delete storage[key]
          })
          return Promise.resolve()
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onInstalled: {
        addListener: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      sendMessage: vi.fn(),
      onActivated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    commands: {
      onCommand: {
        addListener: vi.fn(),
      },
    },
  }
}

export function setMockBrowser(browser: unknown) {
  ;(globalThis as { __ASTRA_TEST_BROWSER__?: unknown }).__ASTRA_TEST_BROWSER__ = browser
  return browser
}
