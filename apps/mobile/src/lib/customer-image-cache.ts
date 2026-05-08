import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { getCustomerImageUri, type CustomerImageIntent } from "@/src/lib/customer-image-url";

const IMAGE_CACHE_KEY = "customer-image-cache:manifest";
const imageMemorySet = new Set<string>();

export function hasPrefetchedCustomerImage(url: string | null | undefined) {
  const normalizedUrl = typeof url === "string" ? url.trim() : "";
  return normalizedUrl.length > 0 && imageMemorySet.has(normalizedUrl);
}

function normalizeImageUrls(urls: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      urls
        .map((url) => (typeof url === "string" ? url.trim() : ""))
        .filter(Boolean),
    ),
  );
}

async function readManifest() {
  if (imageMemorySet.size) {
    return Array.from(imageMemorySet);
  }

  try {
    const raw = await AsyncStorage.getItem(IMAGE_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    for (const item of parsed) {
      if (typeof item === "string" && item.trim()) {
        imageMemorySet.add(item);
      }
    }
    return Array.from(imageMemorySet);
  } catch {
    return [];
  }
}

async function writeManifest(urls: string[]) {
  try {
    await AsyncStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(urls));
  } catch {
    // Ignore persistence failures and keep in-memory manifest alive.
  }
}

export async function prefetchCustomerImages(urls: Array<string | null | undefined>) {
  const normalized = normalizeImageUrls(urls);
  if (!normalized.length) return;

  const knownUrls = new Set(await readManifest());
  const nextUrls = new Set(knownUrls);

  for (const url of normalized) {
    nextUrls.add(url);
  }

  const uncachedUrls = normalized.filter((url) => !knownUrls.has(url));
  if (uncachedUrls.length) {
    await Image.prefetch(uncachedUrls, "memory-disk");
  }

  for (const url of nextUrls) {
    imageMemorySet.add(url);
  }
  await writeManifest(Array.from(nextUrls));
}

export async function prefetchCustomerImagesForIntent(
  urls: Array<string | null | undefined>,
  intent: CustomerImageIntent,
) {
  await prefetchCustomerImages(urls.map((url) => getCustomerImageUri(url, intent)));
}

export async function clearCustomerImageCacheManifest() {
  imageMemorySet.clear();
  try {
    await AsyncStorage.removeItem(IMAGE_CACHE_KEY);
  } catch {
    // Ignore clear failures.
  }
}

export async function getCustomerImageCacheManifestSizeBytes() {
  try {
    const raw = await AsyncStorage.getItem(IMAGE_CACHE_KEY);
    return raw ? raw.length : 0;
  } catch {
    return 0;
  }
}
