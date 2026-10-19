@echo off
timeout /t 15 /nobreak

set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars

rem Top left - screen1 lobby board
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP1" --window-position=-1920,-1080 --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen1/"
timeout /t 10 /nobreak

rem Top middle - screen4 weather
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP2" --window-position=0,-1080     --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen4/"
timeout /t 10 /nobreak

rem Bottom left - screen7 news
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP5" --window-position=-1920,0     --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen7/"
timeout /t 10 /nobreak

rem Bottom middle - screen8 YouTube 1
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP6" --window-position=0,0         --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen8/"
timeout /t 10 /nobreak

rem Right column (spans both rows) - screen13 portrait board
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP13" --window-position=1920,-1080 --window-size=1920,2160 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen13/"
