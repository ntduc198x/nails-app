import { supabase } from "@/lib/supabase";

const BUCKET = "service-images";

export async function uploadServiceImage(file: File, serviceName?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("Chưa đăng nhập");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", "lookbook");
  formData.append("baseName", serviceName || file.name);

  const response = await fetch("/api/uploads/service-image", {
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
