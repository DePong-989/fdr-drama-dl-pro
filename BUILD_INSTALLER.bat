@echo off
title FDR Pro - Build Installer EXE (NSIS)
cd /d "%~dp0"

echo ===================================================
echo     FDR Drama DL Pro - Build Installer EXE
echo ===================================================
echo.
echo Compiling Windows Setup Installer EXE...
call npm run build:installer
if %errorlevel% neq 0 (
    echo [ERROR] Installer build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo Syncing to 1_FOR_CLIENT and installer/ folder...
node organize_build.js

echo.
echo ===================================================
echo  SUCCESS! Installer is ready:
echo  1. FINAL_BUILD\1_FOR_CLIENT\FDR Download Drama Pro Setup.exe
echo  2. installer\FDR Download Drama Pro Setup.exe
echo ===================================================
pause
