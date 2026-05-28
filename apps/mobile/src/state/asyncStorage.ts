import AsyncStorage from "@react-native-async-storage/async-storage"

import type { MobileKeyValueStorage } from "./mobileStorage"

export function createAsyncStorageMobileKeyValueStorage(storage = AsyncStorage): MobileKeyValueStorage {
  return {
    async getItem(key: string) {
      return storage.getItem(key)
    },
    async setItem(key: string, value: string) {
      await storage.setItem(key, value)
    },
    async removeItem(key: string) {
      await storage.removeItem(key)
    },
  }
}
