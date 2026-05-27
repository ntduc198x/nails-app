import type { ImagePickerAsset } from "expo-image-picker";
import { translate, type Locale } from "@nails/shared";
import { mobileEnv } from "@/src/lib/env";
import { mobileSupabase } from "@/src/lib/supabase";

const BUCKET = "service-images";

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function uploadPickedServiceImage(asset: ImagePickerAsset, serviceName?: string, locale: Locale = "vi") {
  if (!mobileSupabase) {
    throw new Error(translate(locale, "admin", "contentImagesMissingSupabase"));
  }
  if (!mobileEnv.apiBaseUrl) {
    throw new Error(translate(locale, "admin", "contentImagesMissingApiBaseUrl"));
  }

  const uri = asset.uri;
  if (!uri) {
    throw new Error(translate(locale, "admin", "contentImagesUnreadableAsset"));
  }

  const { data: sessionData } = await mobileSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error(translate(locale, "admin", "contentImagesUnauthenticated"));
  }

  const safeBase = sanitizeFileName(serviceName || asset.fileName || "service-image");
  const formData = new FormData();
  formData.append("folder", "lookbook");
  formData.append("baseName", safeBase);
  formData.append(
    "file",
    {
      uri,
      name: asset.fileName || `${safeBase}.jpg`,
      type: asset.mimeType || "image/jpeg",
    } as unknown as Blob,
  );

  const response = await fetch(`${mobileEnv.apiBaseUrl.replace(/\/$/, "")}/api/uploads/service-image`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
  const payload = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; data?: { path: string; publicUrl: string } }
    | null;

  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error || translate(locale, "admin", "contentImagesUploadFailed"));
  }

  return {
    bucket: BUCKET,
    path: payload.data.path,
    publicUrl: payload.data.publicUrl,
  };
}
