@echo off
setlocal
title BIMLog Lens Next 2021 v1.05.N01-P01 Installer
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-BIMLogLensNext2021.ps1"
exit /b %errorlevel%
