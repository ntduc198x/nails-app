import { NextResponse } from "next/server";
import {
  isValidResetEmail,
  issueTemporaryPasswordReset,
  normalizeResetEmail,
} from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string };
    const email = normalizeResetEmail(body.email ?? "");

    if (!email || !isValidResetEmail(email)) {
      return NextResponse.json({ success: false, error: "Email không hợp lệ." }, { status: 400 });
    }

    const temporaryReset = await issueTemporaryPasswordReset(email);
    if (!temporaryReset) {
      return NextResponse.json({ success: true });
    }

    await sendPasswordResetEmail({
      to: temporaryReset.email,
      temporaryPassword: temporaryReset.temporaryPassword,
      loginUrl: temporaryReset.loginUrl,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gửi được email reset mật khẩu.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
