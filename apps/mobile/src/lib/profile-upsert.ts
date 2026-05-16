import {
  type AdminProfileUpdateInput,
  type VerifiedAdminProfile,
  upsertAndVerifyAdminProfile,
} from "@/src/lib/admin-profile";
import {
  type CustomerProfileUpdateInput,
  type VerifiedCustomerProfile,
  upsertAndVerifyCustomerProfile,
} from "@/src/lib/customer-profile";

export type ProfileUpdateInput = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  language?: string | null;
  defaultBranchId?: string | null;
  target?: "auto" | "customer" | "profile";
};

export {
  upsertAndVerifyAdminProfile,
  upsertAndVerifyCustomerProfile,
};
export type {
  AdminProfileUpdateInput,
  CustomerProfileUpdateInput,
  VerifiedAdminProfile,
  VerifiedCustomerProfile,
};

/**
 * @deprecated Use `upsertAndVerifyCustomerProfile` or `upsertAndVerifyAdminProfile`.
 * Do not use this helper in new code.
 */
export async function upsertAndVerifyProfile(
  input: ProfileUpdateInput,
): Promise<VerifiedCustomerProfile | VerifiedAdminProfile> {
  const target = input.target ?? "auto";

  if (target === "profile") {
    const profileInput: AdminProfileUpdateInput = {
      userId: input.userId,
      displayName: input.displayName,
      phone: input.phone,
      birthDate: input.birthDate,
      address: input.address,
      language: input.language,
      defaultBranchId: input.defaultBranchId,
    };
    return upsertAndVerifyAdminProfile(profileInput);
  }

  const customerInput: CustomerProfileUpdateInput = {
    userId: input.userId,
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    birthDate: input.birthDate,
    address: input.address,
    language: input.language,
  };
  return upsertAndVerifyCustomerProfile(customerInput);
}
