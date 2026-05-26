import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("services")
      .select(
        "id,name,short_description,image_url,featured_in_lookbook,duration_min,base_price,active,created_at",
      )
      .eq("active", true)
      .eq("featured_in_lookbook", true)
      .order("name", { ascending: true })
      .limit(6);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
  } catch (error) {
    console.error("lookbook GET failed", error);
    return NextResponse.json(
      { ok: false, error: "Khong tai duoc lookbook" },
      { status: 500 },
    );
  }
}
