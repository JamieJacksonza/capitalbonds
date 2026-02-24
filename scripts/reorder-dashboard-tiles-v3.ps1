param(
  [string]$Root = "."
)

# Desired tile order
$desiredLabels = @("Instructed","Granted","AIP","Submitted","NTU","Registrations")

function Score-File([string]$text) {
  $score = 0
  foreach ($t in $desiredLabels) { if ($text -match [regex]::Escape($t)) { $score++ } }
  if ($text -match "Deal Breakdown") { $score += 3 }
  if ($text -match "stageOrder" -or $text -match "StageCard" -or $text -match "Breakdown") { $score += 2 }
  if ($text -match "Registrations" -and $text -match "NTU") { $score += 1 }
  return $score
}

function Try-Reorder-StageKeyArray([string]$content) {
  # reorder arrays of quoted stage keys e.g. ["submitted","aip","instructed","granted","ntu","registrations"]
  $rx = New-Object System.Text.RegularExpressions.Regex("(?ms)\[(?:\s*[""'][a-zA-Z_]+[""']\s*,?)+\s*\]")
  $matches = $rx.Matches($content)

  foreach ($m in $matches) {
    $arr = $m.Value

    $keys = @("submitted","aip","instructed","granted","ntu","registrations","registration")
    $found = @()
    foreach ($k in $keys) {
      if ($arr -match "(?i)[""']$k[""']") { $found += $k }
    }

    if (($found | Select-Object -Unique).Count -ge 5) {
      $quote = '"'
      if ($arr -notmatch '"') { $quote = "'" }

      $useRegistrations = $true
      if (($arr -match "(?i)['""]registration['""]") -and -not ($arr -match "(?i)['""]registrations['""]")) {
        $useRegistrations = $false
      }

      $regKey = "registrations"
      if (-not $useRegistrations) { $regKey = "registration" }

      $newKeys = @("instructed","granted","aip","submitted","ntu",$regKey)
      $newArr = "[ " + \(\(\$newKeys \| ForEach-Object { "$quoteparam(
  [string]$Root = "."
)

# Desired tile order
$desiredLabels = @("Instructed","Granted","AIP","Submitted","NTU","Registrations")

function Score-File([string]$text) {
  $score = 0
  foreach ($t in $desiredLabels) { if ($text -match [regex]::Escape($t)) { $score++ } }
  if ($text -match "Deal Breakdown") { $score += 3 }
  if ($text -match "stageOrder" -or $text -match "StageCard" -or $text -match "Breakdown") { $score += 2 }
  if ($text -match "Registrations" -and $text -match "NTU") { $score += 1 }
  return $score
}

function Try-Reorder-StageKeyArray([string]$content) {
  # reorder arrays of quoted stage keys e.g. ["submitted","aip","instructed","granted","ntu","registrations"]
  $rx = New-Object System.Text.RegularExpressions.Regex("(?ms)\[(?:\s*[""'][a-zA-Z_]+[""']\s*,?)+\s*\]")
  $matches = $rx.Matches($content)

  foreach ($m in $matches) {
    $arr = $m.Value

    $keys = @("submitted","aip","instructed","granted","ntu","registrations","registration")
    $found = @()
    foreach ($k in $keys) {
      if ($arr -match "(?i)[""']$k[""']") { $found += $k }
    }

    if (($found | Select-Object -Unique).Count -ge 5) {
      $quote = '"'
      if ($arr -notmatch '"') { $quote = "'" }

      $useRegistrations = $true
      if (($arr -match "(?i)['""]registration['""]") -and -not ($arr -match "(?i)['""]registrations['""]")) {
        $useRegistrations = $false
      }

      $regKey = "registrations"
      if (-not $useRegistrations) { $regKey = "registration" }

      $newKeys = @("instructed","granted","aip","submitted","ntu",$regKey)
      $newArr = "[ " + ($newKeys | ForEach-Object { "$quote$_$quote" } -join ", ") + " ]"

      $before = $content.Substring(0, $m.Index)
      $after  = $content.Substring($m.Index + $m.Length)
      return @{ Ok=$true; NewContent=($before + $newArr + $after); Mode="stage-key-array" }
    }
  }

  return @{ Ok=$false; Reason="No suitable stage key array found." }
}

function Try-Reorder-LabelConfigObjects([string]$content) {
  # reorder simple objects with label/title/name (no nested braces)
  $wanted = @("Instructed","Granted","AIP","Submitted","NTU","Registrations")
  $found = @{}
  $matchesAll = @()

  foreach ($t in $wanted) {
    $pat = "(?ms)\{[^{}]*?(?:label|title|name)\s*:\s*[""']" + [regex]::Escape($t) + "[""'][^{}]*?\}\s*,?"
    $m = [regex]::Match($content, $pat)
    if ($m.Success) { $found[$t] = $m; $matchesAll += $m }
  }

  if ($found.Keys.Count -ne $wanted.Count) {
    return @{ Ok=$false; Reason="Could not find all tiles as simple label/title/name config objects." }
  }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum
  $working = $content
  foreach ($m in ($matchesAll | Sort-Object Index -Descending)) {
    $working = $working.Remove($m.Index, $m.Length)
  }

  $insertBlock = (($wanted | ForEach-Object { $found[$_].Value }) -join "`r`n")
  $working = $working.Insert($minStart, $insertBlock + "`r`n")

  return @{ Ok=$true; NewContent=$working; Mode="label-config-objects" }
}

# Scan files
$files = Get-ChildItem -Path $Root -Recurse -File -Include *.tsx,*.ts,*.jsx,*.js |
  Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\_bak\\" -and $_.FullName -notmatch "\\.next\\" }

$scored = @()
foreach ($f in $files) {
  $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  if (-not $txt) { continue }
  $s = Score-File $txt
  $scored += [pscustomobject]@{ Path=$f.FullName; Score=$s }
}

$top = $scored | Sort-Object Score -Descending | Select-Object -First 20
Write-Host "Top candidates (for visibility):" -ForegroundColor Yellow
$top | Format-Table -AutoSize

$target = ($top | Select-Object -First 1).Path
if (-not $target) { Write-Host "No target file found." -ForegroundColor Red; exit 1 }

Write-Host "Target file:" -NoNewline
Write-Host " $target" -ForegroundColor Cyan

# Backup helper if you have it
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
}

$orig = Get-Content -LiteralPath $target -Raw

# Try reorder methods
$result = Try-Reorder-StageKeyArray $orig
if (-not $result.Ok) { $result = Try-Reorder-LabelConfigObjects $orig }

if (-not $result.Ok) {
  Write-Host "Failed to reorder tiles." -ForegroundColor Red
  Write-Host $result.Reason -ForegroundColor Red
  exit 2
}

Set-Content -LiteralPath $target -Value $result.NewContent -Encoding UTF8
Write-Host "Reordered tiles using mode:" -NoNewline
Write-Host " $($result.Mode)" -ForegroundColor Green
Write-Host "Changed file:" -NoNewline
Write-Host " $target" -ForegroundColor Green
$quote" }\) -join ", "\) + " ]"

      $before = $content.Substring(0, $m.Index)
      $after  = $content.Substring($m.Index + $m.Length)
      return @{ Ok=$true; NewContent=($before + $newArr + $after); Mode="stage-key-array" }
    }
  }

  return @{ Ok=$false; Reason="No suitable stage key array found." }
}

function Try-Reorder-LabelConfigObjects([string]$content) {
  # reorder simple objects with label/title/name (no nested braces)
  $wanted = @("Instructed","Granted","AIP","Submitted","NTU","Registrations")
  $found = @{}
  $matchesAll = @()

  foreach ($t in $wanted) {
    $pat = "(?ms)\{[^{}]*?(?:label|title|name)\s*:\s*[""']" + [regex]::Escape($t) + "[""'][^{}]*?\}\s*,?"
    $m = [regex]::Match($content, $pat)
    if ($m.Success) { $found[$t] = $m; $matchesAll += $m }
  }

  if ($found.Keys.Count -ne $wanted.Count) {
    return @{ Ok=$false; Reason="Could not find all tiles as simple label/title/name config objects." }
  }

  $minStart = ($matchesAll | Measure-Object Index -Minimum).Minimum
  $working = $content
  foreach ($m in ($matchesAll | Sort-Object Index -Descending)) {
    $working = $working.Remove($m.Index, $m.Length)
  }

  $insertBlock = (($wanted | ForEach-Object { $found[$_].Value }) -join "`r`n")
  $working = $working.Insert($minStart, $insertBlock + "`r`n")

  return @{ Ok=$true; NewContent=$working; Mode="label-config-objects" }
}

# Scan files
$files = Get-ChildItem -Path $Root -Recurse -File -Include *.tsx,*.ts,*.jsx,*.js |
  Where-Object { $_.FullName -notmatch "\\node_modules\\" -and $_.FullName -notmatch "\\_bak\\" -and $_.FullName -notmatch "\\.next\\" }

$scored = @()
foreach ($f in $files) {
  $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue
  if (-not $txt) { continue }
  $s = Score-File $txt
  $scored += [pscustomobject]@{ Path=$f.FullName; Score=$s }
}

$top = $scored | Sort-Object Score -Descending | Select-Object -First 20
Write-Host "Top candidates (for visibility):" -ForegroundColor Yellow
$top | Format-Table -AutoSize

$target = ($top | Select-Object -First 1).Path
if (-not $target) { Write-Host "No target file found." -ForegroundColor Red; exit 1 }

Write-Host "Target file:" -NoNewline
Write-Host " $target" -ForegroundColor Cyan

# Backup helper if you have it
if (Test-Path ".\scripts\backup-helper.ps1") {
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force | Out-Null
  . .\scripts\backup-helper.ps1
}

$orig = Get-Content -LiteralPath $target -Raw

# Try reorder methods
$result = Try-Reorder-StageKeyArray $orig
if (-not $result.Ok) { $result = Try-Reorder-LabelConfigObjects $orig }

if (-not $result.Ok) {
  Write-Host "Failed to reorder tiles." -ForegroundColor Red
  Write-Host $result.Reason -ForegroundColor Red
  exit 2
}

Set-Content -LiteralPath $target -Value $result.NewContent -Encoding UTF8
Write-Host "Reordered tiles using mode:" -NoNewline
Write-Host " $($result.Mode)" -ForegroundColor Green
Write-Host "Changed file:" -NoNewline
Write-Host " $target" -ForegroundColor Green

