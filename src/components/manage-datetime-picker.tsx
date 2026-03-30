"use client";

import { useMemo, useState } from "react";

const MONTHS_VI = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const WEEKDAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const QUICK_DATES = [
  { label: "Hôm nay", offset: 0 },
  { label: "Ngày mai", offset: 1 },
  { label: "Mốt", offset: 2 },
  { label: "3 ngày", offset: 3 },
  { label: "1 tuần", offset: 7 },
  { label: "2 tuần", offset: 14 },
];
const TIME_SLOTS = Array.from({ length: 25 }, (_, index) => {
  if (index === 24) return "21:00";
  const hour = 9 + Math.floor(index / 2);
  const minute = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minute}`;
});

function sameDay(a: Date | null, b: Date | null) {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function getRelativeDay(date: Date, today: Date) {
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hôm nay";
  if (diff === 1) return "Ngày mai";
  if (diff === 2) return "Mốt";
  return WEEKDAYS_VI[date.getDay()];
}

export function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateTimeLocal(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function ManageDateTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (nextValue: string) => void;
}) {
  const todayDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const initial = parseDateTimeLocal(value) ?? new Date();
  const [selectedDate, setSelectedDate] = useState<Date | null>(parseDateTimeLocal(value));
  const [selectedTime, setSelectedTime] = useState<string | null>(parseDateTimeLocal(value)
    ? `${String(initial.getHours()).padStart(2, "0")}:${String(initial.getMinutes()).padStart(2, "0")}`
    : null);
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Array<{ label: number; current: boolean; date?: Date }> = [];

    for (let i = firstDay - 1; i >= 0; i--) cells.push({ label: daysInPrevMonth - i, current: false });
    for (let day = 1; day <= daysInMonth; day++) cells.push({ label: day, current: true, date: new Date(viewYear, viewMonth, day) });

    const remain = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remain; day++) cells.push({ label: day, current: false });
    return cells;
  }, [viewMonth, viewYear]);

  const closeAll = () => {
    setDateOpen(false);
    setTimeOpen(false);
  };

  const emit = (date: Date | null, time: string | null) => {
    if (!date || !time) return;
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date(date);
    next.setHours(hours, minutes, 0, 0);
    onChange(toDateTimeLocalValue(next));
  };

  const pickDate = (date: Date) => {
    setSelectedDate(date);
    setViewMonth(date.getMonth());
    setViewYear(date.getFullYear());
    setDateOpen(false);
    emit(date, selectedTime);
  };

  const pickTime = (time: string) => {
    setSelectedTime(time);
    setTimeOpen(false);
    emit(selectedDate, time);
  };

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
      return;
    }
    setViewMonth((prev) => prev - 1);
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
      return;
    }
    setViewMonth((prev) => prev + 1);
  };

  return (
    <div className="manage-picker-block">
      {(dateOpen || timeOpen) && <div className="pk-overlay show" onClick={closeAll} />}
      <label className="block text-sm">
        <span className="mb-1 block text-neutral-600">{label}</span>

        <div className="pk-group pk-date-group">
          <button type="button" className={`pk-trigger manage-pk-trigger ${dateOpen ? "active" : ""}`} onClick={() => { setTimeOpen(false); setDateOpen((prev) => !prev); }}>
            <div className="pk-trigger-left">
              <span className="pk-trigger-icon">📅</span>
              <div className="pk-trigger-text">
                {!selectedDate ? (
                  <span className="pk-placeholder">Chọn ngày...</span>
                ) : (
                  <span className="pk-value">
                    {formatDate(selectedDate)}
                    <span className="pk-tag">{getRelativeDay(selectedDate, todayDate)}</span>
                  </span>
                )}
              </div>
            </div>
            <span className="pk-arrow">⌄</span>
          </button>
          <div className={`pk-dropdown ${dateOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="pk-cal-header">
              <button type="button" className="pk-cal-nav" onClick={goPrevMonth}>‹</button>
              <span className="pk-cal-title">{MONTHS_VI[viewMonth]} {viewYear}</span>
              <div className="pk-cal-navs">
                <button type="button" className="pk-cal-nav pk-cal-today-btn" onClick={() => pickDate(new Date(todayDate))}>Hôm nay</button>
                <button type="button" className="pk-cal-nav" onClick={goNextMonth}>›</button>
              </div>
            </div>
            <div className="pk-cal-weekdays">
              {WEEKDAYS_VI.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="pk-cal-days">
              {calendarCells.map((cell, index) => {
                const isToday = sameDay(cell.date ?? null, todayDate);
                const isSelected = sameDay(cell.date ?? null, selectedDate);
                return (
                  <button
                    key={`${cell.label}-${index}`}
                    type="button"
                    className={`pk-cal-day ${!cell.current ? "other" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`.trim()}
                    disabled={!cell.current}
                    onClick={() => cell.date && pickDate(cell.date)}
                  >
                    {cell.label}
                  </button>
                );
              })}
            </div>
            <div className="pk-quick-dates">
              {QUICK_DATES.map((item) => {
                const quickDate = new Date(todayDate);
                quickDate.setDate(todayDate.getDate() + item.offset);
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`pk-qd-btn ${sameDay(selectedDate, quickDate) ? "active" : ""}`}
                    onClick={() => pickDate(quickDate)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="pk-group pk-time-group manage-pk-time-group">
          <button type="button" className={`pk-trigger manage-pk-trigger ${timeOpen ? "active" : ""}`} onClick={() => { setDateOpen(false); setTimeOpen((prev) => !prev); }}>
            <div className="pk-trigger-left">
              <span className="pk-trigger-icon">🕘</span>
              <div className="pk-trigger-text">
                {!selectedTime ? <span className="pk-placeholder">Chọn giờ...</span> : <span className="pk-value">{selectedTime}</span>}
              </div>
            </div>
            <span className="pk-arrow">⌄</span>
          </button>
          <div className={`pk-dropdown ${timeOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="pk-time-grid">
              {TIME_SLOTS.map((slot) => (
                <button key={slot} type="button" className={`pk-time-slot ${selectedTime === slot ? "selected" : ""}`} onClick={() => pickTime(slot)}>
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>
      </label>
    </div>
  );
}
