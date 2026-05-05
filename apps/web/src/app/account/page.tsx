"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  phone: string | null;
};

export default function CustomerAccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function loadAccount() {
    try {
      setLoading(true);
      setError(null);
      if (!supabase) {
        throw new Error("Thiếu cấu hình Supabase.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email ?? "");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id,display_name,phone")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const row = profile as ProfileRow | null;
      setDisplayName((row?.display_name ?? user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "").trim());
      setPhone(String(row?.phone ?? ""));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không tải được thông tin tài khoản.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, []);

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;

    try {
      setSavingProfile(true);
      setError(null);
      setMessage(null);

      const nextName = displayName.trim() || "Khách hàng";
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: nextName,
          phone: phone.trim() || null,
        })
        .eq("user_id", userId);

      if (profileError) {
        throw profileError;
      }

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: nextName,
        },
      });

      if (authError && !authError.message.includes("Auth session missing")) {
        throw authError;
      }

      setMessage("Đã cập nhật thông tin cá nhân.");
      await loadAccount();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không lưu được hồ sơ.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    if (!email.trim()) {
      setError("Không tìm thấy email hiện tại.");
      return;
    }
    if (!currentPassword) {
      setError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Mật khẩu mới cần ít nhất 8 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu nhập lại chưa khớp.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Mật khẩu mới không nên trùng mật khẩu hiện tại.");
      return;
    }

    try {
      setSavingPassword(true);
      setError(null);
      setMessage(null);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: currentPassword,
      });
      if (signInError) {
        throw new Error("Mật khẩu hiện tại không đúng.");
      }

      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        throw passwordError;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Đã đổi mật khẩu thành công.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không đổi được mật khẩu.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    if (!supabase) return;
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      router.replace("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="landing-auth-page">
      <div className="landing-auth-page__container landing-account-page">
        <div className="landing-account-page__topbar">
          <Link href="/" className="landing-account-page__back">
            ← Về trang chủ
          </Link>
          <button type="button" className="landing-showcase__secondary-btn" onClick={() => void handleSignOut()} disabled={signingOut}>
            {signingOut ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>

        <section className="landing-account-page__hero">
          <span className="landing-showcase__eyebrow">Tài khoản khách hàng</span>
          <h1>Cá nhân</h1>
          <p>Quản lý thông tin cá nhân, mật khẩu và các thiết lập cơ bản cho tài khoản của bạn.</p>
        </section>

        {error ? <div className="landing-account-page__feedback landing-account-page__feedback--error">{error}</div> : null}
        {message ? <div className="landing-account-page__feedback landing-account-page__feedback--success">{message}</div> : null}

        {!loading ? (
          <section className="landing-account-page__summary">
            <article>
              <span>Tên hiển thị</span>
              <strong>{displayName || "Khách hàng"}</strong>
            </article>
            <article>
              <span>Email</span>
              <strong>{email || "Chưa có email"}</strong>
            </article>
            <article>
              <span>Trạng thái</span>
              <strong>Đang hoạt động</strong>
            </article>
          </section>
        ) : null}

        <div className="landing-account-page__grid">
          <form className="landing-account-page__card" onSubmit={handleSaveProfile}>
            <div className="landing-account-page__card-head">
              <h2>Thông tin cá nhân</h2>
              <p>Cập nhật tên hiển thị và số điện thoại liên hệ.</p>
            </div>

            <label>
              <span>Tên hiển thị</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ví dụ: Minh Anh" />
            </label>

            <label>
              <span>Số điện thoại</span>
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ví dụ: 09xxxxxxxx" />
            </label>

            <label>
              <span>Email</span>
              <input value={email} disabled readOnly />
            </label>

            <button type="submit" className="landing-showcase__primary-btn" disabled={savingProfile}>
              {savingProfile ? "Đang lưu..." : "Lưu thông tin"}
            </button>
          </form>

          <form className="landing-account-page__card" onSubmit={handleChangePassword}>
            <div className="landing-account-page__card-head">
              <h2>Bảo mật</h2>
              <p>Đổi mật khẩu để bảo vệ tài khoản của bạn an toàn hơn.</p>
            </div>

            <label>
              <span>Mật khẩu hiện tại</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Nhập mật khẩu hiện tại" />
            </label>

            <label>
              <span>Mật khẩu mới</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Ít nhất 8 ký tự" />
            </label>

            <label>
              <span>Nhập lại mật khẩu mới</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại để xác nhận" />
            </label>

            <button type="submit" className="landing-showcase__primary-btn" disabled={savingPassword}>
              {savingPassword ? "Đang cập nhật..." : "Đổi mật khẩu"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
