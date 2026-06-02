import { NextResponse } from "next/server";
import {
  createPendingPasswordReset,
  deletePendingPasswordResetById,
  isValidResetEmail,
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

    const pendingReset = await createPendingPasswordReset(email);
    if (!pendingReset) {
      return NextResponse.json({ success: true });
    }

    try {
      await sendPasswordResetEmail({
        to: pendingReset.email,
        temporaryPassword: pendingReset.temporaryPassword,
        webConfirmUrl: pendingReset.webConfirmUrl,
        mobileConfirmUrl: pendingReset.mobileConfirmUrl,
      });
    } catch (error) {
      await deletePendingPasswordResetById(pendingReset.requestId).catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Không gửi được email reset mật khẩu.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
