"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LandingPageClient } from "@/components/landing/landing-page-client";
import { validateAppSession } from "@/lib/app-session";
import { getDefaultManageHref } from "@/lib/manage-landing-auth";
import type { HomeFeedPayload } from "@/lib/landing-content";
import { getCurrentAuthenticatedSummary } from "@/lib/web-auth";
import type { CustomerExplorePayload } from "@nails/shared";
import { isCustomerRole } from "@nails/shared";

type LandingEntryGateProps = {
  initialHomeFeed: HomeFeedPayload;
  initialExplore: CustomerExplorePayload;
};

export function LandingEntryGate({ initialHomeFeed, initialExplore }: LandingEntryGateProps) {
  const router = useRouter();
  const [canRenderLanding, setCanRenderLanding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const summary = await getCurrentAuthenticatedSummary();

      if (!summary || isCustomerRole(summary.role)) {
        if (!cancelled) {
          setCanRenderLanding(true);
        }
        return;
      }

      const appSession = await validateAppSession();
      if (appSession.valid) {
        router.replace(getDefaultManageHref(summary.role));
        return;
      }

      if (!cancelled) {
        setCanRenderLanding(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!canRenderLanding) {
    return <main className="min-h-screen bg-[#f7efe5]" aria-busy="true" />;
  }

  return <LandingPageClient initialHomeFeed={initialHomeFeed} initialExplore={initialExplore} />;
}
