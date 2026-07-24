@echo off
setlocal
title WMC Virtual Lab - Sign Backend EXE
cd /d "%~dp0"

REM ===================================================================
REM  Signs WMC-Lab-Backend.exe with a code-signing certificate.
REM
REM  WHY THIS EXISTS
REM  Windows SmartScreen shows "Publisher: Unknown publisher" for any
REM  unsigned exe. That line comes ONLY from an Authenticode signature -
REM  it is NOT read from the CompanyName metadata in the file. The only
REM  way to display "Om Tawde" there is to sign with a certificate
REM  issued by a CA that Windows trusts.
REM
REM  A SELF-SIGNED CERT WILL NOT WORK for distribution: its chain isn't
REM  trusted, so Windows still says "Unknown publisher" on other PCs.
REM
REM  WHERE TO GET A CERTIFICATE
REM    - SignPath.io  -> free for open-source projects (MIT licensed: eligible)
REM    - Certum       -> "Open Source Code Signing", approx $25-70/year
REM    - Sectigo/SSL.com -> standard OV/EV certificates
REM
REM  USAGE
REM    sign-backend-exe.bat "C:\path\to\cert.pfx" "pfx-password"
REM  or, if your cert lives on a hardware token / in the cert store:
REM    sign-backend-exe.bat store "Om Tawde"
REM ===================================================================

set "EXE=backend\dist\WMC-Lab-Backend.exe"
set "TS=http://timestamp.digicert.com"

if not exist "%EXE%" (
    echo ERROR: %EXE% not found. Run build-backend-exe.bat first.
    pause & exit /b 1
)

REM --- locate signtool (ships with the Windows SDK) ---------------------
set "SIGNTOOL="
for /f "delims=" %%i in ('dir /b /s "C:\Program Files (x86)\Windows Kits\10\bin\signtool.exe" 2^>nul') do set "SIGNTOOL=%%i"
if not defined SIGNTOOL (
    echo ERROR: signtool.exe not found.
    echo        Install the "Windows SDK Signing Tools for Desktop Apps"
    echo        component from the Windows SDK, then re-run this script.
    pause & exit /b 1
)
echo Using: %SIGNTOOL%
echo.

if "%~1"=="" (
    echo Usage:
    echo    sign-backend-exe.bat "C:\path\to\cert.pfx" "password"
    echo    sign-backend-exe.bat store "Certificate Subject Name"
    pause & exit /b 1
)

REM --- sign ------------------------------------------------------------
REM /fd sha256  : file digest algorithm (SHA-1 is rejected by Windows)
REM /tr + /td   : RFC-3161 timestamp, so the signature stays valid AFTER
REM               the certificate expires. Never skip this.
if /i "%~1"=="store" (
    echo Signing from certificate store, subject: %~2
    "%SIGNTOOL%" sign /n "%~2" /fd sha256 /tr "%TS%" /td sha256 /v "%EXE%" || goto :fail
) else (
    echo Signing with PFX: %~1
    "%SIGNTOOL%" sign /f "%~1" /p "%~2" /fd sha256 /tr "%TS%" /td sha256 /v "%EXE%" || goto :fail
)

echo.
echo --- Verifying signature ---
"%SIGNTOOL%" verify /pa /v "%EXE%"

echo.
echo ==================================================
echo  Signed. Check it worked:
echo    Right-click the exe - Properties - Digital Signatures
echo  SmartScreen should now show your name instead of
echo  "Unknown publisher".
echo ==================================================
pause
exit /b 0

:fail
echo.
echo SIGNING FAILED - see the error above.
echo Common causes: wrong PFX password, expired cert,
echo or the token/PIN was not provided.
pause
exit /b 1
