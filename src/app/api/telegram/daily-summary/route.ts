import { NextResponse } from "next/server";
import { getAdminSupabase, sendTelegramMessage, formatVND } from "@/lib/telegram-bot";

const telegramChatId = process.env.TELEGRAM_BOOKING_CHAT_ID;

export async function POST() {
  try {
    if (!telegramChatId) {
      return NextResponse.json({ ok: false, error: "Thiếu TELEGRAM_BOOKING_CHAT_ID" }, { status: 500 });
    }

    const supabase = getAdminSupabase();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const { data: allOrgs, error: orgError } = await supabase
      .from("orgs")
      .select("id,name");

    if (orgError) throw orgError;

    for (const org of allOrgs ?? []) {
      const { data: tickets, error: ticketError } = await supabase
        .from("tickets")
        .select("id,totals_json")
        .eq("org_id", org.id)
        .eq("status", "CLOSED")
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString());

      if (ticketError) continue;

      const revenue = (tickets ?? []).reduce((sum, t) => sum + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0), 0);
      const billCount = tickets?.length ?? 0;

      const { data: appointments, error: apptError } = await supabase
        .from("appointments")
        .select("id,status")
        .eq("org_id", org.id)
        .gte("start_at", todayStart.toISOString())
        .lt("start_at", todayEnd.toISOString());

      if (apptError) continue;

      const appts = appointments ?? [];
      const doneCount = appts.filter((a) => a.status === "DONE").length;
      const totalAppts = appts.length;

      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 6);
      const { data: weekTickets } = await supabase
        .from("tickets")
        .select("created_at,totals_json")
        .eq("org_id", org.id)
        .eq("status", "CLOSED")
        .gte("created_at", weekStart.toISOString())
        .lt("created_at", todayEnd.toISOString());

      const weekBuckets = new Map<string, number>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        weekBuckets.set(d.toISOString().slice(0, 10), 0);
      }
      for (const t of weekTickets ?? []) {
        const key = String(t.created_at).slice(0, 10);
        const target = weekBuckets.get(key);
        if (target !== undefined) {
          weekBuckets.set(key, target + Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0));
        }
      }

      const weekTotal = [...weekBuckets.values()].reduce((a, b) => a + b, 0);
      const weekAvg = weekTotal / 7;
      const trend = weekAvg > 0 ? Math.round(((revenue - weekAvg) / weekAvg) * 100) : 0;
      const trendIcon = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";

      const { data: staffRows, error: staffError } = await supabase
        .from("appointments")
        .select("id,staff_user_id")
        .eq("org_id", org.id)
        .eq("status", "DONE")
        .gte("start_at", todayStart.toISOString())
        .lt("start_at", todayEnd.toISOString());

      let staffLines: string[] = [];
      if (!staffError && staffRows?.length) {
        const apptIds = staffRows.map((s) => s.id);
        const { data: staffTickets } = await supabase
          .from("tickets")
          .select("id,appointment_id,totals_json")
          .eq("org_id", org.id)
          .eq("status", "CLOSED")
          .in("appointment_id", apptIds);

        const apptMap = new Map(staffRows.map((s) => [s.id as string, s.staff_user_id as string | null]));
        const staffTotals = new Map<string, { name: string; revenue: number; count: number }>();

        const staffIds = [...new Set(staffRows.map((s) => s.staff_user_id).filter((v): v is string => Boolean(v)))];
        if (staffIds.length) {
          const { data: staffProfiles } = await supabase
            .from("profiles")
            .select("user_id,display_name")
            .in("user_id", staffIds);
          const nameMap = new Map((staffProfiles ?? []).map((p) => [p.user_id as string, ((p.display_name as string | null) || "-")]));

          for (const t of staffTickets ?? []) {
            const staffId = t.appointment_id ? apptMap.get(t.appointment_id as string) : null;
            if (!staffId) continue;
            const prev = staffTotals.get(staffId) ?? { name: nameMap.get(staffId) ?? "-", revenue: 0, count: 0 };
            prev.revenue += Number((t.totals_json as { grand_total?: number } | null)?.grand_total ?? 0);
            prev.count += 1;
            staffTotals.set(staffId, prev);
          }
        }

        staffLines = [...staffTotals.entries()]
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .map(([, v]) => `  • ${v.name}: ${formatVND(v.revenue)} (${v.count} bill)`);
      }

      const lines = [
        `<b>📊 TỔNG KẾT NGÀY ${org.name}</b>`,
        "",
        `💰 Doanh thu: <b>${formatVND(revenue)}</b> (${billCount} bill)`,
        `📋 Lịch: <b>${doneCount}/${totalAppts}</b> hoàn thành`,
        `📈 So với TB 7 ngày: ${trendIcon} ${Math.abs(trend)}%`,
        "",
        staffLines.length > 0 ? ["<b>Theo nhân viên:</b>", ...staffLines].join("\n") : "",
      ].filter(Boolean).join("\n");

      await sendTelegramMessage(telegramChatId, lines);
    }

    return NextResponse.json({ ok: true, orgs: (allOrgs ?? []).length });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Daily summary failed" },
      { status: 500 },
    );
  }
}
