param(
  [string]$Root = "."
)

# Desired order (both labels + keys supported)
$desiredLabels = @("Instructed","Granted","AIP","Submitted","NTU","Registrations")
$desiredKeys   = @("instructed","granted","aip","submitted","ntu","registrations","registration") # include singular just in case

function Score-File([string]$text) {
  $score = 0
  foreach ($t in $desiredLabels) { if ($text -match [regex]::Escape($t)) { $score++ } }
  foreach ($k in $desiredKeys)   { if ($text -match "\b$([regex]::Escape($k))\b") { $score++ } }
  if ($text -match "Deal Breakdown") { $score += 3 }
  if ($text -match "StageCard" -or $text -match "MoveStageCards" -or $text -match "stageOrder" -or $text -match "deal breakdown") { $score += 2 }
  return $score
}

function Try-Reorder-StageKeyArray([string]$content) {
  # Finds arrays of quoted strings containing stage keys, then replaces the whole array with desired order.
  # Example: const order = ["submitted","aip","instructed","granted","ntu","registrations"]
  $rx = [regex]'(?ms)\[(?:\s*["''][a-zA-Z_]+["'']\s*,?)+\s*\]'
  $matches = $rx.Matches($content)

  foreach ($m in $matches) {
    $arr = $m.Value

    # Count stage keys present
    $found = @()
    foreach ($k in @("submitted","aip","instructed","granted","ntu","registrations","registration")) {
      if ($arr -match "(?i)[""']$k[""']") { $found += $k }
    }

    if (($found | Select-Object -Unique).Count -ge 5) {
      # Preserve quote style: use " if present else '
      $quote = if ($arr -match '"') { '"' } else { "'" }
      # Prefer plural registrations unless only singular exists in original
      $useRegistrations = $true
      if (($arr -match "(?i)['""]registration['""]") -and -not ($arr -match "(?i)['""]registrations['""]")) { $useRegistrations = $false }

      $newKeys = @("instructed","granted","aip","submitted","ntu", ($useRegistrations ? "registrations" : "registration"))
      $newArr = "[ " + ($newKeys | ForEach-Object { "$quote$_$quote" } -join ", ") + " ]"

      $before = $content.Substring(0, $m.Index)
      $after  = $content.Substring($m.Index + $m.Length)
      return @{ Ok=$true; NewContent=($before + $newArr + $after); Mode="stage-key-array" }
    }
  }

  return @{ Ok=$false; Reason="No suitable stage key array found to reorder." }
}

function Try-Reorder-ConfigObjects([string]$content) {
  # Reorders simple objects containing stage/label/title/name (no nested braces)
  $wanted = @("Instructed","Granted","AIP","Submitted","NTU","Registrations")
  $found = @{}
  $matchesAll = @()

  foreach ($t in $wanted) {
    $pat = "(?ms)\{[^{}]*?(?:label|title|name|stage)\s*:\s*[""']" + [regex]::Escape($t) + "[""'][^{}]*?\}\s*,?"
    $m = [regex]::Match($content, $pat)
    if ($m.Success) { $found[$t] = $m; $matchesAll += $m }
  }

  if ($found.Keys.Count -ne $wanted.Count) { return @{ Ok=$false; Reason="Could not find all tiles as simple config objects by label." } }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum
  $working = $content
  foreach ($m in ($matchesAll | Sort-Object Index -Descending)) { $working = $working.Remove($m.Index, $m.Length) }

  $insertBlock = (($wanted | ForEach-Object { $found[$_].Value }) -join "`r`n")
  $working = $working.Insert($minStart, $insertBlock + "`r`n")
  return @{ Ok=$true; NewContent=$working; Mode="config-objects-label" }
}

function Try-Reorder-JsxStageProps([string]$content) {
  # Reorder JSX components with stage="submitted" (or similar)
  $order = @("instructed","granted","aip","submitted","ntu","registrations")
  $found = @{}
  $matchesAll = @()

  foreach ($k in $order) {
    $patSelf = "(?ms)<[A-Za-z0-9_]+[^>]{0,700}?\bstage\s*=\s*[""']" + [regex]::Escape($k) + "[""'][^>]{0,700}?/>"
    $patWrap = "(?ms)<[A-Za-z0-9_]+[^>]{0,700}?\bstage\s*=\s*[""']" + [regex]::Escape($k) + "[""'][^>]{0,700}?>.*?</[A-Za-z0-9_]+>"
    $m = [regex]::Match($content, $patSelf)
    if (-not $m.Success) { $m = [regex]::Match($content, $patWrap) }

    if ($m.Success) { $found[$k] = $m; $matchesAll += $m }
  }

  if ($found.Keys.Count -lt 5) { return @{ Ok=$false; Reason="Could not find at least 5 JSX cards with stage=... props." } }

  # If singular registration exists instead of registrations, handle it
  if (-not $found.ContainsKey("registrations")) {
    $patReg = "(?ms)<[A-Za-z0-9_]+[^>]{0,700}?\bstage\s*=\s*[""']registration[""'][^>]{0,700}?(/>|>.*?</[A-Za-z0-9_]+>)"
    $mReg = [regex]::Match($content, $patReg)
    if ($mReg.Success) {
      $found["registrations"] = $mReg
      $matchesAll += $mReg
    }
  }

  if ($found.Keys.Count -lt 6) { return @{ Ok=$false; Reason="Missing some stage cards needed for reorder." } }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum
  $working = $content
  foreach ($m in ($matchesAll | Sort-Object Index -Descending)) { $working = $working.Remove($m.Index, $m.Length) }

  $insertBlock = (($order | ForEach-Object { $found[$_].Value }) -join "`r`n")
  $working = $working.Insert($minStart, $insertBlock + "`r`n")
  return @{ Ok=$true; NewContent=$working; Mode="jsx-stage-props" }
}

# --- find best candidate file ---
$files = Get-ChildItem -Path $Root -Recurse -File -Include *.tsx,*.ts |
  Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\_bak\\" }

$candidates = @()
foreach ($f in $files) {
  $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  if (-not $txt) { continue }
  $s = Score-File $txt
  if ($s -ge 8) { $candidates += [pscustomobject]@{ Path=$f.FullName; Score=$s } }
}

if ($candidates.Count -eq 0) {
  Write-Host "No strong candidate found. Showing top 30 likely files (score>=5)..." -ForegroundColor Yellow
  $loose = @()
  foreach ($f in $files) {
    $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $txt) { continue }
    $s = Score-File $txt
    if ($s -ge 5) { $loose += [pscustomobject]@{ Path=$f.FullName; Score=$s } }
  }
  $loose | Sort-Object Score -Descending | Select-Object -First 30 | Format-Table -AutoSize
  exit 1
}

$best = $candidates | Sort-Object Score -Descending
$topScore = $best[0].Score
$tied = $best | Where-Object { $_.Score -eq $topScore }

if ($tied.Count -gt 1) {
  Write-Host "Multiple top candidates tied. Paste this table to me and Ill lock to the correct file:" -ForegroundColor Yellow
  $tied | Format-Table -AutoSize
  exit 2
}

$target = $best[0].Path
Write-Host "Target file:" -NoNewline
Write-Host " $target" -ForegroundColor Cyan

# Backup if helper exists
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
}

$orig = Get-Content -LiteralPath $target -Raw

# Try methods in order
$result = Try-Reorder-StageKeyArray $orig
if (-not $result.Ok) { $result = Try-Reorder-JsxStageProps $orig }
if (-not $result.Ok) { $result = Try-Reorder-ConfigObjects $orig }

if (-not $result.Ok) {
  Write-Host "Failed to auto-reorder dashboard tiles." -ForegroundColor Red
  Write-Host $result.Reason -ForegroundColor Red
  exit 3
}

Set-Content -LiteralPath $target -Value $result.NewContent -Encoding UTF8
Write-Host "Reordered dashboard tiles using mode:" -NoNewline
Write-Host " $($result.Mode)" -ForegroundColor Green
