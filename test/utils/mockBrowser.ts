import { vi } from "vitest"

type StorageData = Record<string, unknown>
type Listener<TArgs extends unknown[]> = (...args: TArgs) => unknown
type StorageChangeRecord = Record<string, { oldValue?: unknown; newValue?: unknown }>

function cloneStorageSubset(storage: StorageData, keys?: string | string[]) {
  if (typeof keys === "string") {
    return { [keys]: storage[keys] }
  }

  if (Array.isArray(keys)) {
    return Object.fromEntries(keys.map((key) => [key, storage[key]]))
  }

  return { ...storage }
}

function createListenerBus<TArgs extends unknown[] = []>() {
  const listeners = new Set<Listener<TArgs>>()

  return {
    addListener: vi.fn((listener: Listener<TArgs>) => {
      listeners.add(listener)
    }),
    removeListener: vi.fn((listener: Listener<TArgs>) => {
      listeners.delete(listener)
    }),
    async emit(...args: TArgs) {
      const results: unknown[] = []
      for (const listener of listeners) {
        results.push(await listener(...args))
      }
      return results
    },
    clear() {
      listeners.clear()
    },
    get size() {
      return listeners.size
    },
  }
}

export function createMockBrowser(initialStorage: StorageData = {}) {
  const storage: StorageData = { ...initialStorage }
  const runtimeMessageBus = createListenerBus<[unknown, unknown, (response?: unknown) => void]>()
  const installedBus = createListenerBus<[unknown]>()
  const commandBus = createListenerBus<[string]>()
  const tabActivatedBus = createListenerBus<[unknown]>()
  const storageChangedBus = createListenerBus<[StorageChangeRecord, string]>()

  return {
    __storage: storage,
    __emitRuntimeMessage: runtimeMessageBus.emit,
    __emitInstalled: installedBus.emit,
    __emitCommand: commandBus.emit,
    __emitTabActivated: tabActivatedBus.emit,
    __emitStorageChange: storageChangedBus.emit,
    __resetListeners: () => {
      runtimeMessageBus.clear()
      installedBus.clear()
      commandBus.clear()
      tabActivatedBus.clear()
      storageChangedBus.clear()
    },
    storage: {
      onChanged: {
        addListener: storageChangedBus.addListener,
        removeListener: storageChangedBus.removeListener,
      },
      local: {
        get: vi.fn((keys?: string | string[]) => Promise.resolve(cloneStorageSubset(storage, keys))),
        set: vi.fn((values: StorageData) => {
          Object.assign(storage, values)
          return Promise.resolve()
        }),
        remove: vi.fn((keys: string | string[]) => {
          const keysToRemove = Array.isArray(keys) ? keys : [keys]
          keysToRemove.forEach((key) => {
            delete storage[key]
          })
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
      getURL: vi.fn((path: string) => `chrome-extension://mock-id${path}`),
      onMessage: {
        addListener: runtimeMessageBus.addListener,
        removeListener: runtimeMessageBus.removeListener,
      },
      onInstalled: {
        addListener: installedBus.addListener,
        removeListener: installedBus.removeListener,
      },
    },
    tabs: {
      query: vi.fn(() => Promise.resolve([])),
      create: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
      sendMessage: vi.fn(),
      onActivated: {
        addListener: tabActivatedBus.addListener,
        removeListener: tabActivatedBus.removeListener,
      },
    },
    commands: {
      onCommand: {
        addListener: commandBus.addListener,
        removeListener: commandBus.removeListener,
      },
    },
  }
}

export function setMockBrowser(browser: unknown) {
  ;(globalThis as { __ASTRA_TEST_BROWSER__?: unknown }).__ASTRA_TEST_BROWSER__ = browser
  return browser
}
