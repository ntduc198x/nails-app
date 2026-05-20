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
  description: string | null;
  phone: string | null;
  address_line: string | null;
  opening_hours: string | null;
  cover_image_url: string | null;
  logo_image_url: string | null;
  map_url: string | null;
  messenger_url: string | null;
  instagram_url: string | null;
  updated_at: string;
  is_active: boolean;
} | null;

type StorefrontFormState = {
  name: string;
  slug: string;
  description: string;
  phone: string;
  addressLine: string;
  openingHours: string;
  coverImageUrl: string;
  logoImageUrl: string;
  mapUrl: string;
  messengerUrl: string;
  instagramUrl: string;
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

const emptyStorefrontForm: StorefrontFormState = {
  name: "",
  slug: "",
  description: "",
  phone: "",
  addressLine: "",
  openingHours: "",
  coverImageUrl: "",
  logoImageUrl: "",
  mapUrl: "",
  messengerUrl: "",
  instagramUrl: "",
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
        <FieldLabel>Tieu de</FieldLabel>
        <TextInput
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="Vi du: Bo suu tap nail nude thang nay"
          required
        />
      </div>

      <div>
        <FieldLabel>Tom tat</FieldLabel>
        <TextArea
          value={form.summary}
          onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
          className="min-h-[84px]"
          placeholder="Doan mo ta ngan hien thi tren landing"
        />
      </div>

      <div>
        <FieldLabel>Noi dung</FieldLabel>
        <TextArea
          value={form.body}
          onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
          className="min-h-[160px] md:min-h-[180px]"
          placeholder="Noi dung chi tiet cua bai viet"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Loai noi dung</FieldLabel>
          <SelectInput
            value={form.contentType}
            onChange={(e) => setForm((prev) => ({ ...prev, contentType: e.target.value as ContentType }))}
          >
            <option value="trend">Trend</option>
            <option value="care">Care</option>
            <option value="news">News</option>
            <option value="offer_hint">Offer hint</option>
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Trang thai</FieldLabel>
          <SelectInput
            value={form.status}
            onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ContentPostStatus }))}
          >
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </SelectInput>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>Anh cover URL</FieldLabel>
          <TextInput
            value={form.coverImageUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, coverImageUrl: e.target.value }))}
            placeholder="https://..."
          />
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
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

async function fetchManageLanding<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  if (!supabase) throw new Error("Supabase chua cau hinh");
  const sessionRes = await supabase.auth.getSession();
  const token = sessionRes.data.session?.access_token;
  if (!token) throw new Error("Chua dang nhap");

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
    throw new Error(payload?.error || "Yeu cau quan tri landing that bai");
  }

  return payload.data as T;
}

export default function ManageLandingPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LandingResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);

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
      setData(landingData);
      setStorefrontForm({
        name: storefront?.name ?? "",
        slug: storefront?.slug ?? "",
        description: storefront?.description ?? "",
        phone: storefront?.phone ?? "",
        addressLine: storefront?.address_line ?? "",
        openingHours: storefront?.opening_hours ?? "",
        coverImageUrl: storefront?.cover_image_url ?? "",
        logoImageUrl: storefront?.logo_image_url ?? "",
        mapUrl: storefront?.map_url ?? "",
        messengerUrl: storefront?.messenger_url ?? "",
        instagramUrl: storefront?.instagram_url ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Khong tai duoc landing page hub");
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

  async function onStorefrontSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (storefrontSubmitting || !canEdit) return;

    try {
      setStorefrontSubmitting(true);
      setError(null);
      await fetchManageLanding("/api/manage/landing/storefront", {
        method: "PUT",
        body: JSON.stringify(storefrontForm),
      });
      await load({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được storefront");
    } finally {
      setStorefrontSubmitting(false);
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
      setError(e instanceof Error ? e.message : "Khong luu duoc content post");
    } finally {
      setSubmitting(false);
    }
  }

  const fallbackHref = getDefaultManageHref(role);
  const mobileSummaryItems = [
    {
      label: "Feed publish",
      value: String(summary?.publishedPosts ?? 0),
      meta: `/${summary?.totalPosts ?? 0} bai`,
    },
    {
      label: "Home / Explore",
      value: `${summary?.featuredInHome ?? 0} / ${summary?.featuredInExplore ?? 0}`,
      meta: "Dich vu hien tren web",
    },
    {
      label: "Uu dai active",
      value: String(summary?.activeOffers ?? 0),
      meta: "Dang hien thi",
    },
    {
      label: "Storefront",
      value: summary?.storefront?.name ?? "Chua co",
      meta: summary?.storefront?.slug ? `/${summary.storefront.slug}` : "Readonly summary",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6 pb-24 md:pb-0">
        <MobileSectionHeader
          title="Landing Page"
          description="Ban mobile uu tien danh sach bai viet va panel chinh sua gon gon."
          meta={<div className="manage-info-box">{refreshing ? "Dang lam moi..." : "Hub quan tri landing va feed noi dung"}</div>}
        />

        {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}

        {!loading && role && !canAccessManageLanding(role) ? (
          <section className="manage-surface space-y-4">
            <ManageAlert tone="warn">
              Chi BOSS, Chu tiem hoac Quan ly moi duoc xem landing quan tri.
            </ManageAlert>
            <div className="flex flex-wrap gap-3">
              <Link href={fallbackHref} className="manage-quick-link-accent">
                Mo khu vuc duoc phep
              </Link>
              <Link href="/manage/services" className="manage-quick-link">
                Di toi quan tri dich vu
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
              <StatCard label="Feed da publish" value={summary?.publishedPosts ?? 0} meta={`Tren tong ${summary?.totalPosts ?? 0} bai`} />
              <StatCard label="Dich vu home" value={summary?.featuredInHome ?? 0} meta="Dang bat tren landing" />
              <StatCard label="Dich vu explore" value={summary?.featuredInExplore ?? 0} meta="Dang bat tren customer explore" />
              <StatCard label="Uu dai active" value={summary?.activeOffers ?? 0} meta="Dang hien thi theo thoi gian" />
              <StatCard
                label="Storefront"
                value={<span className="text-sm">{summary?.storefront?.name ?? "Chua co storefront active"}</span>}
                meta={summary?.storefront?.slug ? `/${summary.storefront.slug}` : "Readonly summary"}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="manage-surface space-y-4 p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 md:text-lg">Feed content-post</h3>
                    <p className="text-sm text-neutral-500">
                      Mobile dua danh sach len truoc, mo editor khi tao moi hoac chon bai can sua.
                    </p>
                  </div>
                  <button type="button" onClick={startCreate} className="manage-quick-link-accent">
                    Bai moi
                  </button>
                </div>

                {loading ? (
                  <div className="manage-info-box">Dang tai du lieu feed...</div>
                ) : orderedPosts.length === 0 ? (
                  <div className="manage-info-box">Chua co content-post nao. Hay tao bai dau tien cho landing.</div>
                ) : (
                  <div className="grid gap-3">
                    {orderedPosts.map((post) => (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => startEdit(post)}
                        className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:bg-neutral-50"
                      >
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-start gap-2">
                            <h4 className="min-w-0 flex-1 text-sm font-semibold text-neutral-900 md:text-base">{post.title}</h4>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(post.status)}`}>
                              {post.status}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-sm text-neutral-600">{post.summary || post.body}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1">Priority {post.priority}</span>
                            <span className="rounded-full bg-neutral-100 px-2.5 py-1">
                              {post.published_at ? new Date(post.published_at).toLocaleString("vi-VN") : "Chua publish"}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <MobileCollapsible
                summary={form.id ? `Chinh sua: ${form.title || "bai viet"}` : "Soan bai viet"}
                open={mobileEditorOpen}
                onToggle={setMobileEditorOpen}
              >
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">
                        {form.id ? "Chinh sua bai viet" : "Tao content-post moi"}
                      </h3>
                      <p className="text-sm text-neutral-500">Uu tien title, body, status va publish state.</p>
                    </div>
                    {form.id ? (
                      <button type="button" onClick={startCreate} className="manage-quick-link">
                        Bo chon
                      </button>
                    ) : null}
                  </div>

                  <LandingEditorFields form={form} setForm={setForm} />

                  <button
                    type="submit"
                    disabled={submitting || !canEdit}
                    className="w-full rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Dang luu..." : form.id ? "Luu thay doi" : "Tao bai viet"}
                  </button>
                </form>
              </MobileCollapsible>

              <form onSubmit={onSubmit} className="hidden space-y-4 rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm md:block">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 md:text-lg">
                      {form.id ? "Chinh sua bai viet" : "Tao content-post moi"}
                    </h3>
                    <p className="text-sm text-neutral-500">
                      Giu nguyen mental model desktop hien tai: title, summary, body, type, status, priority.
                    </p>
                  </div>
                  {form.id ? (
                    <button type="button" onClick={startCreate} className="manage-quick-link">
                      Bo chon
                    </button>
                  ) : null}
                </div>

                <LandingEditorFields form={form} setForm={setForm} />

                <button type="submit" disabled={submitting || !canEdit} className="manage-quick-link-accent disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? "Dang luu..." : form.id ? "Luu thay doi" : "Tao bai viet"}
                </button>
              </form>
            </section>

            <section className="md:hidden">
              <div className="manage-surface space-y-4 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">Landing summary</h3>
                  <p className="text-sm text-neutral-500">
                    Gom thong tin phu vao mot block de mobile do cuon va fit viewport tot hon.
                  </p>
                </div>
                <div className="grid gap-3">
                  <div className="manage-info-box">
                    Home: {summary?.featuredInHome ?? 0} | Explore: {summary?.featuredInExplore ?? 0}
                  </div>
                  <div className="manage-info-box">Uu dai active: {summary?.activeOffers ?? 0}</div>
                </div>
                <div className="manage-info-box">
                  <div className="font-medium text-neutral-900">{summary?.storefront?.name ?? "Chua co storefront active"}</div>
                  <div className="mt-1">{summary?.storefront?.phone ?? "Chua co so dien thoai"}</div>
                  <div className="mt-1">{summary?.storefront?.address_line ?? "Chua co dia chi"}</div>
                  <div className="mt-1">{summary?.storefront?.opening_hours ?? "Chua co gio mo cua"}</div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link href="/manage/services" className="manage-quick-link-accent">
                    Mo quan tri dich vu
                  </Link>
                  <div className="manage-warn-box">Storefront va uu dai chua co hub rieng.</div>
                </div>
              </div>
            </section>

            <section className="hidden gap-4 md:grid md:grid-cols-3">
              <div className="manage-surface space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Dich vu noi bat</h3>
                  <p className="text-sm text-neutral-500">
                    Chinh dich vu dang xuat hien tren landing va explore tu khu Services.
                  </p>
                </div>
                <div className="manage-info-box">
                  Home: {summary?.featuredInHome ?? 0} | Explore: {summary?.featuredInExplore ?? 0}
                </div>
                <Link href="/manage/services" className="manage-quick-link-accent">
                  Mo quan tri dich vu
                </Link>
              </div>

              <div className="manage-surface space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Uu dai</h3>
                  <p className="text-sm text-neutral-500">
                    Hien chi co summary. Chua co giao dien quan tri uu dai rieng trong dot nay.
                  </p>
                </div>
                <div className="manage-info-box">Dang active: {summary?.activeOffers ?? 0} uu dai</div>
                <div className="manage-warn-box">Chua co giao dien quan tri uu dai rieng.</div>
              </div>

              <form onSubmit={onStorefrontSubmit} className="manage-surface space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Thong tin cua tiem</h3>
                  <p className="text-sm text-neutral-500">
                    Hub nay dang hien thi storefront summary de kiem tra nhanh landing hien tai.
                  </p>
                </div>
                <div className="manage-info-box">
                  <div className="font-medium text-neutral-900">{summary?.storefront?.name ?? "Chua co storefront active"}</div>
                  <div className="mt-1">{summary?.storefront?.phone ?? "Chua co so dien thoai"}</div>
                  <div className="mt-1">{summary?.storefront?.address_line ?? "Chua co dia chi"}</div>
                  <div className="mt-1">{summary?.storefront?.opening_hours ?? "Chua co gio mo cua"}</div>
                </div>
                <div className="manage-warn-box">Chua co giao dien quan tri storefront rieng.</div>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
