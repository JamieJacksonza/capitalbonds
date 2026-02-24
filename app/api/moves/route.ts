import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getSupabaseAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dealId = (searchParams.get("dealId") || "").trim();

    // IMPORTANT: Never return global history when dealId is missing
    if (!dealId) {
      return NextResponse.json({ ok: true, moves: [] });
    }
    if (!isUuid(dealId)) {
      return NextResponse.json({ ok: false, error: "Invalid dealId format" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("deal_activity")
      .select("*")
      .eq("deal_id", dealId)
      .order("moved_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ ok: true, moves: data ?? [] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load moves";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
