import { useCallback, useEffect, useState } from "react";
import {
  type CrmDashboardMetrics,
  type MobileAppointmentSummary,
  type MobileBookingRequestSummary,
  type MobileDashboardSnapshot,
  getCrmDashboardMetricsForMobile,
  getDashboardSnapshotForMobile,
  listAppointmentsForMobile,
  listBookingRequestsForMobile,
} from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

type AdminOverviewState = {
  dashboard: MobileDashboardSnapshot | null;
  bookingRequests: MobileBookingRequestSummary[];
  appointments: MobileAppointmentSummary[];
  crmMetrics: CrmDashboardMetrics | null;
};

const INITIAL_STATE: AdminOverviewState = {
  dashboard: null,
  bookingRequests: [],
  appointments: [],
  crmMetrics: null,
};

export function useAdminOverview() {
  const { isHydrated, role } = useSession();
  const [state, setState] = useState<AdminOverviewState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!mobileSupabase || !isHydrated || !role) {
      setState(INITIAL_STATE);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const canSeeBookingRequests =
        role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION";
      const canSeeCrm =
        role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION";

      const [dashboard, bookingRequests, appointments, crmMetrics] = await Promise.all([
        getDashboardSnapshotForMobile(mobileSupabase),
        canSeeBookingRequests ? listBookingRequestsForMobile(mobileSupabase) : Promise.resolve([]),
        listAppointmentsForMobile(mobileSupabase),
        canSeeCrm ? getCrmDashboardMetricsForMobile(mobileSupabase) : Promise.resolve(null),
      ]);

      setState({
        dashboard,
        bookingRequests,
        appointments,
        crmMetrics,
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Khong tai duoc du lieu van hanh");
    } finally {
      setLoading(false);
    }
  }, [isHydrated, role]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void load();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [load]);

  return {
    ...state,
    loading,
    error,
    reload: load,
  };
}
