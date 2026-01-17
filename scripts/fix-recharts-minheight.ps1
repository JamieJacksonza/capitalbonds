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
  if (-not (Test-Path -LiteralPath $p)) { continue }
  Backup-IfPossible $p

  $raw = Get-Content -LiteralPath $p -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) { continue }

  $new = $raw

  # Ensure the immediate wrapper around ResponsiveContainer has a real min-height.
  # This is intentionally conservative: only touches divs with h-[###px].
  $new = $new -replace 'className="([^"]*\bh-\[[0-9]+px\][^"]*)"', {
    $cls = $args[0].Groups[1].Value
    if ($cls -match '\bmin-h-\[') { 'className="' + $cls + '"' }
    else { 'className="' + $cls + ' min-h-[200px]"' }
  }

  if ($new -ne $raw) {
    Set-Content -LiteralPath $p -Value $new -Encoding UTF8
    Write-Host "PATCHED: $p" -ForegroundColor Cyan
  } else {
    Write-Host "NO CHANGE: $p" -ForegroundColor DarkGray
  }
}

Write-Host "DONE." -ForegroundColor Green
