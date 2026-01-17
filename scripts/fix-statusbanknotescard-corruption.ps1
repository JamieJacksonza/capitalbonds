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

# Fix the broken fetch() URL that became a regex:
# fetch(/api/deals//bank-notes  -> fetch(`/api/deals/${encodeURIComponent(key)}/bank-notes`
$new = $new -replace 'fetch\(/api/deals//bank-notes', 'fetch(`/api/deals/${encodeURIComponent(key)}/bank-notes`'

# Fix the broken OTHER line that lost its template string:
# const line = ${name}: ;  -> const line = `${name}: ${note}`;
$new = $new -replace 'const\s+line\s*=\s*\$\{name\}:\s*;', 'const line = `${name}: ${note}`;'

if ($new -eq $orig) {
  Write-Host "No changes applied (patterns not found). Showing nearby lines..." -ForegroundColor Yellow
  $i=0; Get-Content -LiteralPath $File | ForEach-Object { $i++; if($i -ge 55 -and $i -le 95){ "{0,4}: {1}" -f $i,$_ } }
  exit 0
}

Set-Content -LiteralPath $File -Value $new -Encoding UTF8
Write-Host "PATCHED:" -ForegroundColor Green
Write-Host "  $File" -ForegroundColor Green

# quick proof
Write-Host "`nCHECK fetch() lines:" -ForegroundColor Cyan
Select-String -LiteralPath $File -Pattern 'fetch\(' -Context 0,1

Write-Host "`nCHECK const line:" -ForegroundColor Cyan
Select-String -LiteralPath $File -Pattern 'const line' -Context 0,1
