import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_FIELDS = ["consultant", "name_and_surname", "cell", "email", "agency", "area", "notes"] as const;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function cleanValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(), Allow: "GET,POST,PATCH,DELETE,OPTIONS" } });
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("calls")
      .select("*")
      .order("consultant", { ascending: true, nullsFirst: false })
      .order("name_and_surname", { ascending: true, nullsFirst: false })
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
    const row: Record<string, string | null> = {};

    for (const field of CALL_FIELDS) {
      row[field] = cleanValue(body?.[field]);
    }

    if (!row.name_and_surname) {
      return NextResponse.json({ ok: false, error: "Name and Surname is required" }, { status: 400, headers: corsHeaders() });
    }

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase.from("calls").insert(row).select("*").single();

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

    const update: Record<string, string | null> = {};
    for (const field of CALL_FIELDS) {
      if (body?.[field] !== undefined) update[field] = cleanValue(body[field]);
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400, headers: corsHeaders() });
    }

    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase.from("calls").update(update).eq("id", id).select("*").single();

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

    const supabase = getSupabaseAdmin() as any;
    const { error } = await supabase.from("calls").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Server error" }, { status: 500, headers: corsHeaders() });
  }
}
