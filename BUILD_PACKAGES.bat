@echo off
title FDR Pro Build & Packaging System
cd /d "%~dp0"

echo ===================================================
echo     FDR Drama DL Pro - One-Click Build & Pack
echo ===================================================
echo.
echo [1/3] Building Electron Packages (Setup, Portable, No-Terminal)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Electron build failed!
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Building Admin Key Generator EXE...
python -m PyInstaller --onefile --noconsole --icon="FDR Download Drama.ico" --name="FDR Pro Key Generator" "FDR Pro Key Generator.pyw"

echo.
echo [3/3] Organizing into Clean Client and Admin Folders...
node organize_build.js

echo.
echo ===================================================
echo  SUCCESS! Packages are ready in FINAL_BUILD folder!
echo ===================================================
pause
