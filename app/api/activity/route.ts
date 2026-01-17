import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BUILD = "2026-01-04_activity_from_deal_activity_v2";

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url) throw new Error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (restart dev server after setting .env.local)");
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapRow(a: any) {
  return {
    ...a,
    dealId: a.deal_id,
    dealCode: a.deal_code,
    fromStage: a.from_stage,
    toStage: a.to_stage,
    movedBy: a.moved_by,
    movedAt: a.moved_at,
    createdAt: a.created_at,
  };
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabase();
    const url = new URL(req.url);

    const q = (url.searchParams.get("q") || "").trim();
    const limitRaw = url.searchParams.get("limit") || "200";
    const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 200, 1), 1000);

    let query = supabase
      .from("deal_activity")
      .select("*, note")
      .order("moved_at", { ascending: false })
      .limit(limit);

    if (q) {
      const like = `%${q}%`;
      query = query.or(
        [
          `deal_code.ilike.${like}`,
          `moved_by.ilike.${like}`,
          `actor.ilike.${like}`,
          `note.ilike.${like}`,
          `action.ilike.${like}`,
        ].join(",")
      );
    }

    const r = await query;
    if (r.error) return json({ api_build: API_BUILD, ok: false, error: r.error.message }, 500);

    const items = (r.data ?? []).map(mapRow);

    return json(
      { api_build: API_BUILD, ok: true, items, activity: items, moves: items, rows: items, count: items.length },
      200
    );
  } catch (e: any) {
    return json({ api_build: API_BUILD, ok: false, error: e?.message ?? "Unknown error" }, 500);
  }
}