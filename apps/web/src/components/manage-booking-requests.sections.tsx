"use client";

import { getRoleLabel } from "@/lib/role-labels";
import { ManageDateTimePicker } from "@/components/manage-datetime-picker";
import { MobileSectionHeader } from "@/components/manage-mobile";
import {
  formatBookingShortDateTime,
} from "@/lib/booking-requests/view-models";
import type {
  BookingRequestQueueItem,
  BookingRequestSelection,
  ResourceOption,
  StaffOption,
} from "@/lib/booking-requests/types";
import type { CustomerCrmSummary } from "@/lib/crm";
import type { AppRole } from "@/lib/auth";
import type { BookingRequestRow } from "@/lib/booking-requests";
import { memo, type ReactNode, type SelectHTMLAttributes } from "react";

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{children}</label>;
}

function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full cursor-pointer rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-base text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100 md:text-sm ${props.className ?? ""}`}
    />
  );
}

const QueueCard = memo(function QueueCard({
  bookingQueueItem,
  active,
  onClick,
}: {
  bookingQueueItem: BookingRequestQueueItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`booking-request-card w-full cursor-pointer rounded-2xl border px-3 py-3 text-left transition ${
        active ? "booking-request-card--active border-rose-300 bg-rose-50" : "border-neutral-200 bg-white hover:bg-neutral-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-neutral-900 md:text-base">{bookingQueueItem.customerName}</p>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${bookingQueueItem.statusClassName}`}>{bookingQueueItem.statusLabel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 md:text-xs">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-extrabold tracking-[0.02em] text-emerald-800 md:text-xs">
              {bookingQueueItem.customerPhone}
            </span>
            <span>•</span>
            <span>{bookingQueueItem.sourceLabel}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-1 text-[11px] text-neutral-600 md:text-xs">
        <p className="truncate">{bookingQueueItem.requestedStartLabel}</p>
        {bookingQueueItem.crm ? (
          <div className="booking-request-crm-card mt-1 rounded-2xl border border-violet-200 bg-violet-50 px-2.5 py-2 text-[11px] text-violet-900">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold">Khách cũ</span>
              <span>{bookingQueueItem.crm.total_visits} lượt</span>
              <span>•</span>
              <span>{bookingQueueItem.crm.customer_status}</span>
            </div>
            <div className="mt-1 text-violet-800">Lần gần nhất: {formatBookingShortDateTime(bookingQueueItem.crm.last_visit_at)}</div>
            {bookingQueueItem.crm.last_service_summary ? (
              <div className="mt-1 line-clamp-1 text-violet-800">Dịch vụ gần nhất: {bookingQueueItem.crm.last_service_summary}</div>
            ) : null}
          </div>
        ) : null}
        <p className="truncate">{bookingQueueItem.requestedServiceLabel}</p>
      </div>
    </button>
  );
});

export function BookingServicesPanelSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <MobileSectionHeader title={title} meta={<div className="manage-info-box">Đang tải...</div>} />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-[76px] rounded-2xl border border-neutral-200 bg-neutral-50" />
        <div className="h-[76px] rounded-2xl border border-amber-200 bg-amber-50" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="h-[320px] rounded-3xl border border-neutral-200 bg-white" />
          <div className="h-[320px] rounded-3xl border border-amber-200 bg-amber-50" />
        </div>
        <div className="h-[420px] rounded-3xl border border-neutral-200 bg-white" />
      </div>
    </div>
  );
}

export function BookingRequestKpis({
  newCount,
  rescheduleCount,
  onSelectFirstNew,
  onSelectFirstReschedule,
}: {
  newCount: number;
  rescheduleCount: number;
  onSelectFirstNew: () => void;
  onSelectFirstReschedule: () => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onSelectFirstNew}
        className="cursor-pointer rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left transition hover:bg-neutral-100"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-neutral-600">Booking mới</span>
          <span className="text-base font-semibold leading-none text-neutral-900">{newCount}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={onSelectFirstReschedule}
        className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-amber-700">Cần dời lịch</span>
          <span className="text-base font-semibold leading-none text-amber-900">{rescheduleCount}</span>
        </div>
      </button>
    </section>
  );
}

export function BookingQueueSection({
  title,
  tone = "default",
  count,
  loading,
  emptyMessage,
  bookingQueueItems,
  selectedBookingId,
  onSelectBooking,
}: {
  title: string;
  tone?: "default" | "warning";
  count: number;
  loading: boolean;
  emptyMessage: string;
  bookingQueueItems: BookingRequestQueueItem[];
  selectedBookingId: string | null;
  onSelectBooking: (bookingRequestId: string) => void;
}) {
  const cardClassName = tone === "warning"
    ? "manage-surface--flat h-full rounded-3xl border border-amber-200 bg-amber-50 p-3.5"
    : "manage-surface manage-surface--flat h-full p-3.5 md:p-4";
  const titleClassName = tone === "warning"
    ? "text-sm font-semibold text-amber-900 md:text-base"
    : "text-sm font-semibold text-neutral-900 md:text-base";
  const badgeClassName = tone === "warning"
    ? "rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900"
    : "rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700";
  const loadingClassName = tone === "warning" ? "text-sm text-amber-800/70" : "text-sm text-neutral-500";
  const emptyClassName = tone === "warning"
    ? "rounded-2xl border border-dashed border-amber-200 bg-white/70 px-4 py-5 text-center text-sm text-amber-800/70"
    : "rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500";

  return (
    <div className={cardClassName}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={titleClassName}>{title}</h3>
        <span className={badgeClassName}>{count}</span>
      </div>

      <div className="booking-request-scroll-list mt-3 space-y-2">
        {loading ? (
          <p className={loadingClassName}>Đang tải...</p>
        ) : bookingQueueItems.length === 0 ? (
          <div className={emptyClassName}>{emptyMessage}</div>
        ) : (
          bookingQueueItems.map((bookingQueueItem) => (
            <QueueCard
              key={bookingQueueItem.id}
              bookingQueueItem={bookingQueueItem}
              active={selectedBookingId === bookingQueueItem.id}
              onClick={() => onSelectBooking(bookingQueueItem.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function BookingCapacityWarning({
  bookingAt,
  capacityWarning,
  overlapSummaries,
  maxSimultaneous,
}: {
  bookingAt: string;
  capacityWarning: string | null;
  overlapSummaries: Array<{ id: string; label: string }>;
  maxSimultaneous: number;
}) {
  if (capacityWarning) {
    return (
      <div className="booking-request-capacity-box rounded-2xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 md:text-sm">
        <p className="font-semibold">Khung giờ vượt giới hạn</p>
        <p className="mt-1">{capacityWarning}</p>
        {overlapSummaries.length > 0 ? (
          <div className="mt-2 space-y-1 text-[11px] md:text-xs">
            {overlapSummaries.map((bookingOverlap) => (
              <p key={bookingOverlap.id}>• {bookingOverlap.label}</p>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-[11px] text-red-600 md:text-xs">Tối đa {maxSimultaneous} khách trong cùng khung giờ.</p>
      </div>
    );
  }

  if (!bookingAt) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-700 md:text-sm">
      Khung giờ hợp lệ để convert.
    </div>
  );
}

export function BookingDetailPanel({
  role,
  selectedBookingRequest,
  selectedBooking,
  selectedCustomerCrm,
  bookingAt,
  onBookingAtChange,
  staffOptions,
  staffUserId,
  onStaffUserIdChange,
  resourceOptions,
  resourceId,
  onResourceIdChange,
  capacityWarning,
  overlapSummaries,
  maxSimultaneous,
  submitting,
  canHandleBookingRequest,
  confirmCancelId,
  onConvertBooking,
  onRequestCancelBooking,
  onDeleteBooking,
  onClose,
  onDismissCancelConfirmation,
}: {
  role: AppRole | null;
  selectedBookingRequest: BookingRequestRow | null;
  selectedBooking: BookingRequestSelection | null;
  selectedCustomerCrm: CustomerCrmSummary | null;
  bookingAt: string;
  onBookingAtChange: (value: string) => void;
  staffOptions: StaffOption[];
  staffUserId: string;
  onStaffUserIdChange: (value: string) => void;
  resourceOptions: ResourceOption[];
  resourceId: string;
  onResourceIdChange: (value: string) => void;
  capacityWarning: string | null;
  overlapSummaries: Array<{ id: string; label: string }>;
  maxSimultaneous: number;
  submitting: boolean;
  canHandleBookingRequest: boolean;
  confirmCancelId: string | null;
  onConvertBooking: () => Promise<void>;
  onRequestCancelBooking: (bookingRequestId: string) => Promise<void>;
  onDeleteBooking: (bookingRequestId: string) => Promise<void>;
  onClose: () => void;
  onDismissCancelConfirmation: () => void;
}) {
  return (
    <div className="manage-surface manage-surface--flat space-y-2.5 p-3 md:p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 md:text-base">
            {selectedBooking ? `${selectedBooking.customerName} · ${selectedBooking.statusLabel}` : "Chọn yêu cầu để xử lý"}
          </h3>
        </div>
        {role ? (
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium text-neutral-600 md:px-3 md:text-[11px]">
            {getRoleLabel(role)}
          </span>
        ) : null}
      </div>

      {!selectedBookingRequest || !selectedBooking ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          Chọn một yêu cầu để bắt đầu xử lý.
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className={`booking-request-detail-card rounded-2xl border p-2.5 text-sm ${
              selectedBooking.status === "NEEDS_RESCHEDULE" ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900 md:text-base">{selectedBooking.customerName}</p>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selectedBooking.statusClassName}`}>
                    {selectedBooking.statusLabel}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500 md:text-xs">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-extrabold tracking-[0.02em] text-emerald-800 md:text-xs">
                    {selectedBooking.customerPhone}
                  </span>
                  <span>•</span>
                  <span>{selectedBooking.sourceLabel}</span>
                </div>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[0.35fr_0.65fr] gap-2">
              <div className="booking-request-detail-chip rounded-2xl bg-white px-3 py-2">
                <p className="manage-stat-label">Giờ yêu cầu</p>
                <p className="mt-1 text-xs font-medium text-neutral-900 md:text-sm">{selectedBooking.requestedTimeLabel}</p>
              </div>
              <div className="booking-request-detail-chip rounded-2xl bg-white px-3 py-2">
                <p className="manage-stat-label">Dịch vụ</p>
                <p className="mt-1 truncate text-xs font-medium text-neutral-900 md:text-sm">{selectedBooking.requestedServiceLabel}</p>
              </div>
            </div>

            {selectedCustomerCrm ? (
              <div className="booking-request-crm-card mt-2 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-950">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold">CRM</span>
                  <span className="font-semibold">{selectedCustomerCrm.customer_status}</span>
                  <span>•</span>
                  <span>{selectedCustomerCrm.total_visits} lượt</span>
                  <span>•</span>
                  <span>{selectedCustomerCrm.total_spend.toLocaleString("vi-VN")} VND</span>
                </div>
                <div className="mt-1 text-xs text-violet-900">Lần gần nhất: {formatBookingShortDateTime(selectedCustomerCrm.last_visit_at)}</div>
                {selectedCustomerCrm.last_service_summary ? (
                  <div className="mt-1 text-xs text-violet-900">Dịch vụ gần nhất: {selectedCustomerCrm.last_service_summary}</div>
                ) : null}
                {selectedCustomerCrm.care_note ? (
                  <div className="mt-1 text-xs text-violet-900">Ghi chú: {selectedCustomerCrm.care_note}</div>
                ) : null}
              </div>
            ) : null}

            {selectedBooking.status === "NEEDS_RESCHEDULE" ? (
              <p className={`mt-2 rounded-xl px-3 py-1.5 text-xs md:text-sm ${selectedBooking.isExpired ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
                {selectedBooking.isExpired
                  ? "Request này đã quá giờ so với thời gian khách chọn. Cần chốt lại giờ mới trước khi convert."
                  : "Request này đang trùng lịch hoặc vượt sức chứa khung giờ. Cần chọn giờ khác trước khi convert."}
              </p>
            ) : null}
          </div>

          <div className="booking-request-compact-datetime">
            <ManageDateTimePicker label="Thời gian chốt" value={bookingAt} onChange={onBookingAtChange} compact />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Chọn thợ</FieldLabel>
              <SelectInput value={staffUserId} onChange={(event) => onStaffUserIdChange(event.target.value)}>
                <option value="">Không gán thợ</option>
                {staffOptions.map((staffOption) => (
                  <option key={staffOption.userId} value={staffOption.userId}>{staffOption.name}</option>
                ))}
              </SelectInput>
            </div>
            <div>
              <FieldLabel>Chọn ghế</FieldLabel>
              <SelectInput value={resourceId} onChange={(event) => onResourceIdChange(event.target.value)}>
                <option value="">Không gán ghế</option>
                {resourceOptions.map((resourceOption) => (
                  <option key={resourceOption.id} value={resourceOption.id}>{resourceOption.name}</option>
                ))}
              </SelectInput>
            </div>
          </div>

          <BookingCapacityWarning
            bookingAt={bookingAt}
            capacityWarning={capacityWarning}
            overlapSummaries={overlapSummaries}
            maxSimultaneous={maxSimultaneous}
          />

          <div className="flex flex-wrap gap-1.5">
            {selectedBookingRequest.status !== "CONVERTED" && selectedBookingRequest.status !== "CANCELLED" ? (
              <button
                type="button"
                className="cursor-pointer rounded-2xl bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm ring-1 ring-[var(--color-primary)]/20 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm"
                disabled={submitting || !bookingAt || !!capacityWarning || !canHandleBookingRequest}
                onClick={() => void onConvertBooking()}
              >
                {submitting ? "Đang convert..." : selectedBookingRequest.status === "NEEDS_RESCHEDULE" ? "Chốt giờ & tạo lịch" : "Tạo lịch"}
              </button>
            ) : null}

            {selectedBookingRequest.status !== "CANCELLED" && selectedBookingRequest.status !== "CONVERTED" ? (
              <>
                {confirmCancelId === selectedBookingRequest.id ? (
                  <>
                    <button
                      type="button"
                      className="cursor-pointer rounded-2xl border border-red-600 bg-red-600 px-3 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm"
                      disabled={submitting}
                      onClick={() => void onRequestCancelBooking(selectedBookingRequest.id)}
                    >
                      Xác nhận
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm"
                      disabled={submitting}
                      onClick={onDismissCancelConfirmation}
                    >
                      Không
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cursor-pointer rounded-2xl border border-red-500 bg-red-100 px-3 py-2 text-xs font-bold text-red-800 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm"
                      disabled={submitting}
                      onClick={() => void onRequestCancelBooking(selectedBookingRequest.id)}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm"
                      disabled={submitting}
                      onClick={() => void onDeleteBooking(selectedBookingRequest.id)}
                    >
                      Xóa
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 md:px-3.5 md:py-2.5 md:text-sm"
                      disabled={submitting}
                      onClick={onClose}
                    >
                      Đóng
                    </button>
                  </>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
