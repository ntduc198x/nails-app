const DEFAULT_PUBLIC_APP_URL = "https://www.chambeauty.io.vn";
const PUBLIC_APP_URL_ENV_KEYS = [
  "APP_URL",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_BRANCH_URL",
  "VERCEL_URL",
] as const;

function isLocalLikeHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".trycloudflare.com")
  );
}

function canonicalizePublicAppUrl(url: URL) {
  const next = new URL(url.origin);

  // Keep Telegram links and webhooks on the canonical production host.
  if (next.hostname === "chambeauty.io.vn") {
    next.hostname = "www.chambeauty.io.vn";
  }

  return next;
}

function toAbsoluteOrigin(rawValue: string, fallbackOrigin: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const withProtocol =
    /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) || trimmed.startsWith("//")
      ? trimmed
      : `https://${trimmed}`;

  try {
    return canonicalizePublicAppUrl(new URL(withProtocol, fallbackOrigin)).origin;
  } catch {
    return null;
  }
}

function resolveRequestOrigin(req: Request) {
  const requestUrl = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  if (forwardedHost) {
    return `${forwardedProto || requestUrl.protocol.replace(":", "")}://${forwardedHost}`;
  }

  return requestUrl.origin;
}

export function resolvePublicAppBaseUrl(req?: Request) {
  const requestOrigin = req ? resolveRequestOrigin(req) : null;
  const requestBaseUrl = requestOrigin ? canonicalizePublicAppUrl(new URL(requestOrigin)) : null;
  const fallbackOrigin = requestBaseUrl?.origin || DEFAULT_PUBLIC_APP_URL;

  const envOrigin = PUBLIC_APP_URL_ENV_KEYS
    .map((key) => process.env[key])
    .find((value): value is string => Boolean(value?.trim()));
  const resolvedEnvOrigin = envOrigin ? toAbsoluteOrigin(envOrigin, fallbackOrigin) : null;

  if (requestBaseUrl && !isLocalLikeHost(requestBaseUrl.hostname)) {
    return requestBaseUrl.origin;
  }

  return resolvedEnvOrigin || requestBaseUrl?.origin || DEFAULT_PUBLIC_APP_URL;
}

function resolveBaseUrlInput(baseUrlOrReq?: string | Request) {
  if (!baseUrlOrReq) return resolvePublicAppBaseUrl();
  if (typeof baseUrlOrReq === "string") return toAbsoluteOrigin(baseUrlOrReq, DEFAULT_PUBLIC_APP_URL) || DEFAULT_PUBLIC_APP_URL;
  return resolvePublicAppBaseUrl(baseUrlOrReq);
}

export function buildManageWebBookingUrl(
  bookingId?: string | null,
  queue?: "new" | "reschedule" | "all",
  baseUrlOrReq?: string | Request,
) {
  const url = new URL("/manage/appointments/web-booking", resolveBaseUrlInput(baseUrlOrReq));
  if (bookingId) url.searchParams.set("bookingRequestId", bookingId);
  if (queue && queue !== "all") url.searchParams.set("queue", queue);
  return url.toString();
}

export function buildManageAppointmentsUrl(baseUrlOrReq?: string | Request) {
  return new URL("/manage/appointments", resolveBaseUrlInput(baseUrlOrReq)).toString();
}

export function buildManageCustomerUrl(customerId: string, baseUrlOrReq?: string | Request) {
  return new URL(`/manage/customers/${customerId}`, resolveBaseUrlInput(baseUrlOrReq)).toString();
}

export function buildManageShiftsUrl(baseUrlOrReq?: string | Request) {
  return new URL("/manage/shifts", resolveBaseUrlInput(baseUrlOrReq)).toString();
}
