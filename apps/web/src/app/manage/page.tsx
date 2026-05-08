"use client";

import { AppShell } from "@/components/app-shell";
import { getCurrentSessionRole } from "@/lib/auth";
import { getDefaultManageHref } from "@/lib/manage-landing-auth";
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
        router.replace(getDefaultManageHref(role));
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Khong the mo trang manage");
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
        {error ? <span className="text-red-600">{error}</span> : "Dang chuyen trang..."}
      </div>
    </AppShell>
  );
}
