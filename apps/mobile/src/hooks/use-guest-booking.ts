import { useMemo, useState } from "react";
import {
  createPublicBookingRequest,
  createPublicBookingRequestForMobile,
  publicBookingInputSchema,
  type PublicBookingInput,
  type PublicBookingSubmissionResult,
} from "@nails/shared";
import { mobileEnv } from "@/src/lib/env";
import {
  prewarmCustomerHistoryCache,
  writeOptimisticBookingIntoCustomerHistoryCache,
} from "@/src/lib/customer-history-cache";
import {
  prewarmCustomerUpcomingBookingsCache,
  writeOptimisticBookingIntoUpcomingBookingsCache,
} from "@/src/lib/customer-upcoming-bookings-cache";
import { refreshCustomerBookingTimeline } from "@/src/lib/customer-booking-timeline-store";
import { mobileSupabase } from "@/src/lib/supabase";
import { useSession } from "@/src/providers/session-provider";

export type GuestBookingFormValues = {
  customerName: string;
  customerPhone: string;
  requestedService: string;
  preferredStaff: string;
  note: string;
  selectedDate: string;
  selectedTime: string;
  appliedOfferId: string;
  appliedOfferClaimId: string;
  appliedOfferCode: string;
};

type GuestBookingFieldErrors = Partial<Record<keyof GuestBookingFormValues, string>>;

const DEFAULT_TIME_SLOTS = Array.from({ length: 25 }, (_, index) => {
  if (index === 24) return "21:00";

  const hour = 9 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";

  return `${String(hour).padStart(2, "0")}:${minute}`;
});

function getDateLabel(date: Date, index: number) {
  if (index === 0) return "HÃ´m nay";
  if (index === 1) return "NgÃ y mai";

  return date.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function createDateOptions() {
  return Array.from({ length: 21 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);

    return {
      value: [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-"),
      label: getDateLabel(date, index),
    };
  });
}

function toIsoDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0).toISOString();
}

function normalizeBookingErrorMessage(message: string) {
  const normalized = message.trim();
  const lower = normalized.toLowerCase();

  if (
    lower.includes("customer_offer_claims") ||
    lower.includes("profiles") ||
    lower.includes("user_id_fkey")
  ) {
    return "Æ¯u Ä‘Ã£i nÃ y chÆ°a sáºµn sÃ ng Ä‘á»ƒ dÃ¹ng trÃªn tÃ i khoáº£n cá»§a báº¡n. Báº¡n vui lÃ²ng má»Ÿ Há»“ sÆ¡ kiá»ƒm tra láº¡i sá»‘ Ä‘iá»‡n thoáº¡i hoáº·c chá»n Æ°u Ä‘Ã£i khÃ¡c, bÃªn em sáº½ há»— trá»£ ngay náº¿u cáº§n.";
  }

  if (lower.includes("offer_already_used_or_reserved")) {
    return "Æ¯u Ä‘Ã£i nÃ y vá»«a Ä‘Æ°á»£c giá»¯ chá»— hoáº·c Ä‘Ã£ Ä‘Æ°á»£c sá»­ dá»¥ng rá»“i. Báº¡n vui lÃ²ng chá»n Æ°u Ä‘Ã£i khÃ¡c giÃºp em nhÃ©.";
  }

  if (lower.includes("offer_not_available")) {
    return "Æ¯u Ä‘Ã£i nÃ y hiá»‡n khÃ´ng cÃ²n kháº£ dá»¥ng ná»¯a. Báº¡n vui lÃ²ng chá»n Æ°u Ä‘Ã£i khÃ¡c giÃºp em nhÃ©.";
  }

  if (lower.includes("offer_requires_linked_customer")) {
    return "TÃ i khoáº£n cá»§a báº¡n chÆ°a liÃªn káº¿t Ä‘á»§ thÃ´ng tin thÃ nh viÃªn Ä‘á»ƒ dÃ¹ng Æ°u Ä‘Ã£i nÃ y. Vui lÃ²ng kiá»ƒm tra láº¡i há»“ sÆ¡ trÆ°á»›c khi Ä‘áº·t lá»‹ch.";
  }

  if (lower.includes("customer_name_required")) {
    return "Vui lÃ²ng nháº­p tÃªn khÃ¡ch hÃ ng.";
  }

  if (lower.includes("customer_phone_required")) {
    return "Vui lÃ²ng nháº­p sá»‘ Ä‘iá»‡n thoáº¡i.";
  }

  if (lower.includes("requested_start_required") || lower.includes("invalid_time_range")) {
    return "Vui lÃ²ng chá»n láº¡i ngÃ y giá» Ä‘áº·t lá»‹ch há»£p lá»‡.";
  }

  return normalized || "KhÃ´ng thá»ƒ gá»­i yÃªu cáº§u Ä‘áº·t lá»‹ch lÃºc nÃ y. Báº¡n vui lÃ²ng thá»­ láº¡i sau Ã­t phÃºt.";
}

function inferFieldErrors(message: string): GuestBookingFieldErrors {
  const lower = message.toLowerCase();
  if (lower.includes("ten")) return { customerName: message };
  if (lower.includes("dien thoai") || lower.includes("phone")) return { customerPhone: message };
  if (lower.includes("thoi gian") || lower.includes("requested_start_at")) {
    return { selectedDate: message, selectedTime: message };
  }
  return {};
}

function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "");
}

function isValidWorkingSlot(timeValue: string) {
  return DEFAULT_TIME_SLOTS.includes(timeValue);
}

function validateRequestedDateTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) {
    return "Vui lÃ²ng chá»n ngÃ y giá» Ä‘áº·t lá»‹ch há»£p lá»‡.";
  }

  if (!isValidWorkingSlot(timeValue)) {
    return "Khung giá» Ä‘Ã£ chá»n náº±m ngoÃ i giá» lÃ m viá»‡c cá»§a salon.";
  }

  const requestedAt = new Date(toIsoDateTime(dateValue, timeValue));
  if (Number.isNaN(requestedAt.getTime())) {
    return "NgÃ y giá» Ä‘áº·t lá»‹ch khÃ´ng há»£p lá»‡.";
  }

  const now = new Date();
  if (requestedAt.getTime() <= now.getTime()) {
    return "KhÃ´ng thá»ƒ Ä‘áº·t lá»‹ch á»Ÿ thá»i Ä‘iá»ƒm quÃ¡ khá»©.";
  }

  return null;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatBookingDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function useGuestBooking() {
  const { user } = useSession();
  const dateOptions = useMemo(() => createDateOptions(), []);
  const [values, setValues] = useState<GuestBookingFormValues>({
    customerName: "",
    customerPhone: "",
    requestedService: "",
    preferredStaff: "",
    note: "",
    selectedDate: dateOptions[0]?.value ?? "",
    selectedTime: DEFAULT_TIME_SLOTS[0] ?? "",
    appliedOfferId: "",
    appliedOfferClaimId: "",
    appliedOfferCode: "",
  });
  const [fieldErrors, setFieldErrors] = useState<GuestBookingFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<PublicBookingSubmissionResult | null>(null);

  function updateValue<Key extends keyof GuestBookingFormValues>(key: Key, value: GuestBookingFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setSubmitError(null);
  }

  function reset() {
    setValues({
      customerName: "",
      customerPhone: "",
      requestedService: "",
      preferredStaff: "",
      note: "",
      selectedDate: dateOptions[0]?.value ?? "",
      selectedTime: DEFAULT_TIME_SLOTS[0] ?? "",
      appliedOfferId: "",
      appliedOfferClaimId: "",
      appliedOfferCode: "",
    });
    setFieldErrors({});
    setSubmitError(null);
    setSuccessResult(null);
  }

  async function submit() {
    if (!mobileSupabase && !mobileEnv.apiBaseUrl) {
      setSubmitError("Thieu cau hinh ket noi booking tren mobile.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setSubmitError(null);

    try {
      const dateTimeError = validateRequestedDateTime(values.selectedDate, values.selectedTime);
      if (dateTimeError) {
        setFieldErrors({ selectedDate: dateTimeError, selectedTime: dateTimeError });
        setSubmitError(dateTimeError);
        return;
      }

      const requestedStartAtIso = toIsoDateTime(values.selectedDate, values.selectedTime);

      if (mobileSupabase && user?.id) {
        const accountResult = await mobileSupabase
          .from("customer_accounts")
          .select("org_id,customer_id")
          .eq("user_id", user.id)
          .maybeSingle();

        let linkedPhone = "";

        if (!accountResult.error && accountResult.data?.customer_id) {
          const customerResult = await mobileSupabase
            .from("customers")
            .select("phone")
            .eq("id", accountResult.data.customer_id)
            .eq("org_id", accountResult.data.org_id)
            .maybeSingle();

          if (!customerResult.error && typeof customerResult.data?.phone === "string") {
            linkedPhone = customerResult.data.phone.trim();
          }
        }

        if (!linkedPhone) {
          const {
            data: { user: authUser },
          } = await mobileSupabase.auth.getUser();
          if (typeof authUser?.user_metadata?.phone === "string" && authUser.user_metadata.phone.trim()) {
            linkedPhone = authUser.user_metadata.phone.trim();
          }
        }

        const typedPhone = normalizePhone(values.customerPhone);
        const canonicalPhone = normalizePhone(linkedPhone);
        if (canonicalPhone && typedPhone && canonicalPhone !== typedPhone) {
          const mismatchMessage = "Sá»‘ Ä‘iá»‡n thoáº¡i Ä‘áº·t lá»‹ch pháº£i khá»›p vá»›i sá»‘ trong tÃ i khoáº£n cÃ¡ nhÃ¢n.";
          setFieldErrors({ customerPhone: mismatchMessage });
          setSubmitError(mismatchMessage);
          return;
        }

        if (!accountResult.error && accountResult.data?.org_id && accountResult.data?.customer_id) {
          const requestedAt = new Date(requestedStartAtIso);
          const windowStart = new Date(requestedAt);
          windowStart.setDate(windowStart.getDate() - 3);
          const windowEnd = new Date(requestedAt);
          windowEnd.setDate(windowEnd.getDate() + 3);

          const { data: existingRows, error: existingError } = await mobileSupabase
            .from("booking_requests")
            .select("id,requested_start_at,status")
            .eq("org_id", accountResult.data.org_id)
            .eq("customer_id", accountResult.data.customer_id)
            .in("status", ["NEW", "CONFIRMED", "NEEDS_RESCHEDULE", "CONVERTED"])
            .gte("requested_start_at", windowStart.toISOString())
            .lte("requested_start_at", windowEnd.toISOString())
            .order("requested_start_at", { ascending: true });

          if (!existingError && Array.isArray(existingRows) && existingRows.length) {
            const conflict = existingRows.find((row) => {
              if (typeof row.requested_start_at !== "string") return false;
              const existingAt = new Date(row.requested_start_at);
              if (Number.isNaN(existingAt.getTime())) return false;
              const diffMinutes = Math.abs(existingAt.getTime() - requestedAt.getTime()) / (1000 * 60);
              return isSameCalendarDay(existingAt, requestedAt) || diffMinutes < 60;
            });

            if (conflict && typeof conflict.requested_start_at === "string") {
              const conflictMessage = `Báº¡n Ä‘Ã£ cÃ³ lá»‹ch Ä‘áº·t vÃ o ${formatBookingDateTime(conflict.requested_start_at)}. Náº¿u cáº§n Ä‘á»•i lá»‹ch, báº¡n vui lÃ²ng liÃªn há»‡ trá»±c tiáº¿p vá»›i tiá»‡m Ä‘á»ƒ Ä‘Æ°á»£c há»— trá»£ nhanh nháº¥t.`;
              setSubmitError(conflictMessage);
              return;
            }
          }
        }
      }

      const payload: PublicBookingInput = {
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        requestedService: values.requestedService || undefined,
        preferredStaff: values.preferredStaff || undefined,
        note: values.note || undefined,
        requestedStartAt: requestedStartAtIso,
        source: "mobile_guest",
        appliedOfferId: values.appliedOfferId || undefined,
        appliedOfferClaimId: values.appliedOfferClaimId || undefined,
        appliedOfferCode: values.appliedOfferCode || undefined,
      };

      const parsed = publicBookingInputSchema.safeParse(payload);
      if (!parsed.success) {
        const nextErrors: GuestBookingFieldErrors = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0];
          if (key === "customerName") nextErrors.customerName = issue.message;
          if (key === "customerPhone") nextErrors.customerPhone = issue.message;
          if (key === "requestedStartAt") {
            nextErrors.selectedDate = issue.message;
            nextErrors.selectedTime = issue.message;
          }
        }
        setFieldErrors(nextErrors);
        setSubmitError("Vui long kiem tra lai thong tin dat lich.");
        return;
      }

      const bookingApiBaseUrl = mobileEnv.webApiBaseUrl || mobileEnv.apiBaseUrl;
      let result;

      if (bookingApiBaseUrl) {
        try {
          result = await createPublicBookingRequest(parsed.data, {
            baseUrl: bookingApiBaseUrl,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const shouldFallbackToRpc = Boolean(mobileSupabase) && (
            message.startsWith("BOOKING_API_NON_JSON") ||
            message.includes("Failed to fetch") ||
            message.includes("Network request failed")
          );

          if (shouldFallbackToRpc && mobileSupabase) {
            result = await createPublicBookingRequestForMobile(mobileSupabase, parsed.data);
          } else {
            throw error;
          }
        }
      } else if (mobileSupabase) {
        result = await createPublicBookingRequestForMobile(mobileSupabase, parsed.data);
      } else {
        result = await createPublicBookingRequest(parsed.data);
      }

      setSuccessResult(result);
      setIsSubmitting(false);

      void (async () => {
        if (user?.id && result.bookingRequestId) {
          const hasAppliedOffer = Boolean(parsed.data.appliedOfferId || parsed.data.appliedOfferClaimId || parsed.data.appliedOfferCode);

          await writeOptimisticBookingIntoCustomerHistoryCache(user.id, {
            bookingRequestId: result.bookingRequestId,
            requestedService: parsed.data.requestedService ?? "",
            requestedStartAt: parsed.data.requestedStartAt,
            preferredStaff: parsed.data.preferredStaff ?? null,
          });
          await writeOptimisticBookingIntoUpcomingBookingsCache(user.id, {
            bookingRequestId: result.bookingRequestId,
            requestedService: parsed.data.requestedService ?? "",
            requestedStartAt: parsed.data.requestedStartAt,
            preferredStaff: parsed.data.preferredStaff ?? null,
          });

          await refreshCustomerBookingTimeline(
            {
              userId: user.id,
              historyLimit: 8,
              upcomingLimit: 6,
            },
            { silent: true },
          ).catch(() => {});

          if (mobileSupabase) {
            const supabase = mobileSupabase;
            setTimeout(() => {
              void (async () => {
                await Promise.all([
                  prewarmCustomerHistoryCache(supabase, user.id),
                  prewarmCustomerUpcomingBookingsCache(supabase, user.id),
                ]).catch(() => {});

                await refreshCustomerBookingTimeline(
                  {
                    userId: user.id,
                    historyLimit: 8,
                    upcomingLimit: 6,
                  },
                  { silent: true },
                ).catch(() => {});
              })();
            }, hasAppliedOffer ? 0 : 350);
          }
        }
      })().catch(() => {});
      return;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Gui booking request that bai.";
      const friendlyMessage = normalizeBookingErrorMessage(rawMessage);
      setFieldErrors(inferFieldErrors(friendlyMessage));
      setSubmitError(friendlyMessage);
      setIsSubmitting(false);
      return;
    }
  }

  return {
    dateOptions,
    fieldErrors,
    isSubmitting,
    reset,
    submit,
    submitError,
    successResult,
    timeSlots: DEFAULT_TIME_SLOTS,
    updateValue,
    values,
  };
}

