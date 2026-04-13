"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { createResource, listResources, updateResource } from "@/lib/domain";
import { useEffect, useState } from "react";

type ResourceRow = { id: string; name: string; type: "CHAIR" | "TABLE" | "ROOM"; active: boolean };

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

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

export default function ResourcesPage() {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"CHAIR" | "TABLE" | "ROOM">("CHAIR");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"CHAIR" | "TABLE" | "ROOM">("CHAIR");
  const [editActive, setEditActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      setRole(await getCurrentSessionRole());
      const data = await listResources({ force: true, activeOnly: false });
      setRows(data as ResourceRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải danh sách tài nguyên thất bại");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);


  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await createResource({ name, type });
      setName("");
      setType("CHAIR");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tạo tài nguyên thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(row: ResourceRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditType(row.type);
    setEditActive(row.active);
  }

  async function saveEdit() {
    if (!editingId || submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await updateResource({ id: editingId, name: editName, type: editType, active: editActive });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật tài nguyên thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <ManageQuickNav items={[
          { href: "/manage/technician", label: "Bảng kỹ thuật", accent: true },
          { href: "/manage/appointments", label: "Lịch hẹn" },
          { href: "/manage/checkout", label: "Thanh toán" },
          { href: "/manage/shifts", label: "Ca làm" },
        ]} />

        <MobileSectionHeader title="Tài nguyên / Ghế bàn" meta={<div className="manage-info-box">{rows.length} tài nguyên</div>} />

        {error ? (
          <ManageAlert tone="error">{error}</ManageAlert>
        ) : null}

        <form onSubmit={onSubmit} className="manage-surface md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Thêm tài nguyên mới</h3>
            </div>
            <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">{rows.length} tài nguyên</div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.3fr_0.9fr_auto] md:items-end">
            <div>
              <FieldLabel>Tên tài nguyên</FieldLabel>
              <TextInput placeholder="Ví dụ: Ghế 01" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <FieldLabel>Loại</FieldLabel>
              <SelectInput value={type} onChange={(e) => setType(e.target.value as "CHAIR" | "TABLE" | "ROOM") }>
                <option value="CHAIR">CHAIR</option>
                <option value="TABLE">TABLE</option>
                <option value="ROOM">ROOM</option>
              </SelectInput>
            </div>
            <button className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
              {submitting ? "Đang thêm..." : "Thêm tài nguyên"}
            </button>
          </div>
        </form>

        <div className="manage-surface md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Danh sách tài nguyên</h3>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải tài nguyên...</p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              Chưa có tài nguyên nào. Hãy tạo tài nguyên đầu tiên ở form phía trên.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <div key={r.id} className="manage-surface-muted">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-neutral-900">{r.name}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                            {r.active ? "ĐANG DÙNG" : "TẠM ẨN"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-neutral-500">Loại: {r.type}</p>
                      </div>
                      {!isEditing ? (
                        <button className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" onClick={() => startEdit(r)} type="button">
                          Sửa
                        </button>
                      ) : null}
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <FieldLabel>Tên</FieldLabel>
                          <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>
                        <div>
                          <FieldLabel>Loại</FieldLabel>
                          <SelectInput value={editType} onChange={(e) => setEditType(e.target.value as "CHAIR" | "TABLE" | "ROOM") }>
                            <option value="CHAIR">CHAIR</option>
                            <option value="TABLE">TABLE</option>
                            <option value="ROOM">ROOM</option>
                          </SelectInput>
                        </div>
                        <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
                          <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                          Tài nguyên đang hoạt động
                        </label>
                        <div className="flex gap-2">
                          <button className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" onClick={() => setEditingId(null)} type="button">
                            Huỷ
                          </button>
                          <button className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void saveEdit()} type="button" disabled={submitting}>
                            {submitting ? "Đang lưu..." : "Lưu"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <p className="manage-stat-label">Loại</p>
                          <p className="mt-2 text-base font-semibold text-neutral-900">{r.type}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <p className="manage-stat-label">Trạng thái</p>
                          <p className="mt-2 text-base font-semibold text-neutral-900">{r.active ? "Đang dùng" : "Tạm ẩn"}</p>
                        </div>
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
