import type { AppRole } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase";

const ROLE_PRIORITY: Record<AppRole, number> = {
  OWNER: 0,
  PARTNER: 1,
  MANAGER: 2,
  RECEPTION: 3,
  ACCOUNTANT: 4,
  TECH: 5,
  USER: 6,
};

function pickHighestPriorityRole(roles: Array<AppRole | null | undefined>) {
  return roles
    .filter((role): role is AppRole => Boolean(role))
    .sort((left, right) => (ROLE_PRIORITY[left] ?? 99) - (ROLE_PRIORITY[right] ?? 99))[0] ?? null;
}

export async function getAppSessionRoleByToken(sessionToken: string | null | undefined): Promise<AppRole | null> {
  if (!sessionToken) return null;

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: session, error: sessionError } = await supabase
    .from("app_sessions")
    .select("user_id, expires_at")
    .eq("session_token", sessionToken)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (sessionError) {
    throw new Error(`APP_SESSION_LOOKUP_FAILED: ${sessionError.message}`);
  }

  const userId = session?.user_id;
  if (typeof userId !== "string" || !userId) return null;

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (roleError) {
    throw new Error(`USER_ROLE_LOOKUP_FAILED: ${roleError.message}`);
  }

  return pickHighestPriorityRole((roleRows ?? []).map((row) => row.role as AppRole | null | undefined));
}
