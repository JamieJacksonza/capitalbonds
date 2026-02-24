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

# 1) Find newest backup for DealViewClient.tsx
$bak = Get-ChildItem -LiteralPath ".\_bak" -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like "DealViewClient.tsx.*.bak" -and $_.FullName -like "*\app\deal\[id]\*" } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $bak) {
  throw "No backup found for DealViewClient.tsx under .\_bak\app\deal\[id]\"
}

# 2) Backup current (broken) file, then restore from backup
Backup-Quick $file
Copy-Item -LiteralPath $bak.FullName -Destination $file -Force
Write-Host "RESTORED -> $file" -ForegroundColor Green
Write-Host "FROM     -> $($bak.FullName)" -ForegroundColor DarkGray

# 3) Re-apply the SAFE patch: allow fallback fetch by using let res / let json (first occurrence only)
$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "Restored file is empty (unexpected)." }

$new = $raw

# Join any broken className string literals (just in case)
$pattern = 'className="([^"]*)\r?\n\s*([^"]*)"'
$loops = 0
do {
  $loops++
  $prev = $new
  $new = [regex]::Replace($new, $pattern, 'className="$1 $2"')
} while ($new -ne $prev -and $loops -lt 50)

# const res -> let res (first match only)
$new = [regex]::Replace($new, 'const\s+res\s*=\s*await\s*fetch\s*\(', 'let res = await fetch(', 1)

# const json -> let json (first match only)
$new = [regex]::Replace($new, 'const\s+json\s*=\s*await\s+res\.json\s*\(', 'let json = await res.json(', 1)

# Fix any "}if(" glue
$new = [regex]::Replace($new, '\}\s*if\s*\(', "}`r`n      if (", 50)

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "RE-PATCHED (safe) -> $file" -ForegroundColor Green

Write-Host "`nSANITY CHECK (show first 5 lines):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-Object -First 5

Write-Host "`nSANITY CHECK (find the mt-4 grid line):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern 'mt-4 grid grid-cols-1 md:grid-cols-2' -Context 0,1
