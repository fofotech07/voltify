@echo off
echo === Node / npm diagnostic ===
echo.

where node 2>nul
if errorlevel 1 echo [PATH] node: NOT in PATH

where npm 2>nul
if errorlevel 1 echo [PATH] npm: NOT in PATH

echo.
if exist "C:\Program Files\nodejs\node.exe" (
  echo [OK] C:\Program Files\nodejs\node.exe
  "C:\Program Files\nodejs\node.exe" -v
  "C:\Program Files\nodejs\npm.cmd" -v
) else (
  echo [NO] C:\Program Files\nodejs
)

echo.
if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
  echo [OK] %LOCALAPPDATA%\Programs\node\node.exe
  "%LOCALAPPDATA%\Programs\node\node.exe" -v
  "%LOCALAPPDATA%\Programs\node\npm.cmd" -v
) else (
  echo [NO] %LOCALAPPDATA%\Programs\node
)

echo.
if exist "%~dp0..\tools\node\node.exe" (
  echo [OK] portable tools\node
  "%~dp0..\tools\node\node.exe" -v
  "%~dp0..\tools\node\npm.cmd" -v
) else (
  echo [NO] portable tools\node
)

echo.
pause
