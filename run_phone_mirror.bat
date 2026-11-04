@echo off
title NivaTV Phone Screen Mirror (scrcpy)
color 0A
cls
echo ========================================================
echo    NivaTV - Android Phone Screen Mirror (scrcpy)
echo ========================================================
echo.
echo 1. Connecting via USB cable? Just plug in and press Enter.
echo 2. Connecting wirelessly (Wi-Fi)?
echo.

set /p PHONE_IP="Enter Phone IP:Port (Press ENTER for default 10.40.59.84:43373 or USB): "
if "%PHONE_IP%"=="" (
    set PHONE_IP=10.40.59.84:43373
)

echo.
echo Checking connection...
adb connect %PHONE_IP% 2>nul
adb devices
echo.

echo Launching phone screen window on PC...
echo - Left Click: Tap
echo - Right Click: Back
echo - Middle Click: Home
echo.

scrcpy -s %PHONE_IP% --stay-awake --max-size=1080 --video-bit-rate=8M

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Trying direct USB / default device connection...
    scrcpy --stay-awake --max-size=1080
)

pause
