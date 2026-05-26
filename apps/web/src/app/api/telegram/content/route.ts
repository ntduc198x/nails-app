import { NextResponse } from "next/server";
import { verifyTelegramInternalRequest } from "@/lib/route-secrets";
import { createServiceRoleClient } from "@/lib/supabase";

type TelegramContentPayload = {
  orgId?: string | null;
  sourceMessageId?: string | number | null;
  sourcePlatform?: string | null;
  text?: string | null;
  caption?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  coverImageUrl?: string | null;
  contentType?: string | null;
  priority?: number | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
};

function parseContentType(value: string | null | undefined) {
  if (value === "care" || value === "news" || value === "offer_hint") {
    return value;
  }

  return "trend";
}

function parseStatus(value: string | null | undefined) {
  if (value === "draft" || value === "approved" || value === "archived") {
    return value;
  }

  return "published";
}

function parseTelegramText(payload: TelegramContentPayload) {
  if (payload.title && (payload.summary || payload.body)) {
    return {
      title: payload.title.trim(),
      summary: (payload.summary ?? payload.body ?? "").trim(),
      body: (payload.body ?? payload.summary ?? "").trim(),
    };
  }

  const rawText = `${payload.caption ?? ""}\n${payload.text ?? ""}`.trim();
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines[0] ?? "Cap nhat moi";
  const summary = lines[1] ?? title;
  const body = lines.slice(1).join("\n") || summary;

  return { title, summary, body };
}

async function resolveOrgId(supabase: ReturnType<typeof createServiceRoleClient>, incomingOrgId?: string | null) {
  if (incomingOrgId) {
    return incomingOrgId;
  }

  const { data, error } = await supabase.from("orgs").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error("Khong tim thay org de luu content.");
  }

  return String(data.id);
}

export async function POST(req: Request) {
  const verification = verifyTelegramInternalRequest(req);
  if (!verification.ok) {
    return NextResponse.json({ ok: false, error: verification.error }, { status: verification.status });
  }

  try {
    const payload = (await req.json()) as TelegramContentPayload;
    const supabase = createServiceRoleClient();
    const orgId = await resolveOrgId(supabase, payload.orgId);
    const parsed = parseTelegramText(payload);

    const row = {
      org_id: orgId,
      source_platform: payload.sourcePlatform?.trim() || "telegram",
      source_message_id: payload.sourceMessageId != null ? String(payload.sourceMessageId) : null,
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      cover_image_url: payload.coverImageUrl?.trim() || null,
      content_type: parseContentType(payload.contentType),
      status: parseStatus(payload.status),
      published_at: parseStatus(payload.status) === "published" ? new Date().toISOString() : null,
      priority: Number(payload.priority ?? 100),
      metadata: payload.metadata ?? {},
    };

    const { data, error } = await supabase
      .from("customer_content_posts")
      .upsert(row, {
        onConflict: "source_platform,source_message_id",
        ignoreDuplicates: false,
      })
      .select("id,title,status,published_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("telegram content POST failed", error);
    return NextResponse.json(
      { ok: false, error: "Khong ingest duoc Telegram content" },
      { status: 500 },
    );
  }
}
