param()

function Backup-IfPossible([string]$Path) {
  if (Test-Path -LiteralPath ".\scripts\backup-helper.ps1") {
    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
    . .\scripts\backup-helper.ps1
    if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
      if (Test-Path -LiteralPath $Path) { Backup-File -Path $Path | Out-Null }
    }
  }
}

$file = ".\app\deal\[id]\StatusBankNotesCard.tsx"
if (-not (Test-Path -LiteralPath $file)) { throw "Missing: $file" }

Backup-IfPossible $file

$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "File empty: $file" }

$new = $raw

# Fix broken fetch that accidentally became a RegExp literal:
# fetch(/api/deals//bank-notes, ...)  OR fetch(/api/deals/whatever/bank-notes, ...)
$pattern = 'fetch\(\s*\/api\/deals\/.*?\/bank-notes\s*,'
$replacement = 'fetch(`/api/deals/${encodeURIComponent(String(dealKey || ""))}/bank-notes`,'

$new = [regex]::Replace($new, $pattern, $replacement)

if ($new -eq $raw) {
  Write-Host "NO CHANGE (pattern not found). Showing suspicious lines:" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern 'fetch\(' -Context 2,2
  exit 0
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8
Write-Host "PATCHED: $file" -ForegroundColor Green
