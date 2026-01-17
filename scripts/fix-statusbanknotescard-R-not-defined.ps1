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
if (-not (Test-Path -LiteralPath $file)) { throw "Missing file: $file" }

Backup-IfPossible $file

$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "File empty: $file" }

# Replace the broken ternary branch "? R" with a real ZAR formatted string
# We keep it dead simple: "R " + rounded number with ZA thousand separators.
$replacement = '? `R ${Math.round(amountZar).toLocaleString("en-ZA")}`'

# Match: ? R (optionally with whitespace/newlines)
$pattern = '\?\s*R(\s*[\r\n]|[^\w])'

$new = [regex]::Replace($raw, $replacement + '$1', 1)

if ($new -eq $raw) {
  Write-Host "NO CHANGE - couldn't find '? R' pattern. Showing nearby line containing 'amountLine':" -ForegroundColor Yellow
  Get-Content -LiteralPath $file | Select-String -Pattern "amountLine" -Context 4,6
  exit 1
}

Set-Content -LiteralPath $file -Value $new -Encoding UTF8

Write-Host "PATCHED:" -ForegroundColor Green
Write-Host "  $file" -ForegroundColor Green

Write-Host "`nCHECK (show amountLine block):" -ForegroundColor Cyan
Get-Content -LiteralPath $file | Select-String -Pattern "const amountLine" -Context 0,8
