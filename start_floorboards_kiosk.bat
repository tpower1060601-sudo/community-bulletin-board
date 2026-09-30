@echo off
set CHROME="C:\webpage_tools\Supermium_portable\Supermium\chrome.exe"
set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars

rem Left monitor - screen10 (floors 1-14)
start "" %CHROME% %FLAGS% --user-data-dir="C:\SupermiumFloorA" --window-position=0,0 --window-size=1080,1920 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen10/"
timeout /t 5 /nobreak

rem Right monitor - screen11 (floors 15+)
start "" %CHROME% %FLAGS% --user-data-dir="C:\SupermiumFloorB" --window-position=1080,0 --window-size=1080,1920 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen11/"
