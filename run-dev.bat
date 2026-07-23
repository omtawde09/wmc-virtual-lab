@echo off
setlocal EnableDelayedExpansion
title Wireless ^& Mobile Communication - Dev Launcher
cd /d "%~dp0"

echo ==================================================
echo    Wireless ^& Mobile Communication - Virtual Lab
echo    Dev Launcher  ^(Experiments 4, 5, 6, 7, 8, 9^)
echo ==================================================
echo.

REM --- 1. Backend dependencies -------------------------------------------
REM Check EVERY package the backend imports at startup. bleak (Bluetooth) and
REM numpy (path-loss / obstacle regression) were added for Practicals 6 and 7 -
REM if they're missing, main.py fails to import and the whole API dies, so they
REM must be part of this check, not just fastapi/uvicorn.
echo [1/4] Checking backend (Python) dependencies...
python -c "import fastapi, uvicorn, requests, pydantic, bleak, numpy" 1>nul 2>nul
if errorlevel 1 (
    echo        Missing packages - installing from backend\requirements.txt ...
    python -m pip install -r "backend\requirements.txt"
    if errorlevel 1 (
        echo        ERROR: pip install failed. Is Python installed and on PATH?
        pause
        exit /b 1
    )
    REM Verify the install actually satisfied the imports.
    python -c "import fastapi, uvicorn, requests, pydantic, bleak, numpy" 1>nul 2>nul
    if errorlevel 1 (
        echo        ERROR: dependencies still missing after install.
        echo               Try manually:  python -m pip install -r backend\requirements.txt
        pause
        exit /b 1
    )
    echo        Installed.
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
    echo        Installed.
) else (
    echo        OK.
)

REM --- 3. Free ports 8000/5173 so a FRESH server with the latest code runs --
REM IMPORTANT: /T kills the whole process TREE. `uvicorn --reload` runs a parent
REM reloader plus a child worker; killing only the parent leaves the child alive
REM still holding port 8000 and serving the OLD code - which looks exactly like
REM "my changes aren't showing up". /T prevents that orphan.
echo [3/4] Stopping any old servers on ports 8000 / 5173...
for %%p in (8000 5173) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr ":%%p "') do (
        taskkill /F /T /PID %%a >nul 2>nul
    )
)
REM Give the sockets a moment to release before rebinding.
ping -n 3 127.0.0.1 >nul

REM Safety net: if anything is STILL bound to 8000, report it rather than
REM silently starting a second server that loses the port race.
set "PORTBUSY="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr ":8000 "') do set "PORTBUSY=%%a"
if defined PORTBUSY (
    echo        WARNING: port 8000 is still held by PID !PORTBUSY!.
    echo                 Close that process manually, or the backend may serve stale code.
)

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
echo    Experiments:
echo      P4 Wi-Fi RSSI vs Distance      P7 Path Loss vs Obstacles
echo      P5 Throughput ^& Latency        P8 Multipath Fading
echo      P6 Bluetooth Discovery         P9 Noise ^& Interference
echo.
echo    NOTE: Practicals 6 and 7 need Bluetooth turned ON in Windows Settings.
echo          Practicals 4, 8 and 9 need an active Wi-Fi connection.
echo.

REM Launch each server in its own window (/d sets the working directory).
start "WMC Backend"  /d "%~dp0backend"  cmd /k python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
start "WMC Frontend" /d "%~dp0frontend" cmd /k npm run dev -- --host

REM Wait for the Vite dev server to come up, then open the app in the browser.
echo Waiting for the frontend to start, then opening your browser...
ping -n 7 127.0.0.1 >nul
start "" http://localhost:5173

echo.
echo Two terminal windows have opened (WMC Backend + WMC Frontend).
echo Close those windows to stop the servers.
echo.
echo TIP: if the browser still shows old UI, hard-refresh with Ctrl+Shift+R.
echo This launcher window can be closed now.
endlocal
