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

# 1) Remove the StageCard grid block that starts with the mt-4 grid div
#    (non-greedy until the first matching closing </div>)
$pattern = '(?s)\r?\n\s*<div\s+className="mt-4\s+grid\s+grid-cols-1\s+md:grid-cols-2\s+gap-4"\s*>\s*.*?\s*</div>\s*'
$new2 = [regex]::Replace($new, $pattern, "`r`n", 1)

# 2) If it didn't match (maybe spacing/newlines differ), try a looser pattern
if ($new2 -eq $new) {
  $pattern2 = '(?s)\r?\n\s*<div\s+className="mt-4\s+grid[^"]*"\s*>\s*.*?\s*</div>\s*'
  $new2 = [regex]::Replace($new, $pattern2, "`r`n", 1)
}

if ($new2 -eq $new) {
  Write-Host "NO CHANGE - couldn't find the mt-4 grid block. Showing lines containing 'mt-4 grid' for manual targeting:" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern 'mt-4 grid' -Context 2,6
  exit 1
}

$new = $new2

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "PATCHED -> $file" -ForegroundColor Green

Write-Host "`nCONFIRM (should NOT find mt-4 grid anymore):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern 'mt-4 grid' -Context 0,1
