"use client";

import { AppShell } from "@/components/app-shell";
import { MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, setupQuickNav } from "@/components/manage-quick-nav";
import {
  getOrCreateRole,
  listUserRoles,
  type AppRole,
  updateUserDisplayName,
  updateUserRoleByRowId,
} from "@/lib/auth";
import { generateInviteCode, listInviteCodes, revokeInviteCode, type InviteCodeRow } from "@/lib/invite-codes";
import { getRoleLabel } from "@/lib/role-labels";
import {
  createEmptyStaffShiftProfile,
  isMissingStaffShiftProfilesSchema,
  loadStaffShiftProfiles,
  normalizeStaffShiftProfiles,
  saveStaffShiftProfile,
  type StaffShiftProfileRecord,
} from "@/lib/shift-staff-profiles";
import { supabase } from "@/lib/supabase";
import {
  SERVICE_SKILL_OPTIONS,
  type AvailabilityRule,
  type ServiceSkill,
  type ShiftType,
  type StaffRole,
} from "@nails/shared";
import { useEffect, useMemo, useRef, useState } from "react";

type UserRoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
  display_name?: string;
  email?: string | null;
  phone?: string | null;
};

const roleOptions: AppRole[] = ["PARTNER", "MANAGER", "RECEPTION", "ACCOUNTANT", "TECH"];
const availabilityOptions: ShiftType[] = ["MORNING", "AFTERNOON", "FULL_DAY"];
const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 ${className}`}>{children}</label>;
}

function InlineField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
      <FieldLabel className="mb-0">{label}</FieldLabel>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 md:text-sm ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-base text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 md:text-sm ${props.className ?? ""}`}
    />
  );
}

function getShiftTypeLabel(shiftType: ShiftType) {
  switch (shiftType) {
    case "MORNING":
      return "Sáng";
    case "AFTERNOON":
      return "Chiều";
    case "FULL_DAY":
      return "Cả ngày";
    case "OFF":
      return "Nghỉ";
    default:
      return shiftType;
  }
}

function toStaffRole(role: AppRole): StaffRole | null {
  if (role === "OWNER" || role === "PARTNER" || role === "USER") return null;
  return role;
}

function buildAvailability(current: AvailabilityRule[], weekday: number, shiftType: ShiftType) {
  const existing = current.find((rule) => rule.weekday === weekday);
  const currentShiftTypes = existing?.shiftTypes ?? [];
  let nextShiftTypes: ShiftType[] = [];

  if (shiftType === "FULL_DAY") {
    nextShiftTypes = currentShiftTypes.includes("FULL_DAY") ? [] : ["FULL_DAY"];
  } else if (currentShiftTypes.includes("FULL_DAY")) {
    nextShiftTypes = [shiftType];
  } else if (currentShiftTypes.includes(shiftType)) {
    nextShiftTypes = currentShiftTypes.filter((item) => item !== shiftType);
  } else {
    nextShiftTypes = [...currentShiftTypes, shiftType];
    if (nextShiftTypes.includes("MORNING") && nextShiftTypes.includes("AFTERNOON")) {
      nextShiftTypes = ["FULL_DAY"];
    }
  }

  return current
    .filter((rule) => rule.weekday !== weekday)
    .concat(nextShiftTypes.length ? [{ weekday, shiftTypes: nextShiftTypes }] : [])
    .sort((left, right) => left.weekday - right.weekday);
}

export default function TeamPage() {
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [myRole, setMyRole] = useState<AppRole>("RECEPTION");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteRows, setInviteRows] = useState<InviteCodeRow[]>([]);
  const [inviteRole, setInviteRole] = useState<InviteCodeRow["allowed_role"]>("TECH");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [profilesSchemaMissing, setProfilesSchemaMissing] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState<StaffShiftProfileRecord[]>([]);
  const [profileSavingUserId, setProfileSavingUserId] = useState<string | null>(null);
  const [expandedProfileUserId, setExpandedProfileUserId] = useState<string | null>(null);

  const inviteSectionRef = useRef<HTMLDivElement | null>(null);
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  const canManage = myRole === "OWNER" || myRole === "PARTNER";

  const roleStats = useMemo(() => {
    const stats = new Map<AppRole, number>();
    rows.forEach((row) => stats.set(row.role, (stats.get(row.role) ?? 0) + 1));
    return stats;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const sortedRows = [...rows].sort((a, b) => {
      if (a.role === "OWNER" && b.role !== "OWNER") return -1;
      if (a.role !== "OWNER" && b.role === "OWNER") return 1;
      const aLabel = (a.display_name ?? a.email ?? a.user_id).toLowerCase();
      const bLabel = (b.display_name ?? b.email ?? b.user_id).toLowerCase();
      return aLabel.localeCompare(bLabel, "vi");
    });

    const keyword = search.trim().toLowerCase();
    if (!keyword) return sortedRows;

    return sortedRows.filter((row) =>
      `${row.display_name ?? ""} ${row.email ?? ""} ${row.phone ?? ""} ${row.user_id} ${row.role}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [rows, search]);

  const profileMap = useMemo(
    () => new Map(staffProfiles.map((profile) => [profile.userId, profile])),
    [staffProfiles],
  );

  async function load(opts?: { silent?: boolean }) {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      if (!supabase) throw new Error("Thiếu cấu hình Supabase env");

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) throw new Error("Chưa đăng nhập");

      const role = await getOrCreateRole(user.id);
      setMyRole(role);

      const canManageCurrent = role === "OWNER" || role === "PARTNER";
      const [roleRows, invites] = await Promise.all([
        listUserRoles(),
        canManageCurrent ? listInviteCodes() : Promise.resolve([]),
      ]);

      const typedRows = roleRows as UserRoleRow[];
      setRows(typedRows);
      setRoleDrafts({});
      setInviteRows(
        (invites as InviteCodeRow[]).filter((invite) => {
          const expired = new Date(invite.expires_at).getTime() <= Date.now();
          const used = invite.used_count >= invite.max_uses;
          const revoked = Boolean(invite.revoked_at);
          return !expired && !used && !revoked;
        }),
      );

      if (canManageCurrent) {
        try {
          const fallbackRoles = new Map(
            typedRows
              .map((row) => [row.user_id, toStaffRole(row.role)] as const)
              .filter((entry): entry is [string, StaffRole] => !!entry[1]),
          );
          const profiles = normalizeStaffShiftProfiles(await loadStaffShiftProfiles(), fallbackRoles);
          setStaffProfiles(profiles);
          setProfilesSchemaMissing(false);
        } catch (nextError) {
          if (isMissingStaffShiftProfilesSchema(nextError)) {
            setProfilesSchemaMissing(true);
            setStaffProfiles([]);
          } else {
            throw nextError;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load team failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSaveRole(id: string) {
    const currentRow = rows.find((row) => row.id === id);
    const nextRole = roleDrafts[id];
    if (!currentRow || !nextRole || nextRole === currentRow.role) return;

    try {
      setError(null);
      await updateUserRoleByRowId(id, nextRole);
      setRoleDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update role failed");
    }
  }

  async function onCreateInvite() {
    try {
      setInviteBusy(true);
      setError(null);
      const row = await generateInviteCode(inviteRole);
      setInviteRows((prev) => [row, ...prev].slice(0, 20));
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(row.code);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create invite failed");
    } finally {
      setInviteBusy(false);
    }
  }

  async function onRevokeInvite(inviteId: string) {
    try {
      setError(null);
      await revokeInviteCode(inviteId);
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revoke invite failed");
    }
  }

  async function onSaveName(userId: string) {
    try {
      setError(null);
      await updateUserDisplayName(userId, editingName.trim() || "User");
      setEditingUserId(null);
      await load({ silent: true });
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("Update name failed");
    }
  }

  function getProfileForRow(row: UserRoleRow) {
    const staffRole = toStaffRole(row.role);
    if (!staffRole) return null;
    return profileMap.get(row.user_id) ?? createEmptyStaffShiftProfile(row.user_id, staffRole);
  }

  function updateLocalProfile(userId: string, updater: (current: StaffShiftProfileRecord) => StaffShiftProfileRecord) {
    const row = rows.find((item) => item.user_id === userId);
    const staffRole = row ? toStaffRole(row.role) : null;
    if (!staffRole) return;

    setStaffProfiles((current) => {
      const existing = current.find((profile) => profile.userId === userId) ?? createEmptyStaffShiftProfile(userId, staffRole);
      const nextProfile = updater(existing);
      return [...current.filter((profile) => profile.userId !== userId), nextProfile];
    });
  }

  function toggleSkill(userId: string, skill: ServiceSkill) {
    updateLocalProfile(userId, (current) => ({
      ...current,
      skills: current.skills.includes(skill)
        ? current.skills.filter((item) => item !== skill)
        : [...current.skills, skill],
    }));
  }

  function toggleAvailability(userId: string, weekday: number, shiftType: ShiftType) {
    updateLocalProfile(userId, (current) => ({
      ...current,
      availability: buildAvailability(current.availability, weekday, shiftType),
    }));
  }

  async function onSaveProfile(userId: string) {
    const row = rows.find((item) => item.user_id === userId);
    const staffRole = row ? toStaffRole(row.role) : null;
    const profile = row ? getProfileForRow(row) : null;
    if (!profile || !staffRole) return;

    try {
      setError(null);
      setProfileSavingUserId(userId);
      const saved = await saveStaffShiftProfile({ ...profile, staffRole });
      setProfilesSchemaMissing(false);
      setStaffProfiles((current) => [...current.filter((item) => item.userId !== userId), saved]);
    } catch (e) {
      if (isMissingStaffShiftProfilesSchema(e)) {
        setProfilesSchemaMissing(true);
      } else {
        setError(e instanceof Error ? e.message : "Save shift profile failed");
      }
    } finally {
      setProfileSavingUserId(null);
    }
  }

  function describeAvailability(profile: StaffShiftProfileRecord) {
    const total = profile.availability.length;
    const fullDays = profile.availability.filter((rule) => rule.shiftTypes.includes("FULL_DAY")).length;
    if (!total) return "Chưa cấu hình";
    if (fullDays === total) return `${total} ngày linh hoạt cả ngày`;
    return `${total} ngày làm việc`;
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={setupQuickNav("/manage/team")} />

        <MobileSectionHeader
          title="Nhân sự"
          meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : <>Vai trò: <b className="text-neutral-900">{getRoleLabel(myRole)}</b></>}</div>}
        />

        {error ? <div className="manage-error-box">{error}</div> : null}
        {canManage && profilesSchemaMissing ? (
          <div className="manage-info-box">
            Bảng `staff_shift_profiles` chưa có trên Supabase. Cần chạy file `supabase/staff_shift_profiles_2026_04.sql` để lưu kỹ năng và khung giờ làm cho nhân sự.
          </div>
        ) : null}

        <section className="manage-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Điều hướng nhanh</h3>
            <button
              type="button"
              onClick={() => requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))}
              className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700"
            >
              Danh sách nhân sự
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {(["OWNER", ...roleOptions] as AppRole[]).map((role) => (
              <div key={role} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
                <div className="text-[10px] font-medium tracking-[0.08em] text-neutral-500">{getRoleLabel(role)}</div>
                <div className="mt-1 text-sm font-semibold text-neutral-900">{roleStats.get(role) ?? 0}</div>
              </div>
            ))}
          </div>
        </section>

        {canManage ? (
          <section ref={inviteSectionRef} className="manage-surface space-y-3 p-4 md:p-5">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Mã mời nhân sự</h3>
              <p className="text-xs text-neutral-500">Chỉ BOSS mới quản lý</p>
            </div>

            <div className="space-y-3 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-2 md:space-y-0">
              <InlineField label="Vai trò">
                <SelectInput value={inviteRole} onChange={(e) => setInviteRole(e.target.value as InviteCodeRow["allowed_role"])}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{getRoleLabel(role)}</option>
                  ))}
                </SelectInput>
              </InlineField>
              <button
                type="button"
                className="cursor-pointer rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onCreateInvite()}
                disabled={inviteBusy}
              >
                {inviteBusy ? "Đang tạo..." : "Tạo mã"}
              </button>
            </div>

            <div className="space-y-2">
              {inviteRows.length === 0 ? (
                <div className="manage-info-box">Chưa có mã mời nào gần đây.</div>
              ) : inviteRows.map((invite) => (
                <div key={invite.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
                  <div className="text-[10px] tracking-[0.08em] text-neutral-400">{getRoleLabel(invite.allowed_role)}</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-neutral-900">{invite.code}</div>
                  <div className="mt-2 text-xs text-neutral-500">Hết hạn: {new Date(invite.expires_at).toLocaleString("vi-VN")}</div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => navigator.clipboard.writeText(invite.code)}>Copy</button>
                    <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => void onRevokeInvite(invite.id)}>Thu hồi</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section ref={listSectionRef} className="manage-surface space-y-3 p-4 md:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Danh sách nhân sự</h3>
              <p className="text-xs text-neutral-500">Quản lý tên, vai trò, kỹ năng và khung giờ làm để tự động phân ca chính xác hơn.</p>
            </div>
            <div className="w-full md:w-[320px]">
              <TextInput placeholder="Tìm theo tên, user hoặc role" value={search} onChange={(e) => setSearch(e.target.value)} className="py-2.5 text-sm" />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải nhân sự...</p>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              {rows.length === 0 ? "Chưa có dữ liệu nhân sự." : "Không có nhân sự khớp bộ lọc hiện tại."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRows.map((row) => {
                const isEditing = editingUserId === row.user_id;
                const roleDraft = roleDrafts[row.id] ?? row.role;
                const roleChanged = roleDraft !== row.role;
                const staffRole = toStaffRole(row.role);
                const profile = getProfileForRow(row);
                const isTech = row.role === "TECH";

                return (
                  <article key={row.id} className="rounded-2xl border border-neutral-200 bg-white p-3 md:p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-neutral-900">{row.display_name || row.user_id}</h4>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{getRoleLabel(row.role)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-neutral-400">{row.email || row.user_id}</p>
                        {row.phone ? <p className="mt-1 text-[11px] text-neutral-400">{row.phone}</p> : null}
                      </div>

                      {canManage ? (
                        isEditing ? (
                          <div className="flex gap-2">
                            <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => setEditingUserId(null)}>Huỷ</button>
                            <button type="button" className="cursor-pointer rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600" onClick={() => void onSaveName(row.user_id)}>Lưu</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                            onClick={() => {
                              setEditingUserId(row.user_id);
                              setEditingName(row.display_name || "");
                            }}
                          >
                            Sửa tên
                          </button>
                        )
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
                        <InlineField label="Tên">
                          <TextInput value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                        </InlineField>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {canManage && row.role !== "OWNER" && row.role !== "PARTNER" ? (
                        <div className="flex min-w-[180px] flex-wrap items-center gap-2">
                          <SelectInput value={roleDraft} onChange={(e) => setRoleDrafts((prev) => ({ ...prev, [row.id]: e.target.value as AppRole }))} className="min-w-[180px] py-2 text-xs">
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>{getRoleLabel(role)}</option>
                            ))}
                          </SelectInput>
                          {roleChanged ? (
                            <>
                              <button
                                type="button"
                                className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                                onClick={() => {
                                  setRoleDrafts((prev) => {
                                    const next = { ...prev };
                                    delete next[row.id];
                                    return next;
                                  });
                                }}
                              >
                                Huỷ
                              </button>
                              <button type="button" className="cursor-pointer rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600" onClick={() => void onSaveRole(row.id)}>Lưu vai trò</button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {canManage && staffRole && profile ? (
                      <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="text-sm font-semibold text-neutral-900">Hồ sơ phân ca</h5>
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-neutral-600">
                                {isTech ? `${profile.skills.length} kỹ năng` : "Không cần kỹ năng dịch vụ"}
                              </span>
                              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-medium text-neutral-600">
                                {describeAvailability(profile)}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-neutral-500">
                              Dùng cho tự động phân ca ở màn `Shifts`.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedProfileUserId((current) => (current === row.user_id ? null : row.user_id))
                              }
                              className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700"
                            >
                              {expandedProfileUserId === row.user_id ? "Thu gọn" : "Chỉnh hồ sơ"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void onSaveProfile(row.user_id)}
                              disabled={profilesSchemaMissing || profileSavingUserId === row.user_id}
                              className="cursor-pointer rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {profileSavingUserId === row.user_id ? "Đang lưu..." : "Lưu"}
                            </button>
                          </div>
                        </div>

                        {expandedProfileUserId === row.user_id ? (
                          <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                            <div className="space-y-4">
                              <div>
                                <FieldLabel>Kỹ năng</FieldLabel>
                                {isTech ? (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {SERVICE_SKILL_OPTIONS.map((skill) => {
                                      const active = profile.skills.includes(skill);
                                      return (
                                        <button
                                          key={skill}
                                          type="button"
                                          onClick={() => toggleSkill(row.user_id, skill)}
                                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${active ? "border-rose-300 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-600"}`}
                                        >
                                          {skill}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="mt-2 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-500">
                                    Vai trò này không cần cấu hình kỹ năng dịch vụ để phân ca.
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <label className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-700">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Tối đa giờ / tuần</span>
                                  <input
                                    type="number"
                                    min={0}
                                    max={84}
                                    value={profile.maxWeeklyHours}
                                    onChange={(e) => updateLocalProfile(row.user_id, (current) => ({ ...current, maxWeeklyHours: Number(e.target.value || 0) }))}
                                    className="w-full bg-transparent outline-none"
                                  />
                                </label>
                                <label className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-700">
                                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Hiệu suất</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={profile.performanceScore}
                                    onChange={(e) => updateLocalProfile(row.user_id, (current) => ({ ...current, performanceScore: Number(e.target.value || 1) }))}
                                    className="w-full bg-transparent outline-none"
                                  />
                                </label>
                              </div>
                            </div>

                            <div>
                              <FieldLabel>Khung giờ làm theo ngày</FieldLabel>
                              <div className="mt-2 space-y-2">
                                {weekdayLabels.map((label, weekday) => {
                                  const activeRule = profile.availability.find((rule) => rule.weekday === weekday);
                                  return (
                                    <div key={`${row.user_id}-${weekday}`} className="rounded-2xl border border-neutral-200 bg-white px-3 py-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm font-medium text-neutral-800">{label}</p>
                                        <p className="text-[11px] text-neutral-400">
                                          {activeRule?.shiftTypes.includes("FULL_DAY")
                                            ? "Linh hoạt cả ngày"
                                            : activeRule?.shiftTypes.length
                                              ? activeRule.shiftTypes.map((item) => getShiftTypeLabel(item)).join(", ")
                                              : "Chưa chọn"}
                                        </p>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {availabilityOptions.map((shiftType) => {
                                          const active = activeRule?.shiftTypes.includes(shiftType) ?? false;
                                          return (
                                            <button
                                              key={`${row.user_id}-${weekday}-${shiftType}`}
                                              type="button"
                                              onClick={() => toggleAvailability(row.user_id, weekday, shiftType)}
                                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? "border-rose-300 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-600"}`}
                                            >
                                              {getShiftTypeLabel(shiftType)}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
