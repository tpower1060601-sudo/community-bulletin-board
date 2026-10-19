@echo off
rem Ask Supermium to close normally first so it does not record a crash
taskkill /IM chrome.exe >nul 2>nul
ping -n 11 127.0.0.1 >nul
taskkill /F /IM chrome.exe /T >nul 2>nul
echo Done.
