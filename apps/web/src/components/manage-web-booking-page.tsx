"use client";

import { AppShell } from "@/components/app-shell";
import { ManageAppointmentsModeTabs } from "@/components/manage-appointments-mode-tabs";
import {
  LightweightBookingDateTimeField,
  QueueCard,
  QueueModeButton,
  toQueueCardCrmSummary,
} from "@/components/manage-web-booking-controls";
import { MobileCollapsible, MobileSectionHeader } from "@/components/manage-mobile";
import { ManageQuickNav, operationsQuickNav } from "@/components/manage-quick-nav";
import { useManageBookingRequests } from "@/hooks/use-manage-booking-requests";
import { formatBookingShortDateTime } from "@/lib/booking-requests/view-models";
import { getRoleLabel } from "@/lib/role-labels";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type QueueMode = "new" | "reschedule" | "all";

function formatCompactDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ManageWebBookingPage() {
  const activeTab = "web-booking" as const;
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailRef = useRef<HTMLDivElement | null>(null);
  const deepLinkHandledRef = useRef<string | null>(null);
  const [mobileInboxOpen, setMobileInboxOpen] = useState(() => !searchParams.get("bookingRequestId"));
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
    refreshing,
    submitting,
    error,
    role,
    staffOptions,
    resourceOptions,
    staffUserId,
    resourceId,
    bookingAt,
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
    refresh,
  } = useManageBookingRequests();
  const bookingRequestIdParam = searchParams.get("bookingRequestId");
  const queueParam = searchParams.get("queue");
  const queueMode: QueueMode = queueParam === "new" || queueParam === "reschedule" || queueParam === "all" ? queueParam : "all";

  const allQueueItems = useMemo(() => [...newQueueItems, ...rescheduleQueueItems], [newQueueItems, rescheduleQueueItems]);
  const visibleQueueItems = useMemo(() => {
    if (queueMode === "new") return newQueueItems;
    if (queueMode === "reschedule") return rescheduleQueueItems;
    return allQueueItems;
  }, [allQueueItems, newQueueItems, queueMode, rescheduleQueueItems]);
  const totalPending = newBookingRequests.length + rescheduleBookingRequests.length;

  const replacePageUrl = useCallback((nextBookingRequestId: string | null, nextQueueMode: QueueMode) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextBookingRequestId) params.set("bookingRequestId", nextBookingRequestId);
    else params.delete("bookingRequestId");

    if (nextQueueMode === "all") params.delete("queue");
    else params.set("queue", nextQueueMode);

    const query = params.toString();
    router.replace(query ? `/manage/appointments/web-booking?${query}` : "/manage/appointments/web-booking", { scroll: false });
  }, [router, searchParams]);

  const inferQueueMode = useCallback((bookingRequestId: string): QueueMode => {
    if (newQueueItems.some((item) => item.id === bookingRequestId)) return "new";
    if (rescheduleQueueItems.some((item) => item.id === bookingRequestId)) return "reschedule";
    return "all";
  }, [newQueueItems, rescheduleQueueItems]);

  const handleSelectBookingRequest = useCallback((bookingRequestId: string | null) => {
    const nextQueueMode = bookingRequestId ? inferQueueMode(bookingRequestId) : queueMode;
    selectBookingRequest(bookingRequestId);
    setMobileInboxOpen(!bookingRequestId);
    replacePageUrl(bookingRequestId, bookingRequestId ? nextQueueMode : queueMode);
  }, [inferQueueMode, queueMode, replacePageUrl, selectBookingRequest]);

  useEffect(() => {
    if (!selectedBookingRequest) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const detailNode = detailRef.current;
        if (!detailNode) return;

        detailNode.focus({ preventScroll: true });

        if (!window.matchMedia("(max-width: 767px)").matches) return;

        const rect = detailNode.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const topOffset = 88;
        const targetTop = Math.max(window.scrollY + rect.top - topOffset, 0);
        const distance = Math.abs(targetTop - window.scrollY);
        const alreadyVisible = rect.top >= topOffset && rect.bottom <= viewportHeight;
        if (alreadyVisible || distance < 24) return;

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({
          top: targetTop,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      });
    });
  }, [selectedBookingRequest]);

  useEffect(() => {
    if (!bookingRequestIdParam) {
      deepLinkHandledRef.current = null;
      return;
    }
    if (loading) return;

    const exists = allQueueItems.some((item) => item.id === bookingRequestIdParam);
    if (!exists) return;
    if (deepLinkHandledRef.current === bookingRequestIdParam && selectedBookingRequest?.id === bookingRequestIdParam) return;

    deepLinkHandledRef.current = bookingRequestIdParam;
    handleSelectBookingRequest(bookingRequestIdParam);
  }, [allQueueItems, bookingRequestIdParam, handleSelectBookingRequest, loading, selectedBookingRequest?.id]);

  function renderQueueList(queueItemPrefix: string) {
    if (loading) {
      return (
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          Đang tải booking từ web...
        </div>
      );
    }

    if (visibleQueueItems.length === 0) {
      return (
        <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">
          Không có yêu cầu nào trong nhóm hiện tại.
        </div>
      );
    }

    return visibleQueueItems.map((item) => (
      <QueueCard
        key={`${queueItemPrefix}-${item.id}`}
        active={selectedBookingRequest?.id === item.id}
        customerName={item.customerName}
        customerPhone={item.customerPhone}
        requestedServiceLabel={item.requestedServiceLabel}
        requestedStartLabel={item.requestedStartLabel}
        sourceLabel={item.sourceLabel}
        statusLabel={item.statusLabel}
        statusClassName={item.statusClassName}
        crmSummary={toQueueCardCrmSummary(item.crm)}
        onClick={() => handleSelectBookingRequest(item.id)}
      />
    ));
  }

  return (
    <AppShell>
      <div className="space-y-4 pb-20 md:space-y-5 md:pb-0">
        <ManageQuickNav items={operationsQuickNav("/manage/appointments")} />

        <MobileSectionHeader
          title="Điều phối lịch"
          meta={<div className="manage-info-box px-3 py-2 text-xs md:px-4 md:py-3 md:text-sm">{refreshing ? "Đang làm mới..." : compactHeader}</div>}
        />

        <ManageAppointmentsModeTabs
          activeTab={activeTab}
          calendarHref="/manage/appointments"
          webBookingHref="/manage/appointments/web-booking"
        />

        {error ? <div className="manage-error-box">{error}</div> : null}

        <section className="manage-surface p-3.5 md:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-neutral-900 md:text-lg">Inbox booking</h2>
                {role ? (
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-600">
                    {getRoleLabel(role)}
                  </span>
                ) : null}
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-semibold text-neutral-700">
                  {totalPending} yêu cầu
                </span>
              </div>
              <p className="max-w-3xl text-xs leading-5 text-neutral-500 md:text-sm">
                Trên mobile, khi đã chọn booking thì phần inbox sẽ thu gọn để bạn xử lý trong khoảng 1 đến 1.5 màn hình.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void refresh({ silent: true, force: true })}
              disabled={loading || refreshing}
              className="cursor-pointer rounded-2xl border border-neutral-300 bg-white px-3.5 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? "Đang tải..." : "Làm mới"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[0.82fr_1.18fr] xl:items-start">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3">
                <QueueModeButton
                  active={queueMode === "all"}
                  label="Tất cả"
                  count={allQueueItems.length}
                  onClick={() => {
                    setMobileInboxOpen(true);
                    replacePageUrl(selectedBookingRequest?.id ?? bookingRequestIdParam, "all");
                  }}
                />
                <QueueModeButton
                  active={queueMode === "new"}
                  label="Booking mới"
                  count={newQueueItems.length}
                  onClick={() => {
                    setMobileInboxOpen(true);
                    replacePageUrl(selectedBookingRequest?.id ?? bookingRequestIdParam, "new");
                  }}
                />
                <QueueModeButton
                  active={queueMode === "reschedule"}
                  label="Cần dời lịch"
                  count={rescheduleQueueItems.length}
                  tone="warning"
                  onClick={() => {
                    setMobileInboxOpen(true);
                    replacePageUrl(selectedBookingRequest?.id ?? bookingRequestIdParam, "reschedule");
                  }}
                />
              </div>

              <MobileCollapsible
                open={mobileInboxOpen}
                onToggle={setMobileInboxOpen}
                summary={
                  <div className="flex items-center justify-between gap-3 pr-2">
                    <span>{selectedBookingRequest ? "Đổi booking khác" : "Danh sách booking"}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-700">{visibleQueueItems.length}</span>
                  </div>
                }
              >
                <div className="space-y-2.5">
                  {renderQueueList("mobile")}
                </div>
              </MobileCollapsible>

              <div className="hidden space-y-2.5 xl:max-h-[calc(100vh-19rem)] xl:overflow-y-auto xl:pr-1 md:block">
                {renderQueueList("desktop")}
              </div>
            </div>

            <div ref={detailRef} tabIndex={-1} className="scroll-mt-24 outline-none xl:sticky xl:top-24">
              <div className="manage-surface manage-surface--flat space-y-3 p-3.5 md:p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="manage-stat-label">Inspector</p>
                    <h3 className="mt-1 text-base font-semibold text-neutral-900 md:text-lg">
                      {selectedBooking ? selectedBooking.customerName : "Chọn một booking để xử lý"}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-500 md:text-sm">
                      {selectedBooking ? `${selectedBooking.statusLabel} · ${selectedBooking.sourceLabel}` : "Chưa có yêu cầu nào được chọn."}
                    </p>
                  </div>

                  {selectedBooking ? (
                    <button
                      type="button"
                      onClick={() => handleSelectBookingRequest(null)}
                      className="cursor-pointer rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                    >
                      Bỏ chọn
                    </button>
                  ) : null}
                </div>

                {!selectedBookingRequest || !selectedBooking ? (
                  <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-5 py-8 text-center text-sm text-neutral-500">
                    Chọn booking ở cột trái để xem thông tin khách, CRM, khung giờ và thao tác chuyển thành lịch hẹn.
                  </div>
                ) : (
                  <>
                    <div className={`rounded-3xl border p-3.5 ${selectedBooking.status === "NEEDS_RESCHEDULE" ? "border-amber-200 bg-amber-50" : "border-neutral-200 bg-neutral-50"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-neutral-900 md:text-base">{selectedBooking.customerName}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${selectedBooking.statusClassName}`}>{selectedBooking.statusLabel}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold tracking-[0.02em] text-emerald-800">{selectedBooking.customerPhone}</span>
                            <span>•</span>
                            <span>{selectedBooking.sourceLabel}</span>
                            <span>•</span>
                            <span>Tạo lúc {formatCompactDate(selectedBookingRequest.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/80 bg-white px-3 py-2.5">
                          <p className="manage-stat-label">Giờ khách chọn</p>
                          <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedBooking.requestedTimeLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white px-3 py-2.5">
                          <p className="manage-stat-label">Dịch vụ</p>
                          <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedBooking.requestedServiceLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white px-3 py-2.5">
                          <p className="manage-stat-label">Nhân sự mong muốn</p>
                          <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedBookingRequest.preferred_staff || "Không yêu cầu"}</p>
                        </div>
                        <div className="rounded-2xl border border-white/80 bg-white px-3 py-2.5">
                          <p className="manage-stat-label">Ghi chú</p>
                          <p className="mt-1 text-sm font-semibold text-neutral-900">{selectedBookingRequest.note || "Không có ghi chú"}</p>
                        </div>
                      </div>
                    </div>

                    {selectedCustomerCrm ? (
                      <div className="rounded-3xl border border-violet-200 bg-violet-50 p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800">CRM</span>
                          <span className="text-sm font-semibold text-violet-950">{selectedCustomerCrm.customer_status}</span>
                          <span className="text-sm text-violet-900">• {selectedCustomerCrm.total_visits} lượt</span>
                          <span className="text-sm text-violet-900">• {selectedCustomerCrm.total_spend.toLocaleString("vi-VN")} VND</span>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl bg-white/80 px-3 py-2.5 text-sm text-violet-950">
                            <p className="manage-stat-label">Lần gần nhất</p>
                            <p className="mt-1 font-semibold text-neutral-900">{formatBookingShortDateTime(selectedCustomerCrm.last_visit_at)}</p>
                          </div>
                          <div className="rounded-2xl bg-white/80 px-3 py-2.5 text-sm text-violet-950">
                            <p className="manage-stat-label">Dịch vụ gần nhất</p>
                            <p className="mt-1 font-semibold text-neutral-900">{selectedCustomerCrm.last_service_summary || "Chưa có dữ liệu"}</p>
                          </div>
                        </div>
                        {selectedCustomerCrm.care_note ? (
                          <div className="mt-2 rounded-2xl bg-white/80 px-3 py-2.5 text-sm text-neutral-700">
                            {selectedCustomerCrm.care_note}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-3xl border border-neutral-200 bg-white p-3.5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <LightweightBookingDateTimeField value={bookingAt} onChange={setBookingAt} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Thợ phụ trách</label>
                          <select
                            value={staffUserId}
                            onChange={(event) => setStaffUserId(event.target.value)}
                            className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
                          >
                            <option value="">Không gán thợ</option>
                            {staffOptions.map((option) => (
                              <option key={option.userId} value={option.userId}>{option.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Ghế / bàn</label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setResourceId("")}
                              className={`cursor-pointer rounded-2xl border px-3 py-1.5 text-sm font-medium transition ${
                                resourceId === "" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                              }`}
                            >
                              Không gán ghế
                            </button>
                            {resourceOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setResourceId(option.id)}
                                className={`cursor-pointer rounded-2xl border px-3 py-1.5 text-sm font-medium transition ${
                                  resourceId === option.id ? "border-rose-300 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                                }`}
                              >
                                {option.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {capacity.warning ? (
                      <div className="rounded-3xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                        <p className="font-semibold">Khung giờ vượt giới hạn</p>
                        <p className="mt-1">{capacity.warning}</p>
                        {overlapSummaries.length > 0 ? (
                          <div className="mt-3 space-y-1 text-xs">
                            {overlapSummaries.map((item) => (
                              <p key={item.id}>• {item.label}</p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700">
                        Khung giờ hiện tại hợp lệ để tạo lịch hẹn.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-3">
                      {selectedBookingRequest.status !== "CONVERTED" && selectedBookingRequest.status !== "CANCELLED" ? (
                        <button
                          type="button"
                          onClick={() => void convertBooking()}
                          disabled={submitting || !bookingAt || !!capacity.warning || !canHandleBookingRequest}
                          className="cursor-pointer rounded-2xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-[var(--color-primary)]/20 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ? "Đang xử lý..." : selectedBookingRequest.status === "NEEDS_RESCHEDULE" ? "Chốt giờ và tạo lịch" : "Tạo lịch hẹn"}
                        </button>
                      ) : null}

                      {selectedBookingRequest.status !== "CANCELLED" && selectedBookingRequest.status !== "CONVERTED" ? (
                        <>
                          {confirmCancelId === selectedBookingRequest.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void requestCancelBooking(selectedBookingRequest.id)}
                                disabled={submitting}
                                className="cursor-pointer rounded-2xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Xác nhận hủy
                              </button>
                              <button
                                type="button"
                                onClick={dismissCancelConfirmation}
                                disabled={submitting}
                                className="cursor-pointer rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Không
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => void requestCancelBooking(selectedBookingRequest.id)}
                                disabled={submitting}
                                className="cursor-pointer rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Hủy request
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteBooking(selectedBookingRequest.id)}
                                disabled={submitting}
                                className="cursor-pointer rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Xóa vĩnh viễn
                              </button>
                            </>
                          )}
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
