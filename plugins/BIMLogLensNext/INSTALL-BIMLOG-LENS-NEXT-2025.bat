@echo off
setlocal
title BIMLog Lens Next 2025 v1.05.N10-P04 Installer
echo BIMLog Lens Next 2025 v1.05.N10-P04
echo Close Navisworks Manage 2025 before continuing.
echo.
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-BIMLogLensNext2025.ps1"
set "rc=%ERRORLEVEL%"
echo.
if not "%rc%"=="0" echo INSTALL FAILED - EXIT CODE %rc%
if "%rc%"=="0" echo INSTALL COMPLETED
echo Log retained on this screen.
pause
exit /b %rc%
