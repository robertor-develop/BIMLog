@echo off
setlocal
title BIMLog Lens Next 2025 v1.0.50 Uninstaller
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-BIMLogLensNext2025.ps1"
set "rc=%ERRORLEVEL%"
echo.
if not "%rc%"=="0" echo UNINSTALL FAILED - EXIT CODE %rc%
if "%rc%"=="0" echo UNINSTALL COMPLETED
echo Log retained on this screen.
pause
exit /b %rc%
