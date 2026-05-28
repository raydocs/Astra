import * as SecureStore from "expo-secure-store"

import type { MobileKeyValueStorage } from "./mobileStorage"

export function createSecureStoreMobileKeyValueStorage(store = SecureStore): MobileKeyValueStorage {
  return {
    async getItem(key: string) {
      return store.getItemAsync(key)
    },
    async setItem(key: string, value: string) {
      await store.setItemAsync(key, value)
    },
    async removeItem(key: string) {
      await store.deleteItemAsync(key)
    },
  }
}
