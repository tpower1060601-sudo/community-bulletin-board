@echo off
rem Lobby PC 172.18.0.208 - nightly close (scheduled 21:00). Pure ASCII.
rem Ask the browser to close normally first, then force after 10 seconds
taskkill /IM chrome.exe >nul 2>nul
ping -n 11 127.0.0.1 >nul
taskkill /F /IM chrome.exe /T >nul 2>nul
taskkill /F /IM msedge.exe /T >nul 2>nul
