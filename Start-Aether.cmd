@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo === Aether AI (API + Chat) ===
if not exist node_modules (
  echo npm install...
  call npm.cmd install
)
if not exist .env (
  if exist .env.example copy /Y .env.example .env
  echo Created .env — add EXA_API_KEY if you want live web
)
if not exist "E:\AetherAI\data\training" mkdir "E:\AetherAI\data\training"
if not exist "E:\AetherAI\data\memory" mkdir "E:\AetherAI\data\memory"
if not exist "E:\AetherAI\data\missions" mkdir "E:\AetherAI\data\missions"
if not exist "E:\AetherAI\data\logs" mkdir "E:\AetherAI\data\logs"
echo build...
call npm.cmd run build
if errorlevel 1 (
  echo BUILD FAILED
  pause
  exit /b 1
)
REM Prefer Chat-Aether.cmd for chat-only (no server). This starts API too.
echo Starting API http://127.0.0.1:8788
start "Aether-API" cmd /k "cd /d %~dp0 && npm.cmd run start:api"
timeout /t 2 >nul
echo.
echo Chat CLI in this window (for API-only use browser/curl on :8788):
call npm.cmd run chat
endlocal
