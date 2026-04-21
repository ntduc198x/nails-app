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

export const safeStorage: AsyncKeyValueStorage = {
  async getItem(key) {
    return memoryStorage.get(key) ?? null;
  },
  async setItem(key, value) {
    memoryStorage.set(key, value);
  },
  async removeItem(key) {
    memoryStorage.delete(key);
  },
};
