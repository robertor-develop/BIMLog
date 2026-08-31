@echo off
setlocal
title BIMLog Lens Next 2021 v1.0.49 Installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-BIMLogLensNext2021.ps1"
exit /b %errorlevel%
