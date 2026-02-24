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

# If the file is empty/ruined, restore the newest backup from .\_bak
$raw0 = Get-Content -LiteralPath $file -Raw -ErrorAction SilentlyContinue
if ([string]::IsNullOrWhiteSpace($raw0)) {
  $bak = Get-ChildItem -LiteralPath ".\_bak" -Recurse -Filter "StatusBankNotesCard.tsx" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $bak) { throw "StatusBankNotesCard.tsx is empty AND no backup found under .\_bak" }

  Copy-Item -LiteralPath $bak.FullName -Destination $file -Force
  Write-Host "RESTORED FROM BACKUP:" -ForegroundColor Yellow
  Write-Host "  $($bak.FullName)" -ForegroundColor Yellow
}

Backup-IfPossible $file

$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "File is still empty after restore: $file" }

# Fix: amountLine ternary has "? R" which becomes "R is not defined".
# Replace ONLY the ternary branch that is exactly "? R" before ":" (first occurrence only).
# IMPORTANT: in Regex replacement, literal "$" must be escaped as "$$" so TS template literal becomes ${...}
$rx = [regex]::new('\?\s*R\s*(?=:)')
$replacement = '? `R $${Math.round(amountZar).toLocaleString("en-ZA")}` '

$new = $rx.Replace($raw, $replacement, 1)

if ($new -eq $raw) {
  Write-Host "NO CHANGE - couldn't find '? R' before ':' in ternary." -ForegroundColor Yellow
  Write-Host "Showing amountLine context:" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern "const amountLine" -Context 0,12
  exit 1
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8

Write-Host "PATCHED:" -ForegroundColor Green
Write-Host "  $file" -ForegroundColor Green

Write-Host "`nCHECK (amountLine block):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern "const amountLine" -Context 0,12
