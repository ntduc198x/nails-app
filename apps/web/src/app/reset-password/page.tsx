"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Đang kiểm tra liên kết xác nhận reset mật khẩu...");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUsed, setIsUsed] = useState(false);

  const nextPath = useMemo(() => searchParams.get("next") || "/login", [searchParams]);
  const token = useMemo(() => searchParams.get("token")?.trim() || "", [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function validateResetToken() {
      try {
        if (!token) {
          throw new Error("Không tìm thấy token reset mật khẩu hợp lệ.");
        }

        const response = await fetch(`/api/auth/password-reset/status?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { success?: boolean; status?: "pending" | "expired" | "used" | "invalid"; error?: string }
          | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || "Không kiểm tra được trạng thái reset mật khẩu.");
        }

        if (!cancelled) {
          setIsReady(payload.status === "pending");
          setIsUsed(payload.status === "used");
          if (payload.status === "pending") {
            setMessage("Liên kết hợp lệ. Bấm xác nhận để kích hoạt mật khẩu tạm đã được gửi qua email.");
          } else if (payload.status === "used") {
            setMessage("Liên kết này đã được dùng. Bạn có thể đăng nhập bằng mật khẩu tạm trong email.");
          } else if (payload.status === "expired") {
            setError("Liên kết reset mật khẩu đã hết hạn.");
            setMessage("");
          } else {
            setError("Liên kết reset mật khẩu không hợp lệ hoặc không còn tồn tại.");
            setMessage("");
          }
        }
      } catch (recoveryError) {
        if (!cancelled) {
          setError(recoveryError instanceof Error ? recoveryError.message : "Không xác thực được liên kết reset mật khẩu.");
          setMessage("");
        }
      }
    }

    void validateResetToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleConfirmReset() {
    if (!token) {
      setError("Không tìm thấy token reset mật khẩu hợp lệ.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; status?: "pending" | "expired" | "used" | "invalid"; error?: string }
        | null;

      if (!response.ok || !payload?.success) {
        if (payload?.status === "used") {
          setIsUsed(true);
          setIsReady(false);
          setMessage("Liên kết này đã được dùng. Bạn có thể đăng nhập bằng mật khẩu tạm trong email.");
          return;
        }
        if (payload?.status === "expired") {
          throw new Error("Liên kết reset mật khẩu đã hết hạn.");
        }
        if (payload?.status === "invalid") {
          throw new Error(payload.error || "Liên kết reset mật khẩu không hợp lệ.");
        }
        throw new Error(payload?.error || "Không áp dụng được mật khẩu mới.");
      }

      setIsUsed(true);
      setIsReady(false);
      setMessage("Đã kích hoạt mật khẩu tạm thành công. Đang chuyển về đăng nhập...");
      window.setTimeout(() => {
        router.replace(nextPath.startsWith("/") ? nextPath : "/login");
      }, 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không xác nhận được reset mật khẩu.");
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
                <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
                  <p>Mật khẩu mới đã được gửi sẵn qua email. Bước cuối cùng là xác nhận để hệ thống kích hoạt mật khẩu đó.</p>
                  <button type="button" className="landing-auth-form__submit" disabled={isSaving} onClick={() => void handleConfirmReset()}>
                    {isSaving ? "Đang xác nhận..." : "Xác nhận reset mật khẩu"}
                  </button>
                </div>
              ) : null}

              {isUsed ? (
                <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
                  <p>Hãy quay lại màn đăng nhập và dùng mật khẩu tạm đã nhận trong email.</p>
                </div>
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
