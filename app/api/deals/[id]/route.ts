export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { getSessionFromRequest } from "@/app/lib/auth";

function getKeyFromUrl(req: Request): string | null {
  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(String(last)).trim() : null;
  } catch {
    return null;
  }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  const key = service || anon;
  if (!key) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");

  return createClient(url, key, { auth: { persistSession: false } });
}

function fromTable(sb: any, table: string) {
  const schema = process.env.SUPABASE_DB_SCHEMA || "public";
  return typeof sb.schema === "function" ? sb.schema(schema).from(table) : sb.from(table);
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function fetchDealByKey(sb: any, key: string) {
  if (isUuid(key)) {
    const r = await fromTable(sb, "deals").select("*").eq("id", key).maybeSingle();
    if (r.data) return r;
  }
  const r2 = await fromTable(sb, "deals").select("*").eq("deal_code", key).maybeSingle();
  if (r2.data) return r2;

  const r3 = await fromTable(sb, "deals").select("*").eq("id", key).maybeSingle();
  return r3;
}

function normalizeBanks(raw: any): Array<{ bank_name: string }> {
  const out: Array<{ bank_name: string }> = [];
  const pushName = (n: any) => {
    const s = String(n ?? "").trim();
    if (!s) return;
    out.push({ bank_name: s });
  };

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item) continue;
      if (typeof item === "string") pushName(item);
      else pushName(item.bank_name ?? item.bankName ?? item.name ?? item.bank);
    }
  }

  return out;
}

function dedupeBanks(banks: Array<{ bank_name: string }>) {
  const seen = new Set<string>();
  const out: Array<{ bank_name: string }> = [];
  for (const b of banks) {
    const k = String(b?.bank_name ?? "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ bank_name: String(b.bank_name).trim() });
  }
  return out;
}

async function tryLoadBanksFromJoin(sb: any, dealId: string) {
  // try common join table names safely (ignore if they don't exist)
  const candidates = ["deal_banks", "deals_banks"];
  for (const t of candidates) {
    const r = await fromTable(sb, t)
      .select("*")
      .eq("deal_id", dealId);

    if (r.error) {
      // If relation doesn't exist, try next candidate quietly
      const msg = String(r.error.message || "");
      if (msg.toLowerCase().includes("does not exist")) continue;
      // any other error, still skip (we don't want GET to explode)
      continue;
    }

    const rows = Array.isArray(r.data) ? r.data : [];
    const banks = rows.map((x: any) => ({
      bank_name: String(x?.bank_name ?? x?.bank ?? x?.name ?? "").trim(),
    })).filter((x: any) => x.bank_name);

    if (banks.length) return banks;
  }
  return [];
}

export async function GET(req: Request) {
  const key = getKeyFromUrl(req);
  if (!key) return json({ ok: false, error: "Missing id" }, 400);

  if (key.includes("<") || key.toLowerCase().includes("put a deal")) {
    return json({ ok: false, error: "Invalid id/deal_code (replace placeholder)" }, 400);
  }

  try {
    const supabase = getSupabaseServer();
    const res = await fetchDealByKey(supabase, key);

    if (res.error) {
      console.error("DEALS_GET_ERROR:", res.error);
      return json({ ok: false, where: "deals.select", error: res.error.message }, 500);
    }

    if (!res.data) return json({ ok: false, error: "Deal not found" }, 404);

    const dealId = String(res.data.id);

    // banks: prefer actual field, else join table, else single 'bank' string
    let banks = normalizeBanks((res.data as any).banks);

    if (!banks.length) {
      const joinBanks = await tryLoadBanksFromJoin(supabase, dealId);
      banks = normalizeBanks(joinBanks);
    }

    if (!banks.length && (res.data as any).bank) {
      banks = normalizeBanks([{ bank_name: (res.data as any).bank }]);
    }

    banks = dedupeBanks(banks);

    return json({ ok: true, deal: { ...res.data, banks } });
  } catch (e: any) {
    console.error("DEALS_GET_FATAL:", e);
    return json({ ok: false, error: e?.message || "Server error" }, 500);
  }
}

export async function PATCH(req: Request) {
  const key = getKeyFromUrl(req);
  if (!key) return json({ ok: false, error: "Missing id" }, 400);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const supabase = getSupabaseServer();

  // Resolve deal id (UUID or deal_code)
  const dealRes = await fetchDealByKey(supabase, key);
  if (dealRes.error) {
    console.error("DEALS_PATCH_LOOKUP_ERROR:", dealRes.error);
    return json({ ok: false, where: "deals.lookup", error: dealRes.error.message }, 500);
  }
  if (!dealRes.data) return json({ ok: false, error: "Deal not found" }, 404);

  const dealId = String(dealRes.data.id);

  const toStage =
    typeof body?.toStage === "string"
      ? body.toStage
      : typeof body?.stage === "string"
      ? body.stage
      : null;

  const session = getSessionFromRequest(req);
  const headerUser = (req.headers.get("x-cb-user") || "").trim();
  const movedBy =
    session?.name ??
    (headerUser || (typeof body?.movedBy === "string" ? body.movedBy : null));
  const note = typeof body?.note === "string" ? body.note : null;

  const update: Record<string, any> = {};
  if (toStage) update.stage = toStage;

  if (note && note.trim()) update.notes = note.trim();

  if (movedBy && movedBy.trim()) {
    update.last_moved_by = movedBy.trim();
    update.last_moved_at = new Date().toISOString();
  }

  const attorneyRaw = body?.attorney ?? body?.attorney_name ?? body?.attorneyName;
  if (attorneyRaw !== undefined) {
    const v = String(attorneyRaw || "").trim();
    update.attorney = v ? v : null;
  }

  const ntuReasonRaw = body?.ntu_reason ?? body?.ntuReason ?? body?.ntu_reason_text;
  if (ntuReasonRaw !== undefined) {
    const v = String(ntuReasonRaw || "").trim();
    update.ntu_reason = v ? v : null;
  }

  const regPaidRaw = body?.registration_paid ?? body?.registrationPaid;
  if (regPaidRaw !== undefined) {
    const val = regPaidRaw === true || String(regPaidRaw).trim().toLowerCase() === "true";
    update.registration_paid = val;
  }

  const regPaidAtRaw = body?.registration_paid_at ?? body?.registrationPaidAt;
  if (regPaidAtRaw !== undefined) {
    const v = String(regPaidAtRaw || "").trim();
    update.registration_paid_at = v ? v : null;
  }

  const parseBool = (v: any) => {
    if (v === true) return true;
    if (v === false) return false;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "yes" || s === "1") return true;
      if (s === "false" || s === "no" || s === "0") return false;
    }
    if (typeof v === "number") return v === 1 ? true : v === 0 ? false : undefined;
    return undefined;
  };

  const insuranceRaw = body?.insurance_needed ?? body?.insuranceNeeded;
  const insuranceParsed = parseBool(insuranceRaw);
  if (insuranceParsed !== undefined) update.insurance_needed = insuranceParsed;

  // allowlist instructed / registration fields (kept safe)
  const reg = body?.registration && typeof body.registration === "object" ? body.registration : null;

  const pick = (obj: any, keys: string[]) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (typeof v === "string") return v;
    }
    return null;
  };

  const attorney = pick(reg ?? body, ["registration_attorney", "attorney", "attorney_name"]);
  const tel = pick(reg ?? body, ["registration_attorney_tel", "attorney_tel", "attorneyTel", "attorney_phone"]);
  const email = pick(reg ?? body, ["registration_attorney_email", "attorney_email", "attorneyEmail"]);
  const reference = pick(reg ?? body, ["registration_reference", "registration_attorney_reference", "attorney_reference", "attorneyReference", "reference"]);

  if (attorney !== null) update.registration_attorney = attorney?.trim() ? attorney.trim() : null;
  if (tel !== null) update.registration_attorney_tel = tel?.trim() ? tel.trim() : null;
  if (email !== null) update.registration_attorney_email = email?.trim() ? email.trim() : null;
  if (reference !== null) update.registration_attorney_reference = reference?.trim() ? reference.trim() : null;

  const regNo = pick(reg ?? body, ["registration_number",
  "registration_attorney",
  "registration_attorney_tel",
  "payment_due_date",
  "agent_comm_paid", "registrationNumber"]);
  if (regNo !== null) update.registration_number = regNo?.trim() ? regNo.trim() : null;

  const res = await fromTable(supabase, "deals")
    .update(update)
    .eq("id", dealId)
    .select("*")
    .single()
    /* AUTOLOG_DEAL_UPDATES_V1 */
    try {
      const before = await sb.from("deals").select("*").eq("id", dealId).maybeSingle();
      const dealCode = (before as any)?.data?.deal_code ?? null;
      const stage = (before as any)?.data?.stage ?? null;
      const keys = Object.keys(update || {});
      const note = "Updated: " + (keys.length ? keys.join(", ") : "deal");

      await sb.from("deal_activity").insert({
        deal_id: dealId,
        deal_code: dealCode,
        from_stage: stage,
        to_stage: stage,
        moved_by: movedBy || "system",
        actor: movedBy || "system",
        action: "update",
        note,
        moved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch {}
;

  if (res.error) {
    console.error("DEALS_PATCH_ERROR:", res.error);
    return json({ ok: false, where: "deals.update", error: res.error.message }, 500);
  }

  return json({ ok: true, deal: res.data });
}



