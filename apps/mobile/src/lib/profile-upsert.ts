import { ensureOrgContext } from "@nails/shared";
import { mobileSupabase } from "@/src/lib/supabase";

export type ProfileUpdateInput = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
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

  let { data: customerAccount, error: customerAccountError } = await mobileSupabase
    .from("customer_accounts")
    .select("org_id,customer_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (customerAccountError) {
    throw customerAccountError;
  }

  if (!customerAccount?.customer_id) {
    const relinkRpc = await mobileSupabase.rpc("link_customer_account_for_current_user");
    if (relinkRpc.error && !relinkRpc.error.message?.includes("AUTH_USER_NOT_FOUND")) {
      throw relinkRpc.error;
    }

    const relinked = await mobileSupabase
      .from("customer_accounts")
      .select("org_id,customer_id")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (relinked.error) {
      throw relinked.error;
    }

    customerAccount = relinked.data ?? null;
  }

  const orgId = customerAccount?.org_id ?? null;
  const customerId = customerAccount?.customer_id ?? null;

  if (customerAccount?.customer_id && orgId) {
    const { data: customerData, error: customerUpdateError } = await mobileSupabase
      .from("customers")
      .update({
        full_name: input.displayName?.trim() || null,
        name: input.displayName?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        birthday: input.birthDate?.trim() || null,
        address: input.address?.trim() || null,
      })
      .eq("id", customerId)
      .eq("org_id", orgId)
      .select("id,org_id,full_name,name,email,phone,birthday,address")
      .single();

    if (customerUpdateError) {
      throw customerUpdateError;
    }

    return {
      user_id: input.userId,
      org_id: orgId,
      default_branch_id: null,
      display_name: (customerData?.full_name ?? customerData?.name ?? input.displayName ?? "") as string,
      phone: (customerData?.phone ?? input.phone ?? "") as string,
      birth_date: (customerData?.birthday ?? input.birthDate ?? "") as string,
      address: (customerData?.address ?? input.address ?? "") as string,
      email: (customerData?.email ?? input.email ?? "") as string,
      language: input.language?.trim() || "vi",
    };
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
    email: input.email?.trim() || "",
    language: trimmedLanguage || "vi",
  };
}
