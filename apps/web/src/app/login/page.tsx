"use client";

import { createAppSession, recoverFromInvalidAuthState } from "@/lib/app-session";
import { consumeInviteCode } from "@/lib/invite-codes";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function getResetRedirectUrl() {
  if (typeof window === "undefined") return undefined;
  return `${window.location.origin}/login`;
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const normalized = error.message.toLowerCase();
  return normalized.includes("invalid refresh token") || normalized.includes("refresh token not found");
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const description = useMemo(() => {
    if (mode === "signup") {
      return "Tạo tài khoản bằng mã mời để bắt đầu quản lý lịch hẹn, checkout và vận hành trong cùng một nơi.";
    }
    return "Đăng nhập để tiếp tục vận hành tiệm, theo dõi lịch làm và xử lý khách nhanh gọn.";
  }, [mode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return setMsg("Thiếu cấu hình Supabase.");

    try {
      setLoading(true);
      setMsg(null);

      if (mode === "signup") {
        const displayName = name.trim();
        const invite = inviteCode.trim().toUpperCase();

        if (!invite) {
          throw new Error("Vui lòng nhập mã mời hợp lệ.");
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
          },
        });
        if (error) throw error;

        const userId = signUpData.user?.id;
        if (!userId) throw new Error("Không tạo được tài khoản mới.");

        try {
          await consumeInviteCode(invite, userId, displayName);
        } catch (inviteError) {
          await supabase.auth.signOut();
          throw inviteError;
        }

        setMsg("Tạo tài khoản thành công bằng mã mời. Nếu hệ thống bật xác nhận email, hãy kiểm tra inbox rồi đăng nhập lại.");
        setName("");
        setInviteCode("");
        return;
      }

      // Browser có thể đang giữ refresh token hỏng từ phiên trước, cần dọn trước khi đăng nhập lại.
      await recoverFromInvalidAuthState();

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const sessionResult = await createAppSession();
      if (!sessionResult.success) {
        await supabase.auth.signOut();
        throw new Error(sessionResult.message || sessionResult.error || "Đăng nhập không hợp lệ. Vui lòng thử lại.");
      }

      if (sessionResult.replacedOwnerName) {
        setMsg(`Đã đăng nhập thành công. Phiên đăng nhập của tài khoản "${sessionResult.replacedOwnerName}" trên thiết bị này đã được thay thế.`);
      }

      router.replace("/manage");
    } catch (error) {
      if (error instanceof TypeError && /fetch/i.test(error.message)) {
        console.error("Supabase sign-in network error", {
          hasSupabaseClient: Boolean(supabase),
          error,
        });
        setMsg("Không kết nối được tới Supabase khi đăng nhập local. Kiểm tra `.env.local`, mạng, hoặc chạy lại server dev để nạp env mới.");
        return;
      }

      if (isInvalidRefreshTokenError(error)) {
        await recoverFromInvalidAuthState();
        setMsg("Phiên đăng nhập cũ trên trình duyệt đã hết hạn. Hệ thống đã dọn lại trạng thái cục bộ, anh thử đăng nhập lại giúp em.");
        return;
      }

      setMsg(error instanceof Error ? error.message : "Xác thực thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword() {
    if (!supabase) return setMsg("Thiếu cấu hình Supabase.");
    if (!email.trim()) {
      return setMsg("Bạn cần nhập email trước mới gửi link đặt lại mật khẩu được.");
    }

    try {
      setResetting(true);
      setMsg(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getResetRedirectUrl(),
      });
      if (error) throw error;
      setMsg("Đã gửi link đặt lại mật khẩu. Hãy kiểm tra email.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Gửi yêu cầu đặt lại mật khẩu thất bại.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Nails App</h1>
          <p className="text-sm leading-6 text-neutral-500">{description}</p>
        </div>

        <div className="flex gap-2 rounded-lg bg-neutral-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMsg(null);
            }}
            className={`flex-1 rounded-md px-3 py-2 transition-colors ${mode === "login" ? "bg-white shadow-sm" : ""}`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMsg(null);
            }}
            className={`flex-1 rounded-md px-3 py-2 transition-colors ${mode === "signup" ? "bg-white shadow-sm" : ""}`}
          >
            Tạo tài khoản
          </button>
        </div>

        {mode === "signup" && (
          <>
            <input
              className="w-full input"
              type="text"
              placeholder="Tên của bạn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="w-full input uppercase"
              type="text"
              placeholder="Mã mời"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              required
            />
          </>
        )}

        <input
          className="w-full input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="space-y-2">
          <input
            className="w-full input"
            type="password"
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === "login" && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void onForgotPassword()}
                disabled={resetting}
                className="text-sm text-neutral-600 underline underline-offset-2 disabled:opacity-50"
              >
                {resetting ? "Đang gửi link..." : "Quên mật khẩu?"}
              </button>
            </div>
          )}
        </div>

        <button disabled={loading} className="btn btn-primary w-full disabled:opacity-50">
          {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>

        <div className="rounded-lg bg-neutral-50 p-3 text-xs leading-5 text-neutral-500">
          {mode === "signup"
            ? "Đăng ký cần mã mời dùng 1 lần, hiệu lực 15 phút. Tài khoản mới mặc định sẽ là Kỹ thuật viên."
            : "Nếu bạn chưa có tài khoản, hãy xin Chủ tiệm mã mời rồi chuyển sang tab Tạo tài khoản."}
        </div>

        {msg && <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">{msg}</p>}
      </form>
    </main>
  );
}
