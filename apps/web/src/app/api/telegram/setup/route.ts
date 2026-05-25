import { NextResponse } from "next/server";
import {
  getTelegramWebhookSecret,
  isTelegramWebhookSecretConfigured,
  verifyTelegramInternalRequest,
} from "@/lib/route-secrets";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramWebhookSecret = getTelegramWebhookSecret();
const telegramCommands = [
  { command: "manage", description: "Mở menu quản trị" },
  { command: "booking", description: "Xem booking chờ xử lý" },
  { command: "ca", description: "Xem lịch làm việc hôm nay" },
  { command: "crm", description: "Mở menu CRM khách" },
  { command: "doanhthu", description: "Xem báo cáo doanh thu" },
  { command: "me", description: "Xem thông tin tài khoản liên kết" },
  { command: "link", description: "Liên kết tài khoản Telegram" },
] as const;
const telegramCommandsMenuButton = { type: "commands" } as const;

function resolveTelegramPublicBaseUrl(req: Request) {
  const requestUrl = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const envBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const requestOrigin = forwardedHost
    ? `${forwardedProto || requestUrl.protocol.replace(":", "")}://${forwardedHost}`
    : requestUrl.origin;
  const requestBaseUrl = new URL(requestOrigin);
  const fallbackOrigin = requestBaseUrl.origin;

  const isLocalLikeHost = (hostname: string) =>
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".trycloudflare.com");

  const envResolved = envBaseUrl ? new URL(envBaseUrl, fallbackOrigin) : null;
  const preferRequestOrigin = !isLocalLikeHost(requestBaseUrl.hostname);
  const candidate = preferRequestOrigin
    ? requestBaseUrl
    : envResolved && !isLocalLikeHost(envResolved.hostname)
      ? envResolved
      : requestBaseUrl;
  const resolved = new URL(candidate.origin, fallbackOrigin);

  // Telegram webhook should point to the canonical host to avoid 307 redirects.
  if (
    resolved.hostname === "chambeauty.io.vn" ||
    requestUrl.hostname === "www.chambeauty.io.vn"
  ) {
    resolved.hostname = "www.chambeauty.io.vn";
  }

  return resolved.origin;
}

export async function POST(req: Request) {
  const auth = verifyTelegramInternalRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!telegramBotToken) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const publicBaseUrl = resolveTelegramPublicBaseUrl(req);
  const webhookUrl = `${publicBaseUrl}/api/telegram/callback`;
  const isLocalhostBaseUrl = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(publicBaseUrl);
  const results: Record<string, unknown> = {};
  const errors: string[] = [];

  if (isLocalhostBaseUrl) {
    return NextResponse.json({
      ok: false,
      webhookUrl,
      publicBaseUrl,
      warning: "Telegram không thể gọi webhook vào localhost trực tiếp. Dùng route /api/telegram/dev để test local, hoặc expose localhost bằng tunnel như ngrok/cloudflared rồi mới setWebhook.",
      localTestRoute: `${publicBaseUrl}/api/telegram/dev`,
    }, { status: 400 });
  }

  // Set webhook
  try {
    const webhookRes = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"],
          ...(telegramWebhookSecret ? { secret_token: telegramWebhookSecret } : {}),
        }),
      }
    );
    const webhookData = await webhookRes.json();
    results.webhook = webhookData;
    if (!webhookData.ok) {
      errors.push(`Webhook error: ${JSON.stringify(webhookData)}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.webhook = { error: msg };
    errors.push(`Webhook exception: ${msg}`);
  }

  // Publish bot commands so Telegram can surface them from the menu button
  // beside the sticker/emoji area.
  try {
    const commandsRes = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/setMyCommands`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: telegramCommands,
        }),
      }
    );
    const commandsData = await commandsRes.json();
    results.commands = commandsData;
    if (!commandsData.ok) {
      errors.push(`Commands error: ${JSON.stringify(commandsData)}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.commands = { error: msg };
    errors.push(`Commands exception: ${msg}`);
  }

  // Force Telegram to show the commands menu from the button beside the
  // sticker/emoji controls.
  try {
    const menuButtonRes = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/setChatMenuButton`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_button: telegramCommandsMenuButton,
        }),
      }
    );
    const menuButtonData = await menuButtonRes.json();
    results.menuButton = menuButtonData;
    if (!menuButtonData.ok) {
      errors.push(`Menu button error: ${JSON.stringify(menuButtonData)}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.menuButton = { error: msg };
    errors.push(`Menu button exception: ${msg}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    webhookUrl,
    publicBaseUrl,
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}

export async function GET(req: Request) {
  const auth = verifyTelegramInternalRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!telegramBotToken) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" },
      { status: 500 }
    );
  }

  try {
    const publicBaseUrl = resolveTelegramPublicBaseUrl(req);
    const [webhookRes, commandsRes, meRes, menuButtonRes] = await Promise.all([
      fetch(`https://api.telegram.org/bot${telegramBotToken}/getWebhookInfo`),
      fetch(`https://api.telegram.org/bot${telegramBotToken}/getMyCommands`),
      fetch(`https://api.telegram.org/bot${telegramBotToken}/getMe`),
      fetch(`https://api.telegram.org/bot${telegramBotToken}/getChatMenuButton`),
    ]);

    const webhook = await webhookRes.json();
    const commands = await commandsRes.json();
    const me = await meRes.json();
    const menuButton = await menuButtonRes.json();

    return NextResponse.json({
      ok: true,
      security: {
        webhookSecretConfigured: isTelegramWebhookSecretConfigured(),
      },
      publicBaseUrl,
      webhook,
      commands,
      menuButton,
      bot: me,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
