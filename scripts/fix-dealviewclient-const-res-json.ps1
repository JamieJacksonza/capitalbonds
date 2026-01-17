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
if ([string]::IsNullOrWhiteSpace($raw)) { throw "File empty: $file" }

$new = $raw

# 1) Allow reassignment for fallback logic
$new = [regex]::Replace($new, 'const\s+res\s*=\s*await\s*fetch\(', 'let res = await fetch(', 1)
$new = [regex]::Replace($new, 'const\s+json\s*=\s*await\s+res\.json\(', 'let json = await res.json(', 1)

# 2) Fix accidental "}{if" glue (keeps TS parser happy)
$new = [regex]::Replace($new, '\}\s*if\s*\(', "}`r`n      if (", 10)

if ($new -eq $raw) {
  Write-Host "NO CHANGE - nothing matched. Showing fetch context:" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern "await fetch|const res|let res|const json|let json" -Context 2,3
  exit 1
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "PATCHED -> $file" -ForegroundColor Green

Write-Host "`nCHECK (snippet):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern "let res = await fetch|let json = await res.json|\}\s*if\s*\(" -Context 0,3
