"use client";

import { AppShell } from "@/components/app-shell";
import { MobileCollapsible, MobileSectionHeader, MobileStickyActions } from "@/components/manage-mobile";
import { ManageQuickNav, setupQuickNav } from "@/components/manage-quick-nav";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { createService, deleteService, listServices, updateService } from "@/lib/domain";
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

type ServiceFormState = {
  name: string;
  shortDescription: string;
  imageUrl: string;
  featuredInLookbook: boolean;
  durationInput: string;
  priceInput: string;
  vatInput: string;
  active: boolean;
};

const emptyCreateForm: ServiceFormState = {
  name: "",
  shortDescription: "",
  imageUrl: "",
  featuredInLookbook: false,
  durationInput: "",
  priceInput: "",
  vatInput: "",
  active: true,
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

function parseDigits(value: string) {
  return Number(value.replace(/\D/g, "") || 0);
}

function parseDecimal(value: string) {
  return Number(value.replace(/[^\d.]/g, "") || 0);
}

function serviceToFormState(row: ServiceRow): ServiceFormState {
  return {
    name: row.name,
    shortDescription: row.short_description ?? "",
    imageUrl: row.image_url ?? "",
    featuredInLookbook: Boolean(row.featured_in_lookbook),
    durationInput: String(row.duration_min),
    priceInput: String(Number(row.base_price)),
    vatInput: String(Number(row.vat_rate) * 100),
    active: row.active,
  };
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

  const [createForm, setCreateForm] = useState<ServiceFormState>(emptyCreateForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ServiceFormState | null>(null);

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
  const sampleCount = useMemo(() => rows.filter((row) => row.active && Boolean(row.featured_in_lookbook)).length, [rows]);
  const activeServiceCount = useMemo(() => rows.filter((row) => row.active && !row.featured_in_lookbook).length, [rows]);

  const activeServiceRows = useMemo(() => filteredRows.filter((row) => !row.featured_in_lookbook), [filteredRows]);
  const lookbookSampleRows = useMemo(() => filteredRows.filter((row) => Boolean(row.featured_in_lookbook)), [filteredRows]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      if (!canEdit) throw new Error("Role hiện tại không được phép thêm dịch vụ.");

      const created = await createService({
        name: createForm.name,
        shortDescription: createForm.shortDescription || null,
        imageUrl: createForm.imageUrl || null,
        featuredInLookbook: createForm.featuredInLookbook,
        durationMin: parseDigits(createForm.durationInput),
        basePrice: parseDigits(createForm.priceInput),
        vatPercent: parseDecimal(createForm.vatInput),
      });

      setCreateForm(emptyCreateForm);
      await load({ force: true });

      const createdRow = created as Partial<ServiceRow> | null;
      if (createdRow?.id) {
        const matchedRow = {
          id: createdRow.id,
          name: createdRow.name ?? createForm.name,
          short_description: createdRow.short_description ?? createForm.shortDescription,
          image_url: createdRow.image_url ?? createForm.imageUrl,
          featured_in_lookbook: createdRow.featured_in_lookbook ?? createForm.featuredInLookbook,
          duration_min: createdRow.duration_min ?? parseDigits(createForm.durationInput),
          base_price: Number(createdRow.base_price ?? parseDigits(createForm.priceInput)),
          vat_rate: Number(createdRow.vat_rate ?? parseDecimal(createForm.vatInput) / 100),
          active: createdRow.active ?? true,
        } as ServiceRow;
        setEditingId(matchedRow.id);
        setEditForm(serviceToFormState(matchedRow));
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
    setEditForm(serviceToFormState(row));
  }

  async function saveEdit() {
    if (!editingId || !editForm || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      await updateService({
        id: editingId,
        name: editForm.name,
        shortDescription: editForm.shortDescription || null,
        imageUrl: editForm.imageUrl || null,
        featuredInLookbook: editForm.featuredInLookbook,
        durationMin: parseDigits(editForm.durationInput),
        basePrice: parseDigits(editForm.priceInput),
        vatPercent: parseDecimal(editForm.vatInput),
        active: editForm.active,
      });
      setEditingId(null);
      setEditForm(null);
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
      const uploaded = await uploadServiceImage(file, createForm.name || file.name);
      setCreateForm((prev) => ({ ...prev, imageUrl: uploaded.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploadingCreateImage(false);
    }
  }

  async function handleEditImageUpload(file?: File | null) {
    if (!file || !editForm) return;
    try {
      setUploadingEditImage(true);
      setError(null);
      const uploaded = await uploadServiceImage(file, editForm.name || file.name);
      setEditForm((prev) => (prev ? { ...prev, imageUrl: uploaded.publicUrl } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploadingEditImage(false);
    }
  }

  async function moveToTrash(row: ServiceRow) {
    if (!canEdit || submitting) return;
    const ok = window.confirm(`Chuyển dịch vụ "${row.name}" vào thùng rác? Có thể khôi phục sau.`);
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
      if (editingId === row.id) {
        setEditingId(null);
        setEditForm(null);
      }
      await load({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chuyển vào thùng rác thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  async function restoreFromTrash(row: ServiceRow) {
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

  function openListSection() {
    setMobileListOpen(true);
    requestAnimationFrame(() => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function deleteForever(row: ServiceRow) {
    if (!canEdit || submitting) return;
    const ok = window.confirm(`Xóa vĩnh viễn dịch vụ "${row.name}"? Hành động này không thể hoàn tác.`);
    if (!ok) return;

    try {
      setSubmitting(true);
      setError(null);
      await deleteService(row.id);
      await load({ force: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa vĩnh viễn thất bại");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <ManageQuickNav items={setupQuickNav("/manage/services")} />

        <MobileSectionHeader title="Dịch vụ" meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : `${activeCount} dịch vụ`}</div>} />

        {error ? <div className="manage-error-box">{error}</div> : null}

        <section className="manage-surface space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-900">Điều hướng nhanh</h3>
            <button type="button" onClick={openListSection} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
              Danh sách dịch vụ
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-500">Tổng active</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{activeCount}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium tracking-[0.04em] text-neutral-500">Dịch vụ</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{activeServiceCount}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium tracking-[0.04em] text-neutral-500">Mẫu lookbook</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{sampleCount}</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5">
              <div className="text-[10px] font-medium tracking-[0.04em] text-neutral-500">Thùng rác</div>
              <div className="mt-1 text-sm font-semibold text-neutral-900">{trashedRows.length}</div>
            </div>
          </div>

          <div className="hidden md:flex flex-wrap gap-2">
            <button type="button" onClick={() => requestAnimationFrame(() => createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))} className="cursor-pointer rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700">
              Thêm dịch vụ mới
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
              <div className="space-y-2">
                <InlineField label="Tên" compact>
                  <TextInput placeholder="Luxury Gel" value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </InlineField>

                <div className="grid gap-2 md:grid-cols-[72px_minmax(0,1fr)] md:items-center">
                  <FieldLabel className="mb-0">Thông số</FieldLabel>
                  <div className="grid gap-2 md:grid-cols-3">
                    <TextInput inputMode="numeric" pattern="[0-9]*" value={createForm.priceInput} onChange={(e) => setCreateForm((prev) => ({ ...prev, priceInput: e.target.value.replace(/\D/g, "") }))} required placeholder="Giá · 250000" />
                    <TextInput inputMode="numeric" pattern="[0-9]*" value={createForm.durationInput} onChange={(e) => setCreateForm((prev) => ({ ...prev, durationInput: e.target.value.replace(/\D/g, "") }))} required placeholder="Phút · 45" />
                    <TextInput inputMode="decimal" value={createForm.vatInput} onChange={(e) => setCreateForm((prev) => ({ ...prev, vatInput: e.target.value.replace(/[^\d.]/g, "") }))} required placeholder="VAT %" />
                  </div>
                </div>

                <InlineField label="Ảnh" compact>
                  <TextInput placeholder="URL hoặc storage path" value={createForm.imageUrl} onChange={(e) => setCreateForm((prev) => ({ ...prev, imageUrl: e.target.value }))} />
                </InlineField>
              </div>

              <InlineField label="Mô tả" compact>
                <TextArea placeholder="Mô tả ngắn cho landing / lookbook" value={createForm.shortDescription} onChange={(e) => setCreateForm((prev) => ({ ...prev, shortDescription: e.target.value }))} className="min-h-[56px]" />
              </InlineField>

              <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-neutral-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={createForm.featuredInLookbook} onChange={(e) => setCreateForm((prev) => ({ ...prev, featuredInLookbook: e.target.checked }))} />
                    <span className="font-medium">Đưa lên lookbook</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleCreateImageUpload(e.target.files?.[0])} />
                    {uploadingCreateImage ? "Đang upload..." : "Upload ảnh"}
                  </label>
                </div>
                {createForm.imageUrl ? (
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-neutral-600">
                    <img src={createForm.imageUrl} alt="Preview lookbook" className="h-10 w-10 rounded-lg object-cover" />
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
            <MobileCollapsible summary="Thêm dịch vụ mới" open={!rows.length ? true : mobileCreateOpen} onToggle={setMobileCreateOpen}>
              <form onSubmit={onSubmit} className="space-y-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_96px_78px] gap-2">
                  <TextInput placeholder="Tên dịch vụ" value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} required />
                  <TextInput inputMode="numeric" pattern="[0-9]*" value={createForm.priceInput} onChange={(e) => setCreateForm((prev) => ({ ...prev, priceInput: e.target.value.replace(/\D/g, "") }))} required placeholder="250000" />
                  <TextInput inputMode="numeric" pattern="[0-9]*" value={createForm.durationInput} onChange={(e) => setCreateForm((prev) => ({ ...prev, durationInput: e.target.value.replace(/\D/g, "") }))} required placeholder="45" />
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-2">
                  <TextInput placeholder="Ảnh URL" value={createForm.imageUrl} onChange={(e) => setCreateForm((prev) => ({ ...prev, imageUrl: e.target.value }))} />
                  <TextInput inputMode="decimal" value={createForm.vatInput} onChange={(e) => setCreateForm((prev) => ({ ...prev, vatInput: e.target.value.replace(/[^\d.]/g, "") }))} required placeholder="VAT %" />
                </div>

                <TextArea placeholder="Mô tả ngắn" value={createForm.shortDescription} onChange={(e) => setCreateForm((prev) => ({ ...prev, shortDescription: e.target.value }))} className="min-h-[44px]" />

                <div className="space-y-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-neutral-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={createForm.featuredInLookbook} onChange={(e) => setCreateForm((prev) => ({ ...prev, featuredInLookbook: e.target.checked }))} />
                      <span className="font-medium">Đưa lên lookbook</span>
                    </label>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleCreateImageUpload(e.target.files?.[0])} />
                      {uploadingCreateImage ? "Đang upload..." : "Upload ảnh"}
                    </label>
                  </div>
                  {createForm.imageUrl ? (
                    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-neutral-600">
                      <img src={createForm.imageUrl} alt="Preview lookbook" className="h-10 w-10 rounded-lg object-cover" />
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
                <p className="text-xs text-neutral-500">Tách riêng dịch vụ vận hành và mẫu lookbook để tránh nhầm khi chỉnh landing page.</p>
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
              <>
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-600">Dịch vụ vận hành</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-700">{activeServiceRows.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {activeServiceRows.map((s) => {
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-2.5">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex min-w-0 flex-1 items-start gap-2.5">
                              {s.image_url ? <img src={s.image_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : null}
                              <div className="min-w-0 flex-1">
                                {isEditing && editForm ? (
                                  <TextInput value={editForm.name} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="max-w-xl py-1.5 text-[13px]" placeholder="Tên dịch vụ" />
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900 md:text-sm">{s.name}</h4>
                                    {s.featured_in_lookbook ? <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">Lookbook</span> : null}
                                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>{s.active ? "Đang dùng" : "Tạm ẩn"}</span>
                                  </div>
                                )}
                                {!isEditing ? <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả ngắn."}</p> : null}
                              </div>
                            </div>
                            {!canEdit ? null : isEditing ? (
                              <div className="flex gap-1.5">
                                <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void moveToTrash(s)} disabled={submitting}>Xóa</button>
                                <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => { setEditingId(null); setEditForm(null); }}>Huỷ</button>
                                <button className="cursor-pointer rounded-xl bg-rose-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void saveEdit()} disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</button>
                              </div>
                            ) : (
                              <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => startEdit(s)}>Sửa</button>
                            )}
                          </div>
                          {isEditing && editForm ? (
                            <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
                              <div className="space-y-2">
                                <TextArea value={editForm.shortDescription} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, shortDescription: e.target.value } : prev))} placeholder="Mô tả ngắn" className="min-h-[52px] text-[12px]" />
                                <div className="grid grid-cols-3 gap-2">
                                  <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.priceInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, priceInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Giá" className="py-1.5 text-[12px]" />
                                  <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.durationInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, durationInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Phút" className="py-1.5 text-[12px]" />
                                  <TextInput inputMode="decimal" value={editForm.vatInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, vatInput: e.target.value.replace(/[^\d.]/g, "") } : prev))} placeholder="VAT %" className="py-1.5 text-[12px]" />
                                </div>
                                <TextInput value={editForm.imageUrl} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, imageUrl: e.target.value } : prev))} placeholder="URL hoặc storage path" className="py-1.5 text-[12px]" />
                                <div className="flex flex-wrap gap-2">
                                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.featuredInLookbook} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, featuredInLookbook: e.target.checked } : prev))} />
                                    Lookbook
                                  </label>
                                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.active} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, active: e.target.checked } : prev))} />
                                    Đang hoạt động
                                  </label>
                                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleEditImageUpload(e.target.files?.[0])} />
                                    {uploadingEditImage ? "Đang upload..." : "Upload ảnh"}
                                  </label>
                                </div>
                                {editForm.imageUrl ? (
                                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
                                    <img src={editForm.imageUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                                    <div className="min-w-0 flex-1 truncate">Đã có ảnh preview</div>
                                  </div>
                                ) : null}
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
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">Mẫu lookbook / trend</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-amber-800">{lookbookSampleRows.length}</span>
                  </div>
                  <p className="mb-2 text-xs text-amber-800/80">Những mục bắt đầu bằng &quot;Mẫu ...&quot; là item phục vụ landing/lookbook, không phải dịch vụ vận hành chính.</p>
                  <div className="space-y-1.5">
                    {lookbookSampleRows.map((s) => {
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} className="rounded-2xl border border-amber-200 bg-white p-2.5">
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex min-w-0 flex-1 items-start gap-2.5">
                              {s.image_url ? <img src={s.image_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" /> : null}
                              <div className="min-w-0 flex-1">
                                {isEditing && editForm ? (
                                  <TextInput value={editForm.name} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="max-w-xl py-1.5 text-[13px]" placeholder="Tên dịch vụ" />
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900 md:text-sm">{s.name}</h4>
                                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">Mẫu lookbook</span>
                                    {s.featured_in_lookbook ? <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">Landing</span> : null}
                                  </div>
                                )}
                                {!isEditing ? <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả ngắn."}</p> : null}
                              </div>
                            </div>
                            {!canEdit ? null : isEditing ? (
                              <div className="flex gap-1.5">
                                <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void moveToTrash(s)} disabled={submitting}>Xóa</button>
                                <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => { setEditingId(null); setEditForm(null); }}>Huỷ</button>
                                <button className="cursor-pointer rounded-xl bg-rose-500 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void saveEdit()} disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</button>
                              </div>
                            ) : (
                              <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => startEdit(s)}>Sửa</button>
                            )}
                          </div>
                          {isEditing && editForm ? (
                            <div className="mt-3 rounded-2xl bg-neutral-50 p-3">
                              <div className="space-y-2">
                                <TextArea value={editForm.shortDescription} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, shortDescription: e.target.value } : prev))} placeholder="Mô tả ngắn" className="min-h-[52px] text-[12px]" />
                                <div className="grid grid-cols-3 gap-2">
                                  <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.priceInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, priceInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Giá" className="py-1.5 text-[12px]" />
                                  <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.durationInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, durationInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Phút" className="py-1.5 text-[12px]" />
                                  <TextInput inputMode="decimal" value={editForm.vatInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, vatInput: e.target.value.replace(/[^\d.]/g, "") } : prev))} placeholder="VAT %" className="py-1.5 text-[12px]" />
                                </div>
                                <TextInput value={editForm.imageUrl} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, imageUrl: e.target.value } : prev))} placeholder="URL hoặc storage path" className="py-1.5 text-[12px]" />
                                <div className="flex flex-wrap gap-2">
                                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.featuredInLookbook} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, featuredInLookbook: e.target.checked } : prev))} />
                                    Lookbook
                                  </label>
                                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.active} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, active: e.target.checked } : prev))} />
                                    Đang hoạt động
                                  </label>
                                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleEditImageUpload(e.target.files?.[0])} />
                                    {uploadingEditImage ? "Đang upload..." : "Upload ảnh"}
                                  </label>
                                </div>
                                {editForm.imageUrl ? (
                                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
                                    <img src={editForm.imageUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                                    <div className="min-w-0 flex-1 truncate">Đã có ảnh preview</div>
                                  </div>
                                ) : null}
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
                </div>
              </>
            )}
          </div>

          <div className="md:hidden space-y-3">
            <MobileCollapsible summary={<div className="flex items-center justify-between gap-3 pr-2"><span>Dịch vụ</span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">{activeServiceRows.length}</span></div>} open={mobileListOpen} onToggle={setMobileListOpen}>
              <div className="space-y-2.5">
                <TextInput placeholder="Tìm tên hoặc mô tả" value={search} onChange={(e) => setSearch(e.target.value)} className="py-2 text-sm" />
                {loading ? (
                  <p className="text-sm text-neutral-500">Đang tải dữ liệu dịch vụ...</p>
                ) : activeServiceRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                    Chưa có dịch vụ nào.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {activeServiceRows.map((s) => {
                      const isEditing = editingId === s.id;
                      return (
                        <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              {s.image_url ? <img src={s.image_url} alt={s.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" /> : null}
                              <div className="min-w-0 flex-1">
                                {isEditing && editForm ? (
                                  <TextInput value={editForm.name} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="max-w-xl py-1 text-[12px]" placeholder="Tên dịch vụ" />
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900">{s.name}</h4>
                                    {s.featured_in_lookbook ? <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">Lookbook</span> : null}
                                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                                      {s.active ? "Đang dùng" : "Tạm ẩn"}
                                    </span>
                                  </div>
                                )}
                                {!isEditing ? <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả."}</p> : null}
                              </div>
                            </div>

                            {!canEdit ? null : isEditing ? (
                              <div className="flex gap-1.5">
                                <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void moveToTrash(s)} disabled={submitting}>
                                  Xóa
                                </button>
                                <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => { setEditingId(null); setEditForm(null); }}>
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

                          {isEditing && editForm ? (
                            <div className="mt-2 rounded-2xl bg-neutral-50 p-2.5">
                              <div className="space-y-2">
                                <TextArea value={editForm.shortDescription} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, shortDescription: e.target.value } : prev))} placeholder="Mô tả ngắn" className="min-h-[52px] text-[12px]" />
                                <div className="grid grid-cols-3 gap-2">
                                  <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.priceInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, priceInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Giá" className="py-1 text-[12px]" />
                                  <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.durationInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, durationInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Phút" className="py-1 text-[12px]" />
                                  <TextInput inputMode="decimal" value={editForm.vatInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, vatInput: e.target.value.replace(/[^\d.]/g, "") } : prev))} placeholder="VAT %" className="py-1 text-[12px]" />
                                </div>
                                <TextInput value={editForm.imageUrl} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, imageUrl: e.target.value } : prev))} placeholder="URL hoặc storage path" className="py-1 text-[12px]" />
                                <div className="flex flex-wrap gap-2">
                                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.featuredInLookbook} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, featuredInLookbook: e.target.checked } : prev))} />
                                    Lookbook
                                  </label>
                                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                    <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.active} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, active: e.target.checked } : prev))} />
                                    Đang hoạt động
                                  </label>
                                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleEditImageUpload(e.target.files?.[0])} />
                                    {uploadingEditImage ? "Đang upload..." : "Upload ảnh"}
                                  </label>
                                </div>
                                {editForm.imageUrl ? (
                                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
                                    <img src={editForm.imageUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                                    <div className="min-w-0 flex-1 truncate">Đã có ảnh preview</div>
                                  </div>
                                ) : null}
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

            <MobileCollapsible summary={<div className="flex items-center justify-between gap-3 pr-2"><span className="text-amber-800">Mẫu lookbook</span><span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-medium text-amber-800">{lookbookSampleRows.length}</span></div>}>
              <div className="space-y-1.5">
                {loading ? (
                  <p className="text-sm text-neutral-500">Đang tải...</p>
                ) : lookbookSampleRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 px-4 py-6 text-center text-sm text-amber-700/80">
                    Chưa có mẫu lookbook nào.
                  </div>
                ) : (
                  lookbookSampleRows.map((s) => {
                    const isEditing = editingId === s.id;
                    return (
                      <div key={s.id} className="rounded-2xl border border-amber-200 bg-white p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-start gap-2">
                            {s.image_url ? <img src={s.image_url} alt={s.name} className="h-9 w-9 shrink-0 rounded-xl object-cover" /> : null}
                            <div className="min-w-0 flex-1">
                              {isEditing && editForm ? (
                                <TextInput value={editForm.name} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, name: e.target.value } : prev))} className="max-w-xl py-1 text-[12px]" placeholder="Tên dịch vụ" />
                              ) : (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900">{s.name}</h4>
                                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">Mẫu</span>
                                  {s.featured_in_lookbook ? <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-semibold text-rose-700">Landing</span> : null}
                                </div>
                              )}
                              {!isEditing ? <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả."}</p> : null}
                            </div>
                          </div>

                          {!canEdit ? null : isEditing ? (
                            <div className="flex gap-1.5">
                              <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void moveToTrash(s)} disabled={submitting}>
                                Xóa
                              </button>
                              <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700" type="button" onClick={() => { setEditingId(null); setEditForm(null); }}>
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

                        {isEditing && editForm ? (
                          <div className="mt-2 rounded-2xl bg-neutral-50 p-2.5">
                            <div className="space-y-2">
                              <TextArea value={editForm.shortDescription} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, shortDescription: e.target.value } : prev))} placeholder="Mô tả ngắn" className="min-h-[52px] text-[12px]" />
                              <div className="grid grid-cols-3 gap-2">
                                <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.priceInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, priceInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Giá" className="py-1 text-[12px]" />
                                <TextInput inputMode="numeric" pattern="[0-9]*" value={editForm.durationInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, durationInput: e.target.value.replace(/\D/g, "") } : prev))} placeholder="Phút" className="py-1 text-[12px]" />
                                <TextInput inputMode="decimal" value={editForm.vatInput} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, vatInput: e.target.value.replace(/[^\d.]/g, "") } : prev))} placeholder="VAT %" className="py-1 text-[12px]" />
                              </div>
                              <TextInput value={editForm.imageUrl} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, imageUrl: e.target.value } : prev))} placeholder="URL hoặc storage path" className="py-1 text-[12px]" />
                              <div className="flex flex-wrap gap-2">
                                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                  <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.featuredInLookbook} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, featuredInLookbook: e.target.checked } : prev))} />
                                  Lookbook
                                </label>
                                <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
                                  <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editForm.active} onChange={(e) => setEditForm((prev) => (prev ? { ...prev, active: e.target.checked } : prev))} />
                                  Đang hoạt động
                                </label>
                                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50">
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleEditImageUpload(e.target.files?.[0])} />
                                  {uploadingEditImage ? "Đang upload..." : "Upload ảnh"}
                                </label>
                              </div>
                              {editForm.imageUrl ? (
                                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600">
                                  <img src={editForm.imageUrl} alt="Preview" className="h-10 w-10 rounded-lg object-cover" />
                                  <div className="min-w-0 flex-1 truncate">Đã có ảnh preview</div>
                                </div>
                              ) : null}
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
                  })
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
                      <div className="flex gap-1.5">
                        <button className="cursor-pointer rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void restoreFromTrash(s)} disabled={submitting || !canEdit}>
                          Khôi phục
                        </button>
                        <button className="cursor-pointer rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void deleteForever(s)} disabled={submitting || !canEdit}>
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
            <MobileCollapsible summary={<div className="flex items-center justify-between gap-3 pr-2"><span>Thùng rác</span><span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-700">{trashedRows.length}</span></div>} open={mobileTrashOpen} onToggle={setMobileTrashOpen}>
              <div className="space-y-1.5">
                {trashedRows.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
                    Thùng rác đang trống.
                  </div>
                ) : trashedRows.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-2">
                    <div className="space-y-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-[13px] font-semibold leading-4.5 text-neutral-900">{s.name}</h4>
                          <span className="rounded-full bg-neutral-200 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-600">TRASH</span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{s.short_description || "Chưa có mô tả ngắn."}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{formatVnd(Number(s.base_price))}</div>
                          <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">{s.duration_min}p</div>
                          <div className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700">VAT {Number(s.vat_rate) * 100}%</div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="cursor-pointer flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[11px] font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void restoreFromTrash(s)} disabled={submitting || !canEdit}>
                          Khôi phục
                        </button>
                        <button className="cursor-pointer flex-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void deleteForever(s)} disabled={submitting || !canEdit}>
                          Xóa hẳn
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </MobileCollapsible>
          </div>
        </div>
      </div>

      <MobileStickyActions>
        <button
          type="button"
          onClick={() => requestAnimationFrame(() => createSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))}
          className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm"
        >
          Thêm dịch vụ
        </button>
        <button
          type="button"
          onClick={openListSection}
          className="flex-1 rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm"
        >
          Danh sách
        </button>
      </MobileStickyActions>
    </AppShell>
  );
}
