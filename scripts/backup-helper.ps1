function Backup-File {
  param(
    [Parameter(Mandatory=$true)][string]$Path
  )

  $proj = (Resolve-Path ".").Path
  $full = (Resolve-Path -LiteralPath $Path).Path
  $bakRoot = Join-Path $proj "_bak"

  if ($full -notlike "$proj*") { throw "File must be inside project folder: $full" }

  $rel = $full.Substring($proj.Length).TrimStart('\')
  $dirRel = Split-Path $rel -Parent
  $name = Split-Path $rel -Leaf

  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $destDir = Join-Path $bakRoot $dirRel
  New-Item -ItemType Directory -Force -Path $destDir | Out-Null

  $dest = Join-Path $destDir ("{0}.bak_{1}" -f $name,$stamp)
  Copy-Item -LiteralPath $full -Destination $dest -Force

  return $dest
}


