import { type CustomerHistoryItem, type CustomerMembershipOffer, type CustomerUpcomingBookingItem } from "@nails/shared";

export type CustomerNotificationRouteItem = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  type: string;
  is_read: boolean;
  relatedAppointmentId: string | null;
  relatedBookingRequestId?: string | null;
  relatedOfferId: string | null;
};

type NotificationNavigationArgs = {
  item: CustomerNotificationRouteItem;
  historyItems: CustomerHistoryItem[];
  upcomingItems: CustomerUpcomingBookingItem[];
  offers: CustomerMembershipOffer[];
};

export function normalizeNotificationType(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function isBookingNotificationType(value: string) {
  const normalized = normalizeNotificationType(value);
  return normalized.includes("booking") || normalized.includes("lich");
}

export function resolveNotificationTargets({
  item,
  historyItems,
  upcomingItems,
  offers,
}: NotificationNavigationArgs) {
  const matchedHistoryItem = item.relatedAppointmentId
    ? historyItems.find(
        (historyItem) =>
          historyItem.appointmentId === item.relatedAppointmentId ||
          historyItem.id === item.relatedAppointmentId,
      ) ?? null
    : null;
  const matchedOffer = item.relatedOfferId
    ? offers.find(
        (offer) =>
          offer.id === item.relatedOfferId ||
          offer.claimId === item.relatedOfferId,
      ) ?? null
    : null;

  if (matchedHistoryItem || matchedOffer) {
    return { matchedHistoryItem, matchedOffer, matchedUpcomingItem: null };
  }

  const matchedUpcomingItem = item.relatedAppointmentId
    ? upcomingItems.find(
        (upcomingItem) =>
          upcomingItem.appointmentId === item.relatedAppointmentId ||
          upcomingItem.id === item.relatedAppointmentId,
      ) ?? null
    : null;

  return {
    matchedHistoryItem,
    matchedOffer,
    matchedUpcomingItem,
  };
}

export function getNotificationDestination({
  item,
  historyItems,
  upcomingItems,
  offers,
}: NotificationNavigationArgs) {
  const normalizedType = normalizeNotificationType(item.type);
  const { matchedHistoryItem, matchedOffer, matchedUpcomingItem } = resolveNotificationTargets({
    item,
    historyItems,
    upcomingItems,
    offers,
  });

  if (matchedOffer) {
    return {
      pathname: "/(customer)/(tabs)/membership" as const,
      params: {
        focusSection: "offers" as const,
        highlightOfferId: matchedOffer.id,
      },
    };
  }

  if (item.relatedOfferId) {
    return {
      pathname: "/(customer)/(tabs)/membership" as const,
      params: {
        focusSection: "offers" as const,
        highlightOfferId: item.relatedOfferId,
      },
    };
  }

  if (matchedHistoryItem) {
    return {
      pathname: "/(customer)/(tabs)/account" as const,
      params: {
        tab: "history" as const,
        focusSection: "history" as const,
        highlightAppointmentId: matchedHistoryItem.appointmentId ?? matchedHistoryItem.id,
      },
    };
  }

  if (matchedUpcomingItem) {
    return {
      pathname: "/(customer)/(tabs)/booking" as const,
      params: {
        focusSection: "upcoming" as const,
        highlightAppointmentId: matchedUpcomingItem.appointmentId ?? matchedUpcomingItem.id,
      },
    };
  }

  if (item.relatedAppointmentId) {
    return null;
  }

  if (isBookingNotificationType(item.type)) {
    return {
      pathname: "/(customer)/(tabs)/account" as const,
      params: {
        tab: "history" as const,
        focusSection: "history" as const,
      },
    };
  }

  if (
    normalizedType.includes("promo") ||
    normalizedType.includes("khuyen mai") ||
    normalizedType.includes("membership") ||
    normalizedType.includes("thanh vien") ||
    normalizedType.includes("tier")
  ) {
    return {
      pathname: "/(customer)/(tabs)/membership" as const,
      params: {
        focusSection: "offers" as const,
      },
    };
  }

  return null;
}

export function canNavigateNotification(args: NotificationNavigationArgs) {
  return getNotificationDestination(args) !== null;
}
