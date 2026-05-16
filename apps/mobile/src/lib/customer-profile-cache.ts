import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CachedCustomerProfile {
  displayName: string;
  phone: string;
  birthDate: string;
  address: string;
  avatarUrl: string;
  updatedAt: number;
}

const CUSTOMER_PROFILE_CACHE_KEY_PREFIX = "customer-profile:";

function getCustomerProfileCacheKey(userId: string): string {
  return `${CUSTOMER_PROFILE_CACHE_KEY_PREFIX}${userId}`;
}

export async function readCustomerProfileCache(userId: string): Promise<CachedCustomerProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(getCustomerProfileCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCustomerProfile;
    if (!parsed || typeof parsed.updatedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCustomerProfileCache(
  userId: string,
  data: Omit<CachedCustomerProfile, "updatedAt">,
): Promise<void> {
  try {
    const payload: CachedCustomerProfile = {
      ...data,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(getCustomerProfileCacheKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore cache write failures
  }
}

export async function clearCustomerProfileCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getCustomerProfileCacheKey(userId));
  } catch {
    // Ignore clear failures
  }
}
