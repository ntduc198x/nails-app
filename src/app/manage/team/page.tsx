"use client";

import { AppShell } from "@/components/app-shell";
import { MobileCollapsible, MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, setupQuickNav } from "@/components/manage-quick-nav";
import { getOrCreateRole, listUserRoles, type AppRole, updateUserDisplayName, updateUserRoleByRowId } from "@/lib/auth";
import { generateInviteCode, listInviteCodes, revokeInviteCode, type InviteCodeRow } from "@/lib/invite-codes";
import { getRoleLabel } from "@/lib/role-labels";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useRef, useState } from "react";

type UserRoleRow = { id: string; user_id: string; role: AppRole; display_name?: string; email?: string | null; phone?: string | null };

const roleOptions: AppRole[] = ["MANAGER", "RECEPTION", "ACCOUNTANT", "TECH"];

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
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-base md:text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-base md:text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

export default function TeamPage() {
  const [rows, setRows] = useState<UserRoleRow[]>([]);
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

  const inviteSectionRef = useRef<HTMLDivElement | null>(null);
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  const canManage = myRole === "OWNER";

  const roleStats = useMemo(() => {
    const stats = new Map<AppRole, number>();
    rows.forEach((row) => stats.set(row.role, (stats.get(row.role) ?? 0) + 1));
    return stats;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => `${row.display_name ?? ""} ${row.email ?? ""} ${row.phone ?? ""} ${row.user_id} ${row.role}`.toLowerCase().includes(keyword));
  }, [rows, search]);

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

      const canManageCurrent = role === "OWNER";
      const [roleRows, invites] = await Promise.all([
        listUserRoles(),
        canManageCurrent ? listInviteCodes() : Promise.resolve([]),
      ]);
      setRows(roleRows as UserRoleRow[]);
      setInviteRows((invites as InviteCodeRow[]).filter((invite) => {
        const expired = new Date(invite.expires_at).getTime() <= Date.now();
        const used = invite.used_count >= invite.max_uses;
        const revoked = Boolean(invite.revoked_at);
        return !expired && !used && !revoked;
      }));
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

  async function onChangeRole(id: string, role: AppRole) {
    try {
      setError(null);
      await updateUserRoleByRowId(id, role);
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
      else if (e && typeof e === "object") {
        const anyErr = e as { message?: unknown; details?: unknown; hint?: unknown };
        setError([anyErr.message, anyErr.details, anyErr.hint].filter(Boolean).join(" | ") || "Update name failed");
      } else {
        setError("Update name failed");
      }
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={setupQuickNav("/manage/team")} />

        <MobileSectionHeader title="Nhân sự" meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : <>Vai trò: <b className="text-neutral-900">{getRoleLabel(myRole)}</b></>}</div>} />

        {error ? <div className="manage-error-box">{error}</div> : null}

        <section className="manage-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Điều hướng nhanh</h3>
            <button type="button" onClick={() => requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
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
          <div ref={inviteSectionRef} className="space-y-3">
            <div className="hidden md:block manage-surface p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900">Mã mời nhân sự</h3>
                <p className="text-xs text-neutral-500">Chỉ BOSS mới quản lý</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-2 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-2 md:space-y-0">
                  <InlineField label="Vai trò">
                    <SelectInput value={inviteRole} onChange={(e) => setInviteRole(e.target.value as InviteCodeRow["allowed_role"])}>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{getRoleLabel(role)}</option>
                      ))}
                    </SelectInput>
                  </InlineField>
                  <button type="button" className="cursor-pointer rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void onCreateInvite()} disabled={inviteBusy}>{inviteBusy ? "Đang tạo..." : "Tạo mã"}</button>
                </div>

                <div className="space-y-2">
                  {inviteRows.length === 0 ? (
                    <div className="manage-info-box">Chưa có mã mời nào gần đây.</div>
                  ) : inviteRows.map((invite) => (
                    <div key={invite.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] tracking-[0.08em] text-neutral-400">{getRoleLabel(invite.allowed_role)}</div>
                          <div className="mt-1 font-mono text-sm font-semibold text-neutral-900">{invite.code}</div>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-neutral-500">
                        <p>Hết hạn: {new Date(invite.expires_at).toLocaleString("vi-VN")}</p>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => navigator.clipboard.writeText(invite.code)}>Copy</button>
                        <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => void onRevokeInvite(invite.id)}>Thu hồi</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:hidden">
              <MobileCollapsible summary="Mã mời nhân sự" defaultOpen={inviteRows.length === 0}>
                <div className="space-y-3">
                  <InlineField label="Vai trò">
                    <SelectInput value={inviteRole} onChange={(e) => setInviteRole(e.target.value as InviteCodeRow["allowed_role"])}>
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{getRoleLabel(role)}</option>
                      ))}
                    </SelectInput>
                  </InlineField>
                  <button type="button" className="cursor-pointer w-full rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void onCreateInvite()} disabled={inviteBusy}>{inviteBusy ? "Đang tạo..." : "Tạo mã"}</button>

                  <div className="space-y-2">
                    {inviteRows.length === 0 ? (
                      <div className="manage-info-box">Chưa có mã mời nào gần đây.</div>
                    ) : inviteRows.map((invite) => (
                      <div key={invite.id} className="rounded-2xl border border-neutral-200 bg-white p-2.5">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <div className="text-[10px] tracking-[0.08em] text-neutral-400">{getRoleLabel(invite.allowed_role)}</div>
                            <div className="mt-1 font-mono text-sm font-semibold text-neutral-900">{invite.code}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-[11px] text-neutral-500">{new Date(invite.expires_at).toLocaleString("vi-VN")}</div>
                        <div className="mt-2 flex gap-2">
                          <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => navigator.clipboard.writeText(invite.code)}>Copy</button>
                          <button type="button" className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => void onRevokeInvite(invite.id)}>Thu hồi</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </MobileCollapsible>
            </div>
          </div>
        ) : null}

        <section ref={listSectionRef} className="manage-surface space-y-3 p-4 md:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Danh sách nhân sự</h3>
              <p className="text-xs text-neutral-500">Ưu tiên xem nhanh tên, vai trò và sửa inline khi cần.</p>
            </div>
            <div className="w-full md:w-[280px]">
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
            <div className="space-y-2">
              {filteredRows.map((m) => {
                const isEditing = editingUserId === m.user_id;
                return (
                  <div key={m.id} className="rounded-2xl border border-neutral-200 bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-semibold leading-5 text-neutral-900">{m.display_name || m.user_id}</h4>
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{getRoleLabel(m.role)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-400">{m.email || m.user_id}</p>
                      </div>

                      {canManage ? isEditing ? (
                        <div className="flex gap-2">
                          <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" type="button" onClick={() => setEditingUserId(null)}>
                            Huỷ
                          </button>
                          <button className="cursor-pointer rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600" type="button" onClick={() => void onSaveName(m.user_id)}>
                            Lưu
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                          onClick={() => {
                            setEditingUserId(m.user_id);
                            setEditingName(m.display_name || "");
                          }}
                        >
                          Sửa tên
                        </button>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-2 rounded-2xl bg-neutral-50 p-3">
                        <InlineField label="Tên">
                          <TextInput value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                        </InlineField>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                      {canManage && m.role !== "OWNER" ? (
                        <div className="min-w-[180px]">
                          <SelectInput value={m.role} onChange={(e) => void onChangeRole(m.id, e.target.value as AppRole)} className="py-2 text-xs">
                            {roleOptions.map((r) => (
                              <option key={r} value={r}>{getRoleLabel(r)}</option>
                            ))}
                          </SelectInput>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
