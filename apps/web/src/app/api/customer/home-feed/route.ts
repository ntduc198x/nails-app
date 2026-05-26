import { NextResponse } from "next/server";
import { getCustomerScopedContextForUser, listCustomerHomeFeedForContext } from "@nails/shared";
import { createServiceRoleClient } from "@/lib/supabase";

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing bearer token" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const userResult = await supabase.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const scope = await getCustomerScopedContextForUser(supabase, userResult.data.user.id);
    if (!scope) {
      return NextResponse.json({ ok: false, error: "Customer scope not found" }, { status: 403 });
    }

    const payload = await listCustomerHomeFeedForContext(supabase, scope);
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    console.error("customer home-feed GET failed", error);
    return NextResponse.json(
      { ok: false, error: "Không tải được customer home feed" },
      { status: 500 },
    );
  }
}
