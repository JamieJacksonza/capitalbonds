param(
  [string]$File = ".\app\deal\[id]\StatusBankNotesCard.tsx"
)

if (-not (Test-Path -LiteralPath $File)) {
  Write-Host "Missing file: $File" -ForegroundColor Red
  exit 1
}

# backup (optional)
if (Test-Path -LiteralPath ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
  if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
    Backup-File -Path $File | Out-Null
  }
}

$orig = Get-Content -LiteralPath $File -Raw
$new = $orig

# Fix the broken throw new Error(...) where the string lost quotes/backticks
# Turns: json?.error || Failed to save (...)  -> json?.error || `Failed to save (${res.status})`
$new = $new -replace 'throw new Error\(\s*json\?\.\s*error\s*\|\|\s*Failed to save\s*\([^)]*\)\s*\)\s*;', 'throw new Error(json?.error || `Failed to save (${res.status})`);'

if ($new -eq $orig) {
  Write-Host "No changes applied (pattern not found). Showing line 145-175 for inspection:" -ForegroundColor Yellow
  $i=0; Get-Content -LiteralPath $File | ForEach-Object { $i++; if($i -ge 145 -and $i -le 175){ "{0,4}: {1}" -f $i,$_ } }
  exit 0
}

Set-Content -LiteralPath $File -Value $new -Encoding UTF8
Write-Host "PATCHED:" -ForegroundColor Green
Write-Host "  $File" -ForegroundColor Green

Write-Host "`nCHECK (Failed to save) line:" -ForegroundColor Cyan
Select-String -LiteralPath $File -Pattern 'Failed to save' -Context 0,1
