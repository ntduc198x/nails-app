import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { APP_SESSION_COOKIE_NAME } from "@/lib/app-session-constants";
import { getDefaultManageHref } from "@/lib/manage-landing-auth";
import { getAppSessionRoleByToken } from "@/lib/server-app-session";

export async function proxy(req: NextRequest) {
  const sessionToken = req.cookies.get(APP_SESSION_COOKIE_NAME)?.value ?? null;
  const role = await getAppSessionRoleByToken(sessionToken);
  const { pathname, search } = req.nextUrl;

  if (pathname === "/") {
    if (role && role !== "USER") {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = getDefaultManageHref(role);
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  if (role && role !== "USER") {
    return NextResponse.next();
  }

  if (role === "USER") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = "/";
  redirectUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/", "/manage/:path*"],
};
