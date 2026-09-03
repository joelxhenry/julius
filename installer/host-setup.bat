@echo off
REM Turbo Julius host setup launcher.
REM Double-click this file, then approve the "Run as administrator" prompt.
REM It relaunches host-setup.ps1 elevated, allowing the unsigned script to run.

setlocal
set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-NoExit','-File','\"%SCRIPT_DIR%host-setup.ps1\"'"

endlocal
