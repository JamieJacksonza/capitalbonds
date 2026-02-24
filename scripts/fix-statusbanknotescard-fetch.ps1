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

$file = ".\app\deal\[id]\StatusBankNotesCard.tsx"
if (-not (Test-Path -LiteralPath $file)) { throw "Missing file: $file" }

Backup-IfPossible $file

$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "File empty: $file" }

$new = $raw

# 1) If any fetch() call starts with /api (regex literal mistake), replace the URL portion with a proper template string.
#    This fixes cases like: fetch(/api/deals//bank-notes, {...})
$new = [regex]::Replace(
  $new,
  'fetch\(\s*/api/deals/[^,)]*',
  'fetch(`/api/deals/${encodeURIComponent(String(key || ""))}/bank-notes`'
)

# 2) Also normalize any correct template URLs that still use dealKey, to use key (your effect already checks key).
$new = $new.Replace(
  '`/api/deals/${encodeURIComponent(String(dealKey || ""))}/bank-notes`',
  '`/api/deals/${encodeURIComponent(String(key || ""))}/bank-notes`'
)

# 3) Optional: if you used encodeURIComponent(dealKey) without String(), normalize too
$new = $new.Replace(
  '`/api/deals/${encodeURIComponent(dealKey)}/bank-notes`',
  '`/api/deals/${encodeURIComponent(String(key || ""))}/bank-notes`'
)

if ($new -eq $raw) {
  Write-Host "NO CHANGE (nothing matched). Let's print the broken fetch lines:" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern "fetch\(" -Context 1,2
  exit 0
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8

Write-Host "PATCHED:" -ForegroundColor Green
Write-Host "  $file" -ForegroundColor Green

Write-Host "`nVERIFY (show any remaining bad fetch(/api...):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern "fetch\(\s*/api" -Context 0,2

Write-Host "`nVERIFY (show bank-notes fetch lines):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern "bank-notes" -Context 1,2
