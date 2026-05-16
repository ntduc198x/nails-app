import { ensureOrgContext } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";

export type AdminProfileUpdateInput = {
  userId: string;
  displayName?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  language?: string | null;
  defaultBranchId?: string | null;
};

export type VerifiedAdminProfile = {
  user_id: string;
  org_id: string;
  default_branch_id: string | null;
  display_name: string;
  phone: string;
  birth_date: string;
  address: string;
  email: string;
  language: string;
};

function isMissingCustomerProfileContextError(error: unknown) {
  return error instanceof Error && error.message === "CUSTOMER_PROFILE_CONTEXT_MISSING";
}

export async function upsertAndVerifyAdminProfile(
  input: AdminProfileUpdateInput,
): Promise<VerifiedAdminProfile> {
  if (!mobileSupabase) {
    throw new Error("Thieu cau hinh Supabase mobile.");
  }

  const { data: existingProfile, error: existingProfileError } = await mobileSupabase
    .from("profiles")
    .select("user_id,org_id,default_branch_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  const existingOrgId = existingProfile?.org_id ?? null;
  const existingBranchId = existingProfile?.default_branch_id ?? null;
  let resolvedOrgId: string | null = existingOrgId;
  let resolvedBranchId: string | null = input.defaultBranchId ?? existingBranchId;

  try {
    const orgContext = await ensureOrgContext(mobileSupabase);
    resolvedOrgId = orgContext.orgId ?? resolvedOrgId;
    resolvedBranchId = resolvedBranchId ?? orgContext.branchId ?? null;
  } catch (error) {
    if (!isMissingCustomerProfileContextError(error)) {
      console.warn("Profile save using fallback org context", error);
    }
  }

  if (!resolvedOrgId) {
    throw new Error("PROFILE_ORG_CONTEXT_MISSING");
  }

  const trimmedLanguage = input.language?.trim() || "";
  const payload: Record<string, string | null> & { updated_at: string } = {
    org_id: resolvedOrgId,
    display_name: input.displayName?.trim() || null,
    phone: input.phone?.trim() || null,
    birth_date: input.birthDate?.trim() || null,
    address: input.address?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (resolvedBranchId) {
    payload.default_branch_id = resolvedBranchId;
  }

  if (trimmedLanguage) {
    payload.language = trimmedLanguage;
  } else if (!existingProfile?.user_id) {
    payload.language = "vi";
  }

  if (existingProfile?.user_id) {
    const { error: updateError } = await mobileSupabase.from("profiles").update(payload).eq("user_id", input.userId);
    if (updateError) {
      throw new Error(updateError.message || "PROFILE_UPDATE_FAILED");
    }
  } else {
    const { error: insertError } = await mobileSupabase.from("profiles").insert({ user_id: input.userId, ...payload });
    if (insertError) {
      throw new Error(insertError.message || "PROFILE_INSERT_FAILED");
    }
  }

  return {
    user_id: input.userId,
    org_id: resolvedOrgId,
    default_branch_id: resolvedBranchId,
    display_name: input.displayName?.trim() || "",
    phone: input.phone?.trim() || "",
    birth_date: input.birthDate?.trim() || "",
    address: input.address?.trim() || "",
    email: "",
    language: trimmedLanguage || "vi",
  };
}
