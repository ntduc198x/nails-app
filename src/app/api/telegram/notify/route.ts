import { NextResponse } from "next/server";
import { getAdminSupabase, sendTelegramMessage, formatViDateTime, formatViTime } from "@/lib/telegram-bot";

const telegramChatId = process.env.TELEGRAM_BOOKING_CHAT_ID;
const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://chambeauty.io.vn";

export async function POST(req: Request) {
  try {
    if (!telegramChatId) {
      return NextResponse.json({ ok: false, error: "Thiếu TELEGRAM_BOOKING_CHAT_ID" }, { status: 500 });
    }

    const supabase = getAdminSupabase();
    let sent = 0;

    const now = new Date();
    const tenHoursAgo = new Date(now.getTime() - 10 * 3600000).toISOString();

    const { data: staleShifts, error: shiftError } = await supabase
      .from("time_entries")
      .select("id,staff_user_id,clock_in")
      .is("clock_out", null)
      .lt("clock_in", tenHoursAgo)
      .order("clock_in", { ascending: true });

    if (shiftError) throw shiftError;

    const shifts = (staleShifts ?? []) as Array<{ id: string; staff_user_id: string; clock_in: string }>;

    if (shifts.length > 0) {
      const staffIds = shifts.map((s) => s.staff_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,display_name")
        .in("user_id", staffIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.user_id as string, ((p.display_name as string | null) || String(p.user_id).slice(0, 8))]));

      const lines = ["<b>⚠️ CẢNH BÁO CA LÀM QUÁ LÂU</b>", ""];

      for (const s of shifts) {
        const name = nameMap.get(s.staff_user_id) ?? "-";
        const clockIn = new Date(s.clock_in);
        const diffMs = now.getTime() - clockIn.getTime();
        const hours = Math.floor(diffMs / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        lines.push(`• <b>${name}</b> — ${hours}h${minutes}p (vào ${formatViTime(s.clock_in)})`);
      }

      lines.push("", `👉 ${publicBaseUrl}/manage/shifts`);

      await sendTelegramMessage(telegramChatId, lines.join("\n"));
      sent++;
    }

    return NextResponse.json({ ok: true, sent, checked: { staleShifts: shifts.length } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram notify failed" },
      { status: 500 },
    );
  }
}
