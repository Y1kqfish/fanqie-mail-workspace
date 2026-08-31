param(
  [string]$ProjectRoot = (Split-Path -Parent (Split-Path -Parent $PSCommandPath)),
  [string]$OutputDirectory = "dist",
  [string]$PackageStem = "fanqie-mail-0.1.0-personal-20260831"
)

$ErrorActionPreference = "Stop"
$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
$manifestPath = Join-Path $project "manifest.json"
$manifest = [System.IO.File]::ReadAllText($manifestPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json

$sourcePaths = [System.Collections.Generic.List[string]]::new()
$sourcePaths.Add("manifest.json")
$sourcePaths.Add([string]$manifest.background.service_worker)
foreach ($scriptGroup in @($manifest.content_scripts)) {
  foreach ($path in @($scriptGroup.js)) {
    if (-not [string]::IsNullOrWhiteSpace([string]$path)) { $sourcePaths.Add([string]$path) }
  }
  foreach ($path in @($scriptGroup.css)) {
    if (-not [string]::IsNullOrWhiteSpace([string]$path)) { $sourcePaths.Add([string]$path) }
  }
}
$sourcePaths.Add("NOTICE.md")
$sourcePaths.Add("third_party/fluentui-system-icons/LICENSE")
$sourcePaths.Add("third_party/fluentui-system-icons/NOTICE.md")

$releaseDocs = @{
  "docs/release/fanqie-mail-personal-install.md" = "INSTALL.md"
  "docs/release/fanqie-mail-m4-acceptance-summary.md" = "ACCEPTANCE-SUMMARY.md"
}

$uniqueSources = @($sourcePaths | Select-Object -Unique)
foreach ($relativePath in $uniqueSources) {
  if ([System.IO.Path]::IsPathRooted($relativePath) -or (@($relativePath -split '[\\/]') -contains '..')) {
    throw "Unsafe allowlisted resource path: $relativePath"
  }
  $fullPath = Join-Path $project $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing allowlisted resource: $relativePath" }
}
foreach ($relativePath in $releaseDocs.Keys) {
  $fullPath = Join-Path $project $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing release document: $relativePath" }
}

$outputDir = Join-Path $project $OutputDirectory
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$zipPath = Join-Path $outputDir ($PackageStem + ".zip")
$suffix = 2
while (Test-Path -LiteralPath $zipPath) {
  $zipPath = Join-Path $outputDir ($PackageStem + "-" + $suffix + ".zip")
  $suffix += 1
}

$stage = Join-Path ([System.IO.Path]::GetTempPath()) ("fqmail-package-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$projectBoundary = ((Resolve-Path -LiteralPath $project).Path).TrimEnd('\') + '\'
$stageBoundary = ((Resolve-Path -LiteralPath $stage).Path).TrimEnd('\') + '\'
foreach ($relativePath in $uniqueSources) {
  $source = (Resolve-Path -LiteralPath (Join-Path $project $relativePath)).Path
  $destination = [System.IO.Path]::GetFullPath((Join-Path $stage $relativePath))
  if (-not $source.StartsWith($projectBoundary, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Source escapes project: $relativePath" }
  if (-not $destination.StartsWith($stageBoundary, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Destination escapes staging: $relativePath" }
  $parent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}
foreach ($entry in $releaseDocs.GetEnumerator()) {
  $source = (Resolve-Path -LiteralPath (Join-Path $project $entry.Key)).Path
  $destination = [System.IO.Path]::GetFullPath((Join-Path $stage $entry.Value))
  if (-not $source.StartsWith($projectBoundary, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Release source escapes project: $($entry.Key)" }
  if (-not $destination.StartsWith($stageBoundary, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Release destination escapes staging: $($entry.Value)" }
  Copy-Item -LiteralPath $source -Destination $destination
}

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Output "zip=$zipPath"
Write-Output "staging=$stage"
