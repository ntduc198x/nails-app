const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const telegramInternalRouteSecret = process.env.TELEGRAM_INTERNAL_ROUTE_SECRET;

function isPrivateIpv4(hostname: string) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local") ||
    isPrivateIpv4(normalized)
  );
}

function readRequestHostname(req: Request) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    return forwardedHost.split(":")[0] ?? "";
  }

  try {
    return new URL(req.url).hostname;
  } catch {
    return "";
  }
}

function isExplicitLocalDevelopment(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }

  const hostname = readRequestHostname(req);
  return Boolean(hostname && isLocalHostname(hostname));
}

function missingSecretResult(secretName: string, req: Request) {
  if (isExplicitLocalDevelopment(req)) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    status: 500,
    error: `${secretName} is required outside explicit local development.`,
  };
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export function verifyTelegramWebhookRequest(req: Request) {
  if (!telegramWebhookSecret) {
    return missingSecretResult("TELEGRAM_WEBHOOK_SECRET", req);
  }

  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!incomingSecret || !safeEqual(incomingSecret, telegramWebhookSecret)) {
    return { ok: false, status: 401, error: "Invalid Telegram webhook secret." };
  }

  return { ok: true };
}

export function verifyTelegramInternalRequest(req: Request) {
  if (!telegramInternalRouteSecret) {
    return missingSecretResult("TELEGRAM_INTERNAL_ROUTE_SECRET", req);
  }

  const headerSecret = req.headers.get("x-telegram-internal-secret");
  const authHeader = req.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const incomingSecret = headerSecret ?? bearerSecret;

  if (!incomingSecret || !safeEqual(incomingSecret, telegramInternalRouteSecret)) {
    return { ok: false, status: 401, error: "Invalid internal Telegram route secret." };
  }

  return { ok: true };
}

export function isTelegramWebhookSecretConfigured() {
  return Boolean(telegramWebhookSecret);
}

export function getTelegramWebhookSecret() {
  return telegramWebhookSecret;
}
