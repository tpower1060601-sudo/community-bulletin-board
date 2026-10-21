@echo off
rem Lobby PC 172.18.0.208 (ADVANTECH-PC, Win Embedded 7 + Supermium) - screen wall mode
rem One 5760x2160 window covering 6 monitors; renderer/wall tiles the screens with iframes.
rem Run by scheduled task at 08:00 (and at logon). Keep this file pure ASCII.

rem Wait until GitHub Pages is reachable (max ~5 min) so the window never opens on an error page
set /a TRIES=0
:waitnet
ping -n 1 -w 2000 tpower1060601-sudo.github.io >nul 2>nul && goto netok
set /a TRIES+=1
if %TRIES% GEQ 60 goto netok
ping -n 6 127.0.0.1 >nul
goto waitnet
:netok

rem Clear the crash flag left by the nightly force-close
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\webpage\fix_floor_exit.ps1" C:\EdgeWall

set BROWSER="C:\Program Files (x86)\Supermium\chrome.exe"
set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars --hide-crash-restore-bubble

rem --app windows keep a ~30px title bar. Start 30px above the top monitors and 30px taller
rem so the title bar is off-screen and the page area is exactly 5760x2160 (scale 1, no blur).
start "" %BROWSER% %FLAGS% --user-data-dir="C:\EdgeWall" --window-position=-1920,-1110 --window-size=5760,2190 --app="https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/wall/"
