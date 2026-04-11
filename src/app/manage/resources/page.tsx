"use client";

import { AppShell } from "@/components/app-shell";
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
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"CHAIR" | "TABLE" | "ROOM">("CHAIR");
  const [editActive, setEditActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const data = await listResources({ force: true, activeOnly: false });
      setRows(data as ResourceRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load resources failed");
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
      setError(e instanceof Error ? e.message : "Create resource failed");
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
      setError(e instanceof Error ? e.message : "Update resource failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900">Resources / Ghế bàn</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
            Quản lý ghế, bàn và phòng phục vụ vận hành. Bật/tắt nhanh resource và chỉnh loại để hệ thống phân bổ lịch hẹn chính xác hơn.
          </p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">{error}</div>
        ) : null}

        <form onSubmit={onSubmit} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Thêm resource mới</h3>
              <p className="mt-1 text-sm text-neutral-500">Tạo nhanh ghế, bàn hoặc phòng để dùng trong điều phối lịch.</p>
            </div>
            <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">{rows.length} resource</div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.3fr_0.9fr_auto] md:items-end">
            <div>
              <FieldLabel>Tên resource</FieldLabel>
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
              {submitting ? "Đang thêm..." : "Thêm resource"}
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Danh sách resources</h3>
              <p className="mt-1 text-sm text-neutral-500">Chỉnh sửa trực tiếp tên, loại và trạng thái hoạt động.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải resources...</p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              Chưa có resource nào. Hãy tạo resource đầu tiên ở form phía trên.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <div key={r.id} className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-4 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-neutral-900">{r.name}</h4>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                            {r.active ? "ACTIVE" : "INACTIVE"}
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
                          Resource đang hoạt động
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
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Loại</p>
                          <p className="mt-2 text-base font-semibold text-neutral-900">{r.type}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Trạng thái</p>
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
