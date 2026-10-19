@echo off
wscript "C:\webpage\fix_edge_exit.vbs"
set EDGE="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars
start "" %EDGE% %FLAGS% --user-data-dir="C:\EdgeP13" --kiosk "https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/screen13/"
