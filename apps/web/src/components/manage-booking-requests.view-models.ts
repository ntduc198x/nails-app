import type { CustomerCrmSummary } from "@/lib/crm";
import type { BookingRequestRow, BookingRequestStatus } from "@/lib/booking-requests";
import type {
  BookingRequestQueueItem,
  BookingRequestSelection,
  OverlapRow,
} from "@/components/manage-booking-requests.types";

export const BOOKING_REQUEST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const BOOKING_REQUEST_TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
});

export function toBookingDateTimeInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addBookingMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function getBookingRequestStatusTone(status: BookingRequestStatus, isExpired = false) {
  if (status === "NEW") return "bg-blue-100 text-blue-700";
  if (status === "NEEDS_RESCHEDULE" && isExpired) return "bg-red-100 text-red-700";
  if (status === "NEEDS_RESCHEDULE") return "bg-amber-100 text-amber-800";
  if (status === "CONFIRMED") return "bg-violet-100 text-violet-700";
  if (status === "CONVERTED") return "bg-emerald-100 text-emerald-700";
  return "bg-red-100 text-red-700";
}

export function getBookingRequestStatusLabel(status: BookingRequestStatus, isExpired = false) {
  if (status === "NEW") return "Mới";
  if (status === "NEEDS_RESCHEDULE" && isExpired) return "Quá giờ";
  if (status === "NEEDS_RESCHEDULE") return "Cần dời lịch";
  if (status === "CONFIRMED") return "Đã xác nhận";
  if (status === "CONVERTED") return "Đã chuyển";
  return "Đã hủy";
}

export function pickBookingOverlapCustomerName(customers: OverlapRow["customers"]) {
  if (Array.isArray(customers)) return customers[0]?.name ?? "Khách";
  return customers?.name ?? "Khách";
}

export function isExpiredBookingRequest(bookingRequest: BookingRequestRow) {
  return !!bookingRequest.requested_start_at && new Date(bookingRequest.requested_start_at).getTime() < Date.now();
}

export function normalizeBookingPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("84") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

export function formatBookingShortDateTime(value: string | null) {
  if (!value) return "-";
  return BOOKING_REQUEST_DATE_TIME_FORMATTER.format(new Date(value));
}

function getBookingSourceLabel(source: string | null | undefined) {
  return source === "landing_page" ? "Website" : source ?? "-";
}

export function buildBookingQueueItem(
  bookingRequest: BookingRequestRow,
  crm: CustomerCrmSummary | null,
): BookingRequestQueueItem {
  const isExpired = isExpiredBookingRequest(bookingRequest);
  return {
    id: bookingRequest.id,
    customerName: bookingRequest.customer_name,
    customerPhone: bookingRequest.customer_phone,
    sourceLabel: getBookingSourceLabel(bookingRequest.source),
    requestedServiceLabel: bookingRequest.requested_service ?? "Không rõ dịch vụ",
    requestedStartLabel: BOOKING_REQUEST_DATE_TIME_FORMATTER.format(new Date(bookingRequest.requested_start_at)),
    statusClassName: getBookingRequestStatusTone(bookingRequest.status, isExpired),
    statusLabel: getBookingRequestStatusLabel(bookingRequest.status, isExpired),
    crm,
  };
}

export function buildBookingSelection(bookingRequest: BookingRequestRow): BookingRequestSelection {
  const isExpired = isExpiredBookingRequest(bookingRequest);
  return {
    id: bookingRequest.id,
    customerName: bookingRequest.customer_name,
    customerPhone: bookingRequest.customer_phone,
    sourceLabel: getBookingSourceLabel(bookingRequest.source),
    requestedServiceLabel: bookingRequest.requested_service ?? "-",
    requestedTimeLabel: BOOKING_REQUEST_TIME_FORMATTER.format(new Date(bookingRequest.requested_start_at)),
    status: bookingRequest.status,
    statusClassName: getBookingRequestStatusTone(bookingRequest.status, isExpired),
    statusLabel: getBookingRequestStatusLabel(bookingRequest.status, isExpired),
    isExpired,
  };
}
