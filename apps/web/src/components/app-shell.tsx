"use client";

import {
  loadManageNotifications,
  type ManageNotificationItem,
} from "@/lib/manage-notifications";
import {
  clearStoredSessionToken,
  createAppSession,
  getSafeSupabaseSession,
  logoutWithSessionCleanup,
  recoverFromInvalidAuthState,
  validateAppSession,
} from "@/lib/app-session";
import { getOrCreateRole, type AppRole } from "@/lib/auth";
import { clearDomainCaches } from "@/lib/domain";
import { getRoleLabel } from "@/lib/role-labels";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const navGroups = [
  {
    label: "Vận hành",
    href: "/manage/booking-requests",
    items: [
      { href: "/manage/booking-requests", label: "Web Booking", desc: "Booking từ landing page" },
      { href: "/manage/appointments", label: "Điều phối lịch", desc: "Lịch hẹn, check-in, mở phiếu, vận hành" },
      { href: "/manage/checkout", label: "Thanh toán", desc: "Ticket, thanh toán, hóa đơn" },
      { href: "/manage/shifts", label: "Ca làm", desc: "Chấm công và ca trong ngày" },
    ],
  },
  {
    label: "Thiết lập",
    href: "/manage/services",
    items: [
      { href: "/manage/services", label: "Dịch vụ", desc: "Menu dịch vụ và VAT" },
      { href: "/manage/resources", label: "Ghế/Bàn", desc: "Quản lý chair, table, room" },
      { href: "/manage/team", label: "Nhân sự", desc: "Role và nhân sự" },
    ],
  },
  {
    label: "Báo cáo",
    href: "/manage/reports",
    items: [
      { href: "/manage/customers", label: "CRM khách", desc: "Hồ sơ khách, follow-up, chăm sóc lại" },
      { href: "/manage/reports", label: "Báo cáo", desc: "Doanh thu và phân tích" },
      { href: "/manage/tax-books", label: "Sổ thuế", desc: "Mẫu S1a xuất file" },
    ],
  },
] as const;

function canAccess(role: AppRole, href: string) {
  if (href === "/manage/account") return true;
  if (role === "OWNER") return true;
  if (role === "MANAGER") return href !== "/manage/tax-books";
  if (role === "RECEPTION") {
    return ["/manage", "/manage/booking-requests", "/manage/appointments", "/manage/resources", "/manage/checkout", "/manage/shifts", "/manage/customers"].includes(href);
  }
  if (role === "TECH") {
    return ["/manage", "/manage/booking-requests", "/manage/appointments", "/manage/checkout", "/manage/shifts"].includes(href);
  }
  if (role === "ACCOUNTANT") {
    return ["/manage", "/manage/checkout", "/manage/reports", "/manage/tax-books"].includes(href);
  }
  return false;
}

type AuthCache = { userId: string; email: string; role: AppRole; cachedAt: number };
let authCache: AuthCache | null = null;
const AUTH_CACHE_TTL = 5 * 60 * 1000;
const SESSION_VALIDATION_INTERVAL = 3_000;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<AppRole>("RECEPTION");
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionReplaced, setSessionReplaced] = useState<{ ownerName?: string | null } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ManageNotificationItem[]>([]);
  const [notificationsSeenAt, setNotificationsSeenAt] = useState<string | null>(null);
  const [notificationTab, setNotificationTab] = useState<"action" | "feed">("action");

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        if (!supabase) {
          if (mounted) setLoading(false);
          return;
        }

        const { session, invalidRefreshToken } = await getSafeSupabaseSession();
        if (invalidRefreshToken) {
          clearDomainCaches();
          authCache = null;
          router.replace("/login");
          return;
        }
        if (!session?.user) {
          router.replace("/login");
          return;
        }

        const validation = await validateAppSession();
        if (!validation.valid) {
          if (validation.reason === "SESSION_REPLACED") {
            setSessionReplaced({ ownerName: validation.ownerName });
          }
          clearDomainCaches();
          authCache = null;
          sessionStorage.removeItem("nails.auth.cache");
          clearStoredSessionToken();
          await recoverFromInvalidAuthState();
          router.replace("/login");
          return;
        }

        const cached = authCache && authCache.userId === session.user.id && Date.now() - authCache.cachedAt < AUTH_CACHE_TTL ? authCache : null;
        if (cached) {
          if (!mounted) return;
          setEmail(cached.email);
          setRole(cached.role);
          setLoading(false);
          return;
        }

        try {
          const raw = sessionStorage.getItem("nails.auth.cache");
          if (raw) {
            const parsed = JSON.parse(raw) as AuthCache;
            if (parsed.userId === session.user.id && Date.now() - parsed.cachedAt < AUTH_CACHE_TTL) {
              authCache = parsed;
              if (!mounted) return;
              setEmail(parsed.email);
              setRole(parsed.role);
              setLoading(false);
              return;
            }
          }
        } catch {}

        const userRole = await getOrCreateRole(session.user.id);
        if (!mounted) return;

        const nextCache: AuthCache = {
          userId: session.user.id,
          email: session.user.email ?? "",
          role: userRole,
          cachedAt: Date.now(),
        };
        authCache = nextCache;
        sessionStorage.setItem("nails.auth.cache", JSON.stringify(nextCache));

        setEmail(nextCache.email);
        setRole(nextCache.role);
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setAuthError(e instanceof Error ? e.message : "Lỗi xác thực / phân quyền");
        setLoading(false);
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!supabase) return;
    let disposed = false;

    async function validateSession() {
      if (!supabase) return;
      const { session, invalidRefreshToken } = await getSafeSupabaseSession();
      if (invalidRefreshToken && !disposed) {
        clearDomainCaches();
        authCache = null;
        sessionStorage.removeItem("nails.auth.cache");
        clearStoredSessionToken();
        router.replace("/login");
        return;
      }
      if (!session?.user || disposed) return;

      const validation = await validateAppSession();
      if (!validation.valid && !disposed) {
        clearDomainCaches();
        authCache = null;
        sessionStorage.removeItem("nails.auth.cache");
        clearStoredSessionToken();
        await recoverFromInvalidAuthState();
        router.replace("/login");
      }
    }

    void validateSession();
    const id = setInterval(() => {
      void validateSession();
    }, SESSION_VALIDATION_INTERVAL);

    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [router]);

  useEffect(() => {
    if (!supabase) return;
    let disposed = false;

    async function ensureAppSession() {
      if (!supabase) return;
      const { session, invalidRefreshToken } = await getSafeSupabaseSession();
      if (invalidRefreshToken || !session?.user || disposed) return;

      const validation = await validateAppSession();
      if (!validation.valid && validation.reason === "INVALID_TOKEN") {
        try {
          await createAppSession();
        } catch {}
      }
    }

    void ensureAppSession();
  }, [role]);

  useEffect(() => {
    if (!email) return;
    try {
      const stored = sessionStorage.getItem(`nails.manage.notifications.seenAt.${email}`);
      setNotificationsSeenAt(stored);
    } catch {
      setNotificationsSeenAt(null);
    }
  }, [email]);

  useEffect(() => {
    if (!["OWNER", "MANAGER", "RECEPTION", "TECH", "ACCOUNTANT"].includes(role)) return;
    let disposed = false;

    async function loadNotifications() {
      try {
        const rows = await loadManageNotifications(role);
        if (!disposed) setNotifications(rows);
      } catch {}
    }

    void loadNotifications();
    const id = setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [role]);

  useEffect(() => {
    if (!notificationsOpen || !email) return;
    const seenAt = new Date().toISOString();
    setNotificationsSeenAt(seenAt);
    try {
      sessionStorage.setItem(`nails.manage.notifications.seenAt.${email}`, seenAt);
    } catch {}
  }, [email, notificationsOpen]);

  const visibleGroups = useMemo(() => {
    if (role === "TECH") {
      const operationalGroup = navGroups.find((group) => group.label === "Vận hành");
      return (operationalGroup?.items ?? []).filter((item) => canAccess(role, item.href)).map((item) => ({
        label: item.label,
        href: item.href,
        items: [item],
      }));
    }

    return navGroups
      .map((group) => {
        const baseItems = group.items.filter((item) => {
          if (group.href === "/manage/services" && item.href === "/manage/customers") return false;
          return canAccess(role, item.href);
        });

        const items = group.href === "/manage/reports" && canAccess(role, "/manage/customers")
          ? [
              { href: "/manage/customers", label: "CRM khách", desc: "Hồ sơ khách, follow-up, chăm sóc lại" },
              ...baseItems.filter((item) => item.href !== "/manage/customers"),
            ]
          : baseItems;

        return {
          ...group,
          items,
        };
      })
      .filter((group) => group.items.length > 0);
  }, [role]);

  const actionableNotificationCount = useMemo(
    () => notifications.filter((item) => item.kind === "booking_request" && item.actionRequired).length,
    [notifications],
  );

  const unreadNotificationCount = useMemo(() => {
    const seenAtMs = notificationsSeenAt ? new Date(notificationsSeenAt).getTime() : 0;
    return notifications.filter((item) => {
      if (item.actionRequired) return true;
      return new Date(item.createdAt).getTime() > seenAtMs;
    }).length;
  }, [notifications, notificationsSeenAt]);

  const actionNotifications = useMemo(
    () => notifications.filter((item) => item.actionRequired),
    [notifications],
  );

  const feedNotifications = useMemo(
    () => notifications.filter((item) => !item.actionRequired),
    [notifications],
  );

  const visibleNotifications = notificationTab === "action" ? actionNotifications : feedNotifications;

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      clearDomainCaches();
      if (!session) {
        authCache = null;
        sessionStorage.removeItem("nails.auth.cache");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    for (const group of visibleGroups) {
      for (const item of group.items) router.prefetch(item.href);
    }
  }, [router, visibleGroups]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!notificationsOpen) return;
    setNotificationTab(actionNotifications.length ? "action" : "feed");
  }, [actionNotifications.length, notificationsOpen]);

  useEffect(() => {
    if (!loading && !canAccess(role, pathname)) {
      router.replace(visibleGroups[0]?.items[0]?.href ?? "/manage");
    }
  }, [loading, pathname, role, router, visibleGroups]);

  async function onLogout() {
    if (!supabase) return;
    await logoutWithSessionCleanup();
    clearDomainCaches();
    authCache = null;
    sessionStorage.removeItem("nails.auth.cache");
    router.replace("/login");
  }

  function renderItemLabel(label: string, href: string) {
    const isBookingRequests = href === "/manage/booking-requests";
    return (
      <span className="inline-flex items-center gap-2">
        <span>{label}</span>
        {isBookingRequests && actionableNotificationCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {actionableNotificationCount > 99 ? "99+" : actionableNotificationCount}
          </span>
        )}
      </span>
    );
  }

  function renderNotificationTone(item: ManageNotificationItem) {
    if (item.actionRequired) return "border-amber-200 bg-amber-50";
    if (item.kind === "customer_checked_in") return "border-blue-200 bg-blue-50";
    if (item.kind === "customer_checked_out") return "border-emerald-200 bg-emerald-50";
    return "border-neutral-200 bg-white";
  }

  if (loading) {
    return (
      <div className="p-8 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  if (authError) {
    return (
      <div className="space-y-3 p-8 text-sm">
        <p className="font-semibold text-red-600">Không thể xác thực phiên đăng nhập.</p>
        <p className="text-neutral-700">Chi tiết: {authError}</p>
        <button onClick={() => router.replace("/login")} className="rounded border px-3 py-2 text-xs">
          Về trang login
        </button>
      </div>
    );
  }

  if (sessionReplaced) {
    return (
      <div className="space-y-3 p-8 text-sm">
        <p className="font-semibold text-orange-600">Phiên đăng nhập đã bị thay thế.</p>
        <p className="text-neutral-700">
          {sessionReplaced.ownerName
            ? `Tài khoản "${sessionReplaced.ownerName}" đã đăng nhập trên thiết bị này.`
            : "Tài khoản khác đã đăng nhập trên thiết bị này."}
        </p>
        <p className="text-neutral-500">Bạn cần đăng nhập lại để tiếp tục.</p>
        <button onClick={() => router.replace("/login")} className="rounded border px-3 py-2 text-xs">
          Đăng nhập lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur" style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(255,253,249,.95)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 p-3 md:p-4">
          <div>
            <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
              Nails App
            </p>
            <h1 className="text-lg font-semibold">Chạm Beauty</h1>
          </div>

          <nav className="hidden items-center gap-2 text-sm md:flex">
            {visibleGroups.map((group) => {
              const active = group.items.some((item) => item.href === pathname);
              const hovered = hoveredGroup === group.label;
              const directHref = ("href" in group ? group.href : undefined) ?? group.items[0]?.href ?? "/";

              if (group.items.length === 1) {
                return (
                  <div key={group.label} onMouseEnter={() => setHoveredGroup(group.label)} onMouseLeave={() => setHoveredGroup((current) => (current === group.label ? null : current))}>
                    <Link href={directHref} className="nav-link rounded-full px-4 py-2 text-sm transition" style={active || hovered ? { background: "var(--color-primary)", color: "#fff" } : { color: "var(--color-text-secondary)" }}>
                      {renderItemLabel(group.label, directHref)}
                    </Link>
                  </div>
                );
              }

              return (
                <div key={group.label} className="nav-group group relative" onMouseEnter={() => setHoveredGroup(group.label)} onMouseLeave={() => setHoveredGroup((current) => (current === group.label ? null : current))}>
                  <Link href={directHref} className="nav-group-trigger inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition" style={active || hovered ? { background: "var(--color-primary)", color: "#fff" } : { color: "var(--color-text-secondary)" }}>
                    <span>{group.label}</span>
                    <span className="text-xs opacity-80">▾</span>
                  </Link>
                  <div className="pointer-events-none absolute left-0 top-full z-30 pt-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                    <div className="w-[380px] rounded-[28px] border bg-white p-3 shadow-xl" style={{ borderColor: "var(--color-border)" }}>
                      <div className="grid gap-2">
                        {group.items.map((item) => {
                          const itemActive = pathname === item.href;
                          return (
                            <Link key={item.href} href={item.href} className="rounded-2xl px-4 py-3 transition hover:bg-[#faf7f2]" style={itemActive ? { background: "#fff1f3" } : undefined}>
                              <p className="text-sm font-semibold" style={{ color: itemActive ? "var(--color-primary)" : "var(--color-text-main)" }}>
                                {renderItemLabel(item.label, item.href)}
                              </p>
                              <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>{item.desc}</p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((current) => !current)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white text-base transition hover:bg-[#faf7f2]"
                style={{ borderColor: "var(--color-border)" }}
                aria-label="Mở thông báo"
              >
                <span>🔔</span>
                {unreadNotificationCount > 0 ? (
                  <span className="absolute right-0 top-0 inline-flex min-w-5 -translate-y-1/4 translate-x-1/4 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-full z-40 mt-3 w-[360px] max-w-[calc(100vw-24px)] rounded-[28px] border bg-white p-3 shadow-xl" style={{ borderColor: "var(--color-border)" }}>
                  <div className="flex items-center justify-between gap-3 px-2 py-2">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Thông báo</p>
                      <p className="text-xs text-neutral-500">
                        {unreadNotificationCount > 0 ? `${unreadNotificationCount} mục cần chú ý` : "Chưa có mục mới"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm text-neutral-500"
                      style={{ borderColor: "var(--color-border)" }}
                      aria-label="Đóng thông báo"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 px-2">
                    <button
                      type="button"
                      onClick={() => setNotificationTab("action")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        notificationTab === "action"
                          ? "bg-[var(--color-primary)] text-white"
                          : "border border-neutral-200 bg-white text-neutral-700"
                      }`}
                    >
                      Cần xử lý {actionNotifications.length ? `(${actionNotifications.length})` : ""}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotificationTab("feed")}
                      className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                        notificationTab === "feed"
                          ? "bg-[var(--color-primary)] text-white"
                          : "border border-neutral-200 bg-white text-neutral-700"
                      }`}
                    >
                      Dòng sự kiện {feedNotifications.length ? `(${feedNotifications.length})` : ""}
                    </button>
                  </div>

                  <div className="mt-2 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {visibleNotifications.length ? (
                      visibleNotifications.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setNotificationsOpen(false)}
                          className={`block rounded-2xl border px-4 py-3 transition hover:bg-[#faf7f2] ${renderNotificationTone(item)}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                              <p className="mt-1 text-sm text-neutral-600">{item.message}</p>
                            </div>
                            {item.actionRequired ? (
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-700">
                                Cần xử lý
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-neutral-400">
                            {new Intl.DateTimeFormat("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(item.createdAt))}
                          </p>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-neutral-500" style={{ borderColor: "var(--color-border)" }}>
                        {notificationTab === "action"
                          ? "Hiện không có mục nào cần xử lý."
                          : "Chưa có sự kiện nào gần đây."}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <button className="btn btn-outline md:hidden" type="button" onClick={() => setMobileOpen((v) => !v)}>
              Menu
            </button>

            <div className="hidden items-center gap-2 md:flex">
              <div className="rounded-2xl border px-4 py-2 text-right text-xs" style={{ borderColor: "var(--color-border)", background: "#fff8cf" }}>
                <p style={{ color: "var(--color-text-secondary)" }}>{email || "No session"}</p>
                <p className="font-semibold">{getRoleLabel(role)}</p>
              </div>
              <Link href="/manage/account" className="btn btn-outline px-3 py-2 text-xs">
                Hồ sơ
              </Link>
              <button onClick={onLogout} className="btn btn-outline px-3 py-2 text-xs">
                Đăng xuất
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="mx-auto max-w-7xl border-t px-3 pb-3 pt-2 md:hidden" style={{ borderColor: "var(--color-border)" }}>
            <div className="space-y-3">
              {visibleGroups.map((group) => (
                <details key={group.label} className="rounded-2xl border bg-white p-3" style={{ borderColor: "var(--color-border)" }}>
                  <summary className="cursor-pointer list-none text-sm font-semibold">{group.label}</summary>
                  <div className="mt-3 grid gap-2">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2 hover:bg-[#faf7f2]" onClick={() => setMobileOpen(false)}>
                        <p className="text-sm font-semibold">{renderItemLabel(item.label, item.href)}</p>
                        <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{item.desc}</p>
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
              <div className="rounded-2xl border bg-white p-3 text-xs" style={{ borderColor: "var(--color-border)" }}>
                <div className="rounded-2xl border px-4 py-3" style={{ borderColor: "var(--color-border)", background: "#fff8cf" }}>
                  <p style={{ color: "var(--color-text-secondary)" }}>{email || "No session"}</p>
                  <p className="font-semibold">{getRoleLabel(role)}</p>
                </div>
                <div className="mt-2 grid gap-2">
                  <Link href="/manage/account" className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-[#faf7f2]" style={{ borderColor: "var(--color-border)" }} onClick={() => setMobileOpen(false)}>
                    Hồ sơ & bảo mật
                  </Link>
                  <button onClick={onLogout} className="rounded-xl border px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50" style={{ borderColor: "#fecaca" }}>
                    Đăng xuất
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
      <div className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6 md:py-6">{children}</div>
    </div>
  );
}



