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

$file = ".\app\deal\[id]\DealViewClient.tsx"
if (-not (Test-Path -LiteralPath $file)) { throw "Missing: $file" }

Backup-Quick $file

$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "Empty: $file" }

$new = $raw

# -----------------------------
# FIX 1: TS/JS assignments like: const url = /api/...
# -----------------------------
# Turns:  = /api/deals/123;
# Into:   = "/api/deals/123";
$new = [regex]::Replace(
  $new,
  '(?m)(=\s*)(/api/[^\s;]+)(\s*;)',
  '$1"$2"$3'
)

# -----------------------------
# FIX 2: JSX attrs like: href=/deal/123 or src=/logo.png
# -----------------------------
# Turns: href=/deal/123
# Into:  href="/deal/123"
$new = [regex]::Replace(
  $new,
  '(?m)\b(href|src)\s*=\s*(/[^"\s>]+)',
  '$1="$2"'
)

# -----------------------------
# FIX 3: Any remaining "= /something" in JSX attrs (broader net)
# -----------------------------
# Turns: foo=/bar
# Into:  foo="/bar"
$new = [regex]::Replace(
  $new,
  '(?m)\b([a-zA-Z_][a-zA-Z0-9_\-]*)\s*=\s*(/[^"\s>]+)',
  '$1="$2"'
)

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "PATCHED -> $file" -ForegroundColor Green

Write-Host "`nCHECK 1: any remaining raw '= /' patterns? (should be none)" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern '=\s*/' -Context 0,1

Write-Host "`nCHECK 2: any href=/ or src=/? (should be none)" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern 'href=/|src=/' -Context 0,1

Write-Host "`nDONE." -ForegroundColor Green
