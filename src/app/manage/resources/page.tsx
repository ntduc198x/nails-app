"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileCollapsible, MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, setupQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { createResource, listResources, updateResource } from "@/lib/domain";
import { useEffect, useMemo, useRef, useState } from "react";

type ResourceRow = { id: string; name: string; type: "CHAIR" | "TABLE" | "ROOM"; active: boolean };

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
      className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[16px] md:text-sm text-neutral-900 outline-none transition placeholder:text-[13px] placeholder:text-neutral-400 md:placeholder:text-sm focus:border-rose-300 focus:ring-3 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[16px] md:text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-3 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

function typeLabel(type: ResourceRow["type"]) {
  if (type === "CHAIR") return "Ghế";
  if (type === "TABLE") return "Bàn";
  return "Phòng";
}

export default function ResourcesPage() {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<"CHAIR" | "TABLE" | "ROOM">("CHAIR");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"CHAIR" | "TABLE" | "ROOM">("CHAIR");
  const [editActive, setEditActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const createSectionRef = useRef<HTMLDivElement | null>(null);
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  const canEdit = role === "OWNER" || role === "MANAGER" || role === "RECEPTION";

  async function load(opts?: { silent?: boolean }) {
    try {
      if (opts?.silent) setRefreshing(true);
      setError(null);
      setRole(await getCurrentSessionRole());
      const data = await listResources({ force: true, activeOnly: false });
      setRows(data as ResourceRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải danh sách tài nguyên thất bại");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => `${row.name} ${row.type}`.toLowerCase().includes(keyword));
  }, [rows, search]);

  const activeCount = useMemo(() => rows.filter((row) => row.active).length, [rows]);
  const chairCount = useMemo(() => rows.filter((row) => row.type === "CHAIR").length, [rows]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      await createResource({ name, type });
      setName("");
      setType("CHAIR");
      await load({ silent: true });
      requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
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
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cập nhật tài nguyên thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={setupQuickNav("/manage/resources")} />

        <MobileSectionHeader title="Tài nguyên" meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : `${rows.length} tài nguyên`}</div>} />

        {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}

        <section className="manage-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Điều hướng nhanh</h3>
            <button type="button" onClick={() => requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
              Danh sách tài nguyên
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Tổng</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{rows.length}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium tracking-[0.04em] text-neutral-500">Đang dùng</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{activeCount}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium tracking-[0.04em] text-neutral-500">Ghế</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{chairCount}</div>
            </div>
          </div>

        </section>

        <div ref={createSectionRef} className="space-y-3">
          <div className="hidden md:block manage-surface p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-neutral-900">Thêm tài nguyên mới</h3>
              <p className="text-xs text-neutral-500">Form desktop luôn hiển thị</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-2 md:grid md:grid-cols-[minmax(0,1fr)_180px_auto] md:gap-2 md:space-y-0">
                <InlineField label="Tên">
                  <TextInput placeholder="Ví dụ: Ghế 01" value={name} onChange={(e) => setName(e.target.value)} required />
                </InlineField>
                <InlineField label="Loại">
                  <SelectInput value={type} onChange={(e) => setType(e.target.value as "CHAIR" | "TABLE" | "ROOM")} className="text-[14px] md:text-sm">
                    <option value="CHAIR">Ghế</option>
                    <option value="TABLE">Bàn</option>
                    <option value="ROOM">Phòng</option>
                  </SelectInput>
                </InlineField>
                <button className="cursor-pointer rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
                  {submitting ? "Đang thêm..." : "Thêm tài nguyên"}
                </button>
              </div>
            </form>
          </div>

          <div className="md:hidden">
            <MobileCollapsible summary="Thêm tài nguyên mới" defaultOpen={!rows.length}>
              <form onSubmit={onSubmit} className="space-y-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                  <TextInput placeholder="Ghế chân ..." value={name} onChange={(e) => setName(e.target.value)} required />
                  <SelectInput value={type} onChange={(e) => setType(e.target.value as "CHAIR" | "TABLE" | "ROOM")} className="text-[14px] md:text-sm">
                    <option value="CHAIR">Ghế</option>
                    <option value="TABLE">Bàn</option>
                    <option value="ROOM">Phòng</option>
                  </SelectInput>
                </div>
                <button className="cursor-pointer w-full rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
                  {submitting ? "Đang thêm..." : "Thêm tài nguyên"}
                </button>
              </form>
            </MobileCollapsible>
          </div>
        </div>

        <section ref={listSectionRef} className="manage-surface space-y-3 p-4 md:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Danh sách tài nguyên</h3>
              <p className="text-xs text-neutral-500">Quét nhanh tên, loại, trạng thái rồi sửa inline khi cần.</p>
            </div>
            <div className="w-full md:w-[260px]">
              <TextInput placeholder="Tìm tên hoặc loại" value={search} onChange={(e) => setSearch(e.target.value)} className="py-2.5 text-sm" />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải tài nguyên...</p>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              {rows.length === 0 ? "Chưa có tài nguyên nào. Hãy tạo tài nguyên đầu tiên ở phía trên." : "Không có tài nguyên khớp bộ lọc hiện tại."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRows.map((r) => {
                const isEditing = editingId === r.id;
                return (
                  <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-semibold leading-5 text-neutral-900">{isEditing ? editName : r.name}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${(isEditing ? editActive : r.active) ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                            {isEditing ? `${typeLabel(editType)} · ${(editActive ? "Đang dùng" : "Tạm ẩn")}` : `${typeLabel(r.type)} · ${(r.active ? "Đang dùng" : "Tạm ẩn")}`}
                          </span>
                        </div>
                      </div>

                      {!canEdit ? null : isEditing ? (
                        <div className="flex gap-2">
                          <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700" onClick={() => setEditingId(null)} type="button">
                            Huỷ
                          </button>
                          <button className="cursor-pointer rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void saveEdit()} type="button" disabled={submitting}>
                            {submitting ? "Đang lưu..." : "Lưu"}
                          </button>
                        </div>
                      ) : (
                        <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50" onClick={() => startEdit(r)} type="button">
                          Sửa
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-3 space-y-2 rounded-2xl bg-neutral-50 p-3">
                        <InlineField label="Tên">
                          <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </InlineField>
                        <InlineField label="Loại">
                          <SelectInput value={editType} onChange={(e) => setEditType(e.target.value as "CHAIR" | "TABLE" | "ROOM")} className="text-[14px] md:text-sm">
                            <option value="CHAIR">Ghế</option>
                            <option value="TABLE">Bàn</option>
                            <option value="ROOM">Phòng</option>
                          </SelectInput>
                        </InlineField>
                        <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
                          <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                          Tài nguyên đang hoạt động
                        </label>
                      </div>
                    ) : null}
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
