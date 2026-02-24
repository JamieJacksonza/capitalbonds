param([string]$File = ".\app\deal\[id]\DealViewClient.tsx")

if (-not (Test-Path -LiteralPath $File)) {
  Write-Host "Missing file: $File" -ForegroundColor Red
  exit 1
}

# Backup if helper exists
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
  if (Get-Command Backup-File -ErrorAction SilentlyContinue) {
    Backup-File -Path $File | Out-Null
  }
}

$orig = Get-Content -LiteralPath $File -Raw

$anchor = '<div className="mt-6 rounded-2xl border'
$snippet = @"
      <StatusBankNotesCard
        dealKey={String(deal?.id ?? deal?.deal_code ?? "")}
        amountZar={Number(deal?.amount_zar ?? deal?.amountZar ?? deal?.amount ?? 0)}
        stage={String(stage || "")}
      />
"@

if ($orig -notmatch [regex]::Escape($anchor)) {
  Write-Host "Could not find Stage inputs container anchor in file." -ForegroundColor Yellow
  Write-Host "Search for 'Stage inputs' and confirm the wrapper div starts with: $anchor" -ForegroundColor Yellow
  exit 1
}

$new = $orig

# If StatusBankNotesCard already exists (possibly broken), replace EVERYTHING from it up to the Stage inputs container
if ($new -match '(?ms)\s*<StatusBankNotesCard\b') {
  $new = [regex]::Replace(
    $new,
    '(?ms)\s*<StatusBankNotesCard\b[\s\S]*?(?=\s*<div className="mt-6 rounded-2xl border)',
    "`r`n$snippet`r`n",
    1
  )
} else {
  # Otherwise insert it right before Stage inputs container
  $new = [regex]::Replace(
    $new,
    [regex]::Escape($anchor),
    "`r`n$snippet`r`n$anchor",
    1
  )
}

if ($new -eq $orig) {
  Write-Host "No changes made (unexpected). Printing nearby context may help." -ForegroundColor Yellow
  exit 0
}

Set-Content -LiteralPath $File -Value $new -Encoding UTF8

Write-Host "Patched StatusBankNotesCard block in:" -ForegroundColor Green
Write-Host "  $File" -ForegroundColor Green
