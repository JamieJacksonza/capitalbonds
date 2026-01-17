param()

function Backup-Quick([string]$Path) {
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $rel = $Path.TrimStart(".\")
  $bakPath = Join-Path ".\_bak" $rel
  $bakDir = Split-Path -Parent $bakPath
  New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
  Copy-Item -LiteralPath $Path -Destination ($bakPath + "." + $ts + ".bak") -Force
  Write-Host "BACKUP -> $bakPath.$ts.bak" -ForegroundColor Cyan
}

$file = ".\app\api\deals\[id]\route.ts"
if (-not (Test-Path -LiteralPath $file)) {
  Write-Host "SKIP: missing $file (your project may store routes elsewhere)" -ForegroundColor Yellow
  exit 0
}

Backup-Quick $file

$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "Empty: $file" }

$new = $raw

# Replace ONLY simple select string calls to select("*")
$new = [regex]::Replace($new, '\.select\(\s*"[^"]*"\s*\)', '.select("*")')
$new = [regex]::Replace($new, "\.select\(\s*'[^']*'\s*\)", '.select("*")')

if ($new -eq $raw) {
  Write-Host "NO CHANGE - no .select('...') found to replace" -ForegroundColor Yellow
  exit 0
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "PATCHED -> $file" -ForegroundColor Green
