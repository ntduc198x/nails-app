import type { ImagePickerAsset } from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { mobileSupabase } from "@/src/lib/supabase";

const BUCKET = "service-images";

type UploadAdminContentImageOptions = {
  folder: "offers" | "posts" | "storefront" | "gallery" | "products" | "avatars";
  baseName?: string;
};

export type AvatarResizeOptions = {
  maxSize: number;
  quality: number;
};

export async function resizeAvatarImage(
  asset: ImagePickerAsset,
  options: AvatarResizeOptions = { maxSize: 96, quality: 0.42 },
): Promise<ImagePickerAsset> {
  if (!asset.uri) {
    return asset;
  }

  const manipResult = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: options.maxSize } }],
    { compress: options.quality, format: ImageManipulator.SaveFormat.JPEG },
  );

  return {
    ...asset,
    uri: manipResult.uri,
    width: manipResult.width,
    height: manipResult.height,
    fileSize: undefined,
    fileName: asset.fileName?.replace(/\.[^.]+$/, ".jpg") ?? "avatar.jpg",
    mimeType: "image/jpeg",
  };
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureBucketExists() {
  if (!mobileSupabase) return;
  try {
    await mobileSupabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
    });
  } catch {
    // Ignore create bucket failures and let upload retry surface a real error if needed.
  }
}

export async function uploadPickedAdminContentImage(
  asset: ImagePickerAsset,
  options: UploadAdminContentImageOptions,
) {
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
  const safeBase = sanitizeFileName(options.baseName || asset.fileName || "content-image");
  const safeFolder = sanitizeFileName(options.folder || "misc");
  const path = `${safeFolder}/${Date.now()}-${safeBase}.${ext}`;

  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error("Khong tai duoc tep anh de upload.");
  }

  const buffer = await response.arrayBuffer();
  let { error: uploadError } = await mobileSupabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: asset.mimeType || "image/jpeg",
    });

  if (uploadError && uploadError.message.toLowerCase().includes("bucket") && uploadError.message.toLowerCase().includes("not found")) {
    await ensureBucketExists();
    const retry = await mobileSupabase.storage.from(BUCKET).upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: asset.mimeType || "image/jpeg",
    });
    uploadError = retry.error;
  }

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
