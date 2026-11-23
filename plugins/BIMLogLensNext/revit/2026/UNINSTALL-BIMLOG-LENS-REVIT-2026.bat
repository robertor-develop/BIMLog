@echo off
setlocal
title BIMLog Lens Next - Uninstall from Revit 2026

echo Uninstalling BIMLog Lens Next from Revit 2026...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-Revit2026.ps1"
set "BIMLOG_EXIT=%ERRORLEVEL%"

if not "%BIMLOG_EXIT%"=="0" (
  echo.
  echo Uninstallation failed. Review the message above or contact BIMLog support.
) else (
  echo.
  echo Uninstallation completed. Restart Revit to complete removal.
)

echo.
pause
exit /b %BIMLOG_EXIT%
