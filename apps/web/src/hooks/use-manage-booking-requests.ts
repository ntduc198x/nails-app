"use client";

import { getCurrentSessionRole, type AppRole } from "@/lib/auth";
import { listCustomerCardsByPhones, type CustomerCrmSummary } from "@/lib/crm";
import {
  checkAppointmentCapacity,
  convertBookingRequestToAppointment,
  deleteBookingRequest,
  type BookingRequestRow,
  updateBookingRequestStatus,
} from "@/lib/booking-requests";
import {
  buildBookingQueueItem,
  buildBookingSelection,
  BOOKING_REQUEST_DATE_TIME_FORMATTER,
  addBookingMinutes,
  normalizeBookingPhone,
  pickBookingOverlapCustomerName,
  toBookingDateTimeInputValue,
} from "@/components/manage-booking-requests.view-models";
import type { ManageBookingRequestsState, OverlapRow } from "@/components/manage-booking-requests.types";
import { getBookingLookupsSnapshot, getBookingRequestsSnapshot } from "@/lib/admin-web-prewarm";
import { useCallback, useEffect, useMemo, useState } from "react";

function buildOverlapSummary(overlap: OverlapRow) {
  return {
    id: overlap.id,
    label: `${pickBookingOverlapCustomerName(overlap.customers)} — ${BOOKING_REQUEST_DATE_TIME_FORMATTER.format(new Date(overlap.start_at))}`,
  };
}

export function useManageBookingRequests(): ManageBookingRequestsState {
  const [bookingRequests, setBookingRequests] = useState<BookingRequestRow[]>([]);
  const [crmCards, setCrmCards] = useState<CustomerCrmSummary[]>([]);
  const [staffOptions, setStaffOptions] = useState<ManageBookingRequestsState["staffOptions"]>([]);
  const [resourceOptions, setResourceOptions] = useState<ManageBookingRequestsState["resourceOptions"]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [staffUserId, setStaffUserId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [bookingAt, setBookingAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);
  const [capacityOverlaps, setCapacityOverlaps] = useState<OverlapRow[]>([]);
  const [capacityAllowed, setCapacityAllowed] = useState(true);
  const [maxSimultaneous, setMaxSimultaneous] = useState(2);

  const refresh = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [currentRole, bookingRequestsSnapshot, bookingLookups] = await Promise.all([
        getCurrentSessionRole(),
        getBookingRequestsSnapshot({ force: opts?.force }),
        getBookingLookupsSnapshot({ force: opts?.force }),
      ]);
      const activeBookingRequests = bookingRequestsSnapshot.filter(
        (bookingRequest) => bookingRequest.status === "NEW" || bookingRequest.status === "NEEDS_RESCHEDULE",
      );
      const customerCards = activeBookingRequests.length > 0
        ? await listCustomerCardsByPhones(activeBookingRequests.map((bookingRequest) => bookingRequest.customer_phone))
        : [];

      setRole(currentRole);
      setBookingRequests(activeBookingRequests);
      setCrmCards(customerCards);
      setStaffOptions(bookingLookups.staffOptions);
      setResourceOptions(bookingLookups.resourceOptions);
      setSelectedBookingId((currentSelectionId) =>
        activeBookingRequests.some((bookingRequest) => bookingRequest.id === currentSelectionId) ? currentSelectionId : null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Tải yêu cầu đặt lịch thất bại");
    } finally {
      if (opts?.silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const newBookingRequests = useMemo(
    () => bookingRequests.filter((bookingRequest) => bookingRequest.status === "NEW"),
    [bookingRequests],
  );
  const rescheduleBookingRequests = useMemo(
    () => bookingRequests.filter((bookingRequest) => bookingRequest.status === "NEEDS_RESCHEDULE"),
    [bookingRequests],
  );
  const selectedBookingRequest = useMemo(
    () => bookingRequests.find((bookingRequest) => bookingRequest.id === selectedBookingId) ?? null,
    [bookingRequests, selectedBookingId],
  );

  const crmByPhone = useMemo(() => {
    const crmMap = new Map<string, CustomerCrmSummary>();
    for (const crmCard of crmCards) {
      const phone = normalizeBookingPhone(crmCard.phone);
      if (phone) crmMap.set(phone, crmCard);
    }
    return crmMap;
  }, [crmCards]);

  const selectedCustomerCrm = useMemo(() => {
    if (!selectedBookingRequest) return null;
    return crmByPhone.get(normalizeBookingPhone(selectedBookingRequest.customer_phone) ?? "") ?? null;
  }, [crmByPhone, selectedBookingRequest]);

  const selectedBooking = useMemo(
    () => (selectedBookingRequest ? buildBookingSelection(selectedBookingRequest) : null),
    [selectedBookingRequest],
  );
  const newQueueItems = useMemo(
    () =>
      newBookingRequests.map((bookingRequest) =>
        buildBookingQueueItem(bookingRequest, crmByPhone.get(normalizeBookingPhone(bookingRequest.customer_phone) ?? "") ?? null),
      ),
    [crmByPhone, newBookingRequests],
  );
  const rescheduleQueueItems = useMemo(
    () =>
      rescheduleBookingRequests.map((bookingRequest) =>
        buildBookingQueueItem(bookingRequest, crmByPhone.get(normalizeBookingPhone(bookingRequest.customer_phone) ?? "") ?? null),
      ),
    [crmByPhone, rescheduleBookingRequests],
  );
  const overlapSummaries = useMemo(
    () => capacityOverlaps.map(buildOverlapSummary),
    [capacityOverlaps],
  );

  useEffect(() => {
    let cancelled = false;

    async function runCapacityCheck() {
      if (!selectedBookingRequest || !bookingAt) {
        setCapacityWarning(null);
        setCapacityOverlaps([]);
        setCapacityAllowed(true);
        return;
      }

      try {
        const startAt = new Date(bookingAt);
        if (Number.isNaN(startAt.getTime())) return;

        const capacitySnapshot = await checkAppointmentCapacity({
          bookingRequestId: selectedBookingRequest.id,
          startAt: startAt.toISOString(),
          endAt: addBookingMinutes(startAt, 60).toISOString(),
        });

        if (cancelled) return;

        setCapacityOverlaps(capacitySnapshot.overlaps as OverlapRow[]);
        setCapacityAllowed(capacitySnapshot.allowed);
        setMaxSimultaneous(capacitySnapshot.maxSimultaneous);
        setCapacityWarning(
          capacitySnapshot.allowed
            ? null
            : `Khung giờ này đã có ${capacitySnapshot.overlapCount} khách trong lịch hẹn. Tối đa cho phép là ${capacitySnapshot.maxSimultaneous}. Hãy chọn giờ khác trước khi chuyển lịch.`,
        );
      } catch (cause) {
        if (cancelled) return;
        setCapacityAllowed(false);
        setCapacityWarning(cause instanceof Error ? cause.message : "Không kiểm tra được sức chứa khung giờ.");
      }
    }

    void runCapacityCheck();
    return () => {
      cancelled = true;
    };
  }, [bookingAt, selectedBookingRequest]);

  const selectBookingRequest = useCallback((bookingRequestId: string | null) => {
    setSelectedBookingId(bookingRequestId);
    setConfirmCancelId(null);
    const nextBookingRequest = bookingRequests.find((bookingRequest) => bookingRequest.id === bookingRequestId) ?? null;
    if (!nextBookingRequest) return;
    setBookingAt(toBookingDateTimeInputValue(new Date(nextBookingRequest.requested_start_at)));
  }, [bookingRequests]);

  const requestCancelBooking = useCallback(async (bookingRequestId: string) => {
    if (confirmCancelId !== bookingRequestId) {
      setConfirmCancelId(bookingRequestId);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setConfirmCancelId(null);
      await updateBookingRequestStatus(bookingRequestId, "CANCELLED");
      if (selectedBookingId === bookingRequestId) setSelectedBookingId(null);
      await refresh({ silent: true, force: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hủy yêu cầu đặt lịch thất bại");
    } finally {
      setSubmitting(false);
    }
  }, [confirmCancelId, refresh, selectedBookingId]);

  const deleteBooking = useCallback(async (bookingRequestId: string) => {
    if (!window.confirm("Xóa vĩnh viễn yêu cầu đặt lịch này?")) return;

    try {
      setSubmitting(true);
      setError(null);
      await deleteBookingRequest(bookingRequestId);
      if (selectedBookingId === bookingRequestId) setSelectedBookingId(null);
      await refresh({ silent: true, force: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Xóa yêu cầu đặt lịch thất bại");
    } finally {
      setSubmitting(false);
    }
  }, [refresh, selectedBookingId]);

  const convertBooking = useCallback(async () => {
    if (!selectedBookingRequest) return;
    if (!capacityAllowed) {
      setError(capacityWarning || "Khung giờ đang vượt số lượng khách cho phép.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const startAt = new Date(bookingAt);
      await convertBookingRequestToAppointment({
        bookingRequestId: selectedBookingRequest.id,
        staffUserId: staffUserId || null,
        resourceId: resourceId || null,
        startAt: startAt.toISOString(),
        endAt: addBookingMinutes(startAt, 60).toISOString(),
      });

      setSelectedBookingId(null);
      setStaffUserId("");
      setResourceId("");
      setBookingAt("");
      setCapacityWarning(null);
      setCapacityOverlaps([]);
      await refresh({ silent: true, force: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Chuyển yêu cầu đặt lịch sang lịch hẹn thất bại");
    } finally {
      setSubmitting(false);
    }
  }, [bookingAt, capacityAllowed, capacityWarning, refresh, resourceId, selectedBookingRequest, staffUserId]);

  const canHandleBookingRequest =
    role === "OWNER" || role === "PARTNER" || role === "MANAGER" || role === "RECEPTION" || role === "TECH";

  return {
    bookingRequests,
    newBookingRequests,
    rescheduleBookingRequests,
    newQueueItems,
    rescheduleQueueItems,
    selectedBookingRequest,
    selectedBooking,
    selectedCustomerCrm,
    compactHeader: refreshing ? "Đang làm mới..." : `${bookingRequests.length} yêu cầu`,
    selectionMeta: selectedBooking ? `${selectedBooking.customerName} · ${selectedBooking.statusLabel}` : "Chọn yêu cầu để xử lý",
    canHandleBookingRequest,
    loading,
    refreshing,
    submitting,
    error,
    role,
    staffOptions,
    resourceOptions,
    staffUserId,
    resourceId,
    bookingAt,
    confirmCancelId,
    capacity: {
      warning: capacityWarning,
      overlaps: capacityOverlaps,
      allowed: capacityAllowed,
      maxSimultaneous,
    },
    overlapSummaries,
    selectBookingRequest,
    setStaffUserId,
    setResourceId,
    setBookingAt,
    dismissCancelConfirmation: () => setConfirmCancelId(null),
    requestCancelBooking,
    deleteBooking,
    convertBooking,
    refresh,
  };
}
