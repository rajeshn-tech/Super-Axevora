@echo off
title OpenComp - Foundry Nuke Alternative (VFX Compositor)
cd /d "%~dp0"

echo ================================================================
echo    OpenComp - Node-Based VFX Compositing Workstation
echo    (Foundry Nuke Alternative)
echo ================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Starting OpenComp with local server...
    node server.js
) else (
    echo [INFO] Node.js not found in PATH. Opening index.html directly...
    start "" "index.html"
)

