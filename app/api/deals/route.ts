import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(), Allow: "GET,POST,OPTIONS" } });
}

export async function GET() {
  try {
    const sb = supabaseAdmin();

    // Keep this fairly broad; your UI can ignore extra fields.
    const { data, error } = await sb
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true, deals: data ?? [] }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const deal_code = String(body?.deal_code || "").trim();
    const deal_deck_id = String(body?.deal_deck_id || "").trim();
    const applicant = String(body?.applicant || "").trim();
    const consultant = String(body?.consultant || "").trim();
    const agent = String(body?.agent || "").trim();
    const stage = String(body?.stage || "submitted").trim().toLowerCase();
    const amount_zar = Number(body?.amount_zar);

    // Optional
    const notes = String(body?.notes || "").trim();

    if (!deal_deck_id) return NextResponse.json({ ok: false, error: "deal_deck_id is required" }, { status: 400, headers: corsHeaders() });
    if (!applicant) return NextResponse.json({ ok: false, error: "applicant is required" }, { status: 400, headers: corsHeaders() });
    if (!consultant) return NextResponse.json({ ok: false, error: "consultant is required" }, { status: 400, headers: corsHeaders() });
    if (!agent) return NextResponse.json({ ok: false, error: "agent is required" }, { status: 400, headers: corsHeaders() });
    if (!Number.isFinite(amount_zar) || amount_zar <= 0) {
      return NextResponse.json({ ok: false, error: "amount_zar must be > 0" }, { status: 400, headers: corsHeaders() });
    }

    const sb = supabaseAdmin();

    // Insert only the fields we know about.
    // If your table doesn't have notes, remove it OR keep it optional (we do optional).
    const insertRow: any = {
      deal_code: deal_code || deal_deck_id,
      deal_deck_id,
      applicant,
      consultant,
      agent,
      amount_zar,
      stage,
    };

    if (notes) insertRow.notes = notes;

    const { data, error } = await sb
      .from("deals")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true, id: data?.id }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}
