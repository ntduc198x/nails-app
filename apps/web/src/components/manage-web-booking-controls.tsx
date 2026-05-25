"use client";

import { formatBookingShortDateTime, toBookingDateTimeInputValue } from "@/lib/booking-requests/view-models";
import { useMemo } from "react";

const QUICK_DATE_OPTIONS = [
  { label: "Hôm nay", offset: 0 },
  { label: "Mai", offset: 1 },
  { label: "Mốt", offset: 2 },
  { label: "+3 ngày", offset: 3 },
];

const TIME_OPTIONS = Array.from({ length: 25 }, (_, index) => {
  if (index === 24) return "21:00";
  const hour = 9 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

type QueueCardCrmSummary = {
  status: string;
  visits: number;
  lastVisitAt: string | null;
  lastService: string | null;
};

function toDateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseBookingDateTime(value: string) {
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

export function LightweightBookingDateTimeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const selected = useMemo(() => parseBookingDateTime(value), [value]);
  const now = useMemo(() => new Date(), []);
  const selectedDateValue = selected ? toDateInputValue(selected) : "";
  const selectedTimeValue = selected
    ? `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`
    : "";

  const availableTimeOptions = useMemo(() => {
    if (!selectedDateValue) return TIME_OPTIONS;

    const today = toDateInputValue(now);
    if (selectedDateValue !== today) return TIME_OPTIONS;

    return TIME_OPTIONS.filter((slot) => {
      const [hours, minutes] = slot.split(":").map(Number);
      const candidate = new Date(now);
      candidate.setHours(hours, minutes, 0, 0);
      return candidate.getTime() > now.getTime();
    });
  }, [now, selectedDateValue]);

  function emit(nextDateValue: string, nextTimeValue: string) {
    if (!nextDateValue || !nextTimeValue) return;
    const [year, month, day] = nextDateValue.split("-").map(Number);
    const [hours, minutes] = nextTimeValue.split(":").map(Number);
    const next = new Date(year, month - 1, day, hours, minutes, 0, 0);
    if (Number.isNaN(next.getTime())) return;
    onChange(toBookingDateTimeInputValue(next));
  }

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Thời gian chốt</label>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DATE_OPTIONS.map((option) => {
          const date = new Date(now);
          date.setHours(0, 0, 0, 0);
          date.setDate(date.getDate() + option.offset);
          const dateValue = toDateInputValue(date);
          const active = selectedDateValue === dateValue;

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => emit(dateValue, selectedTimeValue || availableTimeOptions[0] || "09:00")}
              className={`cursor-pointer rounded-2xl border px-3 py-1.5 text-xs font-semibold transition ${
                active ? "border-rose-300 bg-rose-50 text-rose-700" : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1.1fr_0.9fr]">
        <input
          type="date"
          value={selectedDateValue}
          onChange={(event) => emit(event.target.value, selectedTimeValue || availableTimeOptions[0] || "09:00")}
          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
        />
        <select
          value={selectedTimeValue}
          onChange={(event) => emit(selectedDateValue, event.target.value)}
          className="w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100"
        >
          <option value="">Chọn giờ</option>
          {availableTimeOptions.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function QueueModeButton({
  active,
  label,
  count,
  tone = "default",
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone?: "default" | "warning";
  onClick: () => void;
}) {
  const activeClassName =
    tone === "warning"
      ? "border-amber-300 bg-amber-100 text-amber-900"
      : "border-neutral-900 bg-neutral-900 text-white";
  const idleClassName =
    tone === "warning"
      ? "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
      : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-2xl border px-4 py-3 text-left transition ${active ? activeClassName : idleClassName}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold">{count}</span>
      </div>
    </button>
  );
}

export function QueueCard({
  active,
  customerName,
  customerPhone,
  requestedServiceLabel,
  requestedStartLabel,
  sourceLabel,
  statusLabel,
  statusClassName,
  crmSummary,
  onClick,
}: {
  active: boolean;
  customerName: string;
  customerPhone: string;
  requestedServiceLabel: string;
  requestedStartLabel: string;
  sourceLabel: string;
  statusLabel: string;
  statusClassName: string;
  crmSummary: QueueCardCrmSummary | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full cursor-pointer rounded-3xl border p-4 text-left transition ${
        active ? "border-rose-300 bg-rose-50 shadow-sm" : "border-neutral-200 bg-white hover:bg-neutral-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-neutral-900 md:text-base">{customerName}</p>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClassName}`}>{statusLabel}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-bold tracking-[0.02em] text-emerald-800">{customerPhone}</span>
            <span>•</span>
            <span>{sourceLabel}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-xs text-neutral-600">
        <p>{requestedStartLabel}</p>
        <p className="line-clamp-1">{requestedServiceLabel}</p>
      </div>

      {crmSummary ? (
        <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-violet-950">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold">CRM</span>
            <span>{crmSummary.status}</span>
            <span>•</span>
            <span>{crmSummary.visits} lượt</span>
          </div>
          <div className="mt-1 text-violet-900">Lần gần nhất: {formatBookingShortDateTime(crmSummary.lastVisitAt)}</div>
          {crmSummary.lastService ? <div className="mt-1 line-clamp-1 text-violet-900">Dịch vụ: {crmSummary.lastService}</div> : null}
        </div>
      ) : null}
    </button>
  );
}

export function toQueueCardCrmSummary(
  crm: {
    customer_status: string;
    total_visits: number;
    last_visit_at: string | null;
    last_service_summary: string | null;
  } | null,
): QueueCardCrmSummary | null {
  if (!crm) return null;

  return {
    status: crm.customer_status,
    visits: crm.total_visits,
    lastVisitAt: crm.last_visit_at,
    lastService: crm.last_service_summary,
  };
}
