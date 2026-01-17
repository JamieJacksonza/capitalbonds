param()

function Find-LatestBak([string]$name) {
  if (-not (Test-Path ".\_bak")) { return $null }
  $cands = Get-ChildItem -Path ".\_bak" -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "$name.*.bak" }
  if (-not $cands) { return $null }
  return $cands | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

function Backup-Now([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return }
  $ts = Get-Date -Format "yyyyMMdd-HHmmss"
  New-Item -ItemType Directory -Force ".\_bak\patches" | Out-Null
  Copy-Item -LiteralPath $path -Destination ".\_bak\patches\$(Split-Path -Leaf $path).$ts.bak" -Force
  Write-Host "BACKUP -> .\_bak\patches\$(Split-Path -Leaf $path).$ts.bak" -ForegroundColor Cyan
}

# Locate real files in THIS repo
$dealView = Get-ChildItem -Path ".\app" -Recurse -File -Filter "DealViewClient.tsx" | Select-Object -First 1
if (-not $dealView) { throw "Could not find DealViewClient.tsx under .\app" }

$statusCard = Get-ChildItem -Path ".\app" -Recurse -File -Filter "StatusBankNotesCard.tsx" | Select-Object -First 1
if (-not $statusCard) { throw "Could not find StatusBankNotesCard.tsx under .\app" }

# Restore DealViewClient.tsx
$bak1 = Find-LatestBak "DealViewClient.tsx"
if (-not $bak1) { throw "No backup found for DealViewClient.tsx under .\_bak" }
Backup-Now $dealView.FullName
Copy-Item -LiteralPath $bak1.FullName -Destination $dealView.FullName -Force
Write-Host "RESTORED DealViewClient.tsx <- $($bak1.FullName)" -ForegroundColor Green

# Restore StatusBankNotesCard.tsx
$bak2 = Find-LatestBak "StatusBankNotesCard.tsx"
if (-not $bak2) { throw "No backup found for StatusBankNotesCard.tsx under .\_bak" }
Backup-Now $statusCard.FullName
Copy-Item -LiteralPath $bak2.FullName -Destination $statusCard.FullName -Force
Write-Host "RESTORED StatusBankNotesCard.tsx <- $($bak2.FullName)" -ForegroundColor Green

# ---- Patch A: HIDE Raw Deal (debug) safely ----
$lines = Get-Content -LiteralPath $dealView.FullName
$match = $lines | Select-String -SimpleMatch "Raw Deal (debug)" | Select-Object -First 1

if ($match) {
  $idx = $match.LineNumber - 1
  for ($i = $idx; $i -ge 0; $i--) {
    if ($lines[$i] -match 'className="[^"]*mt-4[^"]*rounded-2xl[^"]*shadow-sm[^"]*"') {
      if ($lines[$i] -notmatch '\bhidden\b') {
        $lines[$i] = $lines[$i] -replace 'className="', 'className="hidden '
      }
      break
    }
  }
  Set-Content -LiteralPath $dealView.FullName -Value $lines -Encoding UTF8
  Write-Host "PATCHED DealViewClient.tsx -> hid Raw Deal (debug)" -ForegroundColor Green
} else {
  Write-Host "NOTE: Raw Deal (debug) not found (no change)" -ForegroundColor DarkYellow
}

# ---- Patch B: Add Investec + Other to BANKS + mapping ----
$txt = Get-Content -LiteralPath $statusCard.FullName -Raw

# Insert Investec + Other before the closing ] as const;
if ($txt -notmatch 'key:\s*"Investec"') {
  $txt = [regex]::Replace(
    $txt,
    '(\{ key:\s*"Nedbank",\s*label:\s*"Nedbank"\s*\},\s*\r?\n)(\]\s+as\s+const;)',
    "`$1  { key: `"Investec`", label: `"Investec`" },`r`n  { key: `"Other`", label: `"Other`" },`r`n`$2",
    1
  )
}

# If Investec exists but Other doesn't, insert Other
if (($txt -match 'key:\s*"Investec"') -and ($txt -notmatch 'key:\s*"Other"')) {
  $txt = [regex]::Replace(
    $txt,
    '(\{ key:\s*"Investec",\s*label:\s*"Investec"\s*\},\s*\r?\n)(\]\s+as\s+const;)',
    "`$1  { key: `"Other`", label: `"Other`" },`r`n`$2",
    1
  )
}

# Add investec mapping (after nedbank)
if ($txt -notmatch 'includes\("investec"\)') {
  $txt = [regex]::Replace(
    $txt,
    '(\s*if\s*\(s\.includes\("ned"\)\)\s*return\s*"Nedbank";\s*\r?\n)',
    "`$1  if (s.includes(`"investec`")) return `"Investec`";`r`n",
    1
  )
}

# Default unknown banks -> Other (keep early empty-string return null intact)
$txt = [regex]::Replace(
  $txt,
  '(\s*return\s+null\s*;\s*\r?\n\s*\})',
  "  return `"Other`";`r`n}",
  1
)

Set-Content -LiteralPath $statusCard.FullName -Value $txt -Encoding UTF8
Write-Host "PATCHED StatusBankNotesCard.tsx -> Investec + Other" -ForegroundColor Green

Write-Host "`nDONE. Now restart dev server." -ForegroundColor Cyan
