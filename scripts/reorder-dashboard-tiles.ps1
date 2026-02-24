param(
  [string]$Root = "."
)

# Desired tile order (display labels)
$desired = @("Instructed","Granted","AIP","Submitted","NTU","Registrations")

function Get-Score($text) {
  $score = 0
  foreach ($t in $desired) {
    if ($text -match [regex]::Escape($t)) { $score++ }
  }
  # extra hints to pick the correct dashboard file
  if ($text -match "Deal Breakdown") { $score += 2 }
  if ($text -match "stage cards" -or $text -match "DealBreakdown" -or $text -match "breakdown") { $score += 1 }
  return $score
}

function Try-Reorder-ConfigObjects([string]$content) {
  # Reorder nav/config objects like:
  # { label: "Submitted", ... }
  # or { title: "Submitted" ... } etc.
  $found = @{}
  $matchesAll = @()

  foreach ($t in $desired) {
    $pat = "(?ms)\{[^{}]*?(?:label|title|name|stage)\s*:\s*[""']" + [regex]::Escape($t) + "[""'][^{}]*?\}\s*,?"
    $m = [regex]::Match($content, $pat)
    if ($m.Success) {
      $found[$t] = $m
      $matchesAll += $m
    }
  }

  if ($found.Keys.Count -ne $desired.Count) {
    return @{ Ok = $false; Reason = "Could not find all tiles as simple config objects (label/title/name/stage)." }
  }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum

  # Remove matched chunks from end->start so indexes don't shift
  $working = $content
  foreach ($m in ($matchesAll | Sort-Object Index -Descending)) {
    $working = $working.Remove($m.Index, $m.Length)
  }

  # Reinsert in desired order at the original first position
  $inserts = foreach ($t in $desired) { $found[$t].Value }
  $insertBlock = ($inserts -join "`r`n")

  $working = $working.Insert($minStart, $insertBlock + "`r`n")

  return @{ Ok = $true; NewContent = $working; Mode = "config-objects" }
}

function Try-Reorder-JsxComponents([string]$content) {
  # Reorder JSX components like:
  # <StageCard title="Submitted" ... />
  # <StageCard label="Submitted">...</StageCard>
  $found = @{}
  $matchesAll = @()

  foreach ($t in $desired) {
    $patSelfClosing = "(?ms)<[A-Za-z0-9_]+[^>]{0,400}?(?:title|label|name)\s*=\s*[""']" + [regex]::Escape($t) + "[""'][^>]{0,400}?/>"
    $patWrapped     = "(?ms)<[A-Za-z0-9_]+[^>]{0,400}?(?:title|label|name)\s*=\s*[""']" + [regex]::Escape($t) + "[""'][^>]{0,400}?>.*?</[A-Za-z0-9_]+>"

    $m = [regex]::Match($content, $patSelfClosing)
    if (-not $m.Success) { $m = [regex]::Match($content, $patWrapped) }

    if ($m.Success) {
      $found[$t] = $m
      $matchesAll += $m
    }
  }

  if ($found.Keys.Count -ne $desired.Count) {
    return @{ Ok = $false; Reason = "Could not find all tiles as JSX components (title/label/name props)." }
  }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum

  $working = $content
  foreach ($m in ($matchesAll | Sort-Object Index -Descending)) {
    $working = $working.Remove($m.Index, $m.Length)
  }

  $inserts = foreach ($t in $desired) { $found[$t].Value }
  $insertBlock = ($inserts -join "`r`n")

  $working = $working.Insert($minStart, $insertBlock + "`r`n")

  return @{ Ok = $true; NewContent = $working; Mode = "jsx-components" }
}

# --- find best candidate file ---
$files = Get-ChildItem -Path $Root -Recurse -File -Include *.tsx,*.ts |
  Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\_bak\\" }

$candidates = @()
foreach ($f in $files) {
  $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  if (-not $txt) { continue }
  $score = Get-Score $txt
  if ($score -ge 6) {
    $candidates += [pscustomobject]@{ Path = $f.FullName; Score = $score }
  }
}

if ($candidates.Count -eq 0) {
  Write-Host "No strong candidate file found. Showing likely files containing at least 4 of the labels..." -ForegroundColor Yellow
  $loose = @()
  foreach ($f in $files) {
    $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $txt) { continue }
    $s = 0
    foreach ($t in $desired) { if ($txt -match [regex]::Escape($t)) { $s++ } }
    if ($s -ge 4) { $loose += [pscustomobject]@{ Path = $f.FullName; Found = $s } }
  }
  $loose | Sort-Object Found -Descending | Select-Object -First 25 | Format-Table -AutoSize
  exit 1
}

$best = $candidates | Sort-Object Score -Descending
$topScore = $best[0].Score
$tied = $best | Where-Object { $_.Score -eq $topScore }

if ($tied.Count -gt 1) {
  Write-Host "Multiple top candidate files tied. Paste this table to me and Ill lock it to the right file:" -ForegroundColor Yellow
  $tied | Format-Table -AutoSize
  exit 2
}

$target = $best[0].Path
Write-Host "Target file:" -NoNewline
Write-Host " $target" -ForegroundColor Cyan

# Backup helper if available
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
}

$orig = Get-Content -LiteralPath $target -Raw

# Try reorder methods
$result = Try-Reorder-ConfigObjects $orig
if (-not $result.Ok) {
  $result = Try-Reorder-JsxComponents $orig
}

if (-not $result.Ok) {
  Write-Host "Failed to auto-reorder dashboard tiles." -ForegroundColor Red
  Write-Host $result.Reason -ForegroundColor Red
  exit 3
}

Set-Content -LiteralPath $target -Value $result.NewContent -Encoding UTF8
Write-Host "Reordered dashboard tiles using mode:" -NoNewline
Write-Host " $($result.Mode)" -ForegroundColor Green
