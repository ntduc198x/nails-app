import AsyncStorage from "@react-native-async-storage/async-storage";
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
const ASYNC_STORAGE_PREFIX = "safe-storage:";
const SECURE_STORE_SAFE_LIMIT = 1900;

let secureStoreAvailablePromise: Promise<boolean> | null = null;

function getAsyncStorageKey(key: string) {
  return `${ASYNC_STORAGE_PREFIX}${key}`;
}

function isSecureStoreAvailable() {
  if (!secureStoreAvailablePromise) {
    secureStoreAvailablePromise = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureStoreAvailablePromise;
}

export const safeStorage: AsyncKeyValueStorage = {
  async getItem(key) {
    if (await isSecureStoreAvailable()) {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue != null) {
        return secureValue;
      }
    }
    const asyncValue = await AsyncStorage.getItem(getAsyncStorageKey(key)).catch(() => null);
    if (asyncValue != null) {
      return asyncValue;
    }
    return memoryStorage.get(key) ?? null;
  },
  async setItem(key, value) {
    const shouldUseSecureStore = value.length <= SECURE_STORE_SAFE_LIMIT;

    if (shouldUseSecureStore && (await isSecureStoreAvailable())) {
      await SecureStore.setItemAsync(key, value);
      await AsyncStorage.removeItem(getAsyncStorageKey(key)).catch(() => undefined);
      return;
    }

    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
    }
    await AsyncStorage.setItem(getAsyncStorageKey(key), value).catch(() => undefined);
    memoryStorage.set(key, value);
  },
  async removeItem(key) {
    if (await isSecureStoreAvailable()) {
      await SecureStore.deleteItemAsync(key);
    }
    await AsyncStorage.removeItem(getAsyncStorageKey(key)).catch(() => undefined);
    memoryStorage.delete(key);
  },
};
