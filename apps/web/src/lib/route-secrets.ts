const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const telegramInternalRouteSecret = process.env.TELEGRAM_INTERNAL_ROUTE_SECRET;

function isProductionLike() {
  return process.env.NODE_ENV === "production";
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
    if (isProductionLike()) {
      return { ok: false, status: 500, error: "TELEGRAM_WEBHOOK_SECRET is required in production." };
    }

    return { ok: true };
  }

  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!incomingSecret || !safeEqual(incomingSecret, telegramWebhookSecret)) {
    return { ok: false, status: 401, error: "Invalid Telegram webhook secret." };
  }

  return { ok: true };
}

export function verifyTelegramInternalRequest(req: Request) {
  if (!telegramInternalRouteSecret) {
    if (isProductionLike()) {
      return { ok: false, status: 500, error: "TELEGRAM_INTERNAL_ROUTE_SECRET is required in production." };
    }

    return { ok: true };
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
