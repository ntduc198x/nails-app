import { supabase } from "@/lib/supabase";

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

export async function uploadServiceImage(file: File, serviceName?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeBase = sanitizeFileName(serviceName || file.name.replace(/\.[^.]+$/, "") || "service-image");
  const path = `lookbook/${Date.now()}-${safeBase}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return {
    bucket: BUCKET,
    path,
    publicUrl: data.publicUrl,
  };
}
