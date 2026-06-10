import { clearAdminOperationsCache } from "@/src/hooks/use-admin-operations";
import { clearAdminServicesCache, getAdminServicesCacheSizeBytes } from "@/src/lib/admin-services-cache";
import { clearCustomerFeedCache, getCustomerFeedCacheSizeBytes } from "@/src/lib/customer-feed-cache";
import { clearCustomerImageCache, getCustomerImageCacheManifestSizeBytes } from "@/src/lib/customer-image-cache";

export async function getAdminAppCacheSizeBytes() {
  const [adminBytes, customerFeedBytes, customerImageBytes] = await Promise.all([
    getAdminServicesCacheSizeBytes(),
    getCustomerFeedCacheSizeBytes(),
    getCustomerImageCacheManifestSizeBytes(),
  ]);

  return adminBytes + customerFeedBytes + customerImageBytes;
}

export async function clearAdminAppCache() {
  clearAdminOperationsCache();

  await Promise.all([
    clearAdminServicesCache(),
    clearCustomerFeedCache(),
    clearCustomerImageCache(),
  ]);
}
