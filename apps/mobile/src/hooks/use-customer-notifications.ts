import { useCallback, useEffect, useMemo, useState } from "react";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export type CustomerNotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  type: string;
  isRead: boolean;
  relatedAppointmentId: string | null;
  relatedBookingRequestId: string | null;
  relatedOfferId: string | null;
};

const NOTIFICATION_LOOKBACK_DAYS = 3;

export function useCustomerNotifications(limit = 50) {
  const { user } = useSession();
  const [items, setItems] = useState<CustomerNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const unreadCount = useMemo(() => items.filter((item) => !item.isRead).length, [items]);

  const refresh = useCallback(async () => {
    if (!mobileSupabase || !user?.id) {
      setItems([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    try {
      const cutoff = new Date(Date.now() - NOTIFICATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const primarySelect =
        "id,title,body,kind,is_read,sent_at,related_appointment_id,related_booking_request_id,related_offer_id";
      const legacySelect =
        "id,title,body,kind,is_read,sent_at,related_appointment_id,related_offer_id";

      let data:
        | Array<Record<string, unknown>>
        | null = null;

      const primaryResult = await mobileSupabase
        .from("customer_notifications")
        .select(primarySelect)
        .gte("sent_at", cutoff)
        .order("sent_at", { ascending: false })
        .limit(limit);

      if (primaryResult.error) {
        const message = primaryResult.error.message ?? "";
        const missingRelatedBookingColumn =
          message.includes("related_booking_request_id") ||
          message.includes("column customer_notifications.related_booking_request_id does not exist");

        if (!missingRelatedBookingColumn) {
          throw primaryResult.error;
        }

        const legacyResult = await mobileSupabase
          .from("customer_notifications")
          .select(legacySelect)
          .gte("sent_at", cutoff)
          .order("sent_at", { ascending: false })
          .limit(limit);

        if (legacyResult.error) {
          throw legacyResult.error;
        }

        data = (legacyResult.data ?? []) as Array<Record<string, unknown>>;
      } else {
        data = (primaryResult.data ?? []) as Array<Record<string, unknown>>;
      }

      setItems(
        (data ?? []).map((row) => ({
          id: String(row.id ?? ""),
          title: typeof row.title === "string" ? row.title : "",
          body: typeof row.body === "string" ? row.body : "",
          createdAt: typeof row.sent_at === "string" ? row.sent_at : "",
          type: typeof row.kind === "string" ? row.kind : "GENERAL",
          isRead: Boolean(row.is_read),
          relatedAppointmentId:
            typeof row.related_appointment_id === "string" ? row.related_appointment_id : null,
          relatedBookingRequestId:
            typeof row.related_booking_request_id === "string" ? row.related_booking_request_id : null,
          relatedOfferId: typeof row.related_offer_id === "string" ? row.related_offer_id : null,
        })),
      );
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [limit, user?.id]);

  const markAsRead = useCallback(async (id: string) => {
    if (!mobileSupabase) return;
    await mobileSupabase
      .from("customer_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!mobileSupabase || !items.some((item) => !item.isRead)) return;
    const unreadIds = items.filter((item) => !item.isRead).map((item) => item.id);
    await mobileSupabase
      .from("customer_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds);
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }, [items]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [refresh]);

  useEffect(() => {
    if (!mobileSupabase || !user?.id) {
      return;
    }

    const client = mobileSupabase;
    const channelName = `customer-notifications:${user.id}:${limit}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const channel = client
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_notifications" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [limit, refresh, user?.id]);

  return {
    items,
    unreadCount,
    isLoading,
    isRefreshing,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
