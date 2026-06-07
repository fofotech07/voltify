$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$node = Join-Path $PSScriptRoot "..\tools\node\node.exe"
$npm  = Join-Path $PSScriptRoot "..\tools\node\npm.cmd"

if (-not (Test-Path $node)) {
  if (Test-Path "C:\Program Files\nodejs\node.exe") {
    $node = "C:\Program Files\nodejs\node.exe"
    $npm  = "C:\Program Files\nodejs\npm.cmd"
  } else {
    throw "Node not found. Run setup-portable-node.ps1 first."
  }
}

Write-Host "Node:" (& $node -v)
Write-Host "npm:"  (& $npm -v)

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }

Write-Host "Installing packages..."
& $npm install

Write-Host ""
Write-Host "API:       http://localhost:4000"
Write-Host "Dashboard: http://localhost:4000/dashboard.html"
Write-Host "Login:     admin / AdminPassword123!"
Write-Host ""

& $node src\server.js
