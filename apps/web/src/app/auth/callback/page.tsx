"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeGoogleAuthFromCode } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập với Google...");

  useEffect(() => {
    let cancelled = false;

    async function completeAuth() {
      try {
        // Debug: log all search params
        console.log("[Callback] Full URL:", window.location.href);
        console.log("[Callback] SearchParams:", Object.fromEntries(searchParams.entries()));
        console.log("[Callback] Hash:", window.location.hash);

        const nextPath = searchParams.get("next");
        const code = searchParams.get("code");
        const error = searchParams.get("error");

        console.log("[Callback] code:", code, "| error:", error);

        const result = await completeGoogleAuthFromCode(nextPath);
        if (cancelled) {
          return;
        }
        router.replace(result.redirectPath);
        router.refresh();
      } catch (error) {
        if (!cancelled) {
          console.error("[Callback] Auth error:", error);
          setMessage(error instanceof Error ? error.message : "Không hoàn tất được đăng nhập Google.");
        }
      }
    }

    void completeAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="landing-auth-page">
      <div className="landing-auth-page__shell landing-auth-page__shell--compact">
        <div className="landing-auth-loading">
          <p className="landing-auth-loading__eyebrow">CHẠM BEAUTY ACCOUNT</p>
          <h1>{message}</h1>
          <p>Nếu trang không tự chuyển, bạn có thể quay lại landing hoặc thử đăng nhập lại.</p>
        </div>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <AuthCallbackContent />
    </Suspense>
  );
}
