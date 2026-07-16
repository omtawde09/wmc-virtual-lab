@echo off
setlocal EnableDelayedExpansion
title MDM Practicals - Dev Launcher
cd /d "%~dp0"

echo ============================================
echo    MDM Practicals - Dev Launcher
echo ============================================
echo.

REM --- 1. Backend dependencies -------------------------------------------
echo [1/3] Checking backend (Python) dependencies...
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
echo [2/3] Checking frontend (npm) dependencies...
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

REM --- 3. Find LAN IP so you can open it on your phone -------------------
set "LANIP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    if not defined LANIP set "LANIP=%%a"
)
set "LANIP=%LANIP: =%"
if not defined LANIP set "LANIP=<your-pc-ip>"

echo [3/3] Starting servers in separate windows...
echo.
echo    Backend  : http://localhost:8000        ^(API docs at /docs^)
echo    Frontend : http://localhost:5173
echo    On phone : http://%LANIP%:5173          ^(same Wi-Fi network^)
echo.

REM Launch each server in its own window (/d sets the working directory).
start "MDM Backend"  /d "%~dp0backend"  cmd /k python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
start "MDM Frontend" /d "%~dp0frontend" cmd /k npm run dev -- --host

echo Two terminal windows have opened (Backend + Frontend).
echo Close those windows to stop the servers.
echo.
echo This launcher window can be closed now.
endlocal
