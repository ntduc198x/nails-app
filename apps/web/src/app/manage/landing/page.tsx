"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileCollapsible, MobileSectionHeader } from "@/components/manage-mobile";
import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { canAccessManageLanding, getDefaultManageHref } from "@/lib/manage-landing-auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type ContentPostStatus = "draft" | "approved" | "published" | "archived";
type ContentType = "trend" | "care" | "news" | "offer_hint";

type ContentPostRow = {
  id: string;
  title: string;
  summary: string;
  body: string;
  cover_image_url: string | null;
  content_type: ContentType;
  status: ContentPostStatus;
  published_at: string | null;
  priority: number;
  source_platform: string | null;
  created_at: string;
  updated_at: string;
};

type StorefrontSummary = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  phone: string | null;
  address_line: string | null;
  opening_hours: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
  rating: number | null;
  reviews_label: string | null;
  map_url: string | null;
  messenger_url: string | null;
  instagram_url: string | null;
  highlights: string[];
  updated_at: string;
  is_active: boolean;
} | null;

type StorefrontFormState = {
  id: string | null;
  name: string;
  slug: string;
  category: string;
  description: string;
  phone: string;
  addressLine: string;
  openingHours: string;
  coverImageUrl: string;
  logoImageUrl: string;
  rating: string;
  reviewsLabel: string;
  mapUrl: string;
  messengerUrl: string;
  instagramUrl: string;
  highlightsText: string;
  isActive: boolean;
};

type LandingSummary = {
  publishedPosts: number;
  totalPosts: number;
  featuredInHome: number;
  featuredInExplore: number;
  activeOffers: number;
  storefront: StorefrontSummary;
};

type LandingResponse = {
  posts: ContentPostRow[];
  summary: LandingSummary;
};

type FormState = {
  id: string | null;
  title: string;
  summary: string;
  body: string;
  coverImageUrl: string;
  contentType: ContentType;
  status: ContentPostStatus;
  priority: string;
};

const emptyForm: FormState = {
  id: null,
  title: "",
  summary: "",
  body: "",
  coverImageUrl: "",
  contentType: "trend",
  status: "draft",
  priority: "100",
};

const emptyStorefrontForm = (): StorefrontFormState => ({
  id: null,
  name: "",
  slug: "",
  category: "",
  description: "",
  phone: "",
  addressLine: "",
  openingHours: "",
  coverImageUrl: "",
  logoImageUrl: "",
  rating: "",
  reviewsLabel: "",
  mapUrl: "",
  messengerUrl: "",
  instagramUrl: "",
  highlightsText: "",
  isActive: true,
});

function buildStorefrontForm(storefront: StorefrontSummary): StorefrontFormState {
  if (!storefront) return emptyStorefrontForm();
  return {
    id: storefront.id,
    name: storefront.name ?? "",
    slug: storefront.slug ?? "",
    category: storefront.category ?? "",
    description: storefront.description ?? "",
    phone: storefront.phone ?? "",
    addressLine: storefront.address_line ?? "",
    openingHours: storefront.opening_hours ?? "",
    coverImageUrl: storefront.cover_image_url ?? "",
    logoImageUrl: storefront.logo_image_url ?? "",
    rating: storefront.rating == null ? "" : String(storefront.rating),
    reviewsLabel: storefront.reviews_label ?? "",
    mapUrl: storefront.map_url ?? "",
    messengerUrl: storefront.messenger_url ?? "",
    instagramUrl: storefront.instagram_url ?? "",
    highlightsText: storefront.highlights?.join("\n") ?? "",
    isActive: storefront.is_active !== false,
  };
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[16px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-3 focus:ring-rose-100 md:text-sm ${props.className ?? ""}`}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[16px] text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-rose-300 focus:ring-3 focus:ring-rose-100 md:text-sm ${props.className ?? ""}`}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[15px] text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-3 focus:ring-rose-100 md:text-sm ${props.className ?? ""}`}
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
      {children}
    </label>
  );
}

function statusTone(status: ContentPostStatus) {
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "approved") return "bg-blue-100 text-blue-700";
  if (status === "archived") return "bg-neutral-200 text-neutral-700";
  return "bg-amber-100 text-amber-800";
}


function contentStatusLabel(status: ContentPostStatus) {
  if (status === "published") return "Đã xuất bản";
  if (status === "approved") return "Đã duyệt";
  if (status === "archived") return "Đã lưu trữ";
  return "Bản nháp";
}


function getStorefrontPublicHref() {
  return "/";
}

function StatCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: React.ReactNode;
  meta: React.ReactNode;
}) {
  return (
    <div className="manage-stat-card">
      <div className="manage-stat-label">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-neutral-900">{value}</div>
      <div className="mt-1 text-xs text-neutral-500">{meta}</div>
    </div>
  );
}

function PreviewImage({
  src,
  alt,
  emptyLabel,
  className,
}: {
  src: string;
  alt: string;
  emptyLabel: string;
  className: string;
}) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 text-xs text-neutral-400 ${className}`}>
        {emptyLabel}
      </div>
    );
  }

  // Ảnh xem trước chỉ hiển thị trong trang quản trị, không cần tối ưu bằng Next.js Image.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`rounded-2xl object-cover ${className}`} />;
}

function LandingEditorFields({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <>
      <div>
        <FieldLabel>Tiêu đề</FieldLabel>
        <TextInput
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Ví dụ: Bộ sưu tập nail nude tháng này"
          required
        />
      </div>

      <div>
        <FieldLabel>Tóm tắt</FieldLabel>
        <TextArea
          value={form.summary}
          onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
          className="min-h-[84px]"
          placeholder="Đoạn mô tả ngắn hiển thị trên landing"
        />
      </div>

      <div>
        <FieldLabel>Nội dung</FieldLabel>
        <TextArea
          value={form.body}
          onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
          className="min-h-[160px] md:min-h-[180px]"
          placeholder="Nội dung chi tiết của bài viết"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Loại nội dung</FieldLabel>
          <SelectInput
            value={form.contentType}
            onChange={(e) => setForm((prev) => ({ ...prev, contentType: e.target.value as ContentType }))}
          >
            <option value="trend">Xu hướng</option>
            <option value="care">Chăm sóc</option>
            <option value="news">Tin tức</option>
            <option value="offer_hint">Gợi ý ưu đãi</option>
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Trạng thái</FieldLabel>
          <SelectInput
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ContentPostStatus }))}
          >
            <option value="draft">Bản nháp</option>
            <option value="approved">Đã duyệt</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Đã lưu trữ</option>
          </SelectInput>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>URL ảnh bìa</FieldLabel>
          <TextInput
            value={form.coverImageUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
            placeholder="https://..."
          />
        </div>
        <div>
          <FieldLabel>Độ ưu tiên</FieldLabel>
          <TextInput
            value={form.priority}
            onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            inputMode="numeric"
            placeholder="100"
          />
        </div>
      </div>
    </>
  );
}

function StorefrontEditorFields({
  form,
  setForm,
}: {
  form: StorefrontFormState;
  setForm: React.Dispatch<React.SetStateAction<StorefrontFormState>>;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Slug hiển thị</FieldLabel>
          <TextInput value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="cham-beauty" />
        </div>
        <div>
          <FieldLabel>Tên tiệm</FieldLabel>
          <TextInput value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="CHAM BEAUTY" />
        </div>
      </div>

      <div>
        <FieldLabel>Nhóm tiệm</FieldLabel>
        <TextInput value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Studio nail" />
      </div>

      <div>
        <FieldLabel>Mô tả</FieldLabel>
        <TextArea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[96px]" placeholder="Mô tả ngắn về tiệm trên landing và explore" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>URL ảnh bìa</FieldLabel>
          <TextInput value={form.coverImageUrl} onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))} placeholder="https://..." />
        </div>
        <div>
          <FieldLabel>URL logo</FieldLabel>
          <TextInput value={form.logoImageUrl} onChange={(e) => setForm((prev) => ({ ...prev, logoImageUrl: e.target.value }))} placeholder="https://..." />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Điểm đánh giá</FieldLabel>
          <TextInput value={form.rating} onChange={(e) => setForm((prev) => ({ ...prev, rating: e.target.value }))} inputMode="decimal" placeholder="4.9" />
        </div>
        <div>
          <FieldLabel>Nhãn đánh giá</FieldLabel>
          <TextInput value={form.reviewsLabel} onChange={(e) => setForm((prev) => ({ ...prev, reviewsLabel: e.target.value }))} placeholder="128 đánh giá" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Địa chỉ</FieldLabel>
          <TextInput value={form.addressLine} onChange={(e) => setForm((prev) => ({ ...prev, addressLine: e.target.value }))} placeholder="38A Bãi Xương Trạch..." />
        </div>
        <div>
          <FieldLabel>Giờ mở cửa</FieldLabel>
          <TextInput value={form.openingHours} onChange={(e) => setForm((prev) => ({ ...prev, openingHours: e.target.value }))} placeholder="09:00 - 21:00" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>URL bản đồ</FieldLabel>
          <TextInput value={form.mapUrl} onChange={(e) => setForm((prev) => ({ ...prev, mapUrl: e.target.value }))} placeholder="https://maps..." />
        </div>
        <div>
          <FieldLabel>Số điện thoại</FieldLabel>
          <TextInput value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="09xxxxxxxx" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>URL Messenger</FieldLabel>
          <TextInput value={form.messengerUrl} onChange={(e) => setForm((prev) => ({ ...prev, messengerUrl: e.target.value }))} placeholder="https://m.me/..." />
        </div>
        <div>
          <FieldLabel>URL Instagram</FieldLabel>
          <TextInput value={form.instagramUrl} onChange={(e) => setForm((prev) => ({ ...prev, instagramUrl: e.target.value }))} placeholder="https://instagram.com/..." />
        </div>
      </div>

      <div>
        <FieldLabel>Điểm nổi bật</FieldLabel>
        <TextArea value={form.highlightsText} onChange={(e) => setForm((prev) => ({ ...prev, highlightsText: e.target.value }))} className="min-h-[108px]" placeholder="Mỗi dòng 1 điểm nổi bật" />
      </div>
    </>
  );
}

function StorefrontDesktopSection({
  title,
  description,
  initiallyOpen = false,
  children,
}: {
  title: string;
  description: string;
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50"
      open={initiallyOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-900">{title}</div>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500">{description}</p>
          </div>
          <span className="shrink-0 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-500">Section</span>
        </div>
      </summary>
      <div className="border-t border-neutral-200 bg-white px-4 py-4">
        <div className="space-y-3">{children}</div>
      </div>
    </details>
  );
}

function StorefrontMiniSnapshot({
  form,
}: {
  form: StorefrontFormState;
}) {
  const storefrontName = form.name || "Chưa đặt tên tiệm";
  const storefrontSlug = form.slug || "storefront";
  const storefrontCategory = form.category || "Chưa có nhóm tiệm";
  const storefrontPhone = form.phone || "Chưa có số điện thoại";
  const storefrontRating = form.rating ? `${form.rating} sao` : "Chưa có đánh giá";
  const storefrontOpeningHours = form.openingHours || "Chưa có giờ mở cửa";
  const storefrontVisibilityLabel = form.isActive ? "Đang hiển thị" : "Đang ẩn";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PreviewImage
            src={form.coverImageUrl}
            alt="Ảnh bìa storefront"
            emptyLabel="Ảnh bìa"
            className="h-14 w-14 shrink-0 rounded-2xl border border-neutral-200 object-cover"
          />
          <div className="flex min-w-0 items-start gap-3">
            <PreviewImage
              src={form.logoImageUrl}
              alt="Logo storefront"
              emptyLabel="Logo"
              className="mt-0.5 h-10 w-10 shrink-0 rounded-full border border-neutral-200 bg-white p-1 object-contain"
            />
            <div className="min-w-0 space-y-0.5">
              <div className="truncate text-sm font-semibold text-neutral-900">{storefrontName}</div>
              <div className="truncate text-xs text-neutral-500">/{storefrontSlug}</div>
              <div className="truncate text-sm text-neutral-700">{storefrontCategory}</div>
            </div>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
            form.isActive ? "bg-emerald-50 text-emerald-700" : "bg-neutral-200 text-neutral-700"
          }`}
        >
          {storefrontVisibilityLabel}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
          {storefrontPhone}
        </span>
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
          <span className="text-amber-500">★</span>
          {storefrontRating}
        </span>
        <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700">
          {storefrontOpeningHours}
        </span>
      </div>
    </div>
  );
}

async function fetchManageLanding<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const sessionRes = await supabase.auth.getSession();
  const token = sessionRes.data.session?.access_token;
  if (!token) throw new Error("Chưa đăng nhập");

  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || "Yêu cầu quản trị landing thất bại");
  }

  return payload.data as T;
}

export default function ManageLandingPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [storefrontSubmitting, setStorefrontSubmitting] = useState(false);
  const [deletingStorefront, setDeletingStorefront] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LandingResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [storefrontForm, setStorefrontForm] = useState<StorefrontFormState>(emptyStorefrontForm);
  const [initialStorefrontForm, setInitialStorefrontForm] = useState<StorefrontFormState>(emptyStorefrontForm);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [mobileStorefrontOpen, setMobileStorefrontOpen] = useState(false);

  const canEdit = canAccessManageLanding(role);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const currentRole = await getCurrentSessionRole();
      setRole(currentRole);

      if (!canAccessManageLanding(currentRole)) {
        setData(null);
        return;
      }

      const [landingData, storefront] = await Promise.all([
        fetchManageLanding<LandingResponse>("/api/manage/landing/content-posts"),
        fetchManageLanding<StorefrontSummary>("/api/manage/landing/storefront"),
      ]);

      const nextStorefrontForm = buildStorefrontForm(storefront);
      setData(landingData);
      setStorefrontForm(nextStorefrontForm);
      setInitialStorefrontForm(nextStorefrontForm);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được hub landing page");
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const summary = data?.summary ?? null;
  const storefrontSummary = summary?.storefront ?? null;
  const storefrontHighlights = storefrontForm.highlightsText
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const orderedPosts = useMemo(
    () =>
      [...(data?.posts ?? [])].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }),
    [data?.posts],
  );

  function startCreate() {
    setForm(emptyForm);
    setMobileEditorOpen(true);
  }

  function startEdit(row: ContentPostRow) {
    setForm({
      id: row.id,
      title: row.title,
      summary: row.summary,
      body: row.body,
      coverImageUrl: row.cover_image_url ?? "",
      contentType: row.content_type,
      status: row.status,
      priority: String(row.priority),
    });
    setMobileEditorOpen(true);
  }

  function resetStorefrontForm() {
    setStorefrontForm(initialStorefrontForm);
  }

  async function onStorefrontSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (storefrontSubmitting || !canEdit) return;

    try {
      setStorefrontSubmitting(true);
      setError(null);
      await fetchManageLanding("/api/manage/landing/storefront", {
        method: "PUT",
        body: JSON.stringify({
          id: storefrontForm.id,
          slug: storefrontForm.slug.trim(),
          name: storefrontForm.name.trim(),
          category: storefrontForm.category.trim() || null,
          description: storefrontForm.description.trim() || null,
          phone: storefrontForm.phone.trim() || null,
          addressLine: storefrontForm.addressLine.trim() || null,
          openingHours: storefrontForm.openingHours.trim() || null,
          coverImageUrl: storefrontForm.coverImageUrl.trim() || null,
          logoImageUrl: storefrontForm.logoImageUrl.trim() || null,
          rating: storefrontForm.rating.trim() ? Number(storefrontForm.rating) : null,
          reviewsLabel: storefrontForm.reviewsLabel.trim() || null,
          mapUrl: storefrontForm.mapUrl.trim() || null,
          messengerUrl: storefrontForm.messengerUrl.trim() || null,
          instagramUrl: storefrontForm.instagramUrl.trim() || null,
          highlights: storefrontHighlights,
          isActive: storefrontForm.isActive,
        }),
      });
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được storefront");
    } finally {
      setStorefrontSubmitting(false);
    }
  }

  async function onDeleteStorefront() {
    if (!storefrontSummary?.id || deletingStorefront || !canEdit) return;
    if (!window.confirm("Xoá storefront này? Tất cả sản phẩm, thư viện ảnh và thành viên team gắn với nó sẽ bị xoá theo.")) return;

    try {
      setDeletingStorefront(true);
      setError(null);
      await fetchManageLanding("/api/manage/landing/storefront", { method: "DELETE" });
      setStorefrontForm(emptyStorefrontForm());
      setInitialStorefrontForm(emptyStorefrontForm());
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xoá được storefront");
    } finally {
      setDeletingStorefront(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || !canEdit) return;

    try {
      setSubmitting(true);
      setError(null);

      await fetchManageLanding("/api/manage/landing/content-posts", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify({
          id: form.id,
          title: form.title,
          summary: form.summary,
          body: form.body,
          coverImageUrl: form.coverImageUrl || null,
          contentType: form.contentType,
          status: form.status,
          priority: Number(form.priority || 100),
        }),
      });

      setForm(emptyForm);
      setMobileEditorOpen(false);
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được content post");
    } finally {
      setSubmitting(false);
    }
  }

  const fallbackHref = getDefaultManageHref(role);
  const mobileSummaryItems = [
    { label: "Feed đã xuất bản", value: String(summary?.publishedPosts ?? 0), meta: `/${summary?.totalPosts ?? 0} bài` },
    { label: "Home / Explore", value: `${summary?.featuredInHome ?? 0} / ${summary?.featuredInExplore ?? 0}`, meta: "Dịch vụ hiển thị trên web" },
    { label: "Ưu đãi đang bật", value: String(summary?.activeOffers ?? 0), meta: "Đang hiển thị" },
    { label: "Storefront", value: summary?.storefront?.name ?? "Chưa có", meta: summary?.storefront ? "Landing công khai /" : "Cần tạo mới" },
  ];

  return (
    <AppShell>
      <div className="space-y-6 pb-24 md:pb-0">
        <MobileSectionHeader
          title="Landing Page"
          description="Hub quản trị feed landing và storefront phía khách hàng."
          meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : "Hub quản trị landing và feed nội dung"}</div>}
        />

        {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}

        {!loading && role && !canAccessManageLanding(role) ? (
          <section className="manage-surface space-y-4">
            <ManageAlert tone="warn">Chỉ BOSS, Chủ tiệm hoặc Quản lý mới được xem trang quản trị landing.</ManageAlert>
            <div className="flex flex-wrap gap-3">
              <Link href={fallbackHref} className="manage-quick-link-accent">
                Mở khu vực được phép
              </Link>
              <Link href="/manage/services" className="manage-quick-link">
                Đi tới quản trị dịch vụ
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="md:hidden">
              <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
                {mobileSummaryItems.map((item) => (
                  <div key={item.label} className="manage-surface min-w-[170px] shrink-0 snap-start space-y-1.5 p-4">
                    <div className="manage-stat-label">{item.label}</div>
                    <div className="text-lg font-semibold text-neutral-900">{item.value}</div>
                    <div className="text-xs text-neutral-500">{item.meta}</div>
                  </div>
                ))}
              </div>

            </section>

            <section className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-5">
              <StatCard label="Feed đã xuất bản" value={summary?.publishedPosts ?? 0} meta={`Trên tổng ${summary?.totalPosts ?? 0} bài`} />
              <StatCard label="Dịch vụ home" value={summary?.featuredInHome ?? 0} meta="Đang bật trên landing" />
              <StatCard label="Dịch vụ explore" value={summary?.featuredInExplore ?? 0} meta="Đang bật trên customer explore" />
              <StatCard label="Ưu đãi đang bật" value={summary?.activeOffers ?? 0} meta="Đang hiển thị theo thời gian" />
              <StatCard label="Storefront" value={<span className="text-sm">{summary?.storefront?.name ?? "Chưa có storefront active"}</span>} meta={summary?.storefront ? "Landing công khai /" : "Cần tạo mới"} />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="manage-surface space-y-4 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 md:text-lg">Feed content-post</h3>
                    <p className="text-sm text-neutral-500">Mobile đưa danh sách lên trước, mở editor khi tạo mới hoặc chọn bài cần sửa.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href="#storefront-editor" className="manage-quick-link">Tới storefront</a>
                    <button type="button" onClick={startCreate} className="manage-quick-link-accent">Bài mới</button>
                  </div>
                </div>

                {loading ? (
                  <div className="manage-info-box">Đang tải dữ liệu feed...</div>
                ) : orderedPosts.length === 0 ? (
                  <div className="manage-info-box">Chưa có content-post nào. Hãy tạo bài đầu tiên cho landing.</div>
                ) : (
                  <div className="grid gap-3">
                    {orderedPosts.map((post) => (
                      <button key={post.id} type="button" onClick={() => startEdit(post)} className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:bg-neutral-50">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start gap-2">
                            <h4 className="min-w-0 flex-1 text-sm font-semibold text-neutral-900 md:text-base">{post.title}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(post.status)}`}>{contentStatusLabel(post.status)}</span>
                          </div>
                          <p className="line-clamp-2 text-sm text-neutral-600">{post.summary || post.body}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1">Độ ưu tiên {post.priority}</span>
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1">{post.published_at ? new Date(post.published_at).toLocaleString("vi-VN") : "Chưa xuất bản"}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <MobileCollapsible summary={form.id ? `Chỉnh sửa: ${form.title || "bài viết"}` : "Soạn bài viết"} open={mobileEditorOpen} onToggle={setMobileEditorOpen}>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">{form.id ? "Chỉnh sửa bài viết" : "Tạo content-post mới"}</h3>
                      <p className="text-sm text-neutral-500">Ưu tiên tiêu đề, nội dung, trạng thái và trạng thái xuất bản.</p>
                    </div>
                    {form.id ? <button type="button" onClick={startCreate} className="manage-quick-link">Bỏ chọn</button> : null}
                  </div>
                  <LandingEditorFields form={form} setForm={setForm} />
                  <button type="submit" disabled={submitting || !canEdit} className="w-full rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                    {submitting ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Tạo bài viết"}
                  </button>
                </form>
              </MobileCollapsible>

              <form onSubmit={onSubmit} className="hidden space-y-4 rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:block">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 md:text-lg">{form.id ? "Chỉnh sửa bài viết" : "Tạo content-post mới"}</h3>
                    <p className="text-sm text-neutral-500">Giữ nguyên luồng desktop hiện tại: tiêu đề, tóm tắt, nội dung, loại, trạng thái, độ ưu tiên.</p>
                  </div>
                  {form.id ? <button type="button" onClick={startCreate} className="manage-quick-link">Bỏ chọn</button> : null}
                </div>
                <LandingEditorFields form={form} setForm={setForm} />
                <button type="submit" disabled={submitting || !canEdit} className="manage-quick-link-accent disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Tạo bài viết"}
                </button>
              </form>
            </section>

            <section id="storefront-editor" className="scroll-mt-24 space-y-4">
              <div className="manage-surface space-y-4 p-4 md:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Trình chỉnh sửa storefront</h3>
                    <p className="text-sm text-neutral-500">Chỉnh hero storefront đang hiển thị trên landing và explore.</p>
                  </div>
                  <button type="button" onClick={() => setMobileStorefrontOpen((prev) => !prev)} className="manage-quick-link">
                    {mobileStorefrontOpen ? "Thu gọn" : "Mở form"}
                  </button>
                </div>

                <div className="grid gap-3">
                  <PreviewImage src={storefrontForm.coverImageUrl} alt="Ảnh bìa storefront" emptyLabel="Chưa có ảnh bìa" className="h-40 w-full" />
                  <div className="flex items-center gap-3">
                    <PreviewImage src={storefrontForm.logoImageUrl} alt="Logo storefront" emptyLabel="Chưa có logo" className="h-16 w-16 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-neutral-900">{storefrontForm.name || "Chưa đặt tên tiệm"}</div>
                      <div className="truncate text-xs text-neutral-500">{storefrontForm.slug || "storefront"}</div>
                      <div className="mt-1 text-xs text-neutral-500">{storefrontForm.isActive ? "Đang hiển thị" : "Đang ẩn"}</div>
                    </div>
                  </div>
                </div>

                <MobileCollapsible summary="Chỉnh sửa storefront" open={mobileStorefrontOpen} onToggle={setMobileStorefrontOpen}>
                  <form onSubmit={onStorefrontSubmit} className="space-y-4">
                    <StorefrontEditorFields form={storefrontForm} setForm={setStorefrontForm} />
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input type="checkbox" checked={storefrontForm.isActive} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                      Đang hiển thị storefront này
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" disabled={storefrontSubmitting || !canEdit} className="manage-quick-link-accent disabled:cursor-not-allowed disabled:opacity-60">
                        {storefrontSubmitting ? "Đang lưu..." : "Lưu storefront"}
                      </button>
                      <button type="button" onClick={resetStorefrontForm} className="manage-quick-link">Đặt lại</button>
                      {storefrontSummary?.id ? (
                        <button type="button" onClick={() => void onDeleteStorefront()} disabled={deletingStorefront} className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
                          {deletingStorefront ? "Đang xoá..." : "Xoá storefront"}
                        </button>
                      ) : null}
                    </div>
                  </form>
                </MobileCollapsible>
              </div>

              <div className="hidden md:block">
                <form onSubmit={onStorefrontSubmit} className="manage-surface min-w-0 w-full space-y-3 p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Trình chỉnh sửa storefront</h3>
                      <p className="text-sm text-neutral-500">
                        Bảng điều khiển gọn, ưu tiên sửa nhanh và hiển thị đẹp hơn.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={storefrontSubmitting || !canEdit}
                        className="manage-quick-link-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {storefrontSubmitting ? "Đang lưu..." : "Lưu storefront"}
                      </button>
                      <button type="button" onClick={resetStorefrontForm} className="manage-quick-link">
                        Đặt lại
                      </button>
                      {storefrontSummary?.slug ? (
                        <Link href={getStorefrontPublicHref()} className="manage-quick-link">
                          Mở storefront
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <StorefrontMiniSnapshot form={storefrontForm} />

                  <StorefrontDesktopSection
                    title="Thông tin chính"
                    description="Tên, slug, nhóm và mô tả ngắn."
                    initiallyOpen
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Slug hiển thị</FieldLabel>
                        <TextInput value={storefrontForm.slug} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="cham-beauty" />
                      </div>
                      <div>
                        <FieldLabel>Tên tiệm</FieldLabel>
                        <TextInput value={storefrontForm.name} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="CHAM BEAUTY" />
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Nhóm tiệm</FieldLabel>
                      <TextInput value={storefrontForm.category} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Studio nail" />
                    </div>

                    <div>
                      <FieldLabel>Mô tả</FieldLabel>
                      <TextArea value={storefrontForm.description} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[96px]" placeholder="Mô tả ngắn về tiệm trên landing và explore" />
                    </div>
                  </StorefrontDesktopSection>

                  <StorefrontDesktopSection
                    title="Hiển thị"
                    description="Ảnh, điểm nổi bật và trạng thái hiển thị."
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>URL ảnh bìa</FieldLabel>
                        <TextInput value={storefrontForm.coverImageUrl} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))} placeholder="https://..." />
                      </div>
                      <div>
                        <FieldLabel>URL logo</FieldLabel>
                        <TextInput value={storefrontForm.logoImageUrl} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, logoImageUrl: e.target.value }))} placeholder="https://..." />
                      </div>
                    </div>

                      <div>
                        <FieldLabel>Điểm nổi bật</FieldLabel>
                        <TextArea value={storefrontForm.highlightsText} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, highlightsText: e.target.value }))} className="min-h-[108px]" placeholder="Mỗi dòng 1 điểm nổi bật" />
                        <div className="mt-2 text-xs text-neutral-500">
                          {storefrontHighlights.length ? `${storefrontHighlights.length} điểm nổi bật đang được hiển thị trong snapshot.` : "Chưa có điểm nổi bật nào."}
                        </div>
                      </div>

                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input type="checkbox" checked={storefrontForm.isActive} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                      Đang hiển thị storefront này cho khách hàng
                    </label>
                  </StorefrontDesktopSection>

                  <StorefrontDesktopSection
                    title="Liên hệ & social"
                    description="Liên hệ, bản đồ và social proof."
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Số điện thoại</FieldLabel>
                        <TextInput value={storefrontForm.phone} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="09xxxxxxxx" />
                      </div>
                      <div>
                        <FieldLabel>Giờ mở cửa</FieldLabel>
                        <TextInput value={storefrontForm.openingHours} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, openingHours: e.target.value }))} placeholder="09:00 - 21:00" />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Địa chỉ</FieldLabel>
                        <TextInput value={storefrontForm.addressLine} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, addressLine: e.target.value }))} placeholder="38A Bãi Xương Trạch..." />
                      </div>
                      <div>
                        <FieldLabel>URL bản đồ</FieldLabel>
                        <TextInput value={storefrontForm.mapUrl} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, mapUrl: e.target.value }))} placeholder="https://maps..." />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Điểm đánh giá</FieldLabel>
                        <TextInput value={storefrontForm.rating} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, rating: e.target.value }))} inputMode="decimal" placeholder="4.9" />
                      </div>
                      <div>
                        <FieldLabel>Nhãn đánh giá</FieldLabel>
                        <TextInput value={storefrontForm.reviewsLabel} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, reviewsLabel: e.target.value }))} placeholder="128 đánh giá" />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>URL Messenger</FieldLabel>
                        <TextInput value={storefrontForm.messengerUrl} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, messengerUrl: e.target.value }))} placeholder="https://m.me/..." />
                      </div>
                      <div>
                        <FieldLabel>URL Instagram</FieldLabel>
                        <TextInput value={storefrontForm.instagramUrl} onChange={(e) => setStorefrontForm((prev) => ({ ...prev, instagramUrl: e.target.value }))} placeholder="https://instagram.com/..." />
                      </div>
                    </div>
                  </StorefrontDesktopSection>
                </form>
              </div>
            </section>

            <section className="hidden gap-4 md:grid md:grid-cols-2">
              <div className="manage-surface space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Dịch vụ nổi bật</h3>
                  <p className="text-sm text-neutral-500">Chỉnh dịch vụ đang xuất hiện trên landing và explore từ khu Dịch vụ.</p>
                </div>
                <div className="manage-info-box">Home: {summary?.featuredInHome ?? 0} | Explore: {summary?.featuredInExplore ?? 0}</div>
                <Link href="/manage/services" className="manage-quick-link-accent">Mở quản trị dịch vụ</Link>
              </div>

              <div className="manage-surface space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Ưu đãi</h3>
                  <p className="text-sm text-neutral-500">Hiện chỉ có phần tổng quan. Chưa có giao diện quản trị ưu đãi riêng trong đợt này.</p>
                </div>
                <div className="manage-info-box">Đang active: {summary?.activeOffers ?? 0} ưu đãi</div>
                <div className="manage-warn-box">Chưa có giao diện quản trị ưu đãi riêng.</div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
