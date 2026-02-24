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

# Join any className="....<newline>...." into className=".... ...."
# Repeat until no matches (handles multiple line wraps).
$pattern = 'className="([^"]*)\r?\n\s*([^"]*)"'
$loops = 0
do {
  $loops++
  $prev = $new
  $new = [regex]::Replace($new, $pattern, 'className="$1 $2"')
} while ($new -ne $prev -and $loops -lt 50)

if ($new -eq $raw) {
  Write-Host "NO CHANGE - no broken className strings found." -ForegroundColor Yellow
  Write-Host "Showing any multi-line className occurrences:" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern 'className="' -Context 0,2
  exit 0
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "PATCHED -> $file" -ForegroundColor Green

Write-Host "`nCHECK (show the specific mt-4 line if present):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern 'mt-4 grid grid-cols-1 md:grid-cols-2' -Context 0,2
