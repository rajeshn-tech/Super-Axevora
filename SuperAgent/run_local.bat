@echo off
title SuperAgent - 24/7 Mobile AI Commander
color 0b

echo ===============================================================
echo            ⚡ SUPERAGENT 24/7 LOCAL CONTROLLER ⚡
echo ===============================================================
echo.
echo Checking Node.js environment...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in your PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js is available.
echo Starting SuperAgent server on port 8787...
echo.

start "" "http://localhost:8787"

node src\server.mjs
pause

