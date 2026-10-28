@echo off
title FDR Drama DL Pro - Auto Build & Publish Update to GitHub
color 0b

echo =======================================================
echo   FDR DRAMA DL PRO - 1-CLICK AUTO PUBLISH RELEASE
echo =======================================================
echo.
echo [1/2] Building Windows Installer & Portable Binaries...
call npx electron-builder --win

if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Build failed!
  pause
  exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Uploading & Publishing Release to GitHub Releases...
node publish_release.js

echo.
echo =======================================================
echo   DONE! NEW VERSION IS NOW LIVE FOR ALL USERS!
echo =======================================================
pause
