@echo off
title Push to GitHub (Kaalvan_REA)
cd /d "%~dp0"

echo ================================================================
echo    Pushing project to https://github.com/rajeshn-tech/Kaalvan_REA.git
echo ================================================================
echo.

where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not found in PATH!
    echo Please make sure Git is installed or run these commands inside Git Bash.
    pause
    exit /b 1
)

if not exist ".git" (
    echo [1/5] Initializing Git...
    git init
) else (
    echo [1/5] Git already initialized.
)

echo [2/5] Setting branch to main...
git branch -M main

echo [3/5] Configuring remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/rajeshn-tech/Kaalvan_REA.git

echo [4/5] Adding files (excluding node_modules/dist via .gitignore)...
git add .

echo [5/5] Committing changes...
git commit -m "feat: initial backup of REA and OpenComp VFX workstation"

echo.
echo Pushing to GitHub...
git push -u origin main

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [INFO] Remote might have existing commits (like README/license).
    echo Attempting force push...
    git push -u origin main --force
)

echo.
echo ================================================================
echo    Done! Please check your GitHub repository.
echo ================================================================
pause

