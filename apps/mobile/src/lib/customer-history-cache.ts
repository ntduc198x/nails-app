import {
  listCustomerHistory,
  type CustomerHistoryItem,
} from "@nails/shared";
import { hydrateCachedValue, writeCachedValue } from "@/src/lib/customer-feed-cache";
import { CUSTOMER_HISTORY_LIMITS_TO_PREWARM } from "@/src/hooks/use-customer-history";
import type { SharedSupabaseClient } from "@nails/shared";

type BookingHistoryDraft = {
  bookingRequestId: string;
  requestedService: string;
  requestedStartAt: string;
  requestedEndAt?: string | null;
  preferredStaff?: string | null;
};

function getHistoryCacheKey(userId: string, limit: number) {
  return `customer-history:${userId}:${limit}`;
}

function upsertHistoryItem(items: CustomerHistoryItem[], nextItem: CustomerHistoryItem, limit: number) {
  const deduped = items.filter((item) => item.id !== nextItem.id);
  return [nextItem, ...deduped]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, limit);
}

export async function prewarmCustomerHistoryCache(
  client: SharedSupabaseClient,
  userId: string,
  limits: readonly number[] = CUSTOMER_HISTORY_LIMITS_TO_PREWARM,
) {
  await Promise.all(
    limits.map(async (limit) => {
      const items = await listCustomerHistory(client, { limit });
      await writeCachedValue(getHistoryCacheKey(userId, limit), items);
    }),
  );
}

export async function writeOptimisticBookingIntoCustomerHistoryCache(
  userId: string,
  draft: BookingHistoryDraft,
  limits: readonly number[] = CUSTOMER_HISTORY_LIMITS_TO_PREWARM,
) {
  const optimisticItem: CustomerHistoryItem = {
    id: `booking-request:${draft.bookingRequestId}`,
    appointmentId: null,
    bookingRequestId: draft.bookingRequestId,
    serviceId: null,
    serviceName: draft.requestedService.trim() || "Yêu cầu đặt lịch",
    serviceImageUrl: null,
    servicePriceLabel: null,
    serviceSummary: null,
    occurredAt: draft.requestedStartAt,
    status: "NEW",
    statusLabel: "Chờ xác nhận",
    source: "booking_request",
    preferredStaff: draft.preferredStaff?.trim() || null,
    endAt: draft.requestedEndAt ?? null,
  };

  await Promise.all(
    limits.map(async (limit) => {
      const cacheKey = getHistoryCacheKey(userId, limit);
      const cached = await hydrateCachedValue<CustomerHistoryItem[]>(cacheKey);
      const currentItems = Array.isArray(cached?.value) ? cached.value : [];
      await writeCachedValue(cacheKey, upsertHistoryItem(currentItems, optimisticItem, limit));
    }),
  );
}
