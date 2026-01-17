# Fix StatusBankNotesCard + bank-notes route + make layout full-width
param()

function Backup-IfPossible([string]$Path) {
  if (Test-Path -LiteralPath ".\scripts\backup-helper.ps1") {
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
    . .\scripts\backup-helper.ps1
    if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
      if (Test-Path -LiteralPath $Path) { Backup-File -Path $Path | Out-Null }
    }
  }
}

# -------------------------
# 1) Overwrite StatusBankNotesCard.tsx (CLEAN + SMALLER UI)
# -------------------------
$cardFile = ".\app\deal\[id]\StatusBankNotesCard.tsx"
Backup-IfPossible $cardFile

$cardContent = @"
"use client";

import { useEffect, useMemo, useState } from "react";

type BankApiRow = {
  id: string;
  bank_name: string;
  bank_notes: string | null;
};

type Props = {
  dealKey: string;
  amountZar: number;
  stage?: string;
};

function money(n: number) {
  const v = Number(n || 0);
  return "R " + v.toLocaleString("en-ZA");
}

function normBankName(v: any) {
  return String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

const BANKS = [
  { key: "FNB", label: "FNB" },
  { key: "ABSA", label: "ABSA" },
  { key: "NEDBANK", label: "NEDBANK" },
  { key: "STANDARD BANK", label: "STANDARD BANK" },
  { key: "INVESTEC", label: "INVESTEC" },
  { key: "OTHER", label: "OTHER" },
] as const;

type BankKey = (typeof BANKS)[number]["key"];

export default function StatusBankNotesCard({ dealKey, amountZar, stage }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Always editable columns (even if no bank existed previously)
  const [rows, setRows] = useState<Record<BankKey, { id?: string; bank_name: string; note: string }>>(() => {
    const base: any = {};
    for (const b of BANKS) base[b.key] = { bank_name: b.key, note: "", id: undefined };
    return base;
  });

  const title = useMemo(() => "STATUS", []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const key = String(dealKey || "").trim();
        if (!key) {
          setErr("Missing deal id/deal_code");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/deals/${encodeURIComponent(key)}/bank-notes`, { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load bank notes");

        const apiBanks: BankApiRow[] = Array.isArray(json?.banks) ? json.banks : [];

        const next: any = {};
        for (const b of BANKS) next[b.key] = { bank_name: b.key, note: "", id: undefined };

        for (const r of apiBanks) {
          const name = normBankName(r?.bank_name);
          const note = String(r?.bank_notes ?? "").trim();
          const id = r?.id ? String(r.id) : undefined;

          const hit = BANKS.find((b) => b.key === name);
          if (hit) {
            next[hit.key] = { bank_name: hit.key, note, id };
            continue;
          }

          if (name.includes("STANDARD") && name.includes("BANK")) {
            next["STANDARD BANK"] = { bank_name: "STANDARD BANK", note, id };
            continue;
          }

          // dump unknowns into OTHER (append)
          if (note) {
            const prev = String(next["OTHER"]?.note ?? "");
            const line = `${name}: ${note}`;
            next["OTHER"].note = prev ? (prev + "\n" + line) : line;
          }
          if (id && !next["OTHER"]?.id) next["OTHER"].id = id;
        }

        if (!alive) return;
        setRows(next);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Failed to load bank notes");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [dealKey]);

  function setNote(k: BankKey, v: string) {
    setRows((p) => ({
      ...p,
      [k]: { ...(p[k] || { bank_name: k }), note: v },
    }));
  }

  async function save() {
    try {
      setBusy(true);
      setErr(null);

      const key = String(dealKey || "").trim();
      if (!key) throw new Error("Missing deal id/deal_code");

      const payload = {
        stage: String(stage || "").trim().toLowerCase() || "submitted",
        bankNotes: BANKS.map((b) => {
          const r = rows[b.key];
          return {
            bankId: r?.id ?? null,
            id: r?.id ?? null,
            bank_name: b.key,
            bankName: b.key,
            note: String(r?.note ?? ""),
          };
        }),
      };

      const res = await fetch(`/api/deals/${encodeURIComponent(key)}/bank-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Failed to save (${res.status})`);

      // reload to pick up ids
      const reload = await fetch(`/api/deals/${encodeURIComponent(key)}/bank-notes`, { cache: "no-store" });
      const reloadJson = await reload.json().catch(() => ({} as any));
      if (reload.ok && reloadJson?.ok && Array.isArray(reloadJson?.banks)) {
        const apiBanks: BankApiRow[] = reloadJson.banks;

        const next: any = {};
        for (const b of BANKS) next[b.key] = { bank_name: b.key, note: String(rows[b.key]?.note ?? ""), id: rows[b.key]?.id };

        for (const r of apiBanks) {
          const name = normBankName(r?.bank_name);
          const id = r?.id ? String(r.id) : undefined;
          const note = String(r?.bank_notes ?? "").trim();
          const hit = BANKS.find((b) => b.key === name);
          if (hit) next[hit.key] = { bank_name: hit.key, note, id };
        }

        setRows(next);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to save bank notes");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
        <div>
          <div className="text-[11px] font-extrabold tracking-wide text-black/50">{title}</div>
          <div className="mt-1 text-base font-extrabold text-black">Bank notes by bank (editable)</div>
        </div>

        <button
          onClick={save}
          disabled={busy || loading}
          className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save"}
        </button>
      </div>

      {err ? <div className="px-5 py-3 text-xs font-semibold text-red-600">{err}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1150px] text-left">
          <thead className="border-b border-black/10 bg-white">
            <tr className="text-[11px] font-extrabold text-black/70">
              <th className="px-5 py-3">Amount</th>
              {BANKS.map((b) => (
                <th key={b.key} className="px-5 py-3">{b.label}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            <tr className="align-top">
              <td className="px-5 py-4">
                <div className="text-xl font-extrabold text-black leading-tight">{money(amountZar)}</div>
              </td>

              {BANKS.map((b) => (
                <td key={b.key} className="px-5 py-4">
                  <textarea
                    value={String(rows[b.key]?.note ?? "")}
                    onChange={(e) => setNote(b.key, e.target.value)}
                    className="h-20 w-[190px] resize rounded-xl border border-black/10 bg-white p-3 text-xs font-semibold text-black outline-none focus:border-black/20"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
"@

Set-Content -LiteralPath $cardFile -Value $cardContent -Encoding UTF8
Write-Host "WROTE:" -ForegroundColor Green
Write-Host "  $cardFile" -ForegroundColor Green

# -------------------------
# 2) Overwrite bank-notes route.ts (CLEAN, upsert-capable, no duplicates)
# -------------------------
$routeFile = ".\app\api\deals\[id]\bank-notes\route.ts"
Backup-IfPossible $routeFile

$routeContent = @"
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED = ["submitted", "aip", "instructed", "granted", "ntu", "registrations"] as const;
type Stage = (typeof ALLOWED)[number];

function supaAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

  if (!url || !key) {
    throw new Error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).");
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function normStage(v: unknown): Stage {
  const s = String(v || "").trim().toLowerCase();
  return (ALLOWED as readonly string[]).includes(s) ? (s as Stage) : "submitted";
}

async function resolveDealId(supabase: any, key: string) {
  const k = String(key || "").trim();
  if (!k) return null;

  const byId = await supabase.from("deals").select("id").eq("id", k).maybeSingle();
  if (!byId.error && byId.data?.id) return byId.data.id as string;

  const byCode = await supabase.from("deals").select("id").eq("deal_code", k).maybeSingle();
  if (!byCode.error && byCode.data?.id) return byCode.data.id as string;

  return null;
}

function normBankName(v: any) {
  return String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

async function handler(req: Request, ctx: { params: { id: string } }) {
  try {
    const paramsAny = await Promise.resolve(ctx?.params);
    const incomingKey = String(paramsAny?.id || "").trim();
    if (!incomingKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing deal id" }), { status: 400 });
    }

    const supabase = supaAdmin();
    const body = await req.json().catch(() => ({} as any));
    const stage = normStage(body?.stage);

    const realDealId = await resolveDealId(supabase, incomingKey);
    if (!realDealId) {
      return new Response(JSON.stringify({ ok: false, error: "Deal not found (bad id/deal_code)" }), { status: 404 });
    }

    const list = Array.isArray(body?.bankNotes) ? body.bankNotes : [];
    let updatedCount = 0;
    let insertedCount = 0;

    for (const item of list) {
      const bankId = String(item?.bankId ?? item?.id ?? "").trim();
      const bankNameRaw = item?.bank_name ?? item?.bankName ?? item?.bank ?? item?.name ?? "";
      const bank_name = normBankName(bankNameRaw);

      const bank_notes = String(item?.note ?? item?.bank_notes ?? item?.bankNotes ?? "").trim() || null;
      const attorney = String(item?.attorney ?? item?.firm ?? "").trim() || null;
      const attorney_note = String(item?.attorney_note ?? item?.attorneyNote ?? item?.attorney_notes ?? "").trim() || null;

      // If an id exists, update directly
      if (bankId) {
        const { data, error } = await supabase
          .from("deal_banks")
          .update({
            bank_notes,
            attorney,
            attorney_note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", bankId)
          .eq("deal_id", realDealId)
          .select("id");

        if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        if (Array.isArray(data) && data.length > 0) updatedCount += data.length;
        continue;
      }

      // No id: upsert by (deal_id + bank_name)
      if (!bank_name) continue;

      const existing = await supabase
        .from("deal_banks")
        .select("id")
        .eq("deal_id", realDealId)
        .eq("bank_name", bank_name)
        .maybeSingle();

      if (!existing.error && existing.data?.id) {
        const { data, error } = await supabase
          .from("deal_banks")
          .update({
            bank_notes,
            attorney,
            attorney_note,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.data.id)
          .eq("deal_id", realDealId)
          .select("id");

        if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        if (Array.isArray(data) && data.length > 0) updatedCount += data.length;
      } else {
        const ins = await supabase
          .from("deal_banks")
          .insert({
            deal_id: realDealId,
            bank_name,
            bank_notes,
            attorney,
            attorney_note,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id");

        if (ins.error) return new Response(JSON.stringify({ ok: false, error: ins.error.message }), { status: 500 });
        if (Array.isArray(ins.data) && ins.data.length > 0) insertedCount += ins.data.length;
      }
    }

    // Non-blocking activity insert
    try {
      const before = await supabase.from("deals").select("deal_code, stage").eq("id", realDealId).maybeSingle();
      const dealCode = before.data?.deal_code ?? null;
      const stageNow = before.data?.stage ?? null;

      await supabase.from("deal_activity").insert({
        deal_id: realDealId,
        deal_code: dealCode,
        from_stage: stageNow,
        to_stage: stageNow,
        moved_by: "system",
        actor: "system",
        action: "bank_notes",
        note: "Bank notes updated",
        moved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch {}

    return new Response(JSON.stringify({ ok: true, stage, updatedCount, insertedCount }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Failed to update bank notes" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}

export async function GET(req: Request, ctx: any) {
  try {
    const paramsAny = await Promise.resolve(ctx?.params);
    const fromParams = String(paramsAny?.id || "").trim();

    const parts = new URL(req.url).pathname.split("/").filter(Boolean);
    const fromPath = String(parts[parts.length - 2] || "").trim(); // .../deals/{id}/bank-notes
    const incomingKey = (fromParams || fromPath || "").trim();

    if (!incomingKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing deal id" }), { status: 400 });
    }

    const supabase = supaAdmin();
    const realDealId = await resolveDealId(supabase, incomingKey);
    if (!realDealId) {
      return new Response(JSON.stringify({ ok: false, error: "Deal not found (bad id/deal_code)" }), { status: 404 });
    }

    const banks = await supabase
      .from("deal_banks")
      .select("id, bank_name, bank_notes, attorney, attorney_note, updated_at, created_at")
      .eq("deal_id", realDealId)
      .order("created_at", { ascending: true });

    if (banks.error) {
      return new Response(JSON.stringify({ ok: false, error: banks.error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, dealId: realDealId, banks: banks.data ?? [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Failed to load bank notes" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  return handler(req, ctx);
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  return handler(req, ctx);
}
"@

Set-Content -LiteralPath $routeFile -Value $routeContent -Encoding UTF8
Write-Host "WROTE:" -ForegroundColor Green
Write-Host "  $routeFile" -ForegroundColor Green

# -------------------------
# 3) Make layout wrappers full width:
#    Patch files that include {children} AND max-w-*
# -------------------------
$files = Get-ChildItem -Recurse .\app -File -Filter *.tsx
$changed = 0

foreach ($f in $files) {
  $raw = Get-Content -LiteralPath $f.FullName -Raw
  if ($raw -notmatch '\{children\}' -or $raw -notmatch 'max-w-') { continue }

  Backup-IfPossible $f.FullName

  $new = $raw

  # Replace max-w-?xl with max-w-none
  $new = [regex]::Replace($new, '\bmax-w-\d+xl\b', 'max-w-none')

  # Ensure w-full is present when mx-auto exists in same class string containing max-w-
  # Insert "w-full" after mx-auto if missing (within className="...")
  $new = [regex]::Replace(
    $new,
    '(className="[^"]*?)mx-auto(?![^"]*\bw-full\b)([^"]*?max-w-none[^"]*?")',
    '$1mx-auto w-full$2'
  )

  if ($new -ne $raw) {
    Set-Content -LiteralPath $f.FullName -Value $new -Encoding UTF8
    Write-Host "FULL-WIDTH PATCHED:" -ForegroundColor Cyan
    Write-Host "  $($f.FullName)" -ForegroundColor Cyan
    $changed++
  }
}

if ($changed -eq 0) {
  Write-Host "No {children}+max-w-* wrappers found to patch (maybe wrapper is in a .ts or .jsx file)." -ForegroundColor Yellow
} else {
  Write-Host "Done. Patched $changed layout file(s) to full width." -ForegroundColor Green
}
