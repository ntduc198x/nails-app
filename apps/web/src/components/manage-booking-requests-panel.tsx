"use client";

import { ManageAlert } from "@/components/manage-alert";
import { MobileSectionHeader } from "@/components/manage-mobile";
import {
  BookingDetailPanel,
  BookingQueueSection,
  BookingRequestKpis,
} from "@/components/manage-booking-requests.sections";
import { useManageBookingRequests } from "@/hooks/use-manage-booking-requests";
import { useEffect, useRef } from "react";

export function ManageBookingRequestsPanel({
  title = "Booking services",
  showHeader = true,
}: {
  title?: string;
  showHeader?: boolean;
}) {
  const detailRef = useRef<HTMLDivElement | null>(null);
  const {
    newBookingRequests,
    rescheduleBookingRequests,
    newQueueItems,
    rescheduleQueueItems,
    selectedBookingRequest,
    selectedBooking,
    selectedCustomerCrm,
    compactHeader,
    loading,
    error,
    role,
    staffOptions,
    resourceOptions,
    staffUserId,
    resourceId,
    bookingAt,
    submitting,
    canHandleBookingRequest,
    confirmCancelId,
    capacity,
    overlapSummaries,
    selectBookingRequest,
    setStaffUserId,
    setResourceId,
    setBookingAt,
    dismissCancelConfirmation,
    requestCancelBooking,
    deleteBooking,
    convertBooking,
  } = useManageBookingRequests();

  useEffect(() => {
    if (!selectedBookingRequest) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    requestAnimationFrame(() => {
      const detailNode = detailRef.current;
      if (!detailNode) return;

      const rect = detailNode.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const alreadyVisible = rect.top >= 72 && rect.top < viewportHeight;
      if (alreadyVisible) return;

      detailNode.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }, [selectedBookingRequest]);

  return (
    <div className="space-y-5">
      {showHeader ? (
        <MobileSectionHeader title={title} meta={<div className="manage-info-box">{compactHeader}</div>} />
      ) : null}

      {error ? <ManageAlert tone="error">{error}</ManageAlert> : null}

      <BookingRequestKpis
        newCount={newBookingRequests.length}
        rescheduleCount={rescheduleBookingRequests.length}
        onSelectFirstNew={() => selectBookingRequest(newBookingRequests[0]?.id ?? null)}
        onSelectFirstReschedule={() => selectBookingRequest(rescheduleBookingRequests[0]?.id ?? null)}
      />

      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <div className="grid gap-3 xl:grid-cols-2">
          <BookingQueueSection
            title="Booking mới"
            count={newBookingRequests.length}
            loading={loading}
            emptyMessage="Không có booking mới."
            bookingQueueItems={newQueueItems}
            selectedBookingId={selectedBookingRequest?.id ?? null}
            onSelectBooking={selectBookingRequest}
          />

          <BookingQueueSection
            title="Cần dời lịch"
            tone="warning"
            count={rescheduleBookingRequests.length}
            loading={loading}
            emptyMessage="Không có yêu cầu nào cần dời lịch."
            bookingQueueItems={rescheduleQueueItems}
            selectedBookingId={selectedBookingRequest?.id ?? null}
            onSelectBooking={selectBookingRequest}
          />
        </div>

        <div ref={detailRef}>
          <BookingDetailPanel
            role={role}
            selectedBookingRequest={selectedBookingRequest}
            selectedBooking={selectedBooking}
            selectedCustomerCrm={selectedCustomerCrm}
            bookingAt={bookingAt}
            onBookingAtChange={setBookingAt}
            staffOptions={staffOptions}
            staffUserId={staffUserId}
            onStaffUserIdChange={setStaffUserId}
            resourceOptions={resourceOptions}
            resourceId={resourceId}
            onResourceIdChange={setResourceId}
            capacityWarning={capacity.warning}
            overlapSummaries={overlapSummaries}
            maxSimultaneous={capacity.maxSimultaneous}
            submitting={submitting}
            canHandleBookingRequest={canHandleBookingRequest}
            confirmCancelId={confirmCancelId}
            onConvertBooking={convertBooking}
            onRequestCancelBooking={requestCancelBooking}
            onDeleteBooking={deleteBooking}
            onClose={() => selectBookingRequest(null)}
            onDismissCancelConfirmation={dismissCancelConfirmation}
          />
        </div>
      </div>
    </div>
  );
}
