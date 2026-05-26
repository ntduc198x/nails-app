import type { ImagePickerAsset } from "expo-image-picker";
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

export async function uploadPickedServiceImage(asset: ImagePickerAsset, serviceName?: string) {
  if (!mobileSupabase) {
    throw new Error("Thieu cau hinh Supabase mobile.");
  }
  if (!mobileEnv.apiBaseUrl) {
    throw new Error("Thieu API base URL cho mobile upload.");
  }

  const uri = asset.uri;
  if (!uri) {
    throw new Error("Khong doc duoc anh da chon.");
  }

  const { data: sessionData } = await mobileSupabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Chua dang nhap.");
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
    throw new Error(payload?.error || "Upload ảnh thất bại");
  }

  return {
    bucket: BUCKET,
    path: payload.data.path,
    publicUrl: payload.data.publicUrl,
  };
}
