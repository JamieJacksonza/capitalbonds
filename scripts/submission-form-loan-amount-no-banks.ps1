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

# Find candidate TSX files (recursive)
$files = Get-ChildItem -Path .\app -Recurse -Filter *.tsx -File
if (-not $files) { throw "No TSX files found under .\app" }

# 1) Prefer file containing the exact label
$hit = $files | Select-String -Pattern "Requested bond amount" -ErrorAction SilentlyContinue | Select-Object -First 1

# 2) Fallback to any file that contains bank UI markers
if (-not $hit) {
  $hit = $files | Select-String -Pattern "\+ Add bank|Bank #1|Banks" -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not $hit) {
  Write-Host "Could not find the submission form file using known markers." -ForegroundColor Yellow
  Write-Host "Run this to locate it:" -ForegroundColor Yellow
  Write-Host 'Get-ChildItem .\app -Recurse -Filter *.tsx | Select-String -Pattern "Requested bond amount|\+ Add bank|Bank #1|Banks" -Context 2,2' -ForegroundColor Yellow
  exit 1
}

$file = $hit.Path
Write-Host "PATCH TARGET:" -ForegroundColor Cyan
Write-Host "  $file" -ForegroundColor Cyan

Backup-IfPossible $file

$raw = Get-Content -LiteralPath $file -Raw
if ([string]::IsNullOrWhiteSpace($raw)) { throw "File is empty or unreadable: $file" }

$new = $raw

# A) Rename label text
$new = $new.Replace("Requested bond amount", "Loan amount")

# B) Remove the entire Banks section:
#    From first occurrence of Banks/+ Add bank/Bank #1 up to submit button or </form>
$patternBanksBlock = '(?s)(\r?\n\s*.*?(Banks|\+ Add bank|Bank\s*#1).*?)(?=(<button[^>]*type\s*=\s*["'']submit["''])|</form>)'
$new2 = [regex]::Replace($new, $patternBanksBlock, "`r`n")

# C) Safety: if any "+ Add bank" row remains, kill that line block too
$patternAddBankRow = '(?s)\r?\n\s*.*?\+ Add bank.*?\r?\n'
$new3 = [regex]::Replace($new2, $patternAddBankRow, "`r`n")

# D) If payload includes banks, force to []
$new3 = [regex]::Replace($new3, '(\bbanks\s*:\s*)[A-Za-z_][A-Za-z0-9_]*\s*,', '${1}[],')
$new3 = [regex]::Replace($new3, '(\bbanks\s*:\s*)\[[^\]]*\]\s*,', '${1}[],')

if ($new3 -eq $raw) {
  Write-Host "No changes applied (patterns not found)." -ForegroundColor Yellow
  Write-Host "Open the file shown above and confirm it contains the form." -ForegroundColor Yellow
  exit 0
}

Set-Content -LiteralPath $file -Value $new3 -Encoding UTF8

Write-Host "DONE:" -ForegroundColor Green
Write-Host "  Renamed to: Loan amount" -ForegroundColor Green
Write-Host "  Removed: Banks inputs section" -ForegroundColor Green
Write-Host "  File: $file" -ForegroundColor Green
