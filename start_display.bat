@echo off
timeout /t 15 /nobreak

set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars

:: 上排左 — screen1 大廳公佈欄
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP1" --window-position=-1920,-1080 --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen1/"
timeout /t 10 /nobreak

:: 上排中 — screen4 即時天氣
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP2" --window-position=0,-1080     --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen4/"
timeout /t 10 /nobreak

:: 下排左 — screen7 即時新聞
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP5" --window-position=-1920,0     --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen7/"
timeout /t 10 /nobreak

:: 下排中 — screen8 YouTube 1
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP6" --window-position=0,0         --window-size=1920,1080 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen8/"
timeout /t 10 /nobreak

:: 右欄（跨上下）— screen13 公告欄（直立）
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP13" --window-position=1920,-1080 --window-size=1920,2160 --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen13/"
