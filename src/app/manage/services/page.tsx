"use client";

import { AppShell } from "@/components/app-shell";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { createService, listServices, updateService } from "@/lib/domain";
import { formatVnd } from "@/lib/mock-data";
import { uploadServiceImage } from "@/lib/service-images";
import { useCallback, useEffect, useState } from "react";

type ServiceRow = {
  id: string;
  name: string;
  short_description?: string | null;
  image_url?: string | null;
  display_order?: number | null;
  featured_in_lookbook?: boolean | null;
  duration_min: number;
  base_price: number;
  vat_rate: number;
  active: boolean;
};

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

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 ${props.className ?? ""}`}
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

  const [name, setName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [featuredInLookbook, setFeaturedInLookbook] = useState(false);
  const [duration, setDuration] = useState(45);
  const [price, setPrice] = useState(250000);
  const [vat, setVat] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortDescription, setEditShortDescription] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDisplayOrder, setEditDisplayOrder] = useState(0);
  const [editFeaturedInLookbook, setEditFeaturedInLookbook] = useState(false);
  const [editDuration, setEditDuration] = useState(45);
  const [editPrice, setEditPrice] = useState(250000);
  const [editVat, setEditVat] = useState(0);
  const [editActive, setEditActive] = useState(true);

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);
      if (role !== "OWNER" && role !== "MANAGER" && role !== "RECEPTION") {
        throw new Error("Role hiện tại không được phép thêm dịch vụ.");
      }
      await createService({
        name,
        shortDescription: shortDescription || null,
        imageUrl: imageUrl || null,
        displayOrder,
        featuredInLookbook,
        durationMin: duration,
        basePrice: price,
        vatPercent: vat,
      });
      setName("");
      setShortDescription("");
      setImageUrl("");
      setDisplayOrder(0);
      setFeaturedInLookbook(false);
      setDuration(45);
      setPrice(250000);
      setVat(0);
      await load({ force: true });
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
    setEditDisplayOrder(row.display_order ?? 0);
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
        displayOrder: editDisplayOrder,
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

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900">Dịch vụ & Lookbook</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
              Quản lý dịch vụ vận hành, VAT, mô tả hiển thị ngoài landing page và ảnh lookbook. Dữ liệu ở đây là nguồn chuẩn để đồng bộ dịch vụ nổi bật lên landing.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-500 shadow-sm">
            {refreshing ? "Đang làm mới dữ liệu..." : `${rows.length} dịch vụ trong hệ thống`}
          </div>
        </div>

        {role === "ACCOUNTANT" || role === "TECH" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
            Role hiện tại chỉ xem danh sách dịch vụ, không thêm/sửa.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Thêm dịch vụ mới</h3>
              <p className="mt-1 text-sm text-neutral-500">Thiết lập dữ liệu vận hành và chọn dịch vụ nào được đưa lên lookbook ngoài landing.</p>
            </div>
            <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">VAT mặc định 0%</div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Tên dịch vụ</FieldLabel>
                  <TextInput placeholder="Ví dụ: Luxury Gel" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <FieldLabel>Ảnh đại diện</FieldLabel>
                  <TextInput placeholder="URL hoặc storage path" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                </div>
              </div>

              <div>
                <FieldLabel>Mô tả ngắn</FieldLabel>
                <TextArea placeholder="Mô tả ngắn cho landing / lookbook" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="min-h-[110px]" />
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <FieldLabel>Display order</FieldLabel>
                  <TextInput type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
                </div>
                <div>
                  <FieldLabel>Thời lượng</FieldLabel>
                  <TextInput type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} required />
                </div>
                <div>
                  <FieldLabel>Giá</FieldLabel>
                  <TextInput type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
                </div>
                <div>
                  <FieldLabel>VAT %</FieldLabel>
                  <TextInput type="number" min={0} step={0.5} value={vat} onChange={(e) => setVat(Number(e.target.value))} required />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={featuredInLookbook} onChange={(e) => setFeaturedInLookbook(e.target.checked)} />
                <span className="font-medium">Đưa lên Lookbook / dịch vụ nổi bật</span>
              </label>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Ảnh lookbook</p>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">Upload ảnh lên storage để DB chỉ lưu URL/path, tránh phình dữ liệu.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleCreateImageUpload(e.target.files?.[0])} />
                    {uploadingCreateImage ? "Đang upload..." : "Upload ảnh"}
                  </label>
                </div>
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview lookbook" className="h-56 w-full rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white text-sm text-neutral-400">
                    Chưa có ảnh preview
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs leading-5 text-neutral-500">
                Gợi ý: dùng ảnh tỉ lệ dọc hoặc ngang rõ sản phẩm. Với bản hoàn chỉnh này, ảnh thật nằm ở storage/CDN, còn DB chỉ lưu <b>image_url</b>.
              </div>

              <button disabled={submitting || role === "ACCOUNTANT" || role === "TECH"} className="w-full rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? "Đang thêm dịch vụ..." : "Thêm dịch vụ"}
              </button>
            </div>
          </div>
        </form>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Danh sách dịch vụ</h3>
              <p className="mt-1 text-sm text-neutral-500">Chỉnh sửa dữ liệu dịch vụ, ảnh lookbook và cờ nổi bật cho landing page.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Đang tải dữ liệu dịch vụ...</p>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-8 text-center text-sm text-neutral-500">
              Chưa có dịch vụ nào. Hãy tạo dịch vụ đầu tiên ở form phía trên.
            </div>
          ) : (
            <div className="space-y-4">
              {rows.map((s) => {
                const isEditing = editingId === s.id;
                return (
                  <div key={s.id} className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-4 shadow-sm">
                    <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
                      <div className="space-y-3">
                        {isEditing ? (
                          <>
                            <div className="rounded-2xl border border-neutral-200 bg-white p-3">
                              {editImageUrl ? (
                                <img src={editImageUrl} alt="Preview" className="h-44 w-full rounded-2xl object-cover" />
                              ) : (
                                <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-neutral-200 text-sm text-neutral-400">
                                  Chưa có ảnh
                                </div>
                              )}
                            </div>
                            <TextInput placeholder="URL hoặc storage path" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} />
                            <label className="inline-flex cursor-pointer items-center rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50">
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => void handleEditImageUpload(e.target.files?.[0])} />
                              {uploadingEditImage ? "Đang upload..." : "Upload ảnh mới"}
                            </label>
                          </>
                        ) : s.image_url ? (
                          <img src={s.image_url} alt={s.name} className="h-52 w-full rounded-2xl object-cover" />
                        ) : (
                          <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-white text-sm text-neutral-400">
                            Chưa có ảnh lookbook
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            {isEditing ? (
                              <TextInput value={editName} onChange={(e) => setEditName(e.target.value)} className="max-w-xl" />
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-lg font-semibold text-neutral-900">{s.name}</h4>
                                {s.featured_in_lookbook ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">LOOKBOOK</span> : null}
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"}`}>
                                  {s.active ? "ACTIVE" : "INACTIVE"}
                                </span>
                              </div>
                            )}
                            <p className="mt-2 text-sm text-neutral-500">{isEditing ? "Chỉnh dịch vụ và dữ liệu hiển thị ngoài landing." : (s.short_description || "Chưa có mô tả ngắn cho landing.")}</p>
                          </div>

                          {role === "ACCOUNTANT" || role === "TECH" ? null : isEditing ? (
                            <div className="flex gap-2">
                              <button className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" type="button" onClick={() => setEditingId(null)}>
                                Huỷ
                              </button>
                              <button className="rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" type="button" onClick={() => void saveEdit()} disabled={submitting}>
                                {submitting ? "Đang lưu..." : "Lưu"}
                              </button>
                            </div>
                          ) : (
                            <button className="rounded-2xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50" type="button" onClick={() => startEdit(s)}>
                              Sửa
                            </button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Giá</p>
                            {isEditing ? <TextInput type="number" min={0} value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="mt-3" /> : <p className="mt-3 text-lg font-semibold text-neutral-900">{formatVnd(Number(s.base_price))}</p>}
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Thời lượng</p>
                            {isEditing ? <TextInput type="number" min={5} value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} className="mt-3" /> : <p className="mt-3 text-lg font-semibold text-neutral-900">{s.duration_min} phút</p>}
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">VAT</p>
                            {isEditing ? <TextInput type="number" min={0} step={0.5} value={editVat} onChange={(e) => setEditVat(Number(e.target.value))} className="mt-3" /> : <p className="mt-3 text-lg font-semibold text-neutral-900">{Number(s.vat_rate) * 100}%</p>}
                          </div>
                          <div className="rounded-2xl bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">Thứ tự</p>
                            {isEditing ? <TextInput type="number" value={editDisplayOrder} onChange={(e) => setEditDisplayOrder(Number(e.target.value))} className="mt-3" /> : <p className="mt-3 text-lg font-semibold text-neutral-900">{s.display_order ?? 0}</p>}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <FieldLabel>Mô tả ngắn cho landing</FieldLabel>
                              <TextArea value={editShortDescription} onChange={(e) => setEditShortDescription(e.target.value)} className="min-h-[110px]" />
                            </div>
                            <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
                              <label className="flex items-center gap-3 text-sm text-neutral-700">
                                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editFeaturedInLookbook} onChange={(e) => setEditFeaturedInLookbook(e.target.checked)} />
                                Đưa lên Lookbook / dịch vụ nổi bật
                              </label>
                              <label className="flex items-center gap-3 text-sm text-neutral-700">
                                <input type="checkbox" className="h-4 w-4 rounded border-neutral-300 text-rose-500 focus:ring-rose-400" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                                Dịch vụ đang hoạt động
                              </label>
                              <p className="text-xs leading-5 text-neutral-500">Ảnh thật nằm ở storage/CDN; service chỉ lưu URL để landing load nhanh và DB không bị phình.</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
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
