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

# 1) const res -> let res (first match only)
$rxRes = [regex]::new('const\s+res\s*=\s*await\s*fetch\s*\(', [System.Text.RegularExpressions.RegexOptions]::Multiline)
$new2 = $rxRes.Replace($new, 'let res = await fetch(', 1)
$new = $new2

# 2) const json -> let json (first match only)
$rxJson = [regex]::new('const\s+json\s*=\s*await\s+res\.json\s*\(', [System.Text.RegularExpressions.RegexOptions]::Multiline)
$new2 = $rxJson.Replace($new, 'let json = await res.json(', 1)
$new = $new2

# 3) Fix any "}if" glue that breaks formatting/readability
$rxGlue = [regex]::new('\}\s*if\s*\(')
$new = $rxGlue.Replace($new, "}`r`n      if (", 20)

if ($new -eq $raw) {
  Write-Host "NO CHANGE (patterns not found). Showing lines around the failing area:" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern 'const res|const json|res = await fetch|json = await res\.json|\}if' -Context 3,3
  exit 1
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "PATCHED -> $file" -ForegroundColor Green

Write-Host "`nVERIFY (look for let res / let json):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern 'let res = await fetch|let json = await res\.json|res = await fetch|json = await res\.json|\}if' -Context 2,2
