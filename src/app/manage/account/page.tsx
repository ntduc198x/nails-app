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
      <div className="space-y-5">
        <section className="manage-surface">
          <div className="space-y-1">
            <h2 className="page-title">Tài khoản</h2>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="card space-y-4 xl:sticky xl:top-4 xl:self-start">
            {loading ? (
              <div className="space-y-3">
                <div className="skeleton h-5 w-40 rounded-full" />
                <div className="skeleton h-4 w-52 rounded-full" />
                <div className="skeleton h-16 rounded-2xl" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xl font-semibold text-neutral-900">{profileName}</p>
                  <p className="text-sm text-neutral-500">{email || "No email"}</p>
                  <span className="badge-soft mt-2 inline-flex">{role}</span>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                  <div className="grid gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-500">Tên hiển thị</p>
                      <p className="mt-1 font-medium text-neutral-900">{profileData.displayName || "Chưa cập nhật"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-neutral-500">Điện thoại</p>
                      <p className="mt-1 font-medium text-neutral-900">{profileData.phone || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>

          <div className="space-y-5">
            <form className="card space-y-4" onSubmit={onSaveProfile}>
              <div>
                <h3 className="text-lg font-semibold">Hồ sơ cá nhân</h3>
                <p className="text-sm text-neutral-500">Cập nhật tên hiển thị và số điện thoại của tài khoản.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">Tên hiển thị</span>
                  <input className="input w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ví dụ: Đức" />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Số điện thoại</span>
                  <input className="input w-full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ví dụ: 09xxxxxxxx" />
                </label>
              </div>

              <label className="space-y-2 text-sm">
                <span className="font-medium">Email</span>
                <input className="input w-full bg-neutral-50" value={email} disabled readOnly />
                <span className="text-xs text-neutral-500">Hiện tại email chỉ hiển thị, chưa cho đổi trực tiếp ở màn này.</span>
              </label>

              <div className="flex justify-end">
                <button className="btn btn-primary" disabled={savingProfile || loading}>
                  {savingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
                </button>
              </div>
            </form>

            <form className="card space-y-4" onSubmit={onChangePassword}>
              <div>
                <h3 className="text-lg font-semibold">Đổi mật khẩu</h3>
                <p className="text-sm text-neutral-500">Nhập mật khẩu hiện tại để xác nhận, sau đó đặt mật khẩu mới.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm md:col-span-2">
                  <span className="font-medium">Mật khẩu hiện tại</span>
                  <input className="input w-full" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Nhập mật khẩu hiện tại" />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Mật khẩu mới</span>
                  <input className="input w-full" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Ít nhất 8 ký tự" />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Nhập lại mật khẩu mới</span>
                  <input className="input w-full" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại để xác nhận" />
                </label>
              </div>

              <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
                Gợi ý: dùng mật khẩu dài hơn 8 ký tự, có chữ hoa, chữ thường, số hoặc ký tự đặc biệt để an toàn hơn.
              </div>

              <div className="flex justify-end">
                <button className="btn btn-primary" disabled={savingPassword || loading}>
                  {savingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
