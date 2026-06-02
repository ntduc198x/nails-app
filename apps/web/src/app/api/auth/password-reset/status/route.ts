import { NextResponse } from "next/server";
import { getPasswordResetStatusByToken } from "@/lib/password-reset";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token")?.trim() ?? "";

    if (!token) {
      return NextResponse.json({ success: true, status: "invalid", expiresAt: null });
    }

    const status = await getPasswordResetStatusByToken(token);
    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không kiểm tra được trạng thái reset mật khẩu.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
