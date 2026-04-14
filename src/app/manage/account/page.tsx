"use client";

import { AppShell } from "@/components/app-shell";
import { getOrCreateRole, type AppRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  phone?: string | null;
  org_id?: string | null;
  default_branch_id?: string | null;
};

function roleLabel(role: AppRole) {
  if (role === "TECH") return "THỢ";
  return role;
}

function InlineField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-2">
      <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("RECEPTION");

  const [profileData, setProfileData] = useState<{ displayName: string; phone: string }>({ displayName: "", phone: "" });
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const profileName = profileData.displayName.trim() || email.split("@")[0] || "User";

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      if (!supabase) throw new Error("Thiếu cấu hình Supabase env");

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) throw new Error("Chưa đăng nhập");

      setUserId(user.id);
      setEmail(user.email ?? "");
      setRole(await getOrCreateRole(user.id));

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("user_id,display_name,phone,org_id,default_branch_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      const row = profile as ProfileRow | null;
      const nextDisplayName = (row?.display_name || (user.user_metadata?.display_name as string | undefined) || user.email?.split("@")[0] || "User").trim();
      const nextPhone = String(row?.phone ?? "");
      setProfileData({ displayName: nextDisplayName, phone: nextPhone });
      setDisplayName(nextDisplayName);
      setPhone(nextPhone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load account failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return setError("Thiếu cấu hình Supabase env");
    if (!userId) return setError("Không tìm thấy user hiện tại");

    const nextName = displayName.trim() || "User";

    try {
      setSavingProfile(true);
      setError(null);
      setMessage(null);

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ display_name: nextName, phone: phone.trim() || null })
        .eq("user_id", userId);
      if (profileErr) throw profileErr;

      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          display_name: nextName,
        },
      });
      if (authErr) {
        const message = authErr instanceof Error ? authErr.message : String(authErr ?? "");
        if (!message.includes("Auth session missing")) throw authErr;
      }

      setMessage("Đã cập nhật thông tin tài khoản.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update profile failed");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return setError("Thiếu cấu hình Supabase env");
    if (!email.trim()) return setError("Không tìm thấy email hiện tại");
    if (!currentPassword) return setError("Cần nhập mật khẩu hiện tại.");
    if (newPassword.length < 8) return setError("Mật khẩu mới cần ít nhất 8 ký tự.");
    if (newPassword !== confirmPassword) return setError("Mật khẩu mới nhập lại chưa khớp.");
    if (newPassword === currentPassword) return setError("Mật khẩu mới không nên trùng mật khẩu hiện tại.");

    try {
      setSavingPassword(true);
      setError(null);
      setMessage(null);

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: currentPassword,
      });
      if (signInErr) throw new Error("Mật khẩu hiện tại không đúng.");

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Đổi mật khẩu thành công.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Change password failed");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-24 md:pb-0">
        <section className="manage-surface p-4 md:p-5">
          <div className="space-y-1">
            <h2 className="page-title">Hồ sơ & bảo mật</h2>
            <p className="text-xs text-neutral-500">Cập nhật thông tin cá nhân và bảo mật tài khoản.</p>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

        {!loading ? (
          <section className="manage-surface p-3 md:p-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Tài khoản</div>
                <div className="mt-1 text-[13px] font-semibold text-neutral-900 md:text-sm">{profileName}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Email</div>
                <div className="mt-1 line-clamp-1 text-[13px] font-semibold text-neutral-900 md:text-sm">{email || "No email"}</div>
              </div>
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-[0.08em] text-neutral-500">Vai trò</div>
                <div className="mt-1 text-[13px] font-semibold text-neutral-900 md:text-sm">{roleLabel(role)}</div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="space-y-4">
          <form className="manage-surface space-y-3 p-3 md:p-4" onSubmit={onSaveProfile}>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Hồ sơ cá nhân</h3>
              <p className="text-xs text-neutral-500">Cập nhật tên hiển thị và số điện thoại.</p>
            </div>

            <div className="space-y-2">
              <InlineField label="Tên hiển thị">
                <input className="input w-full py-2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ví dụ: Đức" />
              </InlineField>
              <InlineField label="Điện thoại">
                <input className="input w-full py-2" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ví dụ: 09xxxxxxxx" />
              </InlineField>
              <InlineField label="Email">
                <input className="input w-full bg-neutral-50 py-2" value={email} disabled readOnly />
              </InlineField>
            </div>
            <div className="text-[11px] text-neutral-500">Hiện tại email chỉ hiển thị, chưa cho đổi trực tiếp ở màn này.</div>

            <div className="flex justify-end">
              <button className="cursor-pointer rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingProfile || loading}>
                {savingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
              </button>
            </div>
          </form>

          <form className="manage-surface space-y-3 p-3 md:p-4" onSubmit={onChangePassword}>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Đổi mật khẩu</h3>
              <p className="text-xs text-neutral-500">Nhập mật khẩu hiện tại rồi đặt mật khẩu mới.</p>
            </div>

            <div className="space-y-2">
              <InlineField label="Mật khẩu cũ">
                <input className="input w-full py-2" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Nhập mật khẩu hiện tại" />
              </InlineField>
              <InlineField label="Mật khẩu mới">
                <input className="input w-full py-2" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" />
              </InlineField>
              <InlineField label="Nhập lại">
                <input className="input w-full py-2" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại để xác nhận" />
              </InlineField>
            </div>

            <div className="rounded-2xl bg-neutral-50 p-3 text-[11px] text-neutral-600">
              Gợi ý: dùng mật khẩu dài hơn 8 ký tự, có chữ hoa, chữ thường, số hoặc ký tự đặc biệt để an toàn hơn.
            </div>

            <div className="flex justify-end">
              <button className="cursor-pointer rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingPassword || loading}>
                {savingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
