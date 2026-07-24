@echo off
setlocal
title WMC Virtual Lab - Build Backend EXE
cd /d "%~dp0backend"

echo ==================================================
echo   Building WMC-Lab-Backend.exe  (one-file Windows)
echo ==================================================
echo.

REM --- 1. Ensure backend dependencies are present -----------------------
echo [1/3] Checking backend dependencies...
python -c "import fastapi, uvicorn, requests, pydantic, bleak, numpy" 1>nul 2>nul
if errorlevel 1 (
    echo        Installing from requirements.txt ...
    python -m pip install -r requirements.txt || goto :fail
)
echo        OK.

REM --- 2. Ensure PyInstaller is installed --------------------------------
echo [2/3] Checking PyInstaller...
python -c "import PyInstaller" 1>nul 2>nul
if errorlevel 1 (
    echo        Installing PyInstaller ...
    python -m pip install pyinstaller || goto :fail
)
echo        OK.

REM --- 3. Build from the spec (clean each time) --------------------------
echo [3/3] Building (this takes a few minutes)...
python -m PyInstaller --clean --noconfirm "WMC-Lab-Backend.spec" || goto :fail

echo.
echo ==================================================
echo   DONE.
echo   Your exe:  backend\dist\WMC-Lab-Backend.exe
echo ==================================================
echo.
echo   Test it now:  double-click that exe, then open the web app.
echo   The console window it opens must stay open while using the app.
echo.
pause
exit /b 0

:fail
echo.
echo   BUILD FAILED. See the error above.
pause
exit /b 1
