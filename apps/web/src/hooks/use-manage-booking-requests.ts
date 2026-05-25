"use client";

import { useManageBookingRequestsState } from "@/lib/booking-requests/state";
import type { ManageBookingRequestsState } from "@/lib/booking-requests/types";

export function useManageBookingRequests(): ManageBookingRequestsState {
  return useManageBookingRequestsState();
}
