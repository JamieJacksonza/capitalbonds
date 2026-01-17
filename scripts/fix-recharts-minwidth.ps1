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

$targets = @(
  ".\app\_components\AgentPie.tsx",
  ".\app\_components\ConsultantPie.tsx"
)

foreach ($p in $targets) {
  if (-not (Test-Path -LiteralPath $p)) {
    Write-Host "SKIP (missing): $p" -ForegroundColor Yellow
    continue
  }

  Backup-IfPossible $p

  $raw = Get-Content -LiteralPath $p -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { continue }

  $new = $raw

  # Ensure parent container divs have min-w-0 (helps ResponsiveContainer measure correctly inside flex/grid)
  $new = $new -replace 'className="([^"]*\bh-\[[0-9]+px\][^"]*)"', { 
    $m = $args[0].Groups[1].Value
    if ($m -match '\bmin-w-0\b') { 'className="' + $m + '"' } else { 'className="' + $m + ' min-w-0"' }
  }

  # Add minWidth={0} to ResponsiveContainer if missing
  $new = $new -replace '<ResponsiveContainer\s+width="100%"\s+height="100%"\s*>', '<ResponsiveContainer width="100%" height="100%" minWidth={0}>'
  $new = $new -replace '<ResponsiveContainer\s+width="100%"\s+height="100%"\s+([^>]*?)>', {
    $tag = $args[0].Value
    if ($tag -match 'minWidth=\{0\}') { $tag } else { $tag -replace '>', ' minWidth={0}>' }
  }

  if ($new -ne $raw) {
    Set-Content -LiteralPath $p -Value $new -Encoding UTF8
    Write-Host "PATCHED: $p" -ForegroundColor Cyan
  } else {
    Write-Host "NO CHANGE: $p" -ForegroundColor DarkGray
  }
}

Write-Host "DONE." -ForegroundColor Green
