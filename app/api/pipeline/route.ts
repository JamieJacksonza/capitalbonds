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
  if (!url || !key) throw new Error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(), Allow: "GET,POST,OPTIONS" } });
}

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("pipeline_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }
    return NextResponse.json({ ok: true, rows: data ?? [] }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const row = {
      lead_date: body?.lead_date || null,
      lead_type: body?.lead_type || null,
      consultant: body?.consultant || null,
      agent: body?.agent || null,
      lead_source: body?.lead_source || null,
      client_name: body?.client_name || null,
      client_email: body?.client_email || null,
      client_cellphone: body?.client_cellphone || null,
      loan_amount: body?.loan_amount ? Number(body.loan_amount) : null,
      bond_amount: body?.bond_amount ? Number(body.bond_amount) : null,
      purchase_price: body?.purchase_price ? Number(body.purchase_price) : null,
      notes: body?.notes || null,
      follow_up_date: body?.follow_up_date || null,
    };

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("pipeline_leads")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }
    return NextResponse.json({ ok: true, row: data }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400, headers: corsHeaders() });
    }

    const update: any = {};
    if (body?.lead_type !== undefined) update.lead_type = body.lead_type || null;

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("pipeline_leads")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }
    return NextResponse.json({ ok: true, row: data }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const id = String(body?.id || "").trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400, headers: corsHeaders() });
    }
    const sb = supabaseAdmin();
    const del = await sb.from("pipeline_leads").delete().eq("id", id);
    if (del.error) {
      return NextResponse.json({ ok: false, error: del.error.message }, { status: 500, headers: corsHeaders() });
    }
    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}
