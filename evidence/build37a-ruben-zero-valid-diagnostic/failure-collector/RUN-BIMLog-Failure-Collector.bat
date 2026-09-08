@echo off
setlocal
title BIMLog Navisworks 2025 Failure Collector
cd /d "%~dp0"
echo Collecting BIMLog and Navisworks 2025 failure evidence...
if "%~1"=="" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Collect-BIMLog-Navisworks2025-Failure.ps1"
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Collect-BIMLog-Navisworks2025-Failure.ps1" -FailedXmlPath "%~1"
)
if errorlevel 1 (
  echo.
  echo Collection failed. Take a screenshot of this window and send it to Roberto.
) else (
  echo.
  echo Done. Send the new BIMLog-Navisworks2025-Failure ZIP from your Desktop to Roberto.
)
echo.
pause
endlocal
