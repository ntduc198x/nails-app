import { useMemo, useState } from "react";
import {
  createPublicBookingRequest,
  publicBookingInputSchema,
  type PublicBookingInput,
  type PublicBookingSubmissionResult,
} from "@nails/shared";
import { mobileEnv } from "@/src/lib/env";

export type GuestBookingFormValues = {
  customerName: string;
  customerPhone: string;
  requestedService: string;
  preferredStaff: string;
  note: string;
  selectedDate: string;
  selectedTime: string;
};

type GuestBookingFieldErrors = Partial<Record<keyof GuestBookingFormValues, string>>;

const DEFAULT_TIME_SLOTS = ["09:00", "10:30", "13:00", "15:00", "17:30", "19:00"];

function createDateOptions() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);

    return {
      value: [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-"),
      label: date.toLocaleDateString("vi-VN", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }),
    };
  });
}

function toIsoDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0, 0).toISOString();
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

export function useGuestBooking() {
  const dateOptions = useMemo(() => createDateOptions(), []);
  const [values, setValues] = useState<GuestBookingFormValues>({
    customerName: "",
    customerPhone: "",
    requestedService: "",
    preferredStaff: "",
    note: "",
    selectedDate: dateOptions[0]?.value ?? "",
    selectedTime: DEFAULT_TIME_SLOTS[0] ?? "",
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
    });
    setFieldErrors({});
    setSubmitError(null);
    setSuccessResult(null);
  }

  async function submit() {
    if (!mobileEnv.apiBaseUrl) {
      setSubmitError("Thieu EXPO_PUBLIC_API_BASE_URL de gui guest booking tren mobile.");
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setSubmitError(null);

    try {
      const payload: PublicBookingInput = {
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        requestedService: values.requestedService || undefined,
        preferredStaff: values.preferredStaff || undefined,
        note: values.note || undefined,
        requestedStartAt: toIsoDateTime(values.selectedDate, values.selectedTime),
        source: "mobile_guest",
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

      const result = await createPublicBookingRequest(parsed.data, {
        baseUrl: mobileEnv.apiBaseUrl,
      });

      setSuccessResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gui booking request that bai.";
      setFieldErrors(inferFieldErrors(message));
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
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
