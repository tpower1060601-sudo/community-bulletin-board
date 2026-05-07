# 社區佈告欄系統 — Claude Code 工作筆記

## 專案性質
Electron + GitHub Pages 雙模式社區大廳佈告欄系統。
目前以 **GitHub Pages 靜態網頁模式**為主，資料存在 `localStorage`。

## GitHub
- Repo：https://github.com/tpower1060601-sudo/community-bulletin-board
- Pages：https://tpower1060601-sudo.github.io/community-bulletin-board/
- Branch：main
- 上傳腳本：`上傳到GitHub.bat`（執行後輸入 commit 訊息即可推送）

## 檔案結構
```
C:\webpage\
├── index.html              # 導覽主頁（9 張畫面卡片 + admin 入口）
├── shared/api.js           # localStorage 版 window.api（核心，所有畫面都載入它）
├── .nojekyll               # GitHub Pages 必要空白檔
├── 上傳到GitHub.bat         # 一鍵上傳腳本
├── main.js / preload.js    # Electron 桌面版（次要）
└── renderer/
    ├── screen1/  公告欄 A（時鐘、快訊、跑馬燈、會議室 iframe）
    ├── screen2/  公告欄 B（投影片公告輪播）
    ├── screen3/  匯率時鐘（Yahoo Finance）
    ├── screen4/  即時天氣（OpenWeather API，全螢幕）
    ├── screen5/  圖片輪播（Ken Burns 效果）
    ├── screen6/  影片播放（本地影片 HUD）
    ├── screen7/  即時新聞看板（4 列 RSS）
    ├── screen8/  YouTube 頻道 1（全螢幕 iframe）
    ├── screen9/  YouTube 頻道 2（全螢幕 iframe）
    └── admin/    管理後台
```

## shared/api.js 使用方式
每個 screen HTML 都在第一個 `<script>` 前載入：
```html
<script src="../../shared/api.js"></script>
```
提供：
- `window.api.get('settings')` → Promise
- `window.api.save('settings', data)` → Promise，自動廣播跨分頁
- `window.api.on('settings:updated', cb)` → 監聽更新
- `window.api.media(type)` → 永遠回傳 `[]`

**重要**：lsGet 讀取 settings 時會自動把 DEFAULTS.windows 裡有但 localStorage 沒有的視窗補上，不需要手動清除快取。

## screen7 即時新聞注意事項
- rss2json proxy **不可加 count= 參數**（付費功能，免費會回傳 error）
- 正確用法：`https://api.rss2json.com/v1/api.json?rss_url=...`
- 台灣財經用 Yahoo Finance：`https://tw.news.yahoo.com/rss/finance`（已驗證）
- 切換間隔 10 秒，動畫 1.2 秒

## admin 登入
- 網頁版（GitHub Pages）：預設密碼 `admin`（可在系統設定修改）
- 密碼存在 `localStorage` 的 `bbs_settings` 欄位

## localStorage 結構
| key | 說明 |
|---|---|
| bbs_announcements | `{ marquee: '', list: [...] }` |
| bbs_settings | `{ communityName, weatherApiKey, weatherCity, youtubeId, youtubeId2, windows: [...], ... }` |
| bbs_meetings | `{ rooms: [...], bookings: [...] }` |
| bbs_news | `[...]` |

## 待辦 / 未來可改善
- screen5（圖片輪播）、screen6（影片播放）在 web 版無法用本地媒體（media() 回傳 []）
- screen3 匯率抓取 Yahoo Finance，CORS 偶爾不穩
- 天氣需要 OpenWeather API Key（免費申請：openweathermap.org）
