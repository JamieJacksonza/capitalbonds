param(
  [string]$Root = "."
)

$desired = @("Instructed","Granted","AIP","Submitted","NTU","Registrations","Activity")

function Get-Score($text) {
  $score = 0
  foreach ($t in $desired) {
    if ($text -match [regex]::Escape($t)) { $score++ }
  }
  # Heuristic boosts to pick the real header/nav file
  if ($text -match "New submission") { $score += 2 }
  if ($text -match "Capital Bonds")  { $score += 2 }
  if ($text -match "Dashboard")      { $score += 1 }
  return $score
}

function Try-Reorder-ArrayItems([string]$content) {
  # Try to reorder array/object nav items like:
  # { label: "Submitted", href: "/submitted" },
  # Works best when each item is a simple object without nested { }.
  $found = @{}
  $matchesAll = @()

  foreach ($t in $desired) {
    $pat = "(?ms)\{[^{}]*?(?:label|name|title)\s*:\s*[""']" + [regex]::Escape($t) + "[""'][^{}]*?\}\s*,?"
    $m = [regex]::Match($content, $pat)
    if ($m.Success) {
      $found[$t] = $m
      $matchesAll += $m
    }
  }

  if ($found.Keys.Count -ne $desired.Count) {
    return @{ Ok = $false; Reason = "Could not find all tab items as simple nav objects (label/name/title)." }
  }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum
  $maxEnd   = ($matchesAll | ForEach-Object { $_.Index + $_.Length } | Measure-Object -Maximum).Maximum

  # Remove matched chunks from end->start so indexes don't shift
  $orderedByIndexDesc = $matchesAll | Sort-Object Index -Descending
  $working = $content
  foreach ($m in $orderedByIndexDesc) {
    $working = $working.Remove($m.Index, $m.Length)
  }

  # Reinsert in desired order at the original first position
  $inserts = @()
  foreach ($t in $desired) { $inserts += $found[$t].Value }
  $insertBlock = ($inserts -join "`r`n")

  $working = $working.Insert($minStart, $insertBlock + "`r`n")

  return @{ Ok = $true; NewContent = $working; Mode = "array-items" }
}

function Try-Reorder-JsxLinks([string]$content) {
  # Try to reorder JSX link-like elements that contain just the label text:
  # >Submitted< or > Submitted <
  # We'll capture the *smallest* tag wrapper around the label on the same element.
  # This is more fragile, so we only use it if the array approach fails.

  $found = @{}
  $matchesAll = @()

  foreach ($t in $desired) {
    $pat = "(?ms)<[^>]{1,200}>\s*" + [regex]::Escape($t) + "\s*</[^>]{1,200}>"
    $m = [regex]::Match($content, $pat)
    if ($m.Success) {
      $found[$t] = $m
      $matchesAll += $m
    }
  }

  if ($found.Keys.Count -ne $desired.Count) {
    return @{ Ok = $false; Reason = "Could not find all tabs as simple JSX label wrappers." }
  }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum
  $maxEnd   = ($matchesAll | ForEach-Object { $_.Index + $_.Length } | Measure-Object -Maximum).Maximum

  $orderedByIndexDesc = $matchesAll | Sort-Object Index -Descending
  $working = $content
  foreach ($m in $orderedByIndexDesc) {
    $working = $working.Remove($m.Index, $m.Length)
  }

  $inserts = @()
  foreach ($t in $desired) { $inserts += $found[$t].Value }
  $insertBlock = ($inserts -join "`r`n")

  $working = $working.Insert($minStart, $insertBlock + "`r`n")

  return @{ Ok = $true; NewContent = $working; Mode = "jsx-links" }
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
  Write-Host "No strong candidate file found. Printing possible files containing at least 4 labels..." -ForegroundColor Yellow
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
  Write-Host "Multiple top candidate files tied. Pick ONE and re-run with -Root narrowed (or tell me the right file):" -ForegroundColor Yellow
  $tied | Format-Table -AutoSize
  exit 2
}

$target = $best[0].Path
Write-Host "Target file:" -NoNewline
Write-Host " $target" -ForegroundColor Cyan

# Backup (use your helper if it exists)
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
}

$orig = Get-Content -LiteralPath $target -Raw

# Try reorder methods
$result = Try-Reorder-ArrayItems $orig
if (-not $result.Ok) {
  $result = Try-Reorder-JsxLinks $orig
}

if (-not $result.Ok) {
  Write-Host "Failed to auto-reorder tabs." -ForegroundColor Red
  Write-Host $result.Reason -ForegroundColor Red
  exit 3
}

Set-Content -LiteralPath $target -Value $result.NewContent -Encoding UTF8
Write-Host "Reordered tabs using mode:" -NoNewline
Write-Host " $($result.Mode)" -ForegroundColor Green
