import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { APP_SESSION_COOKIE_MAX_AGE_SECONDS, APP_SESSION_COOKIE_NAME } from "@/lib/app-session-constants";
import { createServiceRoleClient } from "@/lib/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

function createAuthenticatedRpcClient(accessToken: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function applySessionCookie(response: NextResponse, token: string) {
  response.cookies.set(APP_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: APP_SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set(APP_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return NextResponse.json({ success: false, error: "Missing bearer token" }, { status: 401 });
    }

    const serviceRoleClient = createServiceRoleClient();
    const userRes = await serviceRoleClient.auth.getUser(accessToken);
    const user = userRes.data.user;
    if (userRes.error || !user) {
      return NextResponse.json({ success: false, error: "Invalid session" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      deviceFingerprint?: string | null;
      deviceInfo?: unknown;
    };

    const rpcClient = createAuthenticatedRpcClient(accessToken);
    const { data, error } = await rpcClient.rpc("create_app_session", {
      p_user_id: user.id,
      p_device_fingerprint: body.deviceFingerprint ?? null,
      p_device_info: body.deviceInfo ?? {},
    });

    if (error || !data?.token) {
      return NextResponse.json(
        {
          success: false,
          error: data?.error ?? error?.message ?? "Không tạo được app session.",
          message: data?.message,
          replacedUserId: data?.replaced_user_id ?? null,
          replacedOwnerName: data?.replaced_owner_name ?? null,
        },
        { status: 400 },
      );
    }

    const response = NextResponse.json({
      success: Boolean(data.success),
      message: data.message,
      replacedUserId: data.replaced_user_id ?? null,
      replacedOwnerName: data.replaced_owner_name ?? null,
    });
    applySessionCookie(response, String(data.token));
    return response;
  } catch {
    return NextResponse.json({ success: false, error: "Không tạo được app session." }, { status: 500 });
  }
}

export async function DELETE() {
  const token = (await cookies()).get(APP_SESSION_COOKIE_NAME)?.value ?? null;
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);

  if (!token) {
    return response;
  }

  try {
    const serviceRoleClient = createServiceRoleClient();
    await serviceRoleClient.rpc("revoke_app_session", { p_token: token });
  } catch {
    // Best effort: clearing the cookie is the critical step.
  }

  return response;
}
