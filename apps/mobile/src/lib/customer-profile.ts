import { mobileSupabase } from "@/src/lib/supabase";

export type CustomerProfileUpdateInput = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  language?: string | null;
};

export type VerifiedCustomerProfile = {
  user_id: string;
  org_id: string;
  default_branch_id: null;
  display_name: string;
  phone: string;
  birth_date: string;
  address: string;
  email: string;
  language: string;
};

export async function upsertAndVerifyCustomerProfile(
  input: CustomerProfileUpdateInput,
): Promise<VerifiedCustomerProfile> {
  if (!mobileSupabase) {
    throw new Error("Thieu cau hinh Supabase mobile.");
  }

  const { data: customerAccountData, error: customerAccountError } = await mobileSupabase
    .from("customer_accounts")
    .select("org_id,customer_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  let customerAccount = customerAccountData;

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

  if (!customerAccount?.customer_id) {
    const relinkByPhoneRpc = await mobileSupabase.rpc("link_customer_account_by_phone");
    if (relinkByPhoneRpc.error && !relinkByPhoneRpc.error.message?.includes("AUTH_USER_NOT_FOUND")) {
      throw relinkByPhoneRpc.error;
    }

    const relinkedByPhone = await mobileSupabase
      .from("customer_accounts")
      .select("org_id,customer_id")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (relinkedByPhone.error) {
      throw relinkedByPhone.error;
    }

    customerAccount = relinkedByPhone.data ?? null;
  }

  const orgId = customerAccount?.org_id ?? null;
  const customerId = customerAccount?.customer_id ?? null;

  if (!orgId || !customerId) {
    throw new Error("CUSTOMER_ACCOUNT_NOT_LINKED");
  }

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
