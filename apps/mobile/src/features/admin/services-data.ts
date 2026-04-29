import type { ImagePickerAsset } from "expo-image-picker";
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

  const uri = asset.uri;
  if (!uri) {
    throw new Error("Khong doc duoc anh da chon.");
  }

  const extFromName = asset.fileName?.includes(".") ? asset.fileName.split(".").pop() : null;
  const extFromMime = asset.mimeType?.split("/").pop();
  const ext = (extFromName || extFromMime || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const safeBase = sanitizeFileName(serviceName || asset.fileName || "service-image");
  const path = `lookbook/${Date.now()}-${safeBase}.${ext}`;

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Khong tai duoc tep anh de upload.");
  }

  const buffer = await response.arrayBuffer();
  const { error: uploadError } = await mobileSupabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: asset.mimeType || "image/jpeg",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = mobileSupabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    bucket: BUCKET,
    path,
    publicUrl: data.publicUrl,
  };
}
