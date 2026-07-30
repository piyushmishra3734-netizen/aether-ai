@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Aether AI — Chat
cd /d "%~dp0"

echo.
echo  AETHER AI — pure Node chat (no npm / no tsx)
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist "E:\AetherAI\data" mkdir "E:\AetherAI\data"
if not exist "E:\AetherAI\data\memory" mkdir "E:\AetherAI\data\memory"
if not exist "E:\AetherAI\data\logs" mkdir "E:\AetherAI\data\logs"

if not exist .env (
  if exist .env.example copy /Y .env.example .env >nul
)

echo Starting: node chat-simple.mjs
echo Type and press Enter. Exit: /quit
echo.

node chat-simple.mjs
set ERR=%ERRORLEVEL%

echo.
if %ERR% neq 0 (
  echo Chat exited with error %ERR%.
) else (
  echo Chat closed.
)
pause
endlocal
exit /b %ERR%
