import type { ImagePickerAsset } from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { mobileSupabase } from "@/src/lib/supabase";

const BUCKET = "service-images";

type UploadAdminContentImageOptions = {
  folder: "offers" | "posts" | "storefront" | "gallery" | "products" | "avatars";
  baseName?: string;
};

export type AvatarSize = 256 | 512 | 1024;
export type AvatarFormat = "webp" | "jpeg";

export type AvatarResizeOptions = {
  size: AvatarSize;
  quality: number;
  format?: AvatarFormat;
};

const AVATAR_QUALITY_MAP: Record<AvatarSize, number> = {
  256: 1,
  512: 1,
  1024: 1,
};

export async function resizeAvatarImage(
  asset: ImagePickerAsset,
  options: Partial<AvatarResizeOptions> = {},
): Promise<ImagePickerAsset> {
  if (!asset.uri) {
    return asset;
  }

  const size = options.size ?? 256;
  const quality = options.quality ?? AVATAR_QUALITY_MAP[size];
  const format = options.format ?? "webp";

  const saveFormat = format === "webp"
    ? ImageManipulator.SaveFormat.WEBP
    : ImageManipulator.SaveFormat.JPEG;

  const manipResult = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: size } }],
    { compress: quality, format: saveFormat },
  );

  const ext = format === "webp" ? "webp" : "jpg";
  const mimeType = format === "webp" ? "image/webp" : "image/jpeg";

  return {
    ...asset,
    uri: manipResult.uri,
    width: manipResult.width,
    height: manipResult.height,
    fileSize: undefined,
    fileName: asset.fileName?.replace(/\.[^.]+$/, `.${ext}`) ?? `avatar.${ext}`,
    mimeType,
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
