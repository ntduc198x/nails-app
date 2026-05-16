import {
  clearCustomerProfileCache,
  readCustomerProfileCache,
  writeCustomerProfileCache,
} from "@/src/lib/customer-profile-cache";

export type { CachedCustomerProfile as CachedProfile } from "@/src/lib/customer-profile-cache";

/**
 * @deprecated Use `readCustomerProfileCache`.
 */
export const readProfileCache = readCustomerProfileCache;

/**
 * @deprecated Use `writeCustomerProfileCache`.
 */
export const writeProfileCache = writeCustomerProfileCache;

/**
 * @deprecated Use `clearCustomerProfileCache`.
 */
export const clearProfileCache = clearCustomerProfileCache;
