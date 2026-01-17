import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STAGES = new Set([
  "submitted",
  "aip",
  "instructed",
  "granted",
  "ntu",
  "registrations",
]);

const DEFAULT_BANKS = [
  "ABSA",
  "FNB",
  "Investec",
  "Nedbank",
  "Standard Bank",
  "Other",
];

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
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
  return new NextResponse(null, {
    status: 204,
    headers: { ...corsHeaders(), Allow: "GET,PUT,OPTIONS" },
  });
}

export async function GET(req: Request) {
  try {
    console.log("BANK-NOTES GET URL:", req.url);

    const { searchParams } = new URL(req.url);
    const dealId = (searchParams.get("dealId") || "").trim();
    const stage = "global";

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400, headers: corsHeaders() });
    }
    if (!stage || !ALLOWED_STAGES.has(stage)) {
      return NextResponse.json({ error: "Valid stage is required" }, { status: 400, headers: corsHeaders() });
    }

    const sb = supabaseAdmin();

    // Fetch saved notes (include id)
    const { data, error } = await sb
      .from("bank_notes")
      .select("id, deal_id, stage, bank_name, bank_notes, updated_at")
      .eq("deal_id", dealId)
      .eq("stage", stage)
      .order("bank_name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
    }

    let rows = data ?? [];

    // If nothing saved yet, return a "ready-to-render" template list (with ids)
    if (rows.length === 0) {
      const banksRes = await sb
        .from("deal_banks")
        .select("bank_name")
        .eq("deal_id", dealId)
        .order("bank_name", { ascending: true });

      const inferred = (banksRes.data ?? [])
        .map((b: any) => String(b?.bank_name || "").trim())
        .filter(Boolean);

      const list = inferred.length ? inferred : DEFAULT_BANKS;

      rows = list.map((name: string) => ({
        id: randomUUID(),
        deal_id: dealId,
        stage,
        bank_name: name,
        bank_notes: "",
        updated_at: new Date().toISOString(),
      }));
    }

    return NextResponse.json({ dealId, stage, rows }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const dealId = String(body?.dealId || "").trim();
    const stage = "global";
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400, headers: corsHeaders() });
    }
    if (!stage || !ALLOWED_STAGES.has(stage)) {
      return NextResponse.json({ error: "Valid stage is required" }, { status: 400, headers: corsHeaders() });
    }

    const cleaned = rows
      .map((r: any) => ({
        bank_name: String(r?.bank_name || "").trim(),
        bank_notes: String(r?.bank_notes || "").trim(),
      }))
      .filter((r: any) => r.bank_name.length > 0);

    const sb = supabaseAdmin();

    // wipe + insert (no unique constraint required)
    const del = await sb.from("bank_notes").delete().eq("deal_id", dealId).eq("stage", stage);
    if (del.error) {
      return NextResponse.json({ error: del.error.message }, { status: 500, headers: corsHeaders() });
    }

    if (cleaned.length === 0) {
      return NextResponse.json({ ok: true, deleted: true, inserted: 0 }, { status: 200, headers: corsHeaders() });
    }

    const insertRows = cleaned.map((r: any) => ({
      deal_id: dealId,
      stage,
      bank_name: r.bank_name,
      bank_notes: r.bank_notes,
    }));

    const ins = await sb.from("bank_notes").insert(insertRows);
    if (ins.error) {
      return NextResponse.json({ error: ins.error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true, inserted: insertRows.length }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}

