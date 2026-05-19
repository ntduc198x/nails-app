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
};

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
      const { data, error } = await mobileSupabase
        .from("customer_notifications")
        .select("id,title,body,kind,is_read,sent_at")
        .order("sent_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      setItems(
        (data ?? []).map((row) => ({
          id: String(row.id ?? ""),
          title: typeof row.title === "string" ? row.title : "",
          body: typeof row.body === "string" ? row.body : "",
          createdAt: typeof row.sent_at === "string" ? row.sent_at : "",
          type: typeof row.kind === "string" ? row.kind : "GENERAL",
          isRead: Boolean(row.is_read),
        })),
      );
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
