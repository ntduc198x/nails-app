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
  if (!orgId) {
    throw new Error("CUSTOMER_ORG_CONTEXT_MISSING");
  }

  const { data: existingProfile, error: existingProfileError } = await mobileSupabase
    .from("profiles")
    .select("user_id,org_id")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingProfileError) {
    throw existingProfileError;
  }

  const trimmedLanguage = input.language?.trim() || "";
  const payload: Record<string, string | null> & { updated_at: string } = {
    org_id: orgId,
    display_name: input.displayName?.trim() || null,
    phone: input.phone?.trim() || null,
    birth_date: input.birthDate?.trim() || null,
    address: input.address?.trim() || null,
    updated_at: new Date().toISOString(),
  };

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

  if (customerAccount?.customer_id) {
    const { error: customerUpdateError } = await mobileSupabase
      .from("customers")
      .update({
        full_name: input.displayName?.trim() || null,
        name: input.displayName?.trim() || null,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        birthday: input.birthDate?.trim() || null,
        address: input.address?.trim() || null,
      })
      .eq("id", customerAccount.customer_id)
      .eq("org_id", customerAccount.org_id);

    if (customerUpdateError) {
      throw customerUpdateError;
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
