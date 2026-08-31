@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Collect-LensNextFailureDetails.ps1"
echo.
echo Log retained on this screen.
pause
