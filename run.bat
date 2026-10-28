@echo off
title FDR DRAMA DL PRO - Hongguo Luxury Premium
cd /d "%~dp0"
echo ========================================================
echo  Starting FDR DRAMA DL PRO (Electron JS Luxury VIP)...
echo ========================================================
if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" .
) else (
    npm start
)
