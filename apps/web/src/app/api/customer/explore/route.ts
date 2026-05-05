import { NextResponse } from "next/server";
import { getCustomerExplorePayload } from "@/lib/landing-content";

export async function GET() {
  try {
    const payload = await getCustomerExplorePayload();
    return NextResponse.json({ ok: true, data: payload });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Không tải được customer explore" },
      { status: 500 },
    );
  }
}
