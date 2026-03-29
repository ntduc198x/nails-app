import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const callback = body?.callback_query;
    if (!callback?.data) {
      return NextResponse.json({ ok: false, error: "missing callback_query.data", body });
    }

    const parts = String(callback.data).split(":");
    const [prefix, action, ...rest] = parts;
    const bookingId = rest.join(":");

    return NextResponse.json({
      ok: true,
      debug: {
        raw: callback.data,
        parsed: parts,
        prefix,
        action,
        bookingId,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "callback test failed" },
      { status: 500 },
    );
  }
}
