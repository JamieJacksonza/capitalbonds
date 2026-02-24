param([string]$File = ".\app\_components\StageTable.tsx")

if (-not (Test-Path $File)) {
  Write-Host "Missing file: $File" -ForegroundColor Red
  exit 1
}

# Backup if helper exists
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
  if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
    Backup-File -Path $File | Out-Null
  }
}

$orig = Get-Content -LiteralPath $File -Raw
$new  = $orig

# Fix pattern: map((x) => { ( <tr ... </tr> ); })
# If there's a block body "=> { (" but no "return", add it.
$new = [regex]::Replace(
  $new,
  '(?ms)(map\(\s*\(\s*[^)]*\)\s*=>\s*\{\s*)\(\s*(<tr\b)',
  '$1return (`r`n$2',
  1
)

# Also handle: map(x => { ( <tr ...  (rare variant)
$new = [regex]::Replace(
  $new,
  '(?ms)(map\(\s*[^=]+\s*=>\s*\{\s*)\(\s*(<tr\b)',
  '$1return (`r`n$2',
  1
)

if ($new -eq $orig) {
  Write-Host "No changes made. The broken pattern may be different." -ForegroundColor Yellow
  Write-Host "Next step: print lines around the error:" -ForegroundColor Yellow
  Write-Host "Get-Content -LiteralPath $File | Select-Object -Skip 210 -First 40" -ForegroundColor Cyan
  exit 0
}

Set-Content -LiteralPath $File -Value $new -Encoding UTF8
Write-Host "Patched StageTable map() return wrapper:" -ForegroundColor Green
Write-Host "  $File" -ForegroundColor Green
