import type { ImagePickerAsset } from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { translate, type Locale } from "@nails/shared";
import { mobileEnv } from "@/src/lib/env";
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

export async function uploadPickedAdminContentImage(
  asset: ImagePickerAsset,
  options: UploadAdminContentImageOptions,
  locale: Locale = "vi",
) {
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

  const safeBase = sanitizeFileName(options.baseName || asset.fileName || "content-image");
  const safeFolder = sanitizeFileName(options.folder || "misc");
  const formData = new FormData();
  formData.append("folder", safeFolder);
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
