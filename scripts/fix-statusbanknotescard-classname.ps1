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

# Fix broken className like: className={mt-3 rounded-2xl ... }
# Replace ONLY the first match (should be the msg banner)
$replacement = 'className={`mt-3 rounded-2xl border px-3 py-2 text-xs font-semibold ' +
               '${msg?.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}'
$pattern = 'className=\{\s*mt-3[^}]*\}'

$new2 = [regex]::Replace($new, $pattern, $replacement, 1)

if ($new2 -eq $raw) {
  Write-Host "NO CHANGE - couldn't find the broken className. Showing nearby lines that contain 'className={mt-':" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern 'className=\{\s*mt-' -Context 2,4
  exit 1
}

Set-Content -LiteralPath $file -Value $new2 -Encoding UTF8

Write-Host "PATCHED:" -ForegroundColor Green
Write-Host "  $file" -ForegroundColor Green

Write-Host "`nVERIFY (show any remaining className={mt-...}):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern 'className=\{\s*mt-' -Context 1,2
