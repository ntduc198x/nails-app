"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAlert } from "@/components/manage-alert";
import { MobileSectionHeader } from "@/components/manage-mobile";
import { getCurrentSessionRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
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
  phone: string | null;
  address_line: string | null;
  opening_hours: string | null;
  updated_at: string;
  is_active: boolean;
} | null;

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
  return <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{children}</label>;
}

function statusTone(status: ContentPostStatus) {
  if (status === "published") return "bg-emerald-100 text-emerald-700";
  if (status === "approved") return "bg-blue-100 text-blue-700";
  if (status === "archived") return "bg-neutral-200 text-neutral-700";
  return "bg-amber-100 text-amber-800";
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
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LandingResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const canEdit = role === "OWNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [currentRole, landingData] = await Promise.all([
        getCurrentSessionRole(),
        fetchManageLanding<LandingResponse>("/api/manage/landing/content-posts"),
      ]);

      setRole(currentRole);
      setData(landingData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được landing page hub");
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const posts = data?.posts ?? [];
  const summary = data?.summary ?? null;

  const orderedPosts = useMemo(
    () =>
      [...posts].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }),
    [posts],
  );

  function startCreate() {
    setForm(emptyForm);
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
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được content post");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 pb-24 md:pb-0">
        <MobileSectionHeader
          title="Landing Page"
          meta={<div className="manage-info-box">{refreshing ? "Đang làm mới..." : "Hub quản trị landing và feed nội dung"}</div>}
        />

        {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="manage-stat-card">
            <div className="manage-stat-label">Feed đã publish</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-900">{summary?.publishedPosts ?? 0}</div>
            <div className="mt-1 text-xs text-neutral-500">Trên tổng {summary?.totalPosts ?? 0} bài</div>
          </div>
          <div className="manage-stat-card">
            <div className="manage-stat-label">Dịch vụ home</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-900">{summary?.featuredInHome ?? 0}</div>
            <div className="mt-1 text-xs text-neutral-500">Đang bật trên landing</div>
          </div>
          <div className="manage-stat-card">
            <div className="manage-stat-label">Dịch vụ explore</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-900">{summary?.featuredInExplore ?? 0}</div>
            <div className="mt-1 text-xs text-neutral-500">Đang bật trên customer explore</div>
          </div>
          <div className="manage-stat-card">
            <div className="manage-stat-label">Ưu đãi active</div>
            <div className="mt-2 text-2xl font-semibold text-neutral-900">{summary?.activeOffers ?? 0}</div>
            <div className="mt-1 text-xs text-neutral-500">Đang hiển thị theo điều kiện thời gian</div>
          </div>
          <div className="manage-stat-card">
            <div className="manage-stat-label">Storefront</div>
            <div className="mt-2 text-sm font-semibold text-neutral-900">
              {summary?.storefront?.name ?? "Chưa có storefront active"}
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              {summary?.storefront?.slug ? `/${summary.storefront.slug}` : "Readonly summary"}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="manage-surface space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 md:text-lg">Feed content-post</h3>
                <p className="text-sm text-neutral-500">Tạo, chỉnh sửa và publish các bài đang xuất hiện ở phần blog/tips trên landing.</p>
              </div>
              <button type="button" onClick={startCreate} className="manage-quick-link-accent">
                Bài mới
              </button>
            </div>

            {loading ? (
              <div className="manage-info-box">Đang tải dữ liệu feed...</div>
            ) : orderedPosts.length === 0 ? (
              <div className="manage-info-box">Chưa có content-post nào. Hãy tạo bài đầu tiên cho landing.</div>
            ) : (
              <div className="grid gap-3">
                {orderedPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => startEdit(post)}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:bg-neutral-50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-neutral-900 md:text-base">{post.title}</h4>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(post.status)}`}>
                            {post.status}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{post.summary || post.body}</p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-neutral-500">
                        <div>Priority {post.priority}</div>
                        <div>{post.published_at ? new Date(post.published_at).toLocaleString("vi-VN") : "Chưa publish"}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="manage-surface space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 md:text-lg">
                  {form.id ? "Chỉnh sửa bài viết" : "Tạo content-post mới"}
                </h3>
                <p className="text-sm text-neutral-500">Mental model giữ giống feed landing hiện tại: title, summary, body, type, status, priority.</p>
              </div>
              {form.id ? (
                <button type="button" onClick={startCreate} className="manage-quick-link">
                  Bỏ chọn
                </button>
              ) : null}
            </div>

            <div>
              <FieldLabel>Tiêu đề</FieldLabel>
              <TextInput value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ví dụ: Bộ sưu tập nail nude tháng này" required />
            </div>

            <div>
              <FieldLabel>Tóm tắt</FieldLabel>
              <TextArea value={form.summary} onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))} className="min-h-[84px]" placeholder="Đoạn mô tả ngắn hiển thị trên landing" />
            </div>

            <div>
              <FieldLabel>Nội dung</FieldLabel>
              <TextArea value={form.body} onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))} className="min-h-[180px]" placeholder="Nội dung chi tiết của bài viết" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Ảnh cover URL</FieldLabel>
                <TextInput value={form.coverImageUrl} onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <FieldLabel>Loại nội dung</FieldLabel>
                <SelectInput value={form.contentType} onChange={(e) => setForm((prev) => ({ ...prev, contentType: e.target.value as ContentType }))}>
                  <option value="trend">Trend</option>
                  <option value="care">Care</option>
                  <option value="news">News</option>
                  <option value="offer_hint">Offer hint</option>
                </SelectInput>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Trạng thái</FieldLabel>
                <SelectInput value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ContentPostStatus }))}>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Priority</FieldLabel>
                <TextInput value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} inputMode="numeric" placeholder="100" />
              </div>
            </div>

            <button type="submit" disabled={submitting || !canEdit} className="manage-quick-link-accent disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Tạo bài viết"}
            </button>
          </form>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="manage-surface space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Dịch vụ nổi bật</h3>
              <p className="text-sm text-neutral-500">Chỉnh dịch vụ đang xuất hiện trên landing và explore từ khu Services.</p>
            </div>
            <div className="manage-info-box">
              Home: {summary?.featuredInHome ?? 0} • Explore: {summary?.featuredInExplore ?? 0}
            </div>
            <Link href="/manage/services" className="manage-quick-link-accent">
              Mở quản trị dịch vụ
            </Link>
          </div>

          <div className="manage-surface space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Ưu đãi</h3>
              <p className="text-sm text-neutral-500">Hiện đang chỉ có summary. Chưa có giao diện quản trị riêng trong đợt này.</p>
            </div>
            <div className="manage-info-box">Đang active: {summary?.activeOffers ?? 0} ưu đãi</div>
            <div className="manage-warn-box">Chưa có giao diện quản trị ưu đãi riêng.</div>
          </div>

          <div className="manage-surface space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Thông tin cửa tiệm</h3>
              <p className="text-sm text-neutral-500">Hub này đang hiển thị readonly storefront summary để quản trị dễ kiểm tra landing.</p>
            </div>
            <div className="manage-info-box">
              <div className="font-medium text-neutral-900">{summary?.storefront?.name ?? "Chưa có storefront active"}</div>
              <div className="mt-1">{summary?.storefront?.phone ?? "Chưa có số điện thoại"}</div>
              <div className="mt-1">{summary?.storefront?.address_line ?? "Chưa có địa chỉ"}</div>
              <div className="mt-1">{summary?.storefront?.opening_hours ?? "Chưa có giờ mở cửa"}</div>
            </div>
            <div className="manage-warn-box">Chưa có giao diện quản trị storefront riêng.</div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
