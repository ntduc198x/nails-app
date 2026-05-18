import { listCustomerUpcomingBookings, type CustomerUpcomingBookingItem, type SharedSupabaseClient } from "@nails/shared";
import { hydrateCachedValue, writeCachedValue } from "@/src/lib/customer-feed-cache";

type BookingUpcomingDraft = {
  bookingRequestId: string;
  requestedService: string;
  requestedStartAt: string;
  requestedEndAt?: string | null;
  preferredStaff?: string | null;
};

export const CUSTOMER_UPCOMING_BOOKINGS_LIMITS_TO_PREWARM = [6, 8, 12] as const;

function getUpcomingBookingsCacheKey(userId: string, limit: number) {
  return `customer-upcoming-bookings:${userId}:${limit}`;
}

function upsertUpcomingBookingItem(items: CustomerUpcomingBookingItem[], nextItem: CustomerUpcomingBookingItem, limit: number) {
  const deduped = items.filter((item) => item.id !== nextItem.id);
  return [nextItem, ...deduped]
    .sort((left, right) => new Date(left.requestedStartAt).getTime() - new Date(right.requestedStartAt).getTime())
    .slice(0, limit);
}

export async function prewarmCustomerUpcomingBookingsCache(
  client: SharedSupabaseClient,
  userId: string,
  limits: readonly number[] = CUSTOMER_UPCOMING_BOOKINGS_LIMITS_TO_PREWARM,
) {
  await Promise.all(
    limits.map(async (limit) => {
      const items = await listCustomerUpcomingBookings(client, { limit });
      await writeCachedValue(getUpcomingBookingsCacheKey(userId, limit), items);
    }),
  );
}

export async function writeOptimisticBookingIntoUpcomingBookingsCache(
  userId: string,
  draft: BookingUpcomingDraft,
  limits: readonly number[] = CUSTOMER_UPCOMING_BOOKINGS_LIMITS_TO_PREWARM,
) {
  const optimisticItem: CustomerUpcomingBookingItem = {
    id: draft.bookingRequestId,
    requestedService: draft.requestedService.trim() || "Yêu cầu đặt lịch",
    preferredStaff: draft.preferredStaff?.trim() || null,
    requestedStartAt: draft.requestedStartAt,
    requestedEndAt: draft.requestedEndAt ?? null,
    status: "NEW",
    appointmentId: null,
  };

  await Promise.all(
    limits.map(async (limit) => {
      const cacheKey = getUpcomingBookingsCacheKey(userId, limit);
      const cached = await hydrateCachedValue<CustomerUpcomingBookingItem[]>(cacheKey);
      const currentItems = Array.isArray(cached?.value) ? cached.value : [];
      await writeCachedValue(cacheKey, upsertUpcomingBookingItem(currentItems, optimisticItem, limit));
    }),
  );
}
