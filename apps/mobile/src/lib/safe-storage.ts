import * as SecureStore from "expo-secure-store";

type AsyncKeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

declare global {
  var __nailsMobileMemoryStorage__: Map<string, string> | undefined;
}

const memoryStorage =
  globalThis.__nailsMobileMemoryStorage__ ?? (globalThis.__nailsMobileMemoryStorage__ = new Map<string, string>());

let secureStoreAvailablePromise: Promise<boolean> | null = null;

function isSecureStoreAvailable() {
  if (!secureStoreAvailablePromise) {
    secureStoreAvailablePromise = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureStoreAvailablePromise;
}

export const safeStorage: AsyncKeyValueStorage = {
  async getItem(key) {
    if (await isSecureStoreAvailable()) {
      return SecureStore.getItemAsync(key);
    }
    return memoryStorage.get(key) ?? null;
  },
  async setItem(key, value) {
    if (await isSecureStoreAvailable()) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    memoryStorage.set(key, value);
  },
  async removeItem(key) {
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    memoryStorage.delete(key);
  },
};
