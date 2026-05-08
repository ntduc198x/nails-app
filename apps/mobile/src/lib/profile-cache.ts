import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CachedProfile {
  displayName: string;
  phone: string;
  birthDate: string;
  address: string;
  avatarUrl: string;
  updatedAt: number;
}

const PROFILE_CACHE_KEY_PREFIX = "customer-profile:";

function getCacheKey(userId: string): string {
  return `${PROFILE_CACHE_KEY_PREFIX}${userId}`;
}

export async function readProfileCache(userId: string): Promise<CachedProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (!parsed || typeof parsed.updatedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeProfileCache(
  userId: string,
  data: Omit<CachedProfile, "updatedAt">,
): Promise<void> {
  try {
    const payload: CachedProfile = {
      ...data,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore cache write failures
  }
}

export async function clearProfileCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getCacheKey(userId));
  } catch {
    // Ignore clear failures
  }
}