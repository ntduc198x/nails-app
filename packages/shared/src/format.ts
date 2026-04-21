const DEFAULT_LOCALE = "vi-VN";
const DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

export function formatVnd(amount: number) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function formatViDateTime(value: string | Date) {
  return new Date(value).toLocaleString(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIMEZONE,
    hour12: false,
  });
}

export function formatViDate(value: string | Date) {
  return new Date(value).toLocaleDateString(DEFAULT_LOCALE, {
    timeZone: DEFAULT_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
