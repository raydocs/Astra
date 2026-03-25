export const browser: any = new Proxy({}, {
  get(_target, property) {
    return (globalThis as { __ASTRA_TEST_BROWSER__?: Record<PropertyKey, unknown> })
      .__ASTRA_TEST_BROWSER__?.[property]
  },
})

export function defineBackground<T>(config: T): T {
  return config
}

export function defineContentScript<T>(config: T): T {
  return config
}
