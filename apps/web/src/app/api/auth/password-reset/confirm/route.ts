import { NextResponse } from "next/server";
import { confirmPasswordResetByToken } from "@/lib/password-reset";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const token = body.token?.trim() ?? "";

    if (!token) {
      return NextResponse.json({ success: false, status: "invalid", error: "Thiếu token reset mật khẩu." }, { status: 400 });
    }

    const result = await confirmPasswordResetByToken(token);
    if (result.status !== "used") {
      return NextResponse.json({ success: false, status: result.status }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không áp dụng được mật khẩu mới.";
    return NextResponse.json({ success: false, status: "invalid", error: message }, { status: 500 });
  }
}
