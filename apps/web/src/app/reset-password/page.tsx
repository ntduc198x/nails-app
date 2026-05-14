"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function getRecoveryTokens() {
  if (typeof window === "undefined") {
    return {
      accessToken: null,
      refreshToken: null,
      type: null,
      code: null,
      error: null,
      errorDescription: null,
    };
  }

  const currentUrl = new URL(window.location.href);
  const hash = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
  return {
    code: currentUrl.searchParams.get("code"),
    accessToken: hash.get("access_token"),
    refreshToken: hash.get("refresh_token"),
    type: hash.get("type") || currentUrl.searchParams.get("type"),
    error: currentUrl.searchParams.get("error") || hash.get("error"),
    errorDescription: currentUrl.searchParams.get("error_description") || hash.get("error_description"),
  };
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Đang xác thực link đổi mật khẩu...");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const nextPath = useMemo(() => searchParams.get("next") || "/login", [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function prepareRecoverySession() {
      if (!supabase) {
        if (!cancelled) {
          setError("Thiếu cấu hình Supabase trên web.");
          setMessage("");
        }
        return;
      }

      try {
        const { code, accessToken, refreshToken, type, error, errorDescription } = getRecoveryTokens();

        if (error) {
          throw new Error(errorDescription || error || "Link đổi mật khẩu không hợp lệ.");
        }

        if (type === "recovery" && accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            throw sessionError;
          }
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            throw new Error("Link đổi mật khẩu không hợp lệ hoặc đã hết hạn.");
          }
        }

        if (!cancelled) {
          setIsReady(true);
          setMessage("Nhập mật khẩu mới cho tài khoản của anh ngay trên web.");
        }
      } catch (recoveryError) {
        if (!cancelled) {
          setError(recoveryError instanceof Error ? recoveryError.message : "Không xác thực được link đổi mật khẩu.");
          setMessage("");
        }
      }
    }

    void prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setError("Thiếu cấu hình Supabase trên web.");
      return;
    }

    if (!password || password.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      setMessage("Đổi mật khẩu thành công. Đang chuyển về đăng nhập...");
      await supabase.auth.signOut();
      window.setTimeout(() => {
        router.replace(nextPath.startsWith("/") ? nextPath : "/login");
      }, 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không đổi được mật khẩu.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="landing-auth-page landing-auth-page--login">
      <div className="landing-auth-page__shell">
        <div className="landing-auth-page__container landing-auth-page__container--narrow landing-account-page">
          <div className="landing-account-page__topbar">
            <Link className="landing-account-page__back" href="/login">
              Về đăng nhập
            </Link>
          </div>
          <div className="landing-auth-page__panel">
            <div className="landing-auth-loading" style={{ textAlign: "left" }}>
              <p className="landing-auth-loading__eyebrow">CHẠM BEAUTY ACCOUNT</p>
              <h1>Đặt lại mật khẩu</h1>
              {message ? <p>{message}</p> : null}
              {error ? (
                <p className="manage-error-box" style={{ marginTop: 12 }}>
                  {error}
                </p>
              ) : null}

              {isReady ? (
                <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 12 }}>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Mật khẩu mới</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="landing-auth-form__input"
                      autoComplete="new-password"
                      placeholder="Nhập mật khẩu mới"
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span>Xác nhận mật khẩu</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="landing-auth-form__input"
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </label>
                  <button type="submit" className="landing-auth-form__submit" disabled={isSaving}>
                    {isSaving ? "Đang cập nhật..." : "Đổi mật khẩu"}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
