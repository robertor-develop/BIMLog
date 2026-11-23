@echo off
setlocal
title BIMLog Lens Next - Install for Revit 2026

echo Installing BIMLog Lens Next for Revit 2026.5 or later...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Revit2026.ps1" -SourceRoot "%~dp0"
set "BIMLOG_EXIT=%ERRORLEVEL%"

if not "%BIMLOG_EXIT%"=="0" (
  echo.
  echo Installation failed. No existing installation was intentionally removed.
  echo Review the message above or contact BIMLog support.
) else (
  echo.
  echo Installation completed. Restart Revit before using BIMLog Lens Next.
)

echo.
pause
exit /b %BIMLOG_EXIT%
