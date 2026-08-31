@echo off
setlocal
title BIMLog Lens Next 2025 Diagnostics
echo BIMLog Lens Next 2025 - read-only diagnostics
echo This does not change Windows Security, Navisworks, or installed files.
echo.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Collect-BIMLogLensNext2025Diagnostics.ps1"
set "rc=%ERRORLEVEL%"
echo.
if not "%rc%"=="0" echo DIAGNOSTICS FAILED - EXIT CODE %rc%
if "%rc%"=="0" echo DIAGNOSTICS COMPLETED
echo Log retained on this screen.
pause
exit /b %rc%
