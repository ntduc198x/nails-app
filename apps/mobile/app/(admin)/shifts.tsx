import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { ensureOrgContext, type AppRole } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";
import { AdminBottomNav, AdminScreen, styles } from "@/src/features/admin/ui";

type RangeMode = "week" | "month";

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

function canManageTeamView(role: AppRole | null) {
  return role === "OWNER" || role === "MANAGER";
}

function formatDuration(clockIn: string, clockOut: string | null, nowTs: number) {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : nowTs;
  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function getStartOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getEndOfWeek(date: Date) {
  const next = getStartOfWeek(date);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getStartOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function getEndOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function ShiftRowCard({
  name,
  roleLabel,
  clockIn,
  clockOut,
  active,
  overdue,
  nowTs,
}: {
  name: string;
  roleLabel: string;
  clockIn: string;
  clockOut: string | null;
  active: boolean;
  overdue: boolean;
  nowTs: number;
}) {
  return (
    <View
      style={[
        styles.listRow,
        active ? styles.listRowActive : null,
        overdue ? { borderColor: "#f59e0b", backgroundColor: "#fff7ed" } : null,
      ]}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>{name}</Text>
        <Text style={styles.rowMeta}>{active ? "Dang mo" : "Da dong"}</Text>
      </View>
      <Text style={styles.rowMeta}>
        {roleLabel} - {formatDuration(clockIn, clockOut, nowTs)}
      </Text>
      <Text style={styles.rowMeta}>Mo ca: {new Date(clockIn).toLocaleString("vi-VN")}</Text>
      <Text style={styles.rowMeta}>Dong ca: {clockOut ? new Date(clockOut).toLocaleString("vi-VN") : "-"}</Text>
      {overdue ? <Text style={styles.warningText}>Ca nay da mo qua lau.</Text> : null}
    </View>
  );
}

export default function AdminShiftsScreen() {
  const router = useRouter();
  const { isHydrated, role, user } = useSession();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState<RangeMode>("week");
  const [nowTs, setNowTs] = useState(() => Date.now());

  const loadEntries = useCallback(
    async (targetOrgId: string) => {
      if (!mobileSupabase) {
        setError("Thieu cau hinh Supabase mobile.");
        return;
      }

      const isInitial = entries.length === 0;
      try {
        if (isInitial) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
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
          ((teamRpc.data as Array<Record<string, unknown>>) ?? [])
            .filter((row) => String(row.role ?? "") !== "OWNER")
            .map((row) => ({
              user_id: String(row.user_id),
              display_name:
                typeof row.display_name === "string" && row.display_name.trim().length > 0
                  ? row.display_name.trim()
                  : String(row.user_id).slice(0, 8),
              role: typeof row.role === "string" ? row.role : null,
            })),
        );
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Load shifts failed");
      } finally {
        if (isInitial) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
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
        const context = await ensureOrgContext(mobileSupabase);
        setOrgId(context.orgId);
        await loadEntries(context.orgId);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Khoi tao shifts failed");
        setLoading(false);
      }
    }

    void init();
  }, [isHydrated, loadEntries, user?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  async function clockIn() {
    if (!mobileSupabase || !orgId || !user?.id || submitting || role === "OWNER") {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const { data: openRows, error: existingErr } = await mobileSupabase
        .from("time_entries")
        .select("id")
        .eq("org_id", orgId)
        .eq("staff_user_id", user.id)
        .is("clock_out", null)
        .limit(1);

      if (existingErr) throw existingErr;
      if (openRows?.length) throw new Error("Ban dang co mot ca mo roi.");

      const { error: insertError } = await mobileSupabase.from("time_entries").insert({
        org_id: orgId,
        staff_user_id: user.id,
        clock_in: new Date().toISOString(),
      });
      if (insertError) throw insertError;
      await loadEntries(orgId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Clock in failed");
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
      const { data: openRows, error: findErr } = await mobileSupabase
        .from("time_entries")
        .select("id")
        .eq("org_id", orgId)
        .eq("staff_user_id", user.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1);

      if (findErr) throw findErr;
      const id = openRows?.[0]?.id;
      if (!id) throw new Error("Khong co ca dang mo de dong.");

      const { error: updateError } = await mobileSupabase
        .from("time_entries")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", orgId);
      if (updateError) throw updateError;
      await loadEntries(orgId);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Clock out failed");
    } finally {
      setSubmitting(false);
    }
  }

  const canUse = role === "OWNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";
  const canManageView = canManageTeamView(role);
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
    const base = canManageView ? entries : entries.filter((entry) => entry.staff_user_id === user?.id);
    return base.filter((entry) => memberMap.get(entry.staff_user_id)?.role !== "OWNER");
  }, [canManageView, entries, memberMap, user?.id]);
  const filterRange = useMemo(() => {
    const now = new Date();
    return rangeMode === "week"
      ? { from: getStartOfWeek(now), to: getEndOfWeek(now) }
      : { from: getStartOfMonth(now), to: getEndOfMonth(now) };
  }, [rangeMode]);
  const filteredEntries = useMemo(
    () =>
      visibleEntries.filter((entry) => {
        const startedAt = new Date(entry.clock_in).getTime();
        return startedAt >= filterRange.from.getTime() && startedAt <= filterRange.to.getTime();
      }),
    [filterRange.from, filterRange.to, visibleEntries],
  );
  const activeEntry = useMemo(
    () => entries.find((entry) => entry.staff_user_id === user?.id && !entry.clock_out) ?? null,
    [entries, user?.id],
  );
  const openEntries = useMemo(() => filteredEntries.filter((entry) => !entry.clock_out), [filteredEntries]);
  const overdueOpenEntries = useMemo(
    () =>
      openEntries.filter(
        (entry) => (nowTs - new Date(entry.clock_in).getTime()) / 3600000 >= LONG_OPEN_SHIFT_HOURS,
      ),
    [nowTs, openEntries],
  );
  const closedEntries = useMemo(() => filteredEntries.filter((entry) => !!entry.clock_out), [filteredEntries]);
  const totalMinutes = useMemo(
    () =>
      filteredEntries.reduce((acc, entry) => {
        const start = new Date(entry.clock_in).getTime();
        const end = entry.clock_out ? new Date(entry.clock_out).getTime() : nowTs;
        return acc + Math.max(0, Math.round((end - start) / 60000));
      }, 0),
    [filteredEntries, nowTs],
  );
  const headerMeta = refreshing
    ? "Dang lam moi..."
    : overdueOpenEntries.length > 0
      ? `${overdueOpenEntries.length} ca mo qua lau`
      : activeEntry
        ? "Dang trong ca"
        : openEntries.length > 0
          ? `${openEntries.length} ca dang mo`
          : "Chua mo ca";

  return (
    <AdminScreen
      title="Ca lam"
      subtitle=""
      role={role}
      userEmail={user?.email}
      compactHeader
      onRefresh={() => {
        if (orgId) {
          void loadEntries(orgId);
        }
      }}
      refreshing={loading || refreshing}
      footer={
        <AdminBottomNav
          current="shifts"
          onNavigate={(target) => {
            void router.replace(`/(admin)/${target}`);
          }}
        />
      }
    >
      <View style={styles.section}>
        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Trang thai</Text>
          <Text style={styles.rowMeta}>{headerMeta}</Text>
        </View>
        {error ? <Text style={styles.warningText}>{error}</Text> : null}
        {overdueOpenEntries.length > 0 ? (
          <Text style={styles.warningText}>{overdueOpenEntries.length} ca dang mo qua {LONG_OPEN_SHIFT_HOURS} gio.</Text>
        ) : null}
        {canUse ? (
          <View style={styles.inlineWrap}>
            <Pressable
              style={styles.primaryButton}
              disabled={role === "OWNER" || submitting || Boolean(activeEntry)}
              onPress={() => void clockIn()}
            >
              <Text style={styles.primaryButtonText}>{submitting ? "Dang xu ly..." : "Mo ca"}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              disabled={role === "OWNER" || submitting || !activeEntry}
              onPress={() => void clockOut()}
            >
              <Text style={styles.secondaryButtonText}>{submitting ? "Dang xu ly..." : "Dong ca"}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Tong quan</Text>
          <View style={styles.inlineWrap}>
            {([
              ["week", "Tuan nay"],
              ["month", "Thang nay"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                style={[styles.inlineChipSelectable, rangeMode === value ? styles.inlineChipSelectableActive : null]}
                onPress={() => setRangeMode(value)}
              >
                <Text
                  style={[styles.inlineChipSelectableText, rangeMode === value ? styles.inlineChipSelectableTextActive : null]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[styles.quickGrid, { flexDirection: 'row'}]}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Dang mo</Text>
            <Text style={styles.metricValue}>{openEntries.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Qua lau</Text>
            <Text style={styles.metricValue}>{overdueOpenEntries.length}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Tong gio</Text>
            <Text style={styles.metricValue}>{`${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, "0")}m`}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Ca dang mo</Text>
          <Text style={styles.rowMeta}>{openEntries.length}</Text>
        </View>
        {loading ? <Text style={styles.rowMeta}>Dang tai...</Text> : null}
        {!loading && openEntries.length === 0 ? <Text style={styles.rowMeta}>Khong co ca nao dang mo</Text> : null}
        {openEntries.map((entry) => {
          const member = memberMap.get(entry.staff_user_id);
          const overdue = (nowTs - new Date(entry.clock_in).getTime()) / 3600000 >= LONG_OPEN_SHIFT_HOURS;
          return (
            <ShiftRowCard
              key={entry.id}
              name={member?.name ?? entry.staff_user_id}
              roleLabel={member?.role ?? "-"}
              clockIn={entry.clock_in}
              clockOut={entry.clock_out}
              active
              overdue={overdue}
              nowTs={nowTs}
            />
          );
        })}
      </View>

      <View style={styles.section}>
        <View style={styles.rowHeader}>
          <Text style={styles.sectionTitle}>Lich su ca</Text>
          <Text style={styles.rowMeta}>{Math.min(closedEntries.length, 6)}</Text>
        </View>
        {closedEntries.length === 0 ? <Text style={styles.rowMeta}>Chua co ca dong</Text> : null}
        {closedEntries.slice(0, 6).map((entry) => {
          const member = memberMap.get(entry.staff_user_id);
          return (
            <ShiftRowCard
              key={entry.id}
              name={member?.name ?? entry.staff_user_id}
              roleLabel={member?.role ?? "-"}
              clockIn={entry.clock_in}
              clockOut={entry.clock_out}
              active={false}
              overdue={false}
              nowTs={nowTs}
            />
          );
        })}
      </View>
    </AdminScreen>
  );
}
