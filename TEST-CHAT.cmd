@echo off
chcp 65001 >nul
setlocal EnableExtensions
title Aether AI - TEST CHAT
cd /d "%~dp0"

echo.
echo  ================================================
echo   AETHER AI - CHAT SELF-TEST
echo  ================================================
echo.

set PASS=0
set FAIL=0

where node >nul 2>&1
if errorlevel 1 (
  echo [FAIL] Node.js not found
  set /a FAIL+=1
  goto done
)
echo [PASS] node found
set /a PASS+=1

if not exist chat-simple.mjs (
  echo [FAIL] chat-simple.mjs missing
  set /a FAIL+=1
  goto done
)
echo [PASS] chat-simple.mjs present
set /a PASS+=1

echo.
echo --- Test 1: piped hello via node chat-simple.mjs ---
echo hello> "%TEMP%\aether-chat-in.txt"
node chat-simple.mjs < "%TEMP%\aether-chat-in.txt" > "%TEMP%\aether-chat-test-out.txt" 2>&1
findstr /I /C:"Aether" "%TEMP%\aether-chat-test-out.txt" >nul
if errorlevel 1 (
  echo [FAIL] chat-simple produced no recognizable reply
  type "%TEMP%\aether-chat-test-out.txt"
  set /a FAIL+=1
) else (
  echo [PASS] chat-simple replied
  set /a PASS+=1
  echo --- sample output ---
  type "%TEMP%\aether-chat-test-out.txt"
  echo --- end sample ---
)

echo.
echo --- Test 2: dist cli-chat optional ---
echo hello> "%TEMP%\aether-dist-in.txt"
node "dist\cli-chat.js" < "%TEMP%\aether-dist-in.txt" > "%TEMP%\aether-dist-chat-test.txt" 2>&1
if errorlevel 1 (
  echo [WARN] dist cli-chat failed to run (not fatal)
) else (
  findstr /I /C:"Aether" "%TEMP%\aether-dist-chat-test.txt" >nul
  if errorlevel 1 (
    echo [WARN] dist cli-chat weak output (not fatal)
  ) else (
    echo [PASS] dist/cli-chat.js replied
    set /a PASS+=1
  )
)

echo.
echo --- Test 3: last-chat-simple log ---
if exist "E:\AetherAI\data\logs\last-chat-simple.txt" (
  echo [PASS] log written: E:\AetherAI\data\logs\last-chat-simple.txt
  set /a PASS+=1
  echo --- log snippet ---
  type "E:\AetherAI\data\logs\last-chat-simple.txt"
  echo.
) else (
  echo [WARN] no last-chat-simple.txt yet
)

:done
echo.
echo  ================================================
echo   RESULT: PASS=%PASS%  FAIL=%FAIL%
if %FAIL%==0 (
  echo   OVERALL: PASS - double-click Chat-Aether.cmd or CHAT.bat
  set RC=0
) else (
  echo   OVERALL: FAIL - see errors above
  set RC=1
)
echo  ================================================
echo.
pause
exit /b %RC%
