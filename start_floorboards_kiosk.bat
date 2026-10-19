@echo off
rem Clear the crash flag so Supermium does not start in crash-recovery mode
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\webpage_tools\fix_floor_exit.ps1"
set CHROME="C:\webpage_tools\Supermium_portable\Supermium\chrome.exe"
set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars --hide-crash-restore-bubble
rem Local loader waits until GitHub Pages is reachable, then opens the real page
set LOADER=file:///C:/webpage_tools/floor_loader.html

rem Left monitor - screen10 (floors 1-14)
start "" %CHROME% %FLAGS% --user-data-dir="C:\SupermiumFloorA" --window-position=0,0 --window-size=1080,1920 --kiosk "%LOADER%#screen10"
timeout /t 5 /nobreak

rem Right monitor - screen11 (floors 15+)
start "" %CHROME% %FLAGS% --user-data-dir="C:\SupermiumFloorB" --window-position=1080,0 --window-size=1080,1920 --kiosk "%LOADER%#screen11"
