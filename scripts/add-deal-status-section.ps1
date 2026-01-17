param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# 1) Find the View Deal TSX file by looking for BOTH "Client details" and "Stage inputs"
$dealFile = $null
$candidates = Get-ChildItem -Recurse .\app -File -Filter "*.tsx"

foreach ($f in $candidates) {
  $p = $f.FullName
  try {
    $hasStage = Select-String -LiteralPath $p -Pattern "Stage inputs" -Quiet -ErrorAction SilentlyContinue
    if (-not $hasStage) { continue }
    $hasClient = Select-String -LiteralPath $p -Pattern "Client details" -Quiet -ErrorAction SilentlyContinue
    if (-not $hasClient) { continue }
    $dealFile = $p
    break
  } catch {}
}

if (-not $dealFile) {
  Write-Host "Could not find the View Deal file (no TSX contains both 'Client details' and 'Stage inputs')." -ForegroundColor Red
  Write-Host "Run this and paste output:" -ForegroundColor Yellow
  Write-Host "Get-ChildItem -Recurse .\app -File -Filter *.tsx | Select-String -Pattern `"Client details|Stage inputs`" | Select-Object -First 40" -ForegroundColor Cyan
  exit 1
}

Write-Host "Found View Deal file:" -ForegroundColor Green
Write-Host "  $dealFile" -ForegroundColor Green

$dir = Split-Path $dealFile -Parent
$compPath = Join-Path $dir "StatusBankNotesCard.tsx"

# Backup helper (if exists)
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
  if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
    Backup-File -Path $dealFile | Out-Null
    if (Test-Path $compPath) { Backup-File -Path $compPath | Out-Null }
  }
}

# 2) Create the STATUS component next to the deal file (so we can import with ./StatusBankNotesCard)
$component = @"
"use client";

import { useEffect, useMemo, useState } from "react";

type BankRow = {
  id: string;
  bank_name: string;
  bank_notes: string | null;
};

function money(n: any) {
  const v = Number(n || 0);
  return `R ${v.toLocaleString("en-ZA")}`;
}

function norm(s: any) {
  return String(s ?? "").trim().toUpperCase();
}

function pickStage(s: any) {
  const v = String(s ?? "").trim().toLowerCase();
  if (!v) return "submitted";
  if (v === "arp") return "aip";
  if (v === "instructions" || v === "instruct") return "instructed";
  if (v === "registration" || v === "regs" || v === "reg") return "registrations";
  if (v === "grant" || v === "approved") return "granted";
  return v;
}

const COLS = [
  { key: "FNB", label: "FNB", match: ["FNB"] },
  { key: "ABSA", label: "ABSA", match: ["ABSA"] },
  { key: "NEDBANK", label: "NEDBANK", match: ["NEDBANK"] },
  { key: "STANDARD BANK", label: "STANDARD BANK", match: ["STANDARD", "STANDARD BANK"] },
  { key: "INVESTEC", label: "INVESTEC", match: ["INVESTEC"] },
  { key: "OTHER", label: "OTHER", match: ["OTHER"] },
] as const;

function findBankRow(rows: BankRow[], colKey: string) {
  const K = norm(colKey);

  // exact-ish first
  const exact = rows.find(r => norm(r.bank_name) === K);
  if (exact) return exact;

  // contains match
  const col = COLS.find(c => c.key === colKey);
  const matchers = col ? col.match : [colKey];

  const r2 = rows.find(r => {
    const n = norm(r.bank_name);
    return matchers.some(m => n.includes(norm(m)));
  });

  return r2 || null;
}

export default function StatusBankNotesCard(props: { dealKey: string; amountZar: number; stage?: string }) {
  const dealKey = String(props.dealKey || "").trim();
  const amountZar = Number(props.amountZar || 0);
  const stage = pickStage(props.stage);

  const [rows, setRows] = useState<BankRow[]>([]);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!dealKey) return;

    setLoading(true);
    setMsg(null);

    (async () => {
      try {
        const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}/bank-notes`, { cache: "no-store" });
        const json = await res.json().catch(() => ({} as any));
        const list = Array.isArray(json?.banks) ? json.banks : [];

        const mapped: BankRow[] = list.map((b: any) => ({
          id: String(b?.id ?? ""),
          bank_name: String(b?.bank_name ?? b?.bankName ?? b?.name ?? ""),
          bank_notes: b?.bank_notes ?? b?.bankNotes ?? null,
        })).filter((b: BankRow) => b.id && b.bank_name);

        setRows(mapped);

        const next: Record<string, string> = {};
        for (const r of mapped) {
          next[r.id] = String(r.bank_notes ?? "");
        }
        setNotesById(next);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load bank notes");
      } finally {
        setLoading(false);
      }
    })();
  }, [dealKey]);

  const table = useMemo(() => {
    const map: Record<string, BankRow | null> = {};
    for (const c of COLS) map[c.key] = findBankRow(rows, c.key);
    return map;
  }, [rows]);

  async function saveAll() {
    if (!dealKey) return;
    setSaving(true);
    setMsg(null);

    try {
      const bankNotes = Object.values(table)
        .filter(Boolean)
        .map((r: any) => ({
          bankId: r.id,
          note: String(notesById[r.id] ?? "").trim(),
        }));

      const res = await fetch(`/api/deals/${encodeURIComponent(dealKey)}/bank-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, bankNotes }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 2500);
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
        <div>
          <div className="text-xs font-extrabold text-black/60">STATUS</div>
          <div className="mt-1 text-sm font-semibold text-black/70">
            Bank notes by bank (editable)
          </div>
        </div>

        <div className="flex items-center gap-3">
          {loading ? <div className="text-xs font-semibold text-black/50">Loading</div> : null}
          {msg ? <div className="text-xs font-extrabold text-black/70">{msg}</div> : null}
          <button
            onClick={saveAll}
            disabled={saving || loading || !dealKey}
            className="rounded-2xl bg-black px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left">
          <thead className="border-b border-black/10 bg-white">
            <tr className="text-xs font-extrabold text-black/70">
              <th className="px-4 py-3">Amount</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-4 py-3">{c.label}</th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-black/10">
            <tr>
              <td className="px-4 py-4 text-sm font-extrabold text-black">{money(amountZar)}</td>

              {COLS.map((c) => {
                const row = table[c.key];
                const disabled = !row?.id;

                return (
                  <td key={c.key} className="px-4 py-4 align-top">
                    <textarea
                      value={row?.id ? (notesById[row.id] ?? "") : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!row?.id) return;
                        setNotesById((p) => ({ ...p, [row.id]: v }));
                      }}
                      disabled={disabled}
                      placeholder={disabled ? "Not on this deal" : "Enter bank note"}
                      className="min-h-[64px] w-full rounded-xl border border-black/10 bg-white p-3 text-xs font-semibold text-black placeholder:text-black/30 disabled:bg-black/[0.02]"
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
"@

Set-Content -LiteralPath $compPath -Value $component -Encoding UTF8
Write-Host "Created component:" -ForegroundColor Green
Write-Host "  $compPath" -ForegroundColor Green

# 3) Patch the deal file: add import + insert component right above the "Stage inputs" heading node
$orig = Get-Content -LiteralPath $dealFile -Raw
$new = $orig

# Add import if missing
if ($new -notmatch "StatusBankNotesCard") {
  $new = [regex]::Replace(
    $new,
    '(\r?\n)(\r?\n)',
    "`$1import StatusBankNotesCard from `"./StatusBankNotesCard`";`$1`$2",
    1
  )
}

# Insert the component right before the first element that contains "Stage inputs"
$insert = @"
<StatusBankNotesCard
  dealKey={String(deal?.id ?? deal?.deal_code ?? "")}
  amountZar={Number(deal?.amount_zar ?? deal?.amountZar ?? deal?.amount ?? 0)}
  stage={String(deal?.stage ?? "")}
/>

"@

if ($new -notmatch "StatusBankNotesCard\s*<") {
  $new2 = [regex]::Replace(
    $new,
    '(?ms)(\r?\n\s*<[^>]+>\s*Stage inputs\s*</[^>]+>\s*\r?\n)',
    "`r`n$insert`$1",
    1
  )

  if ($new2 -eq $new) {
    Write-Host "Could not auto-insert above 'Stage inputs' (markup differs)." -ForegroundColor Yellow
    Write-Host "Paste lines around 'Stage inputs' from:" -ForegroundColor Yellow
    Write-Host $dealFile -ForegroundColor Cyan
    Write-Host "Run:" -ForegroundColor Yellow
    Write-Host "Select-String -LiteralPath `"$dealFile`" -Pattern `"Stage inputs`" -Context 6,6" -ForegroundColor Cyan
    exit 1
  }

  $new = $new2
}

Set-Content -LiteralPath $dealFile -Value $new -Encoding UTF8
Write-Host "Patched View Deal file successfully." -ForegroundColor Green
