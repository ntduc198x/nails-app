"use client";

import { AppShell } from "@/components/app-shell";
import { getCurrentSessionRole } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ManageEntryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const role = await getCurrentSessionRole();
        if (!mounted) return;

        if (role === "ACCOUNTANT") {
          router.replace("/manage/checkout");
          return;
        }

        router.replace("/manage/booking-requests");
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Không thể mở trang manage");
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <AppShell>
      <div className="p-6 text-sm text-neutral-500">
        {error ? <span className="text-red-600">{error}</span> : "Đang chuyển trang..."}
      </div>
    </AppShell>
  );
}
