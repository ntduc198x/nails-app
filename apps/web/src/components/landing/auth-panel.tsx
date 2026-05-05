"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getPostAuthRedirectPath,
  requestBrowserPasswordReset,
  signInWithEmailPassword,
  signInWithGoogleCustomer,
  signUpWithRole,
} from "@/lib/web-auth";
import { isCustomerRole, type AuthenticatedUserSummary } from "@nails/shared";

type AuthMode = "login" | "signup";
type RegistrationMode = "USER" | "ADMIN";

type AuthPanelProps = {
  initialMode?: AuthMode;
  variant?: "modal" | "page";
  nextPath?: string;
  onClose?: () => void;
  onAuthenticated?: (summary: AuthenticatedUserSummary) => void;
};

export function AuthPanel({
  initialMode = "login",
  nextPath = "/",
  onAuthenticated,
  onClose,
  variant = "modal",
}: AuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [staffMode, setStaffMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registrationMode: RegistrationMode = staffMode ? "ADMIN" : "USER";
  const showSocial = registrationMode === "USER";

  const cardTitle = useMemo(() => {
    if (staffMode && mode === "signup") {
      return "Tạo tài khoản nhân sự";
    }

    if (mode === "signup") {
      return "Tạo tài khoản";
    }

    return staffMode ? "Đăng nhập nhân sự" : "Đăng nhập";
  }, [mode, staffMode]);

  const description = useMemo(() => {
    if (staffMode && mode === "signup") {
      return "Luồng này dành cho nhân sự nội bộ. Bạn cần mã mời nhân sự để tạo tài khoản vận hành.";
    }

    if (staffMode) {
      return "Nhân sự có thể đăng nhập để vào khu vực lịch hẹn và vận hành cửa tiệm.";
    }

    if (mode === "signup") {
      return "Đăng ký nhanh bằng email hoặc Google để lưu thông tin, theo dõi ưu đãi và đặt lịch mượt hơn ở những lần sau.";
    }

    return "Đăng nhập để lưu lịch sử, ưu đãi yêu thích và tiếp tục trải nghiệm mượt hơn trên landing.";
  }, [mode, staffMode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const summary =
        mode === "login"
          ? await signInWithEmailPassword({ email, password })
          : await signUpWithRole({
              email,
              password,
              name,
              inviteCode,
              registrationMode,
            });

      if (!summary) {
        setMessage("Tài khoản đã được tạo. Nếu hệ thống bật xác nhận email, vui lòng kiểm tra inbox trước khi đăng nhập.");
        setMode("login");
        return;
      }

      onAuthenticated?.(summary);

      const redirectPath = getPostAuthRedirectPath(summary, nextPath);
      if (isCustomerRole(summary.role)) {
        setMessage(mode === "signup" ? "Đăng ký thành công. Chào mừng bạn đến với Chạm Beauty." : "Đăng nhập thành công.");
        onClose?.();
        router.replace(redirectPath);
        router.refresh();
        return;
      }

      router.replace(redirectPath);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Xác thực thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await signInWithGoogleCustomer(nextPath);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không thể tiếp tục với Google.");
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Vui lòng nhập email trước khi gửi link đặt lại mật khẩu.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await requestBrowserPasswordReset(email);
      setMessage("Đã gửi link đặt lại mật khẩu. Vui lòng kiểm tra email của bạn.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Không gửi được email đặt lại mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`landing-auth-panel landing-auth-panel--${variant}`}>
      <div className="landing-auth-panel__intro">
        <div className="landing-auth-panel__header">
          <div>
            <p className="landing-auth-panel__eyebrow">CHẠM BEAUTY ACCOUNT</p>
            <h2>{cardTitle}</h2>
            <p className="landing-auth-panel__description">{description}</p>
          </div>

          {onClose ? (
            <button type="button" className="landing-auth-panel__close" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          ) : null}
        </div>

        {!staffMode ? (
          <div className="landing-auth-benefits">
            <span>Lưu thông tin nhanh hơn</span>
            <span>Theo dõi ưu đãi yêu thích</span>
          </div>
        ) : (
          <div className="landing-auth-benefits landing-auth-benefits--staff">
            <span>Truy cập khu vực vận hành</span>
            <span>Sử dụng mã mời nội bộ</span>
          </div>
        )}
      </div>

      <div className="landing-auth-switch" role="tablist" aria-label="Chọn chế độ xác thực">
        <button
          type="button"
          className={mode === "login" ? "is-active" : ""}
          onClick={() => {
            setMode("login");
            setMessage(null);
            setError(null);
          }}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          className={mode === "signup" ? "is-active" : ""}
          onClick={() => {
            setMode("signup");
            setMessage(null);
            setError(null);
          }}
        >
          Đăng ký
        </button>
      </div>

      {showSocial ? (
        <div className="landing-auth-social">
          <button type="button" className="landing-auth-social__button" onClick={() => void handleGoogleAuth()} disabled={loading}>
            <span>G</span>
            <span>{mode === "login" ? "Tiếp tục với Google" : "Đăng ký với Google"}</span>
          </button>
          <div className="landing-auth-social__separator">
            <span>Hoặc dùng email</span>
          </div>
        </div>
      ) : null}

      <form className="landing-auth-form" onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <label>
            <span>Họ và tên</span>
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nguyễn Minh Anh" required />
          </label>
        ) : null}

        {mode === "signup" && registrationMode === "ADMIN" ? (
          <label>
            <span>Mã mời nhân sự</span>
            <input
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="STAFF-XXXX"
              required
            />
          </label>
        ) : null}

        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@domain.com" required />
        </label>

        <label>
          <span>Mật khẩu</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required />
        </label>

        {mode === "login" ? (
          <button type="button" className="landing-auth-form__link" onClick={() => void handleForgotPassword()} disabled={loading}>
            Quên mật khẩu?
          </button>
        ) : null}

        <button type="submit" className="landing-auth-form__submit" disabled={loading}>
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
      </form>

      <div className="landing-auth-footer">
        {staffMode ? (
          <>
            <span className="landing-auth-staff__badge">Nhân sự nội bộ</span>
            <button
              type="button"
              className="landing-auth-staff__link"
              onClick={() => {
                setStaffMode(false);
                setInviteCode("");
                setError(null);
                setMessage(null);
              }}
            >
              Quay lại đăng nhập thông thường
            </button>
          </>
        ) : (
          <button
            type="button"
            className="landing-auth-staff__link"
            onClick={() => {
              setStaffMode(true);
              setError(null);
              setMessage(null);
            }}
          >
            Nhân sự nội bộ? Dùng mã mời nhân sự
          </button>
        )}
      </div>

      {message ? <p className="landing-auth-feedback landing-auth-feedback--success">{message}</p> : null}
      {error ? <p className="landing-auth-feedback landing-auth-feedback--error">{error}</p> : null}
    </div>
  );
}
