import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { APP_SESSION_COOKIE_NAME } from "@/lib/app-session-constants";

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
      return NextResponse.json({ valid: false, reason: "INVALID_TOKEN" }, { status: 401 });
    }

    const sessionToken = (await cookies()).get(APP_SESSION_COOKIE_NAME)?.value ?? null;
    if (!sessionToken) {
      return NextResponse.json({ valid: false, reason: "INVALID_TOKEN" }, { status: 401 });
    }

    const rpcClient = createAuthenticatedRpcClient(accessToken);
    const { data, error } = await rpcClient.rpc("validate_app_session", {
      p_token: sessionToken,
    });

    if (error || !data) {
      const response = NextResponse.json(
        { valid: false, reason: "INVALID_TOKEN", message: "Session token is invalid or expired." },
        { status: 401 },
      );
      clearSessionCookie(response);
      return response;
    }

    if (!data.valid) {
      const response = NextResponse.json(data, { status: 401 });
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ valid: false, reason: "INVALID_TOKEN" }, { status: 500 });
  }
}
