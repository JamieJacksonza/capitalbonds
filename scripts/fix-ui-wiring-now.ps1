param()

$dealView = ".\app\deal\[id]\DealViewClient.tsx"
$status   = ".\app\deal\[id]\StatusBankNotesCard.tsx"

if (-not (Test-Path -LiteralPath $dealView)) { throw "Missing $dealView" }
if (-not (Test-Path -LiteralPath $status))   { throw "Missing $status" }

# Unhide Deal Summary + Recent Moves
$dv = (Get-Content -LiteralPath $dealView | Out-String)
$dv = $dv -replace 'className="mt-4 hidden rounded-2xl', 'className="mt-4 rounded-2xl'
$dv = $dv -replace 'className="hidden mt-4', 'className="mt-4 hidden'
Set-Content -LiteralPath $dealView -Value $dv -Encoding UTF8

# Wire StatusBankNotesCard to /api/bank-notes
$st = (Get-Content -LiteralPath $status | Out-String)
$st = $st -replace 'const url = `/api/deals/\$\{encodeURIComponent\(key\)\}/bank-notes`;', 'const url = `/api/bank-notes?dealId=${encodeURIComponent(key)}&stage=${encodeURIComponent(stageKey)}`;'
$st = $st -replace 'const apiBanks: BankApiRow\[\] = Array\.isArray\(json\?\.banks\) \? json\.banks : \[\];', 'const apiBanks: BankApiRow[] = Array.isArray(json?.rows) ? json.rows : [];'
Set-Content -LiteralPath $status -Value $st -Encoding UTF8

Write-Host "OK: wrote DealViewClient + StatusBankNotesCard changes" -ForegroundColor Green
