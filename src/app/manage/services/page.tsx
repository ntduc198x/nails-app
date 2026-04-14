"use client";

import { AppShell } from "@/components/app-shell";
import { MobileCollapsible, MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav, setupQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { createService, listServices, updateService } from "@/lib/domain";
import { formatVnd } from "@/lib/mock-data";
import { uploadServiceImage } from "@/lib/service-images";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ServiceRow = {
  id: string;
  name: string;
  short_description?: string | null;
  image_url?: string | null;
  featured_in_lookbook?: boolean | null;
  duration_min: number;
  base_price: number;
  vat_rate: number;
  active: boolean;
};

function FieldLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 ${className}`}>{children}</label>;
}

function InlineField({ label, children, compact = false }: { label: React.ReactNode; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`grid items-center gap-2 ${compact ? "grid-cols-[72px_minmax(0,1fr)]" : "grid-cols-[84px_minmax(0,1fr)]"}`}>
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

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[16px] md:text-sm text-neutral-900 outline-none transition placeholder:text-[13px] placeholder:text-neutral-400 md:placeholder:text-sm focus:border-rose-300 focus:ring-3 focus:ring-rose-100 ${props.className ?? ""}`}
    />
  );
}

export default function ServicesPage() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [mobileTrashOpen, setMobileTrashOpen] = useState(false);

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [featuredInLookbook, setFeaturedInLookbook] = useState(false);
  const [duration, setDuration] = useState(45);
  const [price, setPrice] = useState(250000);
  const [vat, setVat] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortDescription, setEditShortDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editFeaturedInLookbook, setEditFeaturedInLookbook] = useState(false);
  const [editDuration, setEditDuration] = useState(45);
  const [editPrice, setEditPrice] = useState(250000);
  const [editVat, setEditVat] = useState(0);
  const [editActive, setEditActive] = useState(true);

  const createSectionRef = useRef<HTMLDivElement | null>(null);
  const listSectionRef = useRef<HTMLDivElement | null>(null);
  const trashSectionRef = useRef<HTMLDivElement | null>(null);

  const canEdit = role === "OWNER" || role === "MANAGER" || role === "RECEPTION";

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const isInitial = rows.length === 0;
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const currentRole = await getCurrentSessionRole();
      setRole(currentRole);
      const data = await listServices({ force: opts?.force });
      setRows(data as ServiceRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load services failed");
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  }, [rows.length]);

  useEffect(() => {
    void load({ force: true });
  }, [load]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => row.active && (!keyword || [row.name, row.short_description ?? ""].join(" ").toLowerCase().includes(keyword)));
  }, [rows, search]);

  const trashedRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => !row.active && (!keyword || [row.name, row.short_description ?? ""].join(" ").toLowerCase().includes(keyword)));
  }, [rows, search]);

  const activeCount = useMemo(() => rows.filter((row) => row.active).length, [rows]);
  const featuredCount = useMemo(() => rows.filter((row) => row.featured_in_lookbook).length, [rows]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      if (!canEdit) throw new Error("Role hiện tại không được phép thêm dịch vụ.");
      const created = await createService({
        name,
        shortDescription: shortDescription || null,
        imageUrl: imageUrl || null,
        featuredInLookbook,
        durationMin: duration,
        basePrice: price,
        vatPercent: vat,
      });
      setName("");
      setShortDescription("");
      setImageUrl("");
      setFeaturedInLookbook(false);
      setDuration(45);
      setPrice(250000);
      setVat(0);
      await load({ force: true });
      const createdRow = created as Partial<ServiceRow> | null;
      if (createdRow?.id) {
        setEditingId(createdRow.id);
        setEditName(createdRow.name ?? "");
        setEditShortDescription(createdRow.short_description ?? shortDescription);
        setEditImageUrl(createdRow.image_url ?? imageUrl);
        setEditFeaturedInLookbook(Boolean(createdRow.featured_in_lookbook ?? featuredInLookbook));
        setEditDuration(createdRow.duration_min ?? duration);
        setEditPrice(Number(createdRow.base_price ?? price));
        setEditVat(Number(createdRow.vat_rate ?? vat / 100) * 100);
        setEditActive(createdRow.active ?? true);
      }
      requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create service failed");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(row: ServiceRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditShortDescription(row.short_description ?? "");
    setEditImageUrl(row.image_url ?? "");
    setEditFeaturedInLookbook(Boolean(row.featured_in_lookbook));
    setEditDuration(row.duration_min);
    setEditPrice(Number(row.base_price));
    setEditVat(Number(row.vat_rate) * 100);
    setEditActive(row.active);
  }

  async function saveEdit() {
    if (!editingId || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      await updateService({
        id: editingId,
        name: editName,
        shortDescription: editShortDescription || null,
        imageUrl: editImageUrl || null,
        featuredInLookbook: editFeaturedInLookbook,
        durationMin: editDuration,
        basePrice: editPrice,
        vatPercent: editVat,
        active: editActive,
      });
      setEditingId(null);
      await load({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update service failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateImageUpload(file?: File | null) {
    if (!file) return;
    try {
      setUploadingCreateImage(true);
      setError(null);
      const uploaded = await uploadServiceImage(file, name || file.name);
      setImageUrl(uploaded.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploadingCreateImage(false);
    }
  }

  async function handleEditImageUpload(file?: File | null) {
    if (!file) return;
    try {
      setUploadingEditImage(true);
      setError(null);
      const uploaded = await uploadServiceImage(file, editName || file.name);
      setEditImageUrl(uploaded.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploadingEditImage(false);
    }
  }

  async function moveToTrash(row: ServiceRow) {
    if (!canEdit || submitting) return;
    const ok = window.confirm(`Chuyển dịch vụ \"${row.name}\" vào thùng rác? Có thể khôi phục sau.`);
    if (!ok) return;

    try {
      setSubmitting(true);
      setError(null);
      await updateService({
        id: row.id,
        name: row.name,
        shortDescription: row.short_description || null,
        imageUrl: row.image_url || null,
        featuredInLookbook: Boolean(row.featured_in_lookbook),
        durationMin: row.duration_min,
        basePrice: Number(row.base_price),
        vatPercent: Number(row.vat_rate) * 100,
        active: false,
      });
      if (editingId === row.id) setEditingId(null);
      await load({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chuyển vào thùng rác thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function restoreService(row: ServiceRow) {
    if (!canEdit || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      await updateService({
        id: row.id,
        name: row.name,
        shortDescription: row.short_description || null,
        imageUrl: row.image_url || null,
        featuredInLookbook: Boolean(row.featured_in_lookbook),
        durationMin: row.duration_min,
        basePrice: Number(row.base_price),
        vatPercent: Number(row.vat_rate) * 100,
        active: true,
      });
      await load({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Khôi phục dịch vụ thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={setupQuickNav("/manage/services")} />

        <MobileSectionHeader title="Dịch vụ" meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : `${rows.length} dịch vụ`}</div>} />

        {role === "ACCOUNTANT" || role === "TECH" ? (
          <div className="manage-warn-box text-sm">
            Vai trò hiện tại chỉ xem danh sách dịch vụ, không thêm hoặc chỉnh sửa dữ liệu.
          </div>
        ) : null}

        {error ? <div className="manage-error-box text-sm">{error}</div> : null}

        <section className="manage-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Điều hướng nhanh</h3>
          </div>

          <div className="grid grid-cols-3 gap-2 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Tổng</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{rows.length}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Active</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{activeCount}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Lookbook</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{featuredCount}</div>
            </div>
          </div>

          <div className="hidden md:flex flex-wrap gap-2">
            <button type="button" onClick={() => requestAnimationFrame(() => createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
              Thêm dịch vụ mới
            </button>
            <button type="button" onClick={() => requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
              Danh sách dịch vụ
            </button>
            <button type="button" onClick={() => requestAnimationFrame(() => trashSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
              Thùng rác
            </button>
          </div>
        </section>

        <div ref={createSectionRef}>
          <div className="hidden md:block manage-surface p-4 md:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-neutral-900">Thêm dịch vụ mới</h3>
              <p className="text-xs text-neutral-500">Form desktop luôn hiển thị</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-2 md:grid md:gap-2 md:grid-cols-[minmax(0,1.1fr)_180px_160px] md:space-y-0">
                <InlineField label="Tên" compact>
                  <TextInput placeholder="Luxury Gel" value={name} onChange={(e) => setName(e.target.value)} required />
                </InlineField>
                <InlineField label="Giá" compact>
                  <TextInput inputMode="numeric" pattern="[0-9]*" value={price ? String(price) : ""} onChange={(e) => setPrice(Number(e.target.value.replace(/\D/g, "") || 0))} required placeholder="Ví dụ: 250000" />
                </InlineField>
                <InlineField label="Phút" compact>
                  <TextInput inputMode="numeric" pattern="[0-9]*" value={duration ? String(duration) : ""} onChange={(e) => setDuration(Number(e.target.value.replace(/\D/g, "") || 0))} required placeholder="Ví dụ: 60" />
                </InlineField>
              </div>

              <div className="space-y-2 md:grid md:gap-2 md:grid-cols-[minmax(0,1fr)_140px] md:space-y-0">
                <InlineField label="Ảnh" compact>
                  <TextInput placeholder="URL hoặc storage path" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </InlineField>
                <InlineField label="VAT" compact>
                  <TextInput inputMode="decimal" value={vat ? String(vat) : ""} onChange={(e) => setVat(Number(e.target.value.replace(/[^\d.]/g, "") || 0))} required placeholder="VAT %" />
                </InlineField>
              </div>

              <InlineField label="Mô tả" compact>
                <TextArea placeholder="Mô tả ngắn cho landing / lookbook" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="min-h-[56px]" />
              </InlineField>

              <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={featuredInLookbook} onChange={(e) => setFeaturedInLookbook(e.target.checked)} />
                    <span className="font-medium">Đưa lên lookbook</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleCreateImageUpload(e.target.files?.[0])} />
                    {uploadingCreateImage ? "Đang upload..." : "Upload ảnh"}
                  </label>
                </div>
                {imageUrl ? (
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-neutral-600">
                    <img src={imageUrl} alt="Preview lookbook" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1 truncate">Đã có ảnh preview</div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500">Chưa có ảnh preview</div>
                )}
              </div>

              <button disabled={submitting || !canEdit} className="cursor-pointer w-full rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Đang thêm dịch vụ..." : "Thêm dịch vụ"}
              </button>
            </form>
          </div>

          <div className="md:hidden">
            <MobileCollapsible summary="Thêm dịch vụ mới" defaultOpen={mobileCreateOpen || !rows.length}>
            <form onSubmit={onSubmit} className="space-y-2.5">
              <div className="grid grid-cols-[minmax(0,1fr)_96px_78px] gap-2">
                <TextInput placeholder="Tên dịch vụ" value={name} onChange={(e) => setName(e.target.value)} required />
                <TextInput inputMode="numeric" pattern="[0-9]*" value={price ? String(price) : undefined} onChange={(e) => setPrice(Number(e.target.value.replace(/\D/g, "") || 0))} required placeholder="250000" />
                <TextInput inputMode="numeric" pattern="[0-9]*" value={duration ? String(duration) : undefined} onChange={(e) => setDuration(Number(e.target.value.replace(/\D/g, "") || 0))} required placeholder="60" />
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-2">
                <TextInput placeholder="Ảnh URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                <TextInput inputMode="decimal" value={vat ? String(vat) : ""} onChange={(e) => setVat(Number(e.target.value.replace(/[^\d.]/g, "") || 0))} required placeholder="VAT %" />
              </div>

              <TextArea placeholder="Mô tả ngắn" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="min-h-[44px]" />

              <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={featuredInLookbook} onChange={(e) => setFeaturedInLookbook(e.target.checked)} />
                    <span className="font-medium">Đưa lên lookbook</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleCreateImageUpload(e.target.files?.[0])} />
                    {uploadingCreateImage ? "Đang upload..." : "Upload ảnh"}
                  </label>
                </div>
                {imageUrl ? (
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-neutral-600">
                    <img src={imageUrl} alt="Preview lookbook" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1 truncate">Đã có ảnh preview</div>
                  </div>
                ) : (
                  <div className="text-xs text-neutral-500">Chưa có ảnh preview</div>
                )}
              </div>

            <button disabled={submitting || !canEdit} className="cursor-pointer w-full rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Đang thêm dịch vụ..." : "Thêm dịch vụ"}
            </button>
            </form>
            </MobileCollapsible>
          </div>
        </div>

        <div ref={listSectionRef}>
          <div className="hidden md:block manage-surface space-y-3 p-4 md:p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Danh sách dịch vụ</h3>
                <p className="text-xs text-neutral-500">Ưu tiên xem nhanh giá, thời lượng, trạng thái, hạn chế mở card dài.</p>
              </div>
              <div className="w-full md:w-[320px]">
                <TextInput placeholder="Tìm tên hoặc mô tả" value={search} onChange={(e) => setSearch(e.target.value)} className="py-2.5 text-sm" />
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-neutral-500">Đang tải dữ liệu dịch vụ...</p>
            ) : filteredRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                {rows.length === 0 ? "Chưa có dịch vụ nào. Hãy tạo dịch vụ đầu tiên ở phía trên." : "Không có dịch vụ khớp bộ lọc hiện tại."}
              </div>
            ) : (
              <div className="space-y-1.5">
              {filteredRows.map((s) => {
                const isEditing = editingId === s.id;
                return (
                  <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        {s.image_url ? <img src={s.image_url} alt={s.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" /> : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isEditing ? (
                              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xl py-1.5 text-[13px]" />
                            ) : (
                            <>
                              <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900 md:text-sm">{s.name}</h4>
                              {s.featured_in_lookbook ? <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">Lookbook</span> : null}
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                                {s.active ? "Đang dùng" : "Tạm ẩn"}
                              </span>
                            </>
                          )}
                        </div>
                          {!isEditing ? <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả ngắn."}</p> : null}
                        </div>
                      </div>

                      {!canEdit ? null : isEditing ? (
                        <div className="flex gap-1.5">
                          <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void moveToTrash(s)} disabled={submitting}>
                            Xóa
                          </button>
                          <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => setEditingId(null)}>
                            Huỷ
                          </button>
                          <button className="cursor-pointer rounded-xl bg-rose-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void saveEdit()} disabled={submitting}>
                            {submitting ? "Đang lưu..." : "Lưu"}
                          </button>
                        </div>
                      ) : (
                        <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => startEdit(s)}>
                          Sửa
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2 rounded-2xl bg-neutral-50 p-2.5">
                        <div className="space-y-2 md:grid md:gap-2 md:grid-cols-[minmax(0,1fr)_140px_140px_120px] md:space-y-0">
                          <InlineField label="Mô tả" compact>
                            <TextArea value={editShortDescription} onChange={(e) => setEditShortDescription(e.target.value)} className="min-h-[64px] text-[13px]" />
                          </InlineField>
                          <InlineField label="Giá" compact>
                            <TextInput type="number" min={0} value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="text-[13px]" />
                          </InlineField>
                          <InlineField label="Phút" compact>
                            <TextInput type="number" min={5} value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} className="text-[13px]" />
                          </InlineField>
                          <InlineField label="VAT" compact>
                            <TextInput type="number" min={0} step={0.5} value={editVat} onChange={(e) => setEditVat(Number(e.target.value))} className="text-[13px]" />
                          </InlineField>
                        </div>

                        <div className="space-y-2">
                          <InlineField label="Ảnh" compact>
                            <TextInput value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="URL hoặc storage path" className="text-[13px]" />
                          </InlineField>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
                              <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editFeaturedInLookbook} onChange={(e) => setEditFeaturedInLookbook(e.target.checked)} />
                              Đưa lên lookbook
                            </label>
                            <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
                              <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                              Dịch vụ đang hoạt động
                            </label>
                            <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleEditImageUpload(e.target.files?.[0])} />
                              {uploadingEditImage ? "Đang upload..." : "Upload ảnh mới"}
                            </label>
                          </div>

                          {editImageUrl ? (
                            <img src={editImageUrl} alt="Preview" className="h-32 w-full rounded-2xl object-cover" />
                          ) : (
                            <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white text-xs text-neutral-400">Chưa có ảnh</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{formatVnd(Number(s.base_price))}</div>
                        <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{s.duration_min}p</div>
                        <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">VAT {Number(s.vat_rate) * 100}%</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>

          <div className="md:hidden">
            <MobileCollapsible summary={<div className="flex items-center justify-between gap-3 pr-2"><span>Danh sách dịch vụ</span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">{filteredRows.length}</span></div>} defaultOpen={mobileListOpen}>
              <div className="space-y-2.5">
                <TextInput placeholder="Tìm tên hoặc mô tả" value={search} onChange={(e) => setSearch(e.target.value)} className="py-2 text-sm" />
                {loading ? (
                  <p className="text-sm text-neutral-500">Đang tải dữ liệu dịch vụ...</p>
                ) : filteredRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
                    {rows.length === 0 ? "Chưa có dịch vụ nào. Hãy tạo dịch vụ đầu tiên ở phía trên." : "Không có dịch vụ khớp bộ lọc hiện tại."}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredRows.map((s) => {
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              {s.image_url ? <img src={s.image_url} alt={s.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" /> : null}
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {isEditing ? (
                                    <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xl py-1 text-[12px]" />
                                  ) : (
                                  <>
                                    <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900 md:text-sm">{s.name}</h4>
                                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                                      {s.featured_in_lookbook ? `Lookbook · ${s.active ? "Đang dùng" : "Tạm ẩn"}` : (s.active ? "Đang dùng" : "Tạm ẩn")}
                                    </span>
                                  </>
                                )}
                              </div>
                                {!isEditing ? <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả."}</p> : null}
                              </div>
                            </div>

                            {!canEdit ? null : isEditing ? (
                              <div className="flex gap-1.5">
                                <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void moveToTrash(s)} disabled={submitting}>
                                  Xóa
                                </button>
                                <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => setEditingId(null)}>
                                  Huỷ
                                </button>
                                <button className="cursor-pointer rounded-xl bg-rose-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void saveEdit()} disabled={submitting}>
                                  {submitting ? "Đang lưu..." : "Lưu"}
                                </button>
                              </div>
                            ) : (
                              <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => startEdit(s)}>
                                Sửa
                              </button>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="mt-2 space-y-2 rounded-2xl bg-neutral-50 p-2.5">
                              <div className="space-y-2 md:grid md:gap-2 md:grid-cols-[minmax(0,1fr)_140px_140px_120px] md:space-y-0">
                                <InlineField label="Mô tả" compact>
                                  <TextArea value={editShortDescription} onChange={(e) => setEditShortDescription(e.target.value)} className="min-h-[56px] text-[12px]" />
                                </InlineField>
                                <InlineField label="Giá" compact>
                                  <TextInput type="number" min={0} value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="py-1 text-[12px]" />
                                </InlineField>
                                <InlineField label="Phút" compact>
                                  <TextInput type="number" min={5} value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} className="py-1 text-[12px]" />
                                </InlineField>
                                <InlineField label="VAT" compact>
                                  <TextInput type="number" min={0} step={0.5} value={editVat} onChange={(e) => setEditVat(Number(e.target.value))} className="py-1 text-[12px]" />
                                </InlineField>
                              </div>

                              <div className="space-y-2">
                                <InlineField label="Ảnh" compact>
                                  <TextInput value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="URL hoặc storage path" className="py-1 text-[12px]" />
                                </InlineField>
                              </div>

                              <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                                <div className="space-y-2">
                                  <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editFeaturedInLookbook} onChange={(e) => setEditFeaturedInLookbook(e.target.checked)} />
                                    Đưa lên lookbook
                                  </label>
                                  <label className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                                    Dịch vụ đang hoạt động
                                  </label>
                                  <label className="inline-flex w-full cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleEditImageUpload(e.target.files?.[0])} />
                                    {uploadingEditImage ? "Đang upload..." : "Upload ảnh mới"}
                                  </label>
                                </div>

                                {editImageUrl ? (
                                  <img src={editImageUrl} alt="Preview" className="h-32 w-full rounded-2xl object-cover" />
                                ) : (
                                  <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white text-xs text-neutral-400">Chưa có ảnh</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{formatVnd(Number(s.base_price))}</div>
                              <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{s.duration_min}p</div>
                              <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">VAT {Number(s.vat_rate) * 100}%</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </MobileCollapsible>
          </div>
        </div>

        <div ref={trashSectionRef}>
          <div className="hidden md:block manage-surface space-y-3 p-4 md:p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">Thùng rác</h3>
                <p className="text-xs text-neutral-500">Dịch vụ đã xóa tạm sẽ nằm ở đây để khôi phục hoặc xóa hẳn sau.</p>
              </div>
              <div className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-700">{trashedRows.length} mục</div>
            </div>

            {trashedRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                Thùng rác đang trống.
              </div>
            ) : (
              <div className="space-y-1.5">
                {trashedRows.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900 md:text-sm">{s.name}</h4>
                          <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600">TRASH</span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả ngắn."}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{formatVnd(Number(s.base_price))}</div>
                          <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{s.duration_min}p</div>
                          <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">VAT {Number(s.vat_rate) * 100}%</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button className="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void restoreService(s)} disabled={submitting}>
                          Khôi phục
                        </button>
                        <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => window.alert("Hiện tại đã có thùng rác tạm. Nếu anh chốt xóa hẳn thật, em sẽ nối thêm bước delete DB ở lượt sau để tránh xóa nhầm.")} disabled={submitting}>
                          Xóa hẳn
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:hidden">
            <MobileCollapsible summary={<div className="flex items-center justify-between gap-3 pr-2"><span>Thùng rác</span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">{trashedRows.length}</span></div>} defaultOpen={mobileTrashOpen}>
              {trashedRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                  Thùng rác đang trống.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {trashedRows.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900 md:text-sm">{s.name}</h4>
                            <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600">TRASH</span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả ngắn."}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{formatVnd(Number(s.base_price))}</div>
                            <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{s.duration_min}p</div>
                            <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">VAT {Number(s.vat_rate) * 100}%</div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          <button className="cursor-pointer rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void restoreService(s)} disabled={submitting}>
                            Khôi phục
                          </button>
                          <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => window.alert("Hiện tại đã có thùng rác tạm. Nếu anh chốt xóa hẳn thật, em sẽ nối thêm bước delete DB ở lượt sau để tránh xóa nhầm.")} disabled={submitting}>
                            Xóa hẳn
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </MobileCollapsible>
          </div>
        </div>

        <MobileStickyActions>
          <button type="button" onClick={() => { setMobileCreateOpen(true); setMobileListOpen(false); setMobileTrashOpen(false); requestAnimationFrame(() => createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} className="flex-1 rounded-2xl bg-[var(--color-primary)] px-3 py-3 text-[13px] font-semibold text-white shadow-sm transition hover:brightness-95">
            Thêm mới
          </button>
          <button type="button" onClick={() => { setMobileCreateOpen(false); setMobileListOpen(true); setMobileTrashOpen(false); requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} className="flex-1 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[13px] font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50">
            Danh sách
          </button>
          <button type="button" onClick={() => { setMobileCreateOpen(false); setMobileListOpen(false); setMobileTrashOpen(true); requestAnimationFrame(() => trashSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} className="flex-1 rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-[13px] font-semibold text-neutral-800 shadow-sm transition hover:bg-neutral-50">
            Thùng rác
          </button>
        </MobileStickyActions>

      </div>
    </AppShell>
  );
}
