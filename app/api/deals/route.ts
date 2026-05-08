import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/app/lib/auth";

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

function isAdminSession(session: any) {
  return String(session?.role || "").toLowerCase() === "admin";
}

function shouldIgnoreRelatedTableError(error: any) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("relationship") ||
    msg.includes("schema cache")
  );
}

async function loadRelatedRows(sb: any, dealIds: string[]) {
  if (!dealIds.length) return { dealBanks: [], bankNotes: [] };

  const [dealBanksRes, bankNotesRes] = await Promise.all([
    sb
      .from("deal_banks")
      .select("*")
      .in("deal_id", dealIds),
    sb
      .from("bank_notes")
      .select("id, deal_id, stage, bank_name, bank_notes, bank_reference, updated_at")
      .in("deal_id", dealIds),
  ]);

  if (dealBanksRes.error && !shouldIgnoreRelatedTableError(dealBanksRes.error)) {
    console.warn("DEALS_LIST_DEAL_BANKS_ERROR:", dealBanksRes.error);
  }

  if (bankNotesRes.error && !shouldIgnoreRelatedTableError(bankNotesRes.error)) {
    console.warn("DEALS_LIST_BANK_NOTES_ERROR:", bankNotesRes.error);
  }

  return {
    dealBanks: dealBanksRes.error ? [] : dealBanksRes.data ?? [],
    bankNotes: bankNotesRes.error ? [] : bankNotesRes.data ?? [],
  };
}

function attachRelatedRows(deals: any[], dealBanks: any[], bankNotes: any[]) {
  const banksByDeal = new Map<string, any[]>();
  const notesByDeal = new Map<string, any[]>();

  for (const row of dealBanks) {
    const dealId = String(row?.deal_id || "").trim();
    if (!dealId) continue;
    banksByDeal.set(dealId, [...(banksByDeal.get(dealId) || []), row]);
  }

  for (const row of bankNotes) {
    const dealId = String(row?.deal_id || "").trim();
    if (!dealId) continue;
    notesByDeal.set(dealId, [...(notesByDeal.get(dealId) || []), row]);
  }

  return deals.map((deal) => {
    const dealId = String(deal?.id || "").trim();
    const deal_banks = dealId ? banksByDeal.get(dealId) || [] : [];
    const bank_notes_rows = dealId ? notesByDeal.get(dealId) || [] : [];

    return {
      ...deal,
      deal_banks,
      bank_notes_rows,
      banks: Array.isArray(deal?.banks) && deal.banks.length ? deal.banks : deal_banks,
    };
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...corsHeaders(), Allow: "GET,POST,OPTIONS" } });
}

export async function GET(req: Request) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401, headers: corsHeaders() });
    }

    const sb = supabaseAdmin();

    let query = sb
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    const deals = data ?? [];
    const dealIds = deals
      .map((deal: any) => String(deal?.id || "").trim())
      .filter(Boolean);
    const related = await loadRelatedRows(sb, dealIds);

    return NextResponse.json(
      { ok: true, deals: attachRelatedRows(deals, related.dealBanks, related.bankNotes) },
      { status: 200, headers: corsHeaders() }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    if (message.includes("Missing env vars")) {
      return NextResponse.json({ ok: true, deals: [] }, { status: 200, headers: corsHeaders() });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: corsHeaders() });
  }
}

export async function POST(req: Request) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401, headers: corsHeaders() });
    }

    const body = await req.json().catch(() => null);

    const parseMoney = (v: unknown) => {
      const raw = String(v ?? "").replace(/[^\d.]/g, "");
      if (!raw) return NaN;
      return Number(raw);
    };
    const MAX_INT_32 = 2147483647;

    const deal_code = String(body?.deal_code || "").trim();
    const deal_deck_id = String(body?.deal_deck_id || "").trim();
    const applicant = String(body?.applicant || "").trim();
    const consultantInput = String(body?.consultant || "").trim();
    const consultant = isAdminSession(session) ? consultantInput : String(session.name || "").trim();
    const agent = String(body?.agent || "").trim();
    const stage = String(body?.stage || "submitted").trim().toLowerCase();
    const amount_zar = parseMoney(body?.amount_zar);
    const purchase_price =
      body?.purchase_price === undefined ? undefined : parseMoney(body?.purchase_price);
    const client_main_bank = String(body?.client_main_bank || "").trim();
    const client_email = String(body?.client_email || "").trim();
    const client_cellphone = String(body?.client_cellphone || "").trim();
    const bond_due_date = String(body?.bond_due_date || body?.bondDueDate || "").trim();

    const notes = String(body?.notes || "").trim();

    if (!deal_deck_id) return NextResponse.json({ ok: false, error: "deal_deck_id is required" }, { status: 400, headers: corsHeaders() });
    if (!applicant) return NextResponse.json({ ok: false, error: "applicant is required" }, { status: 400, headers: corsHeaders() });
    if (!consultant) return NextResponse.json({ ok: false, error: "consultant is required" }, { status: 400, headers: corsHeaders() });
    if (!agent) return NextResponse.json({ ok: false, error: "agent is required" }, { status: 400, headers: corsHeaders() });
    if (!Number.isFinite(amount_zar) || amount_zar <= 0) {
      return NextResponse.json({ ok: false, error: "amount_zar must be > 0" }, { status: 400, headers: corsHeaders() });
    }
    if (amount_zar > MAX_INT_32) {
      return NextResponse.json({ ok: false, error: "amount_zar is too large" }, { status: 400, headers: corsHeaders() });
    }
    if (purchase_price !== undefined && (!Number.isFinite(purchase_price) || purchase_price <= 0)) {
      return NextResponse.json({ ok: false, error: "purchase_price must be > 0" }, { status: 400, headers: corsHeaders() });
    }
    if (purchase_price !== undefined && purchase_price > MAX_INT_32) {
      return NextResponse.json({ ok: false, error: "purchase_price is too large" }, { status: 400, headers: corsHeaders() });
    }

    const sb = supabaseAdmin();

    const insertRow: Record<string, unknown> = {
      deal_code: deal_code || deal_deck_id,
      deal_deck_id,
      applicant,
      consultant,
      agent,
      amount_zar,
      stage,
    };

    if (client_main_bank) insertRow.client_main_bank = client_main_bank;
    if (purchase_price !== undefined) insertRow.purchase_price = purchase_price;
    if (client_email) insertRow.client_email = client_email;
    if (client_cellphone) insertRow.client_cellphone = client_cellphone;
    if (bond_due_date) insertRow.bond_due_date = bond_due_date.slice(0, 10);
    if (notes) insertRow.notes = notes;

    const { data, error } = await sb
      .from("deals")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      const msg = String(error.message || "");
      const code = String((error as { code?: unknown })?.code ?? "");
      if (
        code === "23505" ||
        msg.toLowerCase().includes("duplicate key value") ||
        msg.includes("deals_deal_code_key")
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `A deal with code '${String(insertRow.deal_code || "")}' already exists. Use a unique Deal Ops Number.`,
          },
          { status: 409, headers: corsHeaders() }
        );
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: corsHeaders() });
    }

    return NextResponse.json({ ok: true, id: data?.id }, { status: 200, headers: corsHeaders() });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: corsHeaders() });
  }
}
