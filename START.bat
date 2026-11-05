@echo off
REM Nexora Fx — ek click-e chalao. Node.js install thakte hobe.
cd /d "%~dp0backend"
node --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js pai nai! nodejs.org theke LTS version install koro,
  echo tarpor abar START.bat double-click koro.
  echo.
  pause
  exit /b 1
)
REM Age theke kono purono server cholle seta bondho koro (port 3000 khali koro)
taskkill /F /IM node.exe >nul 2>&1
if not exist node_modules\dotenv (
  echo Prothom bar — dependency install hochhe, ektu time nibe...
  call npm install
  if not exist node_modules\dotenv (
    echo.
    echo Install hoyni! Internet connection check koro, tarpor abar START.bat chalao.
    echo Jodi abar na hoy, screenshot pathao.
    echo.
    pause
    exit /b 1
  )
)
if not exist nexora-fx.db (
  echo Database banano hochhe...
  call npm run seed
)
echo Server start hochhe...
start "Nexora Fx Server" cmd /k "npm start"
echo Server ready howar jonno 10 second wait korchi...
timeout /t 10 /nobreak >nul
start http://localhost:3000
echo.
echo Site browser-e khule geche.
echo Server-er window-ta bondho koro na — bondho korle site bondho hoye jabe.
echo.
pause
