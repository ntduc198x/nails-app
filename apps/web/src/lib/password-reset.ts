import crypto from "node:crypto";
import { resolvePublicAppBaseUrl } from "@/lib/public-app-url";
import { createServiceRoleClient } from "@/lib/supabase";

const PASSWORD_RESET_TTL_MINUTES = 30;
const MOBILE_APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || "nails-app";

type PasswordResetRecord = {
  id: string;
  user_id: string;
  email: string;
  reset_token: string;
  temporary_password_ciphertext: string;
  expires_at: string;
  confirmed_at: string | null;
  used_at: string | null;
  created_at: string;
};

export type PasswordResetStatus = "pending" | "expired" | "used" | "invalid";

function getPasswordResetSecret() {
  const secret = process.env.PASSWORD_RESET_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!secret) {
    throw new Error("Thiếu PASSWORD_RESET_SECRET hoặc SUPABASE_SERVICE_ROLE_KEY để mã hóa mật khẩu tạm.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encodeBase64Url(value: Buffer) {
  return value.toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function encryptTemporaryPassword(plainText: string) {
  const key = getPasswordResetSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const cipherText = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [encodeBase64Url(iv), encodeBase64Url(authTag), encodeBase64Url(cipherText)].join(".");
}

function decryptTemporaryPassword(cipherText: string) {
  const [ivPart, authTagPart, payloadPart] = cipherText.split(".");
  if (!ivPart || !authTagPart || !payloadPart) {
    throw new Error("PASSWORD_RESET_CIPHERTEXT_INVALID");
  }

  const key = getPasswordResetSecret();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, decodeBase64Url(ivPart));
  decipher.setAuthTag(decodeBase64Url(authTagPart));
  const plainBuffer = Buffer.concat([decipher.update(decodeBase64Url(payloadPart)), decipher.final()]);
  return plainBuffer.toString("utf8");
}

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function generateTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return output;
}

export function normalizeResetEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidResetEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordResetTtlMinutes() {
  return PASSWORD_RESET_TTL_MINUTES;
}

export function buildWebPasswordResetConfirmUrl(token: string) {
  const url = new URL("/reset-password", resolvePublicAppBaseUrl());
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildMobilePasswordResetConfirmUrl(token: string) {
  return `${MOBILE_APP_SCHEME}://reset-password?token=${encodeURIComponent(token)}`;
}

async function findAuthUserByEmail(email: string) {
  const serviceRoleClient = createServiceRoleClient();
  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await serviceRoleClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`PASSWORD_RESET_AUTH_LOOKUP_FAILED: ${error.message}`);
    }

    const matchedUser =
      data?.users?.find((user) => normalizeResetEmail(user.email ?? "") === email) ?? null;

    if (matchedUser) {
      return {
        id: matchedUser.id,
        email: normalizeResetEmail(matchedUser.email ?? email),
      };
    }

    if (!data?.users?.length || data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

export async function createPendingPasswordReset(email: string) {
  const serviceRoleClient = createServiceRoleClient();
  const normalizedEmail = normalizeResetEmail(email);
  const authUserRow = await findAuthUserByEmail(normalizedEmail);

  if (!authUserRow?.id || !authUserRow.email) {
    return null;
  }

  const resetToken = generatePasswordResetToken();
  const temporaryPassword = generateTemporaryPassword();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000).toISOString();

  await serviceRoleClient
    .from("password_reset_requests")
    .delete()
    .eq("user_id", authUserRow.id)
    .is("used_at", null);

  const { data, error: insertError } = await serviceRoleClient
    .from("password_reset_requests")
    .insert({
      user_id: authUserRow.id,
      email: normalizedEmail,
      reset_token: resetToken,
      temporary_password_ciphertext: encryptTemporaryPassword(temporaryPassword),
      expires_at: expiresAt,
    })
    .select("id,user_id,email,reset_token,temporary_password_ciphertext,expires_at,confirmed_at,used_at,created_at")
    .single();

  const insertedRow = (data ?? null) as PasswordResetRecord | null;

  if (insertError || !insertedRow) {
    throw new Error(`PASSWORD_RESET_INSERT_FAILED: ${insertError?.message ?? "UNKNOWN"}`);
  }

  return {
    requestId: insertedRow.id,
    email: normalizedEmail,
    temporaryPassword,
    resetToken,
    expiresAt,
    webConfirmUrl: buildWebPasswordResetConfirmUrl(resetToken),
    mobileConfirmUrl: buildMobilePasswordResetConfirmUrl(resetToken),
  };
}

export async function deletePendingPasswordResetById(requestId: string) {
  const serviceRoleClient = createServiceRoleClient();
  await serviceRoleClient.from("password_reset_requests").delete().eq("id", requestId);
}

export async function getPasswordResetStatusByToken(token: string): Promise<{
  status: PasswordResetStatus;
  expiresAt: string | null;
}> {
  const serviceRoleClient = createServiceRoleClient();
  const { data, error } = await serviceRoleClient
    .from("password_reset_requests")
    .select("expires_at,used_at")
    .eq("reset_token", token)
    .limit(1)
    .maybeSingle();

  const row = (data ?? null) as { expires_at: string; used_at: string | null } | null;

  if (error) {
    throw new Error(`PASSWORD_RESET_STATUS_FAILED: ${error.message}`);
  }

  if (!row) {
    return { status: "invalid", expiresAt: null };
  }

  if (row.used_at) {
    return { status: "used", expiresAt: row.expires_at };
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { status: "expired", expiresAt: row.expires_at };
  }

  return { status: "pending", expiresAt: row.expires_at };
}

async function revokeUserAppSessions(userId: string) {
  const serviceRoleClient = createServiceRoleClient();

  await Promise.allSettled([
    serviceRoleClient.from("app_sessions").delete().eq("user_id", userId),
    serviceRoleClient.from("device_sessions").delete().eq("user_id", userId),
  ]);
}

export async function confirmPasswordResetByToken(token: string): Promise<{
  status: PasswordResetStatus;
}> {
  const serviceRoleClient = createServiceRoleClient();
  const { data, error } = await serviceRoleClient
    .from("password_reset_requests")
    .select("id,user_id,temporary_password_ciphertext,expires_at,used_at")
    .eq("reset_token", token)
    .limit(1)
    .maybeSingle();

  const row = (data ?? null) as Pick<
    PasswordResetRecord,
    "id" | "user_id" | "temporary_password_ciphertext" | "expires_at" | "used_at"
  > | null;

  if (error) {
    throw new Error(`PASSWORD_RESET_CONFIRM_LOOKUP_FAILED: ${error.message}`);
  }

  if (!row) {
    return { status: "invalid" };
  }

  if (row.used_at) {
    return { status: "used" };
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    return { status: "expired" };
  }

  const temporaryPassword = decryptTemporaryPassword(row.temporary_password_ciphertext);
  const { error: updateUserError } = await serviceRoleClient.auth.admin.updateUserById(row.user_id, {
    password: temporaryPassword,
  });

  if (updateUserError) {
    throw new Error(`PASSWORD_RESET_APPLY_FAILED: ${updateUserError.message}`);
  }

  const nowIso = new Date().toISOString();
  const { error: updateRequestError } = await serviceRoleClient
    .from("password_reset_requests")
    .update({
      confirmed_at: nowIso,
      used_at: nowIso,
    })
    .eq("id", row.id);

  if (updateRequestError) {
    throw new Error(`PASSWORD_RESET_MARK_USED_FAILED: ${updateRequestError.message}`);
  }

  await revokeUserAppSessions(row.user_id);
  return { status: "used" };
}
