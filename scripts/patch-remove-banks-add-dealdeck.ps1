param([string]$Root = ".")

Set-Location $Root

$candidates = @(
  ".\app\_components\StageTable.tsx",
  ".\app\_components\DealsTable.tsx",
  ".\app\deal\_components\StageTable.tsx",
  ".\app\deal\_components\DealsTable.tsx"
) | Where-Object { Test-Path $_ }

if (-not $candidates -or $candidates.Count -eq 0) {
  $candidates = Get-ChildItem -Path .\app -Recurse -File -Include *.tsx,*.ts |
    Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\_bak\\" -and $_.FullName -notmatch "\\.next\\" } |
    ForEach-Object { $_.FullName }
}

$target = $null
foreach ($p in $candidates) {
  $txt = Get-Content -LiteralPath $p -Raw -ErrorAction SilentlyContinue
  if ($txt -and $txt -match "Banks" -and $txt -match "<th") { $target = $p; break }
}

if (-not $target) {
  Write-Host "Could not find a table file with a Banks <th> header." -ForegroundColor Red
  Write-Host "Run: Select-String -Path .\app\**\*.tsx -Pattern `"Banks`" -List" -ForegroundColor Yellow
  exit 1
}

Write-Host "Target:" -NoNewline
Write-Host " $target" -ForegroundColor Cyan

if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
  if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
    Backup-File -Path $target | Out-Null
  }
}

$content = Get-Content -LiteralPath $target -Raw

if ($content -notmatch "function\s+pickDealDeckId") {
  $helper = @"

function pickDealDeckId(d: any) {
  return (
    d?.deal_deck_id ??
    d?.dealDeckId ??
    d?.deck_id ??
    d?.deal_deck ??
    d?.dealDeckID ??
    ""
  );
}

"@

  $content = [regex]::Replace(
    $content,
    "(?ms)^((?:import\s+.*?;\s*)+)",
    "`$1$helper",
    1
  )
}

if ($content -notmatch "Deal deck ID") {
  $content = [regex]::Replace(
    $content,
    "(?ms)(<th(?<attrs>[^>]*)>\s*Deal\s*</th>)",
    "`$1`r`n<th`${attrs}>Deal deck ID</th>",
    1
  )
}

$content = [regex]::Replace(
  $content,
  "(?ms)\s*<th[^>]*>\s*Banks\s*</th>\s*",
  "`r`n",
  1
)

if ($content -notmatch "pickDealDeckId\(deal\)") {
  $content = [regex]::Replace(
    $content,
    "(?ms)(<td(?<attrs>[^>]*)>[\s\S]*?(?:deal_code|dealCode|SB-)[\s\S]*?<\/td>)",
    "`$1`r`n<td`${attrs}>{pickDealDeckId(deal) || `"`"}</td>",
    1
  )
}

$removed = $false
$new = [regex]::Replace($content, "(?ms)\s*<td[^>]*>[\s\S]*?\{[\s\S]*?\bbanks\b[\s\S]*?\}[\s\S]*?<\/td>\s*", "`r`n", 1)
if ($new -ne $content) { $content = $new; $removed = $true }

if (-not $removed) {
  $new = [regex]::Replace($content, "(?ms)\s*<td[^>]*>[\s\S]*?\{[\s\S]*?\bbank\w*\b[\s\S]*?\}[\s\S]*?<\/td>\s*", "`r`n", 1)
  if ($new -ne $content) { $content = $new; $removed = $true }
}

if (-not $removed) {
  $new = [regex]::Replace($content, "(?ms)\s*<td[^>]*>[\s\S]*?\b(?:FNB|ABSA|Capitec|Nedbank|Standard)\b[\s\S]*?<\/td>\s*", "`r`n", 1)
  if ($new -ne $content) { $content = $new; $removed = $true }
}

Set-Content -LiteralPath $target -Value $content -Encoding UTF8

Write-Host "Patched:" -NoNewline
Write-Host " $target" -ForegroundColor Green
