import type { CustomerCrmSummary } from "@/lib/crm";
import type { BookingRequestRow, BookingRequestStatus } from "@/lib/booking-requests";
import type { AppRole } from "@/lib/auth";

export type StaffOption = { userId: string; name: string };
export type ResourceOption = { id: string; name: string; type: string };

export type OverlapRow = {
  id: string;
  kind?: "appointment" | "booking_request";
  start_at: string;
  end_at: string;
  status?: string;
  customer_name?: string;
  customers?: { name?: string } | { name?: string }[] | null;
};

export type BookingRequestQueueItem = {
  id: string;
  customerName: string;
  customerPhone: string;
  sourceLabel: string;
  requestedServiceLabel: string;
  requestedStartLabel: string;
  statusClassName: string;
  statusLabel: string;
  crm: CustomerCrmSummary | null;
};

export type BookingRequestSelection = {
  id: string;
  customerName: string;
  customerPhone: string;
  sourceLabel: string;
  requestedServiceLabel: string;
  requestedTimeLabel: string;
  status: BookingRequestStatus;
  statusClassName: string;
  statusLabel: string;
  isExpired: boolean;
};

export type BookingRequestCapacityState = {
  warning: string | null;
  overlaps: OverlapRow[];
  allowed: boolean;
  maxSimultaneous: number;
};

export type ManageBookingRequestsState = {
  bookingRequests: BookingRequestRow[];
  newBookingRequests: BookingRequestRow[];
  rescheduleBookingRequests: BookingRequestRow[];
  newQueueItems: BookingRequestQueueItem[];
  rescheduleQueueItems: BookingRequestQueueItem[];
  selectedBookingRequest: BookingRequestRow | null;
  selectedBooking: BookingRequestSelection | null;
  selectedCustomerCrm: CustomerCrmSummary | null;
  compactHeader: string;
  selectionMeta: string;
  canHandleBookingRequest: boolean;
  loading: boolean;
  refreshing: boolean;
  submitting: boolean;
  error: string | null;
  role: AppRole | null;
  staffOptions: StaffOption[];
  resourceOptions: ResourceOption[];
  staffUserId: string;
  resourceId: string;
  bookingAt: string;
  confirmCancelId: string | null;
  capacity: BookingRequestCapacityState;
  overlapSummaries: Array<{ id: string; label: string }>;
  selectBookingRequest: (bookingRequestId: string | null) => void;
  setStaffUserId: (value: string) => void;
  setResourceId: (value: string) => void;
  setBookingAt: (value: string) => void;
  dismissCancelConfirmation: () => void;
  requestCancelBooking: (bookingRequestId: string) => Promise<void>;
  deleteBooking: (bookingRequestId: string) => Promise<void>;
  convertBooking: () => Promise<void>;
  refresh: (opts?: { silent?: boolean; force?: boolean }) => Promise<void>;
};
