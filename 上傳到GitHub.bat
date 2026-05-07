@echo off
chcp 65001 >nul
cd /d C:\webpage

echo.
echo ========================================
echo   上傳到 GitHub
echo ========================================
echo.

git add .

set /p msg=請輸入更新說明（直接按 Enter 使用預設）: 
if "%msg%"=="" set msg=更新網頁內容

git commit -m "%msg%"

echo.
echo 正在上傳...
git push origin main

echo.
if %errorlevel%==0 (
    echo ✅ 上傳成功！
    echo.
    echo 網站網址：
    echo https://tpower1060601-sudo.github.io/community-bulletin-board/
) else (
    echo ❌ 上傳失敗，請確認網路連線或 Token 是否過期
)

echo.
pause