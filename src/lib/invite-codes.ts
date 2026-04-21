import { supabase } from "@/lib/supabase";

export type InviteCodeRow = {
  id: string;
  code: string;
  allowed_role: "MANAGER" | "RECEPTION" | "ACCOUNTANT" | "TECH";
  expires_at: string;
  used_count: number;
  max_uses: number;
  used_at?: string | null;
  revoked_at?: string | null;
  note?: string | null;
  created_at: string;
};

export async function listInviteCodes() {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data, error } = await supabase
    .from("invite_codes")
    .select("id,code,allowed_role,expires_at,used_count,max_uses,used_at,revoked_at,note,created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as InviteCodeRow[];
}

export async function generateInviteCode(allowedRole: InviteCodeRow["allowed_role"] = "TECH", note?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data, error } = await supabase.rpc("generate_invite_code_secure", {
    p_allowed_role: allowedRole,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data as InviteCodeRow;
}

export async function revokeInviteCode(inviteId: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data, error } = await supabase.rpc("revoke_invite_code_secure", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return data as InviteCodeRow;
}

export async function consumeInviteCode(code: string, userId: string, displayName?: string) {
  if (!supabase) throw new Error("Supabase chưa cấu hình");
  const { data, error } = await supabase.rpc("consume_invite_code_secure", {
    p_code: code,
    p_user_id: userId,
    p_display_name: displayName ?? null,
  });
  if (error) throw error;
  return data as { inviteId: string; orgId: string; role: string; expiresAt: string };
}
