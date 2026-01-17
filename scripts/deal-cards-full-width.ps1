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

$targets = @()
$targets += Get-ChildItem .\app\deal -Recurse -Filter *.tsx -File -ErrorAction SilentlyContinue
$targets += Get-ChildItem .\app -MaxDepth 1 -Filter layout.tsx -File -ErrorAction SilentlyContinue
$targets = $targets | Select-Object -Unique

if (-not $targets) { throw "No target files found under app\deal or app\layout.tsx" }

$patched = 0

foreach ($t in $targets) {
  $raw = Get-Content -LiteralPath $t.FullName -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($raw)) { continue }

  $new = $raw

  # Remove any max-width constraints
  $new = [regex]::Replace($new, '\bmax-w-\d+xl\b', 'max-w-none')
  $new = [regex]::Replace($new, '\bmax-w-screen-\w+\b', 'max-w-none')
  $new = [regex]::Replace($new, '\bmax-w-\[[^\]]+\]\b', 'max-w-none')

  # Tailwind container adds max-width at breakpoints
  $new = [regex]::Replace($new, '(^|[\s"'])container([\s"'])', '${1}w-full${2}')

  # Kill fixed pixel widths like w-[980px]
  $new = [regex]::Replace($new, '\bw-\[\d+px\]\b', 'w-full')

  # If mx-auto exists in a className, ensure w-full is present too
  $new = [regex]::Replace(
    $new,
    '(className="[^"]*?)\bmx-auto\b(?![^"]*\bw-full\b)',
    '$1mx-auto w-full'
  )

  if ($new -ne $raw) {
    Backup-IfPossible $t.FullName
    Set-Content -LiteralPath $t.FullName -Value $new -Encoding UTF8
    Write-Host "PATCHED:" -ForegroundColor Cyan
    Write-Host "  $($t.FullName)" -ForegroundColor Cyan
    $patched++
  }
}

Write-Host "DONE. Patched $patched file(s)." -ForegroundColor Green
