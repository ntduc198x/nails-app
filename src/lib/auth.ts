import { ensureOrgContext } from "@/lib/domain";
import { getDeviceFingerprint, getDeviceInfo } from "@/lib/device-fingerprint";
import { supabase } from "@/lib/supabase";

export type AppRole = "OWNER" | "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";

export async function getOrCreateRole(userId: string): Promise<AppRole> {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  const { data: existing, error: readErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .limit(1);

  if (readErr) throw readErr;
  const role = existing?.[0]?.role as AppRole | undefined;
  if (role) return role;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("user_id,org_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileErr) throw profileErr;

  const orgId = profile?.org_id as string | undefined;
  if (!orgId) {
    throw new Error("USER_NOT_BOUND_TO_ORG");
  }

  const { count: ownerCount, error: ownerCountErr } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "OWNER");
  if (ownerCountErr) throw ownerCountErr;

  const nextRole: AppRole = (ownerCount ?? 0) === 0 ? "OWNER" : "RECEPTION";

  const { error: insertErr } = await supabase.from("user_roles").insert({
    user_id: userId,
    org_id: orgId,
    role: nextRole,
  });
  if (insertErr) throw insertErr;

  return nextRole;
}

export async function listUserRoles() {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  const rpc = await supabase.rpc("list_team_members_secure_v2");
  if (!rpc.error && rpc.data) {
    return rpc.data;
  }

  const { orgId } = await ensureOrgContext();

  const { data, error } = await supabase
    .from("user_roles")
    .select("id,user_id,role")
    .eq("org_id", orgId)
    .order("role", { ascending: true });

  if (error) throw error;

  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  let profileMap = new Map<string, { display_name: string; email?: string | null; phone?: string | null }>();

  if (ids.length) {
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id,display_name,email,phone")
      .in("user_id", ids);
    if (!profileErr) {
      profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.user_id as string,
          {
            display_name: (p.display_name as string | null) || String(p.user_id).slice(0, 8),
            email: (p as { email?: string | null }).email ?? null,
            phone: (p as { phone?: string | null }).phone ?? null,
          },
        ]),
      );
    }
  }

  return rows.map((r) => ({
    ...r,
    display_name: profileMap.get(r.user_id as string)?.display_name ?? String(r.user_id).slice(0, 8),
    email: profileMap.get(r.user_id as string)?.email ?? null,
    phone: profileMap.get(r.user_id as string)?.phone ?? null,
  }));
}

export async function updateUserRoleByRowId(id: string, role: AppRole) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user?.id;
  if (!currentUserId) throw new Error("Chưa đăng nhập");

  const currentRole = await getOrCreateRole(currentUserId);
  if (currentRole !== "OWNER") {
    throw new Error("Chỉ BOSS mới có quyền đổi vai trò.");
  }

  const { data: target, error: targetErr } = await supabase
    .from("user_roles")
    .select("user_id,role")
    .eq("id", id)
    .single();
  if (targetErr) throw targetErr;

  if (target.user_id === currentUserId) {
    throw new Error("Không thể tự đổi vai trò của chính mình.");
  }

  const { error } = await supabase.from("user_roles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function updateUserDisplayName(userId: string, displayName: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");

  const { data: sessionData } = await supabase.auth.getSession();
  const currentUserId = sessionData.session?.user?.id;
  if (!currentUserId) throw new Error("Chưa đăng nhập");

  const currentRole = await getOrCreateRole(currentUserId);
  if (currentRole !== "OWNER") {
    throw new Error("Chỉ BOSS mới có quyền sửa tên nhân sự.");
  }

  const { error } = await supabase.rpc("update_staff_display_name_secure", {
    p_user_id: userId,
    p_display_name: displayName,
  });
  if (error) {
    const message = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
      .filter(Boolean)
      .join(" | ");
    throw new Error(message || "Update display name failed");
  }
}

export async function getCurrentSessionRole(): Promise<AppRole> {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) throw new Error("Chưa đăng nhập");
  return getOrCreateRole(user.id);
}

export interface DeviceConflict {
  conflict: boolean;
  type?: string;
  message?: string;
  ownerName?: string;
}

export async function checkDeviceConflict(): Promise<DeviceConflict> {
  if (!supabase) return { conflict: false };

  const fingerprint = await getDeviceFingerprint();
  const { data, error } = await supabase.rpc("check_device_conflict", {
    p_fingerprint: fingerprint,
  });

  if (error) throw error;
  return {
    conflict: Boolean(data?.conflict),
    type: typeof data?.type === "string" ? data.type : undefined,
    message: typeof data?.message === "string" ? data.message : undefined,
    ownerName: typeof data?.owner_name === "string" ? data.owner_name : undefined,
  };
}

export async function registerDeviceSession(): Promise<{
  success: boolean;
  swapped?: boolean;
  error?: string;
  message?: string;
}> {
  if (!supabase) return { success: false };

  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return { success: false };

  const fingerprint = await getDeviceFingerprint();
  const deviceInfo = await getDeviceInfo();

  const { data, error } = await supabase.rpc("register_device_session", {
    p_user_id: user.id,
    p_fingerprint: fingerprint,
    p_device_info: deviceInfo,
  });

  if (error) return { success: false, error: error.message };
  return {
    success: Boolean(data?.success),
    swapped: Boolean(data?.swapped),
    error: typeof data?.error === "string" ? data.error : undefined,
    message: typeof data?.message === "string" ? data.message : undefined,
  };
}

export interface MyDeviceSession {
  registered: boolean;
  deviceInfo?: unknown;
  createdAt?: string | null;
  fingerprint?: string | null;
}

export async function getMyDeviceSession(): Promise<MyDeviceSession> {
  if (!supabase) return { registered: false };

  const { data, error } = await supabase.rpc("get_my_device_session");
  if (error) throw error;

  return {
    registered: Boolean(data?.registered),
    deviceInfo: data?.device_info,
    createdAt: typeof data?.created_at === "string" ? data.created_at : null,
    fingerprint: typeof data?.fingerprint === "string" ? data.fingerprint : null,
  };
}

export async function validateCurrentDeviceSession(): Promise<{
  valid: boolean;
  reason?: "NO_SESSION" | "NOT_REGISTERED" | "REPLACED";
}> {
  if (!supabase) return { valid: false, reason: "NO_SESSION" };

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.user) {
    return { valid: false, reason: "NO_SESSION" };
  }

  const sessionInfo = await getMyDeviceSession();
  if (!sessionInfo.registered) {
    return { valid: false, reason: "NOT_REGISTERED" };
  }

  const fingerprint = await getDeviceFingerprint();
  if (sessionInfo.fingerprint && sessionInfo.fingerprint !== fingerprint) {
    return { valid: false, reason: "REPLACED" };
  }

  return { valid: true };
}

export async function removeDeviceSession(): Promise<void> {
  if (!supabase) return;

  const fingerprint = await getDeviceFingerprint();
  await supabase.from("device_sessions").delete().eq("device_fingerprint", fingerprint);
}
