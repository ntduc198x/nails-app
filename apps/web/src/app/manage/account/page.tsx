"use client";

import { AppShell } from "@/components/app-shell";
import { getOrCreateRole, type AppRole } from "@/lib/auth";
import { getRoleLabel } from "@/lib/role-labels";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  phone?: string | null;
  org_id?: string | null;
  default_branch_id?: string | null;
};

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

  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramBotTarget, setTelegramBotTarget] = useState<string>("");
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);

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

      const { data: telegramLink, error: telegramLinkErr } = await supabase
        .from("telegram_links")
        .select("telegram_user_id,telegram_username,telegram_first_name")
        .eq("app_user_id", user.id)
        .maybeSingle();

      if (telegramLinkErr) throw telegramLinkErr;
      setTelegramLinked(Boolean(telegramLink?.telegram_user_id));
      setTelegramBotTarget(telegramLink?.telegram_username ? `@${telegramLink.telegram_username}` : String(telegramLink?.telegram_first_name || ""));
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

  async function onGenerateTelegramCode() {
    if (!supabase || !userId) return;
    try {
      setTelegramLoading(true);
      setTelegramError(null);
      let nextCode: string | null = null;

      const currentRpc = await supabase.rpc("generate_telegram_link_code", {
        p_app_user_id: userId,
        p_ttl_minutes: 5,
      });

      if (!currentRpc.error) {
        nextCode = typeof currentRpc.data === "string" ? currentRpc.data : null;
      } else {
        const legacyRpc = await supabase.rpc("generate_telegram_link_code", { p_user_id: userId });
        if (legacyRpc.error) throw legacyRpc.error;
        if (typeof legacyRpc.data === "string") {
          nextCode = legacyRpc.data;
        } else if (legacyRpc.data && typeof legacyRpc.data === "object" && "code" in legacyRpc.data) {
          nextCode = String((legacyRpc.data as { code?: unknown }).code ?? "");
        }
      }

      if (nextCode) {
        setTelegramCode(nextCode);
      }
    } catch (e) {
      setTelegramError(e instanceof Error ? e.message : "Không thể tạo mã");
    } finally {
      setTelegramLoading(false);
    }
  }

  async function onUnlinkTelegram() {
    if (!supabase || !userId) return;
    try {
      setTelegramLoading(true);
      setTelegramError(null);
      const currentRpc = await supabase.rpc("unlink_telegram", { p_app_user_id: userId });
      if (currentRpc.error) {
        const legacyRpc = await supabase.rpc("unlink_telegram", { p_user_id: userId });
        if (legacyRpc.error) throw legacyRpc.error;
      }
      setTelegramLinked(false);
      setTelegramCode(null);
      setTelegramBotTarget("");
      setMessage("Đã hủy liên kết Telegram.");
    } catch (e) {
      setTelegramError(e instanceof Error ? e.message : "Không thể hủy liên kết");
    } finally {
      setTelegramLoading(false);
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
                <div className="mt-1 text-[13px] font-semibold text-neutral-900 md:text-sm">{getRoleLabel(role)}</div>
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

          {(role === "OWNER" || role === "MANAGER") && (
          <section className="manage-surface space-y-3 p-3 md:p-4">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 md:text-base">Liên kết Telegram</h3>
              <p className="text-xs text-neutral-500">Quản lý app từ Telegram bot.</p>
            </div>

            {telegramError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{telegramError}</div>
            )}

            {telegramLinked ? (
              <div className="space-y-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  ✅ Đã liên kết với Telegram{telegramBotTarget ? ` (${telegramBotTarget})` : ""}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onUnlinkTelegram}
                    disabled={telegramLoading}
                    className="cursor-pointer rounded-2xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {telegramLoading ? "Đang xử lý..." : "Hủy liên kết"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="rounded-2xl bg-neutral-50 p-3 text-xs text-neutral-600">
                  <b>Cách liên kết:</b>
                  <ol className="mt-1 list-decimal pl-4 space-y-0.5">
                    <li>Bấm &quot;Tạo mã liên kết&quot; bên dưới</li>
                    <li>Mở bot hoặc chat Telegram đã cấu hình → gửi <code className="bg-neutral-200 px-1 rounded">/link MÃ</code></li>
                    <li>Ví dụ: <code className="bg-neutral-200 px-1 rounded">/link 482910</code></li>
                  </ol>
                  <p className="mt-1 text-neutral-400">Mã hết hạn sau 5 phút.</p>
                </div>

                {telegramCode && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-blue-500">Mã liên kết của bạn</div>
                    <div className="mt-1 text-3xl font-mono font-bold tracking-[0.15em] text-blue-700">{telegramCode}</div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onGenerateTelegramCode}
                    disabled={telegramLoading}
                    className="cursor-pointer rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {telegramLoading ? "Đang tạo..." : "Tạo mã liên kết"}
                  </button>
                </div>
              </div>
            )}
          </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
