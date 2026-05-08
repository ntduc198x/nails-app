import { ensureOrgContext } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";

export type ProfileUpdateInput = {
  userId: string;
  displayName?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  language?: string | null;
  defaultBranchId?: string | null;
};

function isMissingCustomerProfileContextError(error: unknown) {
  return error instanceof Error && error.message === "CUSTOMER_PROFILE_CONTEXT_MISSING";
}

export async function upsertAndVerifyProfile(input: ProfileUpdateInput) {
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
  let orgId: string | null = existingOrgId;
  let branchId: string | null = existingBranchId;

  try {
    const orgContext = await ensureOrgContext(mobileSupabase);
    orgId = orgContext.orgId ?? orgId;
    branchId = orgContext.branchId ?? branchId;
  } catch (error) {
    if (!isMissingCustomerProfileContextError(error)) {
      console.warn("Profile save using fallback org context", error);
    }

    // Customer profile updates can still proceed using the existing profile context.
  }

  if (!orgId || !branchId) {
    const { data: customerAccount, error: customerAccountError } = await mobileSupabase
      .from("customer_accounts")
      .select("org_id,branch_id")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (customerAccountError) {
      throw customerAccountError;
    }

    orgId = orgId ?? customerAccount?.org_id ?? null;
    branchId = branchId ?? customerAccount?.branch_id ?? null;
  }

  const resolvedBranchId = input.defaultBranchId ?? branchId ?? existingBranchId;
  const canPersistProfileContext = Boolean(orgId && resolvedBranchId);

  if (!existingProfile?.user_id && !canPersistProfileContext) {
    throw new Error("CUSTOMER_PROFILE_CONTEXT_MISSING");
  }

  const trimmedLanguage = input.language?.trim() || "";
  const payload: Record<string, string | null> & { updated_at: string } = {
    display_name: input.displayName?.trim() || null,
    phone: input.phone?.trim() || null,
    birth_date: input.birthDate?.trim() || null,
    address: input.address?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (orgId) {
    payload.org_id = orgId;
  }

  if (resolvedBranchId) {
    payload.default_branch_id = resolvedBranchId;
  }

  if (trimmedLanguage) {
    payload.language = trimmedLanguage;
  } else if (!existingProfile?.user_id) {
    payload.language = "vi";
  }

  if (existingProfile?.user_id) {
    const { error: updateError } = await mobileSupabase
      .from("profiles")
      .update(payload)
      .eq("user_id", input.userId);

    if (updateError) {
      throw new Error(updateError.message || "PROFILE_UPDATE_FAILED");
    }
  } else {
    const { error: insertError } = await mobileSupabase.from("profiles").insert({
      user_id: input.userId,
      ...payload,
    });

    if (insertError) {
      throw new Error(insertError.message || "PROFILE_INSERT_FAILED");
    }
  }

  const { data, error: verifyError } = await mobileSupabase
    .from("profiles")
    .select("user_id,org_id,default_branch_id,display_name,phone,birth_date,address,language")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (verifyError) {
    throw verifyError;
  }

  if (!data?.user_id) {
    throw new Error("PROFILE_VERIFY_FAILED");
  }

  return data;
}
