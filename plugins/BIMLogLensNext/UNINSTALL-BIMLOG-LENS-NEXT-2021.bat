@echo off
setlocal
title BIMLog Lens Next 2021 v1.0.51 Uninstaller
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0Uninstall-BIMLogLensNext2021.ps1"
exit /b %errorlevel%
