import { ensureOrgContext } from "@/lib/domain";
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

  const { orgId, branchId } = await ensureOrgContext();

  // bootstrap profile để dùng với RLS helper my_org_id()
  const { data: profile } = await supabase.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (!profile) {
    const { data: sessionData } = await supabase.auth.getSession();
    await supabase.from("profiles").insert({
      user_id: userId,
      org_id: orgId,
      default_branch_id: branchId,
      display_name: (sessionData.session?.user.user_metadata?.display_name as string | undefined)?.trim() || "User",
      email: sessionData.session?.user.email ?? null,
    });
  }

  // Quy tắc signup:
  // - user đầu tiên trong org => OWNER
  // - user đăng ký sau => RECEPTION
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
