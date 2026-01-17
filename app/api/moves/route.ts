import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dealId = (searchParams.get("dealId") || "").trim();

    // IMPORTANT: Never return global history when dealId is missing
    if (!dealId) {
      return NextResponse.json({ ok: true, moves: [] });
    }

    const { data, error } = await supabase
      .from("deal_activity")
      .select("*")
      .eq("deal_id", dealId)
      .order("moved_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ ok: true, moves: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to load moves" },
      { status: 500 }
    );
  }
}


