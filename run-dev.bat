@echo off
setlocal EnableDelayedExpansion
title MDM Practicals - Dev Launcher
cd /d "%~dp0"

echo ============================================
echo    MDM Practicals - Dev Launcher
echo ============================================
echo.

REM --- 1. Backend dependencies -------------------------------------------
echo [1/4] Checking backend (Python) dependencies...
python -c "import fastapi, uvicorn, requests" 1>nul 2>nul
if errorlevel 1 (
    echo        Installing Python packages from backend\requirements.txt ...
    python -m pip install -r "backend\requirements.txt"
    if errorlevel 1 (
        echo        ERROR: pip install failed. Is Python installed and on PATH?
        pause
        exit /b 1
    )
) else (
    echo        OK.
)

REM --- 2. Frontend dependencies ------------------------------------------
echo [2/4] Checking frontend (npm) dependencies...
if not exist "frontend\node_modules" (
    echo        Installing npm packages ^(first run only^) ...
    pushd frontend
    call npm install
    popd
    if errorlevel 1 (
        echo        ERROR: npm install failed. Is Node.js installed and on PATH?
        pause
        exit /b 1
    )
) else (
    echo        OK.
)

REM --- 3. Free ports 8000/5173 so a FRESH server with the latest code runs --
REM (A leftover server from a previous run keeps serving OLD code; killing it
REM  first is what makes your new changes actually show up.)
echo [3/4] Stopping any old servers on ports 8000 / 5173...
for %%p in (8000 5173) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr ":%%p "') do (
        taskkill /F /PID %%a >nul 2>nul
    )
)
REM Give the sockets a moment to release before rebinding.
ping -n 2 127.0.0.1 >nul

REM --- 4. Find LAN IP so you can open it on your phone -------------------
set "LANIP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    if not defined LANIP set "LANIP=%%a"
)
set "LANIP=%LANIP: =%"
if not defined LANIP set "LANIP=<your-pc-ip>"

echo [4/4] Starting fresh servers in separate windows...
echo.
echo    Backend  : http://localhost:8000        ^(API docs at /docs^)
echo    Frontend : http://localhost:5173
echo    On phone : http://%LANIP%:5173          ^(same Wi-Fi network^)
echo.

REM Launch each server in its own window (/d sets the working directory).
start "MDM Backend"  /d "%~dp0backend"  cmd /k python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
start "MDM Frontend" /d "%~dp0frontend" cmd /k npm run dev -- --host

REM Wait for the Vite dev server to come up, then open the app in the browser.
echo.
echo Waiting for the frontend to start, then opening your browser...
ping -n 6 127.0.0.1 >nul
start "" http://localhost:5173

echo.
echo Two terminal windows have opened (Backend + Frontend).
echo Close those windows to stop the servers.
echo.
echo TIP: if the browser still shows old UI, hard-refresh with Ctrl+Shift+R.
echo This launcher window can be closed now.
endlocal
