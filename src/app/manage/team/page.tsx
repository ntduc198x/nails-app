"use client";

import { AppShell } from "@/components/app-shell";
import { getOrCreateRole, listUserRoles, type AppRole, updateUserDisplayName, updateUserRoleByRowId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useMemo, useState } from "react";

type UserRoleRow = { id: string; user_id: string; role: AppRole; display_name?: string };

const roleOptions: AppRole[] = ["MANAGER", "RECEPTION", "ACCOUNTANT", "TECH"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

export default function TeamPage() {
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [myRole, setMyRole] = useState<AppRole>("RECEPTION");
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canManage = myRole === "OWNER";

  const roleStats = useMemo(() => {
    const stats = new Map<AppRole, number>();
    rows.forEach((row) => stats.set(row.role, (stats.get(row.role) ?? 0) + 1));
    return stats;
  }, [rows]);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      if (!supabase) throw new Error("Thiếu cấu hình Supabase env");

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) throw new Error("Chưa đăng nhập");

      const role = await getOrCreateRole(user.id);
      setMyRole(role);

      const roleRows = await listUserRoles();
      setRows(roleRows as UserRoleRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load team failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onChangeRole(id: string, role: AppRole) {
    try {
      setError(null);
      await updateUserRoleByRowId(id, role);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update role failed");
    }
  }

  async function onSaveName(userId: string) {
    try {
      setError(null);
      await updateUserDisplayName(userId, editingName.trim() || "User");
      setEditingUserId(null);
      await load();
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900">Nhân sự & Role</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Quản lý tên hiển thị và vai trò của từng thành viên trong hệ thống. OWNER có thể cập nhật role cho đội ngũ, các role khác chỉ xem dữ liệu.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500 shadow-sm">
            Role hiện tại: <b className="text-neutral-900">{myRole}</b>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">{error}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(["OWNER", ...roleOptions] as AppRole[]).map((role) => (
            <div key={role} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{role}</p>
              <p className="mt-3 text-2xl font-bold text-neutral-900">{roleStats.get(role) ?? 0}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Danh sách nhân sự</h3>
              <p className="mt-1 text-sm text-neutral-500">Chỉnh tên hiển thị và role trực tiếp trong từng thẻ nhân sự.</p>
            </div>
            {!canManage ? (
              <div className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">Chế độ chỉ xem</div>
            ) : null}
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải nhân sự...</p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              Chưa có dữ liệu nhân sự.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((m) => {
                const isEditing = editingUserId === m.user_id;
                return (
                  <div key={m.id} className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-4 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-neutral-900">{m.display_name || m.user_id}</h4>
                          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">{m.role}</span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-400">row id: {m.id}</p>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <FieldLabel>Tên hiển thị</FieldLabel>
                          <TextInput value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" type="button" onClick={() => setEditingUserId(null)}>
                            Huỷ
                          </button>
                          <button className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600" type="button" onClick={() => void onSaveName(m.user_id)}>
                            Lưu tên
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Vai trò</p>
                          <div className="mt-3">
                            {canManage && m.role !== "OWNER" ? (
                              <select
                                value={m.role}
                                onChange={(e) => void onChangeRole(m.id, e.target.value as AppRole)}
                                className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                              >
                                {roleOptions.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-base font-semibold text-neutral-900">{m.role}</p>
                            )}
                          </div>
                        </div>

                        {canManage && (
                          <button
                            type="button"
                            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
                            onClick={() => {
                              setEditingUserId(m.user_id);
                              setEditingName(m.display_name || "");
                            }}
                          >
                            Sửa tên hiển thị
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
