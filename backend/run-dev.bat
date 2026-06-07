@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "NODE_EXE="
set "NPM_CMD="

REM 1) Portable inside project
if exist "%~dp0..\tools\node\node.exe" (
  set "NODE_EXE=%~dp0..\tools\node\node.exe"
  set "NPM_CMD=%~dp0..\tools\node\npm.cmd"
  goto :found
)

REM 2) Standard Windows install
if exist "C:\Program Files\nodejs\node.exe" (
  set "NODE_EXE=C:\Program Files\nodejs\node.exe"
  set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
  goto :found
)

REM 3) Per-user install
if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
  set "NODE_EXE=%LOCALAPPDATA%\Programs\node\node.exe"
  set "NPM_CMD=%LOCALAPPDATA%\Programs\node\npm.cmd"
  goto :found
)

echo.
echo [ERROR] npm/node not found on this PC.
echo.
echo Fix option A - reinstall Node LTS from https://nodejs.org
echo   - check "Add to PATH"
echo   - restart PowerShell after install
echo.
echo Fix option B - portable install (run in this folder):
echo   powershell -ExecutionPolicy Bypass -File "%~dp0setup-portable-node.ps1"
echo   then run this file again.
echo.
pause
exit /b 1

:found
echo Using Node: %NODE_EXE%
"%NODE_EXE%" -v
call "%NPM_CMD%" -v
echo.

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo Created .env
)

echo Installing packages...
call "%NPM_CMD%" install
if errorlevel 1 (
  echo npm install failed.
  pause
  exit /b 1
)

echo.
echo API: http://localhost:4000
echo Admin: http://localhost:4000/admin.html
echo Login: admin / AdminPassword123!
echo.
start "" "http://localhost:4000/admin.html"
"%NODE_EXE%" src\server.js
pause
