# Voltify - Install portable Node.js (no winget / no MSI required)
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root "tools"
$nodeDir = Join-Path $tools "node"
$zip = Join-Path $tools "node.zip"
$version = "22.14.0"
$url = "https://nodejs.org/dist/v$version/node-v$version-win-x64.zip"

Write-Host "==> Creating tools folder..."
New-Item -ItemType Directory -Force -Path $tools | Out-Null

Write-Host "==> Downloading Node.js $version ..."
Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing

Write-Host "==> Extracting..."
Expand-Archive -Path $zip -DestinationPath $tools -Force
$folder = Get-ChildItem $tools -Directory | Where-Object { $_.Name -like "node-v*" } | Select-Object -First 1
if (-not $folder) { throw "Extract failed." }

if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
Rename-Item $folder.FullName $nodeDir
Remove-Item $zip -Force -ErrorAction SilentlyContinue

Write-Host "==> Verifying..."
& (Join-Path $nodeDir "node.exe") -v
& (Join-Path $nodeDir "npm.cmd") -v
Write-Host ""
Write-Host "SUCCESS. Portable Node installed at:"
Write-Host $nodeDir
Write-Host ""
Write-Host "Next: run  backend\install-and-run.bat"
