@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Aether chat self-test ===
where node
node -v
echo.
echo Running: node chat-simple.mjs "hello"
echo ----------------------------------------
node chat-simple.mjs "hello"
echo ----------------------------------------
if errorlevel 1 (
  echo RESULT: FAIL
) else (
  echo RESULT: PASS — agar upar jawab dikha to chat kaam karta hai
  echo.
  echo Ab baat karne ke liye double-click: CHAT.bat
)
echo.
pause
