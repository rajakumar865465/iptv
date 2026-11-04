@echo off
setlocal enabledelayedexpansion
title NivaTV Mobile App - Chrome Manager

:: Resolve Project Paths (supports running from root or mobile directory)
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%mobile\pubspec.yaml" (
    set "MOBILE_DIR=%SCRIPT_DIR%mobile"
) else if exist "%SCRIPT_DIR%pubspec.yaml" (
    set "MOBILE_DIR=%SCRIPT_DIR%"
) else (
    echo [ERROR] Could not find mobile directory with pubspec.yaml.
    echo Please ensure this script is located in the project root or mobile folder.
    pause
    exit /b 1
)

:: Production Backend URL (per project deployment rules)
set "BACKEND_URL=https://nivatv.luxomall.in"
set "WINDOW_TITLE=NivaTV Flutter Chrome Runner"

:MENU
cls
echo ======================================================================
echo                     NIVATV MOBILE APP - CHROME RUNNER
echo ======================================================================
echo.
echo   Mobile Directory  : %MOBILE_DIR%
echo   Backend URL       : %BACKEND_URL%
echo.
echo ======================================================================
echo   [1] Run App in Chrome Browser (Dedicated Runner Window)
echo   [2] Reload Running App        (Hot Reload  - 'r')
echo   [3] Hot Restart Running App   (Full Reload - 'R')
echo   [4] Stop / Close Running App  (Quit        - 'q')
echo   [5] Run in Current Terminal   (Foreground Interactive Mode)
echo   [0] Exit
echo ======================================================================
echo.
set "CHOICE="
set /p "CHOICE=Enter your choice [0-5]: "

:: Strip any accidental spaces
if defined CHOICE set "CHOICE=%CHOICE: =%"

if "%CHOICE%"=="1" goto RUN_SEPARATE
if "%CHOICE%"=="2" goto RELOAD_APP
if "%CHOICE%"=="3" goto RESTART_APP
if "%CHOICE%"=="4" goto STOP_APP
if "%CHOICE%"=="5" goto RUN_DIRECT
if "%CHOICE%"=="0" goto EXIT_SCRIPT

echo.
echo [!] Invalid option '%CHOICE%'. Please choose a number between 0 and 5.
ping -n 2 127.0.0.1 >nul
goto MENU

:RUN_SEPARATE
echo.
echo ======================================================================
echo  Launching NivaTV Mobile in Google Chrome...
echo ======================================================================
echo.
echo  Backend URL : %BACKEND_URL%
echo  Flags       : --disable-web-security (for smooth IPTV stream playback)
echo.

:: Check if already running
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-Process | Where-Object { $_.MainWindowTitle -like '*%WINDOW_TITLE%*' } | Select-Object -First 1; if ($p) { exit 0 } else { exit 1 }"
if %ERRORLEVEL% EQU 0 (
    echo [!] NivaTV Flutter Chrome Runner is ALREADY running!
    echo [!] You can switch to its window, or use Option [2] to Reload, or [4] to Stop.
    echo.
    pause
    goto MENU
)

echo Starting Flutter in a new dedicated window...
start "%WINDOW_TITLE%" cmd /k "cd /d "%MOBILE_DIR%" && title %WINDOW_TITLE% && echo ====================================================================== && echo   NIVATV FLUTTER CHROME RUNNER && echo   - Press 'r' to Hot Reload && echo   - Press 'R' to Hot Restart && echo   - Press 'q' to Quit && echo ====================================================================== && flutter run -d chrome --web-hostname=127.0.0.1 --web-port=8080 --web-browser-flag=\"--disable-web-security\" --dart-define=BACKEND_URL=%BACKEND_URL%"

echo.
echo [+] Flutter Chrome Runner window launched!
echo [+] Chrome will open automatically once compilation finishes.
echo [+] Keep this menu open to trigger [2] Reload or [3] Restart anytime.
echo.
pause
goto MENU

:RELOAD_APP
echo.
echo [*] Triggering Hot Reload ('r')...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue; Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue; $p = Get-Process | Where-Object { $_.MainWindowTitle -like '*%WINDOW_TITLE%*' } | Select-Object -First 1; if ($p) { [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id); Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('r'); Write-Host '[+] Hot Reload (r) sent successfully to Flutter Runner!' -ForegroundColor Green; exit 0 } else { Write-Host '[!] Could not find active Flutter Chrome Runner window.' -ForegroundColor Yellow; Write-Host '    Please select [1] from the menu to start the app first.' -ForegroundColor Yellow; exit 1 }"
echo.
pause
goto MENU

:RESTART_APP
echo.
echo [*] Triggering Hot Restart ('R')...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue; Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue; $p = Get-Process | Where-Object { $_.MainWindowTitle -like '*%WINDOW_TITLE%*' } | Select-Object -First 1; if ($p) { [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id); Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('+r'); Write-Host '[+] Hot Restart (R) sent successfully to Flutter Runner!' -ForegroundColor Green; exit 0 } else { Write-Host '[!] Could not find active Flutter Chrome Runner window.' -ForegroundColor Yellow; Write-Host '    Please select [1] from the menu to start the app first.' -ForegroundColor Yellow; exit 1 }"
echo.
pause
goto MENU

:STOP_APP
echo.
echo [*] Stopping NivaTV Flutter Chrome Runner...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue; Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue; $p = Get-Process | Where-Object { $_.MainWindowTitle -like '*%WINDOW_TITLE%*' } | Select-Object -First 1; if ($p) { [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id); Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('q'); Write-Host '[+] Quit signal (q) sent to Flutter Runner.' -ForegroundColor Green; exit 0 } else { Write-Host '[!] Runner window not found.' -ForegroundColor Yellow; exit 1 }"
echo.
ping -n 2 127.0.0.1 >nul
goto MENU

:RUN_DIRECT
cls
echo ======================================================================
echo  Running NivaTV Mobile directly in this terminal...
echo  (Press 'r' for Hot Reload, 'R' for Hot Restart, 'q' to Quit)
echo ======================================================================
echo.
cd /d "%MOBILE_DIR%"
flutter run -d chrome --web-hostname=127.0.0.1 --web-port=8080 --web-browser-flag="--disable-web-security" --dart-define=BACKEND_URL=%BACKEND_URL%
echo.
echo Flutter session ended.
pause
goto MENU

:EXIT_SCRIPT
echo Exiting...
exit /b 0
