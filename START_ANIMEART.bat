@echo off
setlocal
cd /d "%~dp0web"
where node >nul 2>nul
if errorlevel 1 (
  echo AnimeArt requires Node.js 22 or newer.
  echo Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
start "" cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:4173/"
node scripts\serve.mjs
pause
