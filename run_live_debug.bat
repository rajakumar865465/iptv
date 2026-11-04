@echo off
title NivaTV Live Debug Mode (Hot Reload)
color 0B
cls
echo ========================================================
echo    NivaTV - Flutter Live Debug Mode (Hot Reload)
echo ========================================================
echo.
echo NOTE for Xiaomi/POCO/Redmi phones:
echo Make sure "Install via USB" is turned ON in Developer Options!
echo.

set /p PHONE_IP="Enter Phone IP:Port (Press ENTER for default 10.40.59.84:43373): "
if "%PHONE_IP%"=="" (
    set PHONE_IP=10.40.59.84:43373
)

echo Connecting ADB to %PHONE_IP%...
adb connect %PHONE_IP%
adb devices
echo.

echo Launching Flutter in Live Debug Mode on your phone...
echo Controls:
echo   [r] = Hot Reload (instant UI & code changes)
echo   [R] = Hot Restart (reload entire app)
echo   [q] = Quit session
echo.

cd /d "%~dp0mobile"
flutter run -d %PHONE_IP% --dart-define=BACKEND_URL=https://nivatv.luxomall.in

pause
