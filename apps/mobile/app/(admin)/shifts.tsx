import Feather from "@expo/vector-icons/Feather";
import { Alert } from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdminBottomNav, getAdminBottomBarPadding, getAdminHeaderTopPadding } from "@/src/features/admin/ui";
import { ensureOrgContext, type AppRole } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";
import { getAdminNavHref } from "@/src/features/admin/navigation";

type Entry = {
  id: string;
  staff_user_id: string;
  clock_in: string;
  clock_out: string | null;
};

type TeamMember = {
  user_id: string;
  display_name: string | null;
  role: string | null;
};

const LONG_OPEN_SHIFT_HOURS = 10;

const c = {
  bg: "#FCFAF8",
  white: "#FFFFFF",
  text: "#2F241D",
  sub: "#8F8479",
  subSoft: "#A89B90",
  soft: "#F3EDE7",
  soft2: "#FBF7F3",
  border: "rgba(47, 36, 29, 0.06)",
  success: "#2B9E5F",
  successBg: "#E8F5EC",
  warn: "#E38B28",
  warnBg: "#FFF3E5",
  error: "#DF493E",
  errorBg: "#FDEBE8",
  badge: "#F8E2C7",
};

function canManageTeamView(role: AppRole | null) {
  return role === "OWNER" || role === "MANAGER";
}

function roleBadgeLabel(role: AppRole | null) {
  if (role === "OWNER") return "OWNER";
  if (role === "MANAGER") return "MANAGER";
  if (role === "RECEPTION") return "RECEPTION";
  if (role === "ACCOUNTANT") return "ACCOUNTANT";
  return "TECH";
}

function fmtTime(value: string | null | undefined) {
  if (!value) return "--:--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuration(clockIn: string, clockOut: string | null, nowTs: number) {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : nowTs;
  const mins = Math.max(0, Math.round((end - start) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function displayName(email: string | null | undefined) {
  if (!email) return "Nhân viên";
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatLongDate(date: Date) {
  const weekday = date.toLocaleDateString("vi-VN", { weekday: "long" });
  const normalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${normalizedWeekday}, ${date.toLocaleDateString("vi-VN")}`;
}

export default function AdminShiftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isHydrated, role, user } = useSession();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState<"week" | "month">("month");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const isOwner = role === "OWNER";

  const loadEntries = useCallback(
    async (targetOrgId: string) => {
      if (!mobileSupabase) return;
      const firstLoad = entries.length === 0;

      try {
        if (firstLoad) setLoading(true);
        else setRefreshing(true);
        setError(null);

        const [entriesRes, teamRpc] = await Promise.all([
          mobileSupabase
            .from("time_entries")
            .select("id,staff_user_id,clock_in,clock_out")
            .eq("org_id", targetOrgId)
            .order("clock_in", { ascending: false })
            .limit(100),
          mobileSupabase.rpc("list_team_members_secure_v2"),
        ]);

        if (entriesRes.error) throw entriesRes.error;
        if (teamRpc.error) throw teamRpc.error;

        setEntries((entriesRes.data ?? []) as Entry[]);
        setTeamMembers(
          (((teamRpc.data as Array<Record<string, unknown>>) ?? []).filter(
            (row) => String(row.role ?? "") !== "OWNER",
          )).map((row) => ({
            user_id: String(row.user_id),
            display_name:
              typeof row.display_name === "string" && row.display_name.trim()
                ? row.display_name.trim()
                : String(row.user_id).slice(0, 8),
            role: typeof row.role === "string" ? row.role : null,
          })),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load shifts failed");
      } finally {
        if (firstLoad) setLoading(false);
        else setRefreshing(false);
      }
    },
    [entries.length],
  );

  useEffect(() => {
    async function init() {
      if (!mobileSupabase || !isHydrated || !user?.id) {
        setLoading(false);
        return;
      }

      try {
        const ctx = await ensureOrgContext(mobileSupabase);
        setOrgId(ctx.orgId);
        await loadEntries(ctx.orgId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Khởi tạo shifts failed");
        setLoading(false);
      }
    }

    void init();
  }, [isHydrated, loadEntries, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function clockIn() {
    if (!mobileSupabase || !orgId || !user?.id || submitting || role === "OWNER") {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { data, error: existingErr } = await mobileSupabase
        .from("time_entries")
        .select("id")
        .eq("org_id", orgId)
        .eq("staff_user_id", user.id)
        .is("clock_out", null)
        .limit(1);

      if (existingErr) throw existingErr;
      if (data?.length) throw new Error("Bạn đang có một ca mở rồi.");

      const { error: insertError } = await mobileSupabase
        .from("time_entries")
        .insert({
          org_id: orgId,
          staff_user_id: user.id,
          clock_in: new Date().toISOString(),
        });

      if (insertError) throw insertError;
      await loadEntries(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clock in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function clockOut() {
    if (!mobileSupabase || !orgId || !user?.id || submitting || role === "OWNER") {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const { data, error: findErr } = await mobileSupabase
        .from("time_entries")
        .select("id")
        .eq("org_id", orgId)
        .eq("staff_user_id", user.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1);

      if (findErr) throw findErr;

      const id = data?.[0]?.id;
      if (!id) throw new Error("Không có ca đang mở để đóng.");

      const { error: updateError } = await mobileSupabase
        .from("time_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", orgId);

      if (updateError) throw updateError;
      await loadEntries(orgId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clock out failed");
    } finally {
      setSubmitting(false);
    }
  }

  const memberMap = useMemo(
    () =>
      new Map(
        teamMembers.map((member) => [
          member.user_id,
          {
            name: member.display_name || member.user_id.slice(0, 8),
            role: member.role || "-",
          },
        ]),
      ),
    [teamMembers],
  );

  const visibleEntries = useMemo(() => {
    const base = canManageTeamView(role)
      ? entries
      : entries.filter((entry) => entry.staff_user_id === user?.id);

    return base.filter(
      (entry) => memberMap.get(entry.staff_user_id)?.role !== "OWNER",
    );
  }, [entries, memberMap, role, user?.id]);

  const activeEntry = useMemo(
    () =>
      entries.find(
        (entry) => entry.staff_user_id === user?.id && !entry.clock_out,
      ) ?? null,
    [entries, user?.id],
  );

  const today = useMemo(() => new Date(nowTs), [nowTs]);
  const currentName =
    memberMap.get(user?.id ?? "")?.name || displayName(user?.email);

  const activeTeamEntries = useMemo(
    () => visibleEntries.filter((entry) => !entry.clock_out),
    [visibleEntries],
  );

  const todayTeamEntries = useMemo(
    () =>
      visibleEntries.filter((entry) =>
        isSameDate(new Date(entry.clock_in), today),
      ),
    [today, visibleEntries],
  );

  const activeTeamCount = useMemo(
    () => new Set(activeTeamEntries.map((entry) => entry.staff_user_id)).size,
    [activeTeamEntries],
  );

  const checkedInTodayCount = useMemo(
    () => new Set(todayTeamEntries.map((entry) => entry.staff_user_id)).size,
    [todayTeamEntries],
  );

  const monthlyTeamEntries = useMemo(() => {
    const from = startOfMonth(today).getTime();
    const to = endOfMonth(today).getTime();

    return visibleEntries.filter((entry) => {
      const ts = new Date(entry.clock_in).getTime();
      return ts >= from && ts <= to;
    });
  }, [today, visibleEntries]);

  const monthlyTeamMinutes = useMemo(
    () =>
      monthlyTeamEntries.reduce((acc, entry) => {
        const end = entry.clock_out
          ? new Date(entry.clock_out).getTime()
          : nowTs;
        return (
          acc +
          Math.max(
            0,
            Math.round((end - new Date(entry.clock_in).getTime()) / 60000),
          )
        );
      }, 0),
    [monthlyTeamEntries, nowTs],
  );

  const userEntries = useMemo(
    () => entries.filter((entry) => entry.staff_user_id === user?.id),
    [entries, user?.id],
  );

  const todayEntries = useMemo(
    () =>
      userEntries.filter((entry) => isSameDate(new Date(entry.clock_in), today)),
    [today, userEntries],
  );

  const todayEntry = activeEntry ?? todayEntries[0] ?? null;

  const todayMinutes = useMemo(
    () =>
      todayEntries.reduce((acc, entry) => {
        const end = entry.clock_out
          ? new Date(entry.clock_out).getTime()
          : nowTs;
        return (
          acc +
          Math.max(
            0,
            Math.round((end - new Date(entry.clock_in).getTime()) / 60000),
          )
        );
      }, 0),
    [todayEntries, nowTs],
  );

  const monthlyEntries = useMemo(() => {
    const from = startOfMonth(today).getTime();
    const to = endOfMonth(today).getTime();

    return userEntries.filter((entry) => {
      const ts = new Date(entry.clock_in).getTime();
      return ts >= from && ts <= to;
    });
  }, [today, userEntries]);

  const monthlyMinutes = useMemo(
    () =>
      monthlyEntries.reduce((acc, entry) => {
        const end = entry.clock_out
          ? new Date(entry.clock_out).getTime()
          : nowTs;
        return (
          acc +
          Math.max(
            0,
            Math.round((end - new Date(entry.clock_in).getTime()) / 60000),
          )
        );
      }, 0),
    [monthlyEntries, nowTs],
  );

  const monthlyDays = useMemo(
    () =>
      new Set(
        monthlyEntries.map((entry) =>
          new Date(entry.clock_in).toLocaleDateString("vi-VN"),
        ),
      ).size,
    [monthlyEntries],
  );

  const lateDays = useMemo(
    () =>
      monthlyEntries.filter((entry) => {
        const date = new Date(entry.clock_in);
        return date.getHours() > 8 || (date.getHours() === 8 && date.getMinutes() > 35);
      }).length,
    [monthlyEntries],
  );

  const overdueOpenEntries = useMemo(
    () =>
      visibleEntries.filter(
        (entry) =>
          !entry.clock_out &&
          (nowTs - new Date(entry.clock_in).getTime()) / 3600000 >=
            LONG_OPEN_SHIFT_HOURS,
      ),
    [nowTs, visibleEntries],
  );

  const nextEntry = useMemo(
    () =>
      userEntries
        .filter((entry) => new Date(entry.clock_in).getTime() > nowTs)
        .sort(
          (a, b) =>
            new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime(),
        )[0] ?? null,
    [nowTs, userEntries],
  );

  const notificationCount = Math.max(overdueOpenEntries.length, nextEntry ? 1 : 0);
  const shiftName =
    todayEntry && new Date(todayEntry.clock_in).getHours() < 12
      ? "Ca sáng"
      : "Ca chiều";
  const shiftStatus = activeEntry ? "Đang làm" : todayEntry ? "Hoàn tất" : "Chưa mở";
  const totalHoursText = `${Math.floor(monthlyMinutes / 60)}h ${String(
    monthlyMinutes % 60,
  ).padStart(2, "0")}m`;
  const workingDaysTarget = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const actionItems: Array<{
    icon: React.ComponentProps<typeof Feather>["name"];
    label: string;
    onPress: () => void;
  }> = isOwner
    ? [
        {
          icon: "calendar",
          label: "Quản lý nhân sự",
          onPress: () => void router.push("/(admin)/manage-team"),
        },
        {
          icon: "users",
          label: "Ca đang mở",
          onPress: () => setRangeMode("week"),
        },
        {
          icon: "bar-chart-2",
          label: "Chấm công hôm nay",
          onPress: () => setRangeMode("month"),
        },
        {
          icon: "calendar",
          label: "Phân ca nhân sự",
          onPress: () => Alert.alert("Đang tách flow", "Phân ca nhân sự sẽ được tách sang màn riêng, không dùng chung với điều phối lịch khách hàng."),
        },
      ]
    : [
        {
          icon: "calendar",
          label: "Lịch làm việc",
          onPress: () => setRangeMode("month"),
        },
        {
          icon: "repeat",
          label: "Đổi ca",
          onPress: () => Alert.alert("Tính năng đang phát triển", "Chức năng đổi ca sẽ được ra mắt sớm."),
        },
        {
          icon: "clock",
          label: "Xin nghỉ",
          onPress: () => Alert.alert("Tính năng đang phát triển", "Chức năng xin nghỉ sẽ được ra mắt sớm."),
        },
        {
          icon: "file-text",
          label: activeEntry ? "Đóng ca" : "Ca linh hoạt",
          onPress: () => {
            if (activeEntry) void clockOut();
            else void clockIn();
          },
        },
      ] as const;

  const notificationTitle = isOwner
    ? overdueOpenEntries.length
      ? `${overdueOpenEntries.length} ca đang mở quá ${LONG_OPEN_SHIFT_HOURS}h`
      : "Theo dõi ca làm của đội ngũ"
    : nextEntry
      ? `Ca ${new Date(nextEntry.clock_in).getHours() < 12 ? "sáng" : "chiều"} ngày ${new Date(nextEntry.clock_in).toLocaleDateString("vi-VN")}`
      : "Chưa có thông báo mới";

  const notificationSubtext = isOwner
    ? overdueOpenEntries.length
      ? "Kiểm tra các ca đang mở lâu và xử lý nhân sự cần hỗ trợ."
      : "Màn này chỉ dùng để theo dõi ca làm và chấm công nhân sự."
    : nextEntry
      ? `${fmtTime(nextEntry.clock_in)} - ${fmtTime(nextEntry.clock_out)} • Chi nhánh Hà Nội`
      : "Không có lịch ca nào sắp tới";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: getAdminHeaderTopPadding(insets.top),
              paddingBottom: 112 + getAdminBottomBarPadding(insets.bottom),
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading || refreshing}
              onRefresh={() => {
                if (orgId) void loadEntries(orgId);
              }}
              tintColor={c.text}
              colors={[c.text]}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(currentName)}</Text>
            </View>

            <View style={styles.headerCopy}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{currentName}</Text>
                <View style={styles.techBadge}>
                  <Text style={styles.techBadgeText}>{roleBadgeLabel(role)}</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                {isOwner ? "Theo dõi chấm công, ca làm và nhân sự; tách biệt với điều phối lịch khách hàng" : "Quản lý công việc, ca làm và tài khoản"}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton}>
                <Feather name="bell" size={22} color={c.text} />
                {notificationCount > 0 ? (
                  <View style={styles.redDot}>
                    <Text style={styles.redDotText}>{Math.min(notificationCount, 9)}</Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable style={styles.iconButton} onPress={() => void router.push({ pathname: "/(admin)/settings", params: { from: "/(admin)/shifts" } })}>
                <Feather name="settings" size={22} color={c.text} />
              </Pressable>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.mainCard}>
            <View style={styles.sectionTitleRow}>
              <Feather name="calendar" size={18} color={c.sub} />
              <Text style={styles.sectionTitle}>{isOwner ? "Theo dõi ca nhân sự" : "Ca làm hôm nay"}</Text>
            </View>

            <View style={styles.dateRow}>
              <Feather name="calendar" size={15} color={c.sub} />
              <Text style={styles.dateText}>{formatLongDate(today)}</Text>
            </View>

            <View style={styles.shiftPanel}>
              <View style={styles.shiftTopRow}>
                <View style={styles.row}>
                  <View style={styles.greenDot} />
                  <Text style={styles.shiftLabel}>{isOwner ? "Nhân sự đang hoạt động" : shiftName}</Text>
                </View>
                <View style={styles.stateBadge}>
                  <Text style={styles.stateBadgeText}>{isOwner ? `${activeTeamCount}/${teamMembers.length || 0} online` : shiftStatus}</Text>
                </View>
              </View>

              <View style={styles.shiftMainRow}>
                <Text style={styles.bigTime}>{isOwner ? `${activeTeamCount} người đang mở ca` : `${fmtTime(todayEntry?.clock_in)} - ${fmtTime(todayEntry?.clock_out)}`}</Text>
                <View style={styles.divider} />
                <View style={styles.durationWrap}>
                  <Feather name="clock" size={17} color={c.sub} />
                  <Text style={styles.durationText}>
                    {isOwner ? `${checkedInTodayCount} người đã chấm công hôm nay` : `${todayEntry ? fmtDuration(todayEntry.clock_in, todayEntry.clock_out, nowTs) : "0h 00m"} đã làm`}
                  </Text>
                </View>
              </View>

              <View style={styles.shiftBottomRow}>
                <View style={styles.metaItem}>
                  <Feather name="map-pin" size={15} color={c.sub} />
                  <Text style={styles.metaText}>{isOwner ? "Theo dõi đội ngũ toàn cửa hàng" : "Chi nhánh Hà Nội"}</Text>
                </View>
                <Text style={styles.metaText}>{isOwner ? `${overdueOpenEntries.length} ca cần kiểm tra` : "Nghỉ trưa: 12:00 - 13:00"}</Text>
              </View>
            </View>

            <View style={styles.actionGrid}>
              {actionItems.map((item) => (
                <Pressable key={item.label} style={styles.actionCard} onPress={item.onPress}>
                  <Feather name={item.icon} size={22} color={c.text} />
                  <Text style={styles.actionText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.sectionTitle}>{isOwner ? "Tình hình nhân sự hôm nay" : "Trạng thái hôm nay"}</Text>

            <View style={styles.statusRow}>
              <View style={styles.statusBox}>
                <View style={styles.statusHead}>
                  <View style={[styles.statusIcon, { backgroundColor: c.successBg }]}>
                    <Feather name="mic" size={15} color={c.success} />
                  </View>
                  <Text style={styles.statusLabel}>Mở ca</Text>
                </View>
                <Text style={styles.statusValue}>{isOwner ? String(activeTeamCount) : fmtTime(todayEntry?.clock_in)}</Text>
                <Text style={[styles.statusMeta, { color: c.success }]}>{isOwner ? "nhân sự" : "Đã mở"}</Text>
              </View>

              <View style={styles.statusBox}>
                <View style={styles.statusHead}>
                  <View style={[styles.statusIcon, { backgroundColor: c.errorBg }]}>
                    <Feather name="square" size={12} color={c.error} />
                  </View>
                  <Text style={styles.statusLabel}>Đóng ca</Text>
                </View>
                <Text style={styles.statusValue}>{isOwner ? String(checkedInTodayCount) : fmtTime(todayEntry?.clock_out)}</Text>
                <Text style={[styles.statusMeta, { color: isOwner || todayEntry?.clock_out ? c.success : c.error }]}>
                  {isOwner ? "đã chấm công" : todayEntry?.clock_out ? "Đã đóng" : "Chưa đóng"}
                </Text>
              </View>

              <View style={styles.statusBox}>
                <View style={styles.statusHead}>
                  <View style={[styles.statusIcon, { backgroundColor: c.warnBg }]}>
                    <Feather name="clock" size={14} color={c.warn} />
                  </View>
                  <Text style={styles.statusLabel}>Tổng giờ làm</Text>
                </View>
                <Text style={styles.statusValue}>{isOwner ? String(overdueOpenEntries.length) : `${Math.floor(todayMinutes / 60)}h ${String(todayMinutes % 60).padStart(2, "0")}m`}</Text>
                <Text style={[styles.statusMeta, { color: c.warn }]}>
                  {isOwner ? "ca quá giờ" : activeEntry ? "Đang làm" : "Hôm nay"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.bigSectionTitle}>
                {isOwner ? `Tổng quan đội ngũ tháng ${String(today.getMonth() + 1).padStart(2, "0")}` : `Tổng quan tháng ${String(today.getMonth() + 1).padStart(2, "0")}`}
              </Text>
              <Pressable style={styles.ghostPill} onPress={() => setRangeMode(rangeMode === "month" ? "week" : "month")}>
                <Text style={styles.ghostPillText}>{isOwner ? "Đổi chế độ xem" : "Xem chi tiết"}</Text>
              </Pressable>
            </View>

            <View style={styles.overviewGrid}>
              <View style={styles.overviewBox}>
                <Text style={styles.overviewLabel}>{isOwner ? "Tổng giờ đội ngũ" : "Tổng giờ làm"}</Text>
                <Text style={styles.overviewValue}>{isOwner ? `${Math.floor(monthlyTeamMinutes / 60)}h` : totalHoursText}</Text>
                <Text style={styles.overviewSub}>{isOwner ? "tháng này" : "/ 176h"}</Text>
              </View>
              <View style={styles.overviewBox}>
                <Text style={styles.overviewLabel}>{isOwner ? "Nhân sự hoạt động" : "Số ngày làm"}</Text>
                <Text style={styles.overviewValue}>{isOwner ? checkedInTodayCount : monthlyDays}</Text>
                <Text style={styles.overviewSub}>{isOwner ? "hôm nay" : `/ ${workingDaysTarget} ngày`}</Text>
              </View>
              <View style={styles.overviewBox}>
                <Text style={styles.overviewLabel}>{isOwner ? "Tổng nhân sự" : "Ngày nghỉ phép"}</Text>
                <Text style={styles.overviewValue}>{isOwner ? teamMembers.length : 2}</Text>
                <Text style={styles.overviewSub}>{isOwner ? "đang quản lý" : "còn lại"}</Text>
              </View>
              <View style={styles.overviewBox}>
                <Text style={styles.overviewLabel}>{isOwner ? "Ca cần xử lý" : "Đi muộn"}</Text>
                <Text style={styles.overviewValue}>{isOwner ? overdueOpenEntries.length : lateDays}</Text>
                <Text style={styles.overviewSub}>{isOwner ? "mở quá giờ" : "lần"}</Text>
              </View>
            </View>
          </View>

          {isOwner ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <Text style={styles.bigSectionTitle}>Nhân sự đang mở ca</Text>
                <Pressable style={styles.ghostPill} onPress={() => void router.push("/(admin)/manage-team")}> 
                  <Text style={styles.ghostPillText}>Quản lý</Text>
                </Pressable>
              </View>

              <View style={styles.teamStack}>
                {activeTeamEntries.length ? (
                  activeTeamEntries.map((entry) => {
                    const member = memberMap.get(entry.staff_user_id);
                    return (
                      <View key={entry.id} style={styles.teamCard}>
                        <View style={styles.teamAvatar}>
                          <Text style={styles.teamAvatarText}>{initials(member?.name || "NV")}</Text>
                        </View>
                        <View style={styles.teamCopy}>
                          <Text style={styles.teamName}>{member?.name || entry.staff_user_id.slice(0, 8)}</Text>
                          <Text style={styles.teamMeta}>{member?.role || "STAFF"} • Mở ca {fmtTime(entry.clock_in)}</Text>
                        </View>
                        <Text style={styles.teamDuration}>{fmtDuration(entry.clock_in, entry.clock_out, nowTs)}</Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.noticeCard}>
                    <View style={styles.noticeIcon}>
                      <Feather name="users" size={18} color={c.text} />
                    </View>
                    <View style={styles.noticeBody}>
                      <Text style={styles.noticeTitle}>Chưa có nhân sự nào mở ca</Text>
                      <Text style={styles.noticeSub}>Theo dõi chấm công và cập nhật nhân sự từ khu quản lý riêng.</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          ) : null}


          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.bigSectionTitle}>Thông báo</Text>
              <Pressable style={styles.ghostPill}>
                <Text style={styles.ghostPillText}>Xem tất cả</Text>
              </Pressable>
            </View>

            <Pressable style={styles.noticeCard}>
              <View style={styles.noticeIcon}>
                <Feather name="calendar" size={18} color={c.text} />
              </View>
              <View style={styles.noticeBody}>
                <Text style={styles.noticeTitle}>{notificationTitle}</Text>
                <Text style={styles.noticeSub}>{notificationSubtext}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={c.subSoft} />
            </Pressable>
          </View>
        </ScrollView>

        <View style={[styles.navShell, { paddingBottom: getAdminBottomBarPadding(insets.bottom) }]}>
          <AdminBottomNav current={role === "OWNER" ? null : "profile"} role={role} onNavigate={(target) => void router.replace(getAdminNavHref(target, role))} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: c.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#D6B08A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: c.white,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    color: c.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
    flexShrink: 1,
  },
  techBadge: {
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: c.badge,
    alignItems: "center",
    justifyContent: "center",
  },
  techBadgeText: {
    color: "#D4862B",
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "800",
  },
  subtitle: {
    color: c.sub,
    fontSize: 13,
    lineHeight: 18,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  redDot: {
    position: "absolute",
    top: -1,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F2544B",
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  redDotText: {
    color: c.white,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
  },
  error: {
    color: c.error,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  mainCard: {
    backgroundColor: c.white,
    borderRadius: 24,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  statusCard: {
    backgroundColor: c.white,
    borderRadius: 24,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: -4,
  },
  dateText: {
    color: c.sub,
    fontSize: 13,
    lineHeight: 18,
  },
  shiftPanel: {
    backgroundColor: c.soft2,
    borderRadius: 20,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  shiftTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#169B51",
  },
  shiftLabel: {
    color: c.text,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
  },
  stateBadge: {
    height: 32,
    borderRadius: 16,
    backgroundColor: c.successBg,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stateBadgeText: {
    color: c.success,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
  },
  shiftMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bigTime: {
    flex: 1,
    color: c.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  divider: {
    width: 1,
    height: 34,
    backgroundColor: c.border,
  },
  durationWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 124,
  },
  durationText: {
    color: c.sub,
    fontSize: 13,
    lineHeight: 18,
  },
  shiftBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  metaText: {
    color: "#6E6258",
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 2,
  },
  actionCard: {
    width: "48.1%",
    minHeight: 80,
    borderRadius: 18,
    backgroundColor: c.soft2,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionText: {
    color: "#5B4F45",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusBox: {
    flex: 1,
    backgroundColor: c.soft2,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: c.border,
  },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    color: "#76695F",
    fontSize: 12,
    lineHeight: 16,
    flexShrink: 1,
  },
  statusValue: {
    color: c.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  statusHead: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 38,
  },
  statusMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  sectionBlock: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bigSectionTitle: {
    color: c.text,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  ghostPill: {
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F7F1EC",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  ghostPillText: {
    color: "#8A7D72",
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  overviewBox: {
    width: "48.1%",
    minHeight: 104,
    borderRadius: 18,
    backgroundColor: c.white,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: c.border,
  },
  overviewLabel: {
    color: "#7D7065",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  overviewValue: {
    color: c.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  overviewSub: {
    color: "#76695F",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  noticeCard: {
    backgroundColor: c.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.soft2,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeBody: {
    flex: 1,
    gap: 4,
  },
  noticeTitle: {
    color: c.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  noticeSub: {
    color: c.sub,
    fontSize: 13,
    lineHeight: 18,
  },
  teamStack: {
    gap: 10,
  },
  teamCard: {
    backgroundColor: c.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ead9ca",
    alignItems: "center",
    justifyContent: "center",
  },
  teamAvatarText: {
    color: "#5d4c3f",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
  },
  teamCopy: {
    flex: 1,
    gap: 3,
  },
  teamName: {
    color: c.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  teamMeta: {
    color: c.sub,
    fontSize: 12,
    lineHeight: 16,
  },
  teamDuration: {
    color: c.text,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  navShell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(47, 36, 29, 0.04)",
    paddingTop: 8,
    paddingHorizontal: 14,
  },
});
