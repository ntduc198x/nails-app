export type CustomerImageIntent = "hero" | "card" | "avatar" | "avatar64" | "avatar128" | "avatar512" | "preview" | "thumbnail";

function appendQuery(url: string, entries: Record<string, string | number | null | undefined>) {
  const next = new URL(url);
  for (const [key, value] of Object.entries(entries)) {
    if (value === null || value === undefined || value === "") continue;
    next.searchParams.set(key, String(value));
  }
  return next.toString();
}

function isSupabasePublicObjectUrl(url: string) {
  return url.includes("/storage/v1/object/public/");
}

function toSupabaseRenderUrl(url: string) {
  return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
}

function getIntentConfig(intent: CustomerImageIntent) {
  if (intent === "avatar64") {
    return { width: 64, quality: 92 };
  }
  if (intent === "avatar128") {
    return { width: 128, quality: 92 };
  }
  if (intent === "avatar512") {
    return { width: 512, quality: 92 };
  }
  if (intent === "avatar") {
    return { width: 256, quality: 92 };
  }
  if (intent === "thumbnail") {
    return { width: 64, quality: 80 };
  }
  if (intent === "card") {
    return { width: 480, quality: 80 };
  }
  if (intent === "hero") {
    return { width: 900, quality: 85 };
  }
  return { width: 1400, quality: 88 };
}

export function getCustomerImageUri(
  input: string | null | undefined,
  intent: CustomerImageIntent = "card",
) {
  const trimmed = typeof input === "string" ? input.trim() : "";
  if (!trimmed) return "";

  const config = getIntentConfig(intent);

  try {
    if (isSupabasePublicObjectUrl(trimmed)) {
      return appendQuery(toSupabaseRenderUrl(trimmed), {
        width: config.width,
        quality: config.quality,
      });
    }

    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("supabase")) {
      return appendQuery(trimmed, {
        width: config.width,
        quality: config.quality,
      });
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
