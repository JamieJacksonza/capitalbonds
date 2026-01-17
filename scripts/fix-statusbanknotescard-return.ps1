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

$path = ".\app\deal\[id]\StatusBankNotesCard.tsx"
if (-not (Test-Path -LiteralPath $path)) { throw "Missing file: $path" }

Backup-IfPossible $path

$lines = Get-Content -LiteralPath $path
if (-not $lines -or $lines.Count -lt 10) { throw "File empty/unreadable: $path" }

# Find the exact grid line that the error points to
$hit = $lines | Select-String -SimpleMatch 'mt-4 grid grid-cols-1 md:grid-cols-2 gap-4' | Select-Object -First 1
if (-not $hit) {
  throw "Could not find the target div line in $path"
}
$idx = $hit.LineNumber - 1

# Search upwards for a "return" on its own line (the usual culprit)
$returnIdx = $null
for ($i = $idx; $i -ge 0; $i--) {
  if ($lines[$i] -match '^\s*return\s*$') { $returnIdx = $i; break }
  if ($lines[$i] -match '^\s*return\s*//') { $returnIdx = $i; break }
}

if ($null -eq $returnIdx) {
  Write-Host "No standalone 'return' line found above the error line. Not patching return line." -ForegroundColor Yellow
} else {
  $indent = ([regex]::Match($lines[$returnIdx], '^\s*')).Value
  $lines[$returnIdx] = ($indent + "return (")
  Write-Host "Patched standalone return -> return (" -ForegroundColor Cyan

  # Ensure there is a closing ');' after the JSX return
  $hasClose = $false
  for ($j = $returnIdx; $j -lt $lines.Count; $j++) {
    if ($lines[$j] -match '^\s*\);\s*$') { $hasClose = $true; break }
  }

  if (-not $hasClose) {
    # Insert before the last closing brace in the file (usually the component end)
    $closeBraceIdx = $null
    for ($k = $lines.Count - 1; $k -ge 0; $k--) {
      if ($lines[$k] -match '^\s*\}\s*$') { $closeBraceIdx = $k; break }
    }
    if ($null -eq $closeBraceIdx) { throw "Could not find a closing brace '}' to insert ); before." }

    $lines = @($lines[0..($closeBraceIdx-1)]) + @($indent + ");") + @($lines[$closeBraceIdx..($lines.Count-1)])
    Write-Host "Inserted missing closing );" -ForegroundColor Cyan
  }
}

Set-Content -LiteralPath $path -Value $lines -Encoding UTF8

Write-Host "DONE: $path" -ForegroundColor Green
