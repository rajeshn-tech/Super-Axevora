@echo off
title OpenComp - Foundry Nuke Desktop Alternative (PySide6)
cd /d "%~dp0"

echo ================================================================
echo    🎬 OpenComp - Node-Based VFX Compositing Workstation
echo    (Foundry Nuke Alternative in Python / PySide6)
echo ================================================================
echo.

if exist ".venv\Scripts\python.exe" (
    echo [INFO] Starting OpenComp with virtual environment Python...
    ".venv\Scripts\python.exe" -m src.main
) else (
    echo [INFO] Starting OpenComp with system Python...
    python -m src.main
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application exited with error.
    pause
)
