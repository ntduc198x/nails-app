import { NextResponse } from "next/server";
import type { AppRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase";

const BUCKET = "service-images";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_FOLDERS = new Set(["lookbook", "offers", "posts", "storefront", "gallery", "products", "avatars"]);
const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MANAGE_ROLES = new Set<AppRole>(["OWNER", "PARTNER", "MANAGER", "RECEPTION", "TECH"]);
const ROLE_PRIORITY: Record<AppRole, number> = {
  OWNER: 0,
  PARTNER: 1,
  MANAGER: 2,
  RECEPTION: 3,
  ACCOUNTANT: 4,
  TECH: 5,
  USER: 6,
};

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
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

function pickHighestPriorityRole(rows: Array<{ role?: string | null }>) {
  return [...rows]
    .filter((row): row is { role: AppRole } => Boolean(row.role))
    .sort((left, right) => (ROLE_PRIORITY[left.role] ?? 99) - (ROLE_PRIORITY[right.role] ?? 99))[0]?.role;
}

function detectImageMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return NextResponse.json({ ok: false, error: "Missing bearer token" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const userRes = await supabase.auth.getUser(accessToken);
    const user = userRes.data.user;
    if (userRes.error || !user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const formData = await req.formData();
    const folder = String(formData.get("folder") ?? "").trim().toLowerCase();
    const baseName = String(formData.get("baseName") ?? "").trim();
    const file = formData.get("file");

    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ ok: false, error: "Invalid upload folder" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing upload file" }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ ok: false, error: "Image must be 2MB or smaller" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detectedMime = detectImageMime(bytes);
    if (!detectedMime || !ALLOWED_IMAGE_TYPES.has(detectedMime)) {
      return NextResponse.json({ ok: false, error: "Only JPEG, PNG, and WebP images are allowed" }, { status: 400 });
    }

    if (file.type && file.type !== detectedMime) {
      return NextResponse.json({ ok: false, error: "Uploaded file type does not match image contents" }, { status: 400 });
    }

    let pathPrefix: string;
    if (folder === "avatars") {
      pathPrefix = `avatars/${user.id}`;
    } else {
      const roleRes = await supabase.from("user_roles").select("org_id,role").eq("user_id", user.id);
      if (roleRes.error || !roleRes.data?.length) {
        return NextResponse.json({ ok: false, error: "Missing role context" }, { status: 403 });
      }

      const orgId = String(roleRes.data[0]?.org_id ?? "");
      const role = pickHighestPriorityRole(roleRes.data);
      if (!orgId || !role || !MANAGE_ROLES.has(role)) {
        return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
      }

      pathPrefix = `orgs/${orgId}/${folder}`;
    }

    const extension = ALLOWED_IMAGE_TYPES.get(detectedMime) ?? "jpg";
    const rawName = baseName || file.name.replace(/\.[^.]+$/, "") || "image";
    const safeBase = sanitizeFileName(rawName) || "image";
    const path = `${pathPrefix}/${Date.now()}-${safeBase}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      cacheControl: "3600",
      upsert: false,
      contentType: detectedMime,
    });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 400 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({
      ok: true,
      data: {
        bucket: BUCKET,
        path,
        publicUrl: data.publicUrl,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
