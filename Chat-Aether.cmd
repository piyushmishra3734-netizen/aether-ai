@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Aether AI — Chat / Baat
cd /d "%~dp0"

echo.
echo  ================================================
echo   AETHER AI — Local Chat  ^|  Local Baat-cheet
echo  ================================================
echo   English: Type your message, press Enter.
echo   Hindi:   Apna message likho, Enter dabao.
echo   Exit:    /quit  ya  /exit
echo   (Pure Node — no npm/tsx required)
echo  ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

if not exist .env (
  if exist .env.example (
    copy /Y .env.example .env >nul
    echo Created .env from .env.example
  )
)

if not exist "E:\AetherAI\data" mkdir "E:\AetherAI\data"
if not exist "E:\AetherAI\data\memory" mkdir "E:\AetherAI\data\memory"
if not exist "E:\AetherAI\data\missions" mkdir "E:\AetherAI\data\missions"
if not exist "E:\AetherAI\data\training" mkdir "E:\AetherAI\data\training"
if not exist "E:\AetherAI\data\logs" mkdir "E:\AetherAI\data\logs"

if not exist "chat-simple.mjs" (
  echo ERROR: chat-simple.mjs missing in %CD%
  pause
  exit /b 1
)

echo Starting chat with: node chat-simple.mjs
echo Wait for prompt: aether^>
echo Type and press Enter.
echo.

node chat-simple.mjs
set ERR=%ERRORLEVEL%

if %ERR% neq 0 (
  echo.
  echo Simple chat failed. Trying built dist...
  if exist "dist\cli-chat.js" (
    node dist\cli-chat.js
    set ERR=%ERRORLEVEL%
  )
)

if %ERR% neq 0 (
  echo.
  echo Dist failed. Last resort: npm.cmd run chat
  if exist node_modules (
    call npm.cmd run chat
    set ERR=%ERRORLEVEL%
  ) else (
    echo node_modules missing — run: npm.cmd install
  )
)

echo.
echo Chat closed.
pause
endlocal
exit /b %ERR%
