param(
  [string]$File = ".\app\deal\[id]\DealViewClient.tsx"
)

if (-not (Test-Path -LiteralPath $File)) {
  Write-Host "Missing file: $File" -ForegroundColor Red
  exit 1
}

# Backup (optional)
if (Test-Path -LiteralPath ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
  if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
    Backup-File -Path $File | Out-Null
  }
}

$orig = Get-Content -LiteralPath $File -Raw
$new = $orig

# 1) Replace common centered max-width containers (mx-auto max-w-6xl / max-w-5xl etc)
#    with full-width container but keep centering semantics harmless.
$new = [regex]::Replace(
  $new,
  'mx-auto\s+max-w-(\d+)xl',
  'mx-auto w-full max-w-none'
)

# 2) Also replace any remaining "max-w-6xl/max-w-5xl/max-w-4xl" inside class strings (safety)
$new = [regex]::Replace(
  $new,
  '\bmax-w-(\d+)xl\b',
  'max-w-none'
)

if ($new -eq $orig) {
  Write-Host "No changes applied (couldn't find max-w-* in DealViewClient.tsx)." -ForegroundColor Yellow
  Write-Host "Search for 'max-w-' in that file and paste me the wrapper div line." -ForegroundColor Yellow
  exit 0
}

Set-Content -LiteralPath $File -Value $new -Encoding UTF8

Write-Host "UPDATED to full-width containers in:" -ForegroundColor Green
Write-Host "  $File" -ForegroundColor Green
