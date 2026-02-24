param()

$status = ".\app\deal\[id]\StatusBankNotesCard.tsx"
if (-not (Test-Path -LiteralPath $status)) { throw "Missing $status" }

# backup
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force ".\_bak\patches" | Out-Null
Copy-Item -LiteralPath $status -Destination ".\_bak\patches\StatusBankNotesCard.tsx.$ts.bak" -Force
Write-Host "BACKUP -> .\_bak\patches\StatusBankNotesCard.tsx.$ts.bak" -ForegroundColor Cyan

$st = (Get-Content -LiteralPath $status | Out-String)

# Replace normBankName completely (your file had a broken early return)
$st = [regex]::Replace($st, 'function\s+normBankName\([^)]*\)\s*:\s*BankKey\s*\|\s*null\s*\{[\s\S]*?\n\}', @'
function normBankName(v: any): BankKey | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;

  if (s.includes("fnb")) return "FNB";
  if (s.includes("absa")) return "ABSA";
  if (s.includes("standard")) return "Standard Bank";
  if (s.includes("ned")) return "Nedbank";
  if (s.includes("investec")) return "Investec";
  if (s.includes("other")) return "Other";

  return "Other";
}
'@, 1)

# GET url -> /api/bank-notes?dealId=...&stage=...
$st = $st -replace 'const\s+url\s*=\s*`/api/deals/\$\{encodeURIComponent\(key\)\}/bank-notes`;' , 'const url = `/api/bank-notes?dealId=${encodeURIComponent(key)}&stage=${encodeURIComponent(stageKey)}`;'

# json.banks -> json.rows
$st = $st -replace 'const\s+apiBanks:\s*BankApiRow\[\]\s*=\s*Array\.isArray\(json\?\.\s*banks\)\s*\?\s*json\.banks\s*:\s*\[\];' , 'const apiBanks: BankApiRow[] = Array.isArray(json?.rows) ? json.rows : [];'

# Replace save() function to PUT /api/bank-notes with {dealId, stage, rows}
$st = [regex]::Replace($st, 'async\s+function\s+save\(\)\s*\{[\s\S]*?\}\s*\r?\n\r?\n\s*return\s*\(', @'
async function save() {
  if (!key) return;
  setSaving(true);
  setMsg(null);

  const payload = {
    dealId: key,
    stage: stageKey,
    rows: BANKS.map((b) => {
      const r = rows[b.key];
      return {
        bank_name: b.key,
        bank_notes: String(r?.note ?? "").trim(),
      };
    }),
  };

  try {
    const res = await fetch(`/api/bank-notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to save bank notes");

    setMsg({ type: "ok", text: "Saved." });
  } catch (e: any) {
    setMsg({ type: "err", text: e?.message || "Failed to save." });
  } finally {
    setSaving(false);
  }
}

return (
'@, 1)

Set-Content -LiteralPath $status -Value $st -Encoding UTF8
Write-Host "PATCHED StatusBankNotesCard.tsx -> uses /api/bank-notes (GET+PUT) + fixed normBankName" -ForegroundColor Green
