export interface MobileKeyValueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export class MemoryMobileKeyValueStorage implements MobileKeyValueStorage {
  private readonly values = new Map<string, string>()

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value)
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key)
  }
}

export const MOBILE_APP_STATE_STORAGE_KEY = "astra.mobile.app-state.v1"
