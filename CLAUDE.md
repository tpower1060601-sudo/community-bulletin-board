# 社區佈告欄系統 — Claude Code 工作筆記

## 專案性質
社區大廳佈告欄系統，**GitHub Pages 靜態網頁**（Electron 桌面版已於 commit 4dc83f3 移除，`package.json` 只剩殘留）。
資料存在各台電腦瀏覽器的 `localStorage`，管理後台存檔後自動備份至 GitHub `data/backup.json`，所有畫面每 60 秒輪詢同步。
**repo 是 PUBLIC**：`data/backup.json` 任何人都看得到，不要再把新的金鑰放進設定。

社區名稱：**親家市政廣場**

## GitHub
- Repo：https://github.com/tpower1060601-sudo/community-bulletin-board
- Pages：https://tpower1060601-sudo.github.io/community-bulletin-board/
- Branch：main
- 上傳腳本：`上傳到GitHub.bat`（執行後輸入 commit 訊息即可推送）

---

## ⚡ 換電腦 / 新環境設定（必讀）

### 自動還原機制
`shared/api.js` 內建 `window.ghBackup.autoRestore()`：
- 頁面載入時，若 `localStorage` 完全沒有資料（新瀏覽器／新電腦）
- 自動從 GitHub `data/backup.json` 讀取並還原所有設定
- **無需任何手動操作**，重新整理頁面即可

### 換電腦步驟
```
1. git clone https://github.com/tpower1060601-sudo/community-bulletin-board.git
   （或 git pull 更新至最新版）

2. 開啟任一畫面頁面（或 GitHub Pages URL）
   → autoRestore 自動從 GitHub 還原 localStorage

3. 進入管理後台確認設定正確
   → 若需強制覆蓋：管理後台 → 備份與還原 → 強制從 GitHub 還原
```

### ⚠️ GitHub Token 非常重要
**每台電腦的管理後台都必須設定 GitHub Token**，否則：
- 儲存公告 / 設定後，資料只存在該台電腦的 localStorage
- 換電腦或清除瀏覽器快取，資料會消失
- 系統會顯示橘色警告：「未設定 GitHub Token，資料僅存本機」

設定方式：管理後台 → 系統設定 → 貼上 `ghp_xxxx` Token → 儲存
Token 申請：GitHub → Settings → Developer settings → Personal access tokens

### 自動備份行為
每次在管理後台執行以下操作後，系統自動觸發備份至 GitHub：
- 儲存 / 刪除公告
- 更新跑馬燈文字
- 儲存系統設定

若未設定 Token → 顯示警告但不中斷操作（資料仍存本機）
若 Token 有效 → 2 秒內的連續操作合併成一次備份，右上角顯示「✅ 自動備份：HH:MM:SS」
備份失敗 → 跳出紅色提示；修改仍留在本機並標記為「待備份」，不會被雲端舊版蓋掉，下次存檔再試

---

## 檔案結構
```
C:\webpage\
├── index.html              # 導覽主頁（screen1~13、螢幕牆卡片 + admin 入口）
├── shared/
│   ├── api.js              # localStorage 版 window.api＋GitHub 備份/輪詢（核心，所有畫面都載入）
│   ├── kioskGuard.js       # 展示畫面自我恢復：每 30 分鐘「確認伺服器回 200 才重載」，取代 meta refresh
│   ├── floorData.js        # 水牌預設樓層資料與樓層號碼解析
│   ├── screenDefs.js       # 螢幕尺寸與預設排版（admin 螢幕排版與 wall 共用）
│   └── roomBoardStyle.js   # 管理後台公告預覽用的直式版面參數
├── data/backup.json        # 自動備份檔（含所有設定與 API Key，公開！）
├── data/images/            # 後台上傳的公告圖片（上傳前已縮到長邊 1920px）
├── deploy/floorboards/     # 水牌機本機檔：floor_loader.html、fix_floor_exit.ps1
├── start_floorboards_kiosk.bat / close_floorboards.bat   # 水牌機開關機（純 ASCII，由後台產生器產出）
├── start_display.bat / open_edge.bat / fix_edge_exit.vbs # 大廳電腦啟動腳本
├── promo/                  # 親家市政廣場形象影片（HTML 動畫版）
├── .nojekyll               # GitHub Pages 必要空白檔
├── 上傳到GitHub.bat         # 一鍵上傳腳本（⚠️ 用 git add .，會連未追蹤檔一起推上公開 repo）
└── renderer/
    ├── screen1/   大廳公佈欄（全螢幕建築照片輪播＋公告卡片，富文字呈現）
    ├── screen2/   公告欄 B（投影片公告輪播）
    ├── screen3/   全球市場儀表板（TradingView 嵌入元件）
    ├── screen4/   即時天氣（中央氣象署 CWA，OpenWeather 備援）
    ├── screen5/   圖片輪播（Ken Burns 效果）
    ├── screen6/   影片播放（影片網址 HUD）
    ├── screen7/   即時新聞看板（4 列 RSS）
    ├── screen8/   YouTube 頻道 1（全螢幕 iframe）
    ├── screen9/   YouTube 頻道 2（全螢幕 iframe）
    ├── screen10/  樓層告示牌 A（1–14F，1080×1920 直立，ES5）
    ├── screen11/  樓層告示牌 B（15F 以上，1080×1920 直立，ES5）
    ├── screen12/  台股/港股/美股熱力圖（TradingView）
    ├── screen13/  公告欄直立型（1920×2160，跨上下兩面螢幕）
    ├── wall/      螢幕牆（單一視窗以 iframe 拼接，依後台螢幕排版）
    ├── floorboards/ screen10+11 合併版（未使用，見下方水牌章節）
    └── admin/     管理後台
```

---

## API Keys（均存於 localStorage / backup.json）

| 用途 | 設定欄位 | 說明 |
|------|---------|------|
| 天氣（主要）| `cwaKey` | 中央氣象署開放資料授權碼 |
| 天氣（備援）| `weatherApiKey` | OpenWeather API Key |
| 天氣城市 | `weatherCity` | 預設 `Taichung`（OpenWeather 用） |
| YouTube 1 | `youtubeId` | 目前：非凡財經24H |
| YouTube 2 | `youtubeId2` | 目前：LiveⒼ01天氣觀測 |

**注意**：API Keys 不寫在程式碼中，透過管理後台儲存，並隨 backup.json 備份至 **公開** repo。
FMP / Twelve Data 金鑰（`fmpKey1~3`、`tdKey1~3`、`twelveDataKey`）已不使用（screen3/12 改 TradingView），2026-10-19 起後台存設定時會自動刪除。

---

## screen1 大廳公佈欄（2026 年重製）

### 原設計
時鐘 + 快訊跑馬燈 + 會議室 iframe

### 現在設計
全螢幕照片輪播（Ken Burns 動畫）＋ 公告卡片覆蓋。底部跑馬燈列已在 commit d044f97 移除（程式裡的 `setMarquee` / `renderNews` 找不到元素時會直接略過）。

```
┌─────────────── HEADER ────────────────────────────────────────┐
│  🏢 親家市政廣場管理委員會                    時鐘 / 日期        │
├──────────────────── 全螢幕照片 ───────────────────────────────┤
│  背景：12 張親家市政廣場高清照片（chingjia.com）輪播           │
│        + 管理後台上傳的額外圖片                               │
│                                                               │
│  【有公告時】：半透明卡片覆蓋於照片上                          │
│    左：公告附圖（560px）                                       │
│    右：公告標題（64px）+ 內容（34px，富文字）                   │
│                                                               │
│  【無公告時】：建案名稱大字置中                                │
└────────────────────────────────────────────────────────────────┘
```

### 公告呈現注意事項（2026-10-19 修正）
- 後台公告內容是富文字 HTML（execCommand 產生的 `<font>`/`<span>`），screen1 以 HTML 呈現，保留粗體與顏色；
  CSS `.ac-content *{font-size:inherit !important}` 讓字級統一跟版面走，避免 `<font size=7>` 撐爆。
- 每分鐘的排程重新過濾只在「清單內容有變」時才重建，否則輪播每 60 秒被歸零，一輪超過 60 秒的公告後面幾則永遠輪不到。
- 2026-10-19 之前 screen1 因為呼叫已移除的跑馬燈元素而在 init 拋錯，**實際上一直沒有顯示任何公告**。

### 照片來源
- 12 張高清原圖來自 `https://www.chingjia.com/portfolio-content.php?index_id=46`
- 管理後台「圖片網址清單」可追加額外圖片

---

## screen3 全球市場儀表板

### 現在設計
```
┌──────────── 世界時鐘列（指針式，多城市）─────────────────────┐
├─ 亞太指數 ──────┬─ 歐美指數 ──────┬─ 外匯商品 ───────────────┤
│ TradingView     │ TradingView     │ TradingView               │
│ market-overview │ market-overview │ market-overview           │
└─────────────────┴─────────────────┴───────────────────────────┘
```
- 三欄都是 TradingView `embed-widget-market-overview` 嵌入元件，**不需要任何 API Key**。
  - 亞太：台股加權、日經、恆生、上證、印度 SENSEX、韓國（EWY）、新加坡 STI、澳洲 XJO
  - 歐美：S&P 500、那斯達克 100、道瓊、費半 SOXX、DAX、FTSE、CAC 40、Euro Stoxx 50
  - 外匯商品：USD/TWD、USD/CNY、EUR/USD、USD/JPY、黃金、原油、BTC、ETH
- screen12 熱力圖同樣是 TradingView 元件。

### 資料來源選型歷程
Yahoo Finance → CORS 封鎖 → Stooq 反爬蟲 → Twelve Data / FMP 免費方案不含指數 → 改抓龍頭個股（Twelve Data）→ **改用 TradingView 嵌入元件**（可直接顯示指數，免金鑰、免配額）。
Twelve Data / FMP 的程式與金鑰欄位都已移除。

---

## shared/api.js 使用方式
每個 screen HTML 都在第一個 `<script>` 前載入：
```html
<script src="../../shared/api.js"></script>
```
提供：
- `window.api.get('settings')` → Promise
- `window.api.save('settings', data, opts)` → Promise `{ok}`；內容有變就標記為待備份（`bbs_gh_dirty`）。`opts.silent` 只寫本機、不標記不通知
- `window.api.on('settings:updated', cb)` → 監聽更新，`cb(data, {source})`，source 為 `'local'`（本分頁存檔）或 `'remote'`（雲端輪詢／其他分頁）
- `window.api.media(type)` → 永遠回傳 `[]`
- `window.ghBackup.autoRestore()` → 自動從 GitHub 還原（localStorage 空時）
- `window.ghBackup.forceRestore()` → 強制從 GitHub 覆蓋本地
- `window.ghBackup.save()` → 上傳備份至 GitHub（需 token）
- `window.ghBackup.token()` → 取得目前儲存的 Token

**重要**：lsGet 讀取 settings 時會自動把 DEFAULTS.windows 裡有但 localStorage 沒有的視窗補上，不需要手動清除快取。

### 同步機制（2026-10-19 重寫）
- 每個頁面每 60 秒讀 `data/backup.json`（先 raw.githubusercontent，失敗改讀 GitHub Pages）。`_savedAt` 跟 `bbs_gh_knownAt` 不同才處理。
- 只套用**內容有變**且**本機沒有待備份修改**的 key，只對那些 key 發 `:updated`——存一則公告不會讓所有畫面重載。
- 備份成功後把自己的 `_savedAt` 寫進 `bbs_gh_knownAt`，下一輪輪詢不會把剛推上去的版本當新版本套回來。
- 備份上傳序列化；取 sha 用 `cache:'no-store'`，遇到 409/422 自動重新取 sha 重試。
- 不再派送合成 `StorageEvent`（舊版會讓每個監聽器每次更新跑兩遍）。其他分頁與同源 iframe 靠瀏覽器原生 storage 事件。

### 展示畫面自我恢復（shared/kioskGuard.js）
所有 screen、wall、floorboards 都載入 `kioskGuard.js`，取代原本的 `<meta http-equiv="refresh" content="1800">`。
meta refresh 是盲目重載：重載當下若斷網或 GitHub Pages 回 5xx，畫面停在瀏覽器錯誤頁，之後永遠不會再重試。
kioskGuard 每 30 分鐘先 XHR 確認自己的網址回 200 才 `location.reload()`，失敗就保留畫面、每分鐘重試。**新增畫面時請一併載入它，不要再用 meta refresh。**

---

## screen7 即時新聞注意事項
- rss2json proxy **不可加 count= 參數**（付費功能，免費會回傳 error）
- 正確用法：`https://api.rss2json.com/v1/api.json?rss_url=...`
- 台灣財經用 Yahoo Finance：`https://tw.news.yahoo.com/rss/finance`（已驗證）
- 切換間隔 10 秒，動畫 1.2 秒

---

## admin 登入
- 網頁版（GitHub Pages）：預設密碼 `admin`（可在系統設定修改）
- 密碼存在 `localStorage` 的 `bbs_settings.adminPassword`，登入時先讀出設定再比對（2026-10-19 前改過的密碼其實沒生效，一直只認 `admin`）
- ⚠️ 這是瀏覽器端比對，且密碼會隨 backup.json 進公開 repo，只能防路人誤觸，不是真正的安全機制

---

## 會議室系統（2026-09 起已移出本專案）
- 預約與會議室公告改由獨立系統 **https://meetings.shoyubook.com** 管理（專案 `C:\projects\qinjia-room-booking`，FastAPI + PostgreSQL，跑在 office 主機 docker `qinjia-room-booking`）。管理後台側欄「會議室系統 ↗」直接連過去。
- 門口 5 台平板硬體鎖定只能連 **172.18.0.251**（舊物業系統，無外網）。office 每 5 分鐘把今日預約與有效公告 SCP 成 `roomdata.json`（圖片放 `uploads\`）到該機器 `reservation\` 目錄，`room01~05.html` 以 PHP include `room_render.php` 伺服器端渲染。
- 本 repo 原本的 `renderer/room01~05`、`shared/roomBoard.js`、`deploy/legacy-room-redirect` 已於 2026-10-19 刪除；`bbs_meetings`、`bbs_meetingAnnouncements` 只是舊資料殘留。

---

## localStorage 結構
| key | 說明 |
|---|---|
| `bbs_announcements` | 橫式公告 `{ marquee: '', list: [...] }`（screen1、screen2） |
| `bbs_announcements_v` | 直立公告 `{ marquee: '', list: [...] }`（screen13） |
| `bbs_settings` | 所有設定（communityName, cwaKey, weatherApiKey, youtubeId, imageUrls, windows, adminPassword...） |
| `bbs_floors` | 水牌樓層名錄 `[{floor, company, group}]`（screen10/11） |
| `bbs_screenLayout` | 螢幕排版 `[{screenId, physX, physY}]`（後台螢幕排版、wall） |
| `bbs_meetings` / `bbs_meetingAnnouncements` | 舊會議室資料殘留，已不使用 |
| `bbs_news` | `[...]` |
| `bbs_gh_token` | GitHub Personal Access Token（自動備份用，每台電腦各自設定，不會進備份）|
| `bbs_gh_knownAt` | 輪詢已同步到的雲端 `_savedAt` |
| `bbs_gh_dirty` | 尚未成功備份的本機修改 `{key: 時間}`，輪詢不覆蓋這些 key |
| `bbs_gh_lastBackup` | 上次成功備份時間 |

---

## 樓層告示牌實體機（172.18.0.51）— 2026-08-19 部署紀錄

### 機器資訊
- IP：`172.18.0.51`，主機名稱 `MYUSER-PC`，帳號 `Myuser`（無密碼）
- 作業系統：**Windows Embedded Standard 7**（64 位元，非一般 Windows 7）
- SSH：已裝 OpenSSH Server，用**金鑰登入**（`~/.ssh/id_ed25519` 對應的公鑰已加進該機器 `C:\Users\Myuser\.ssh\authorized_keys`），不需密碼
- 寫入過濾器（EWF / FBWF）：**已確認皆為 DISABLED**，代表變更會正常持久保存、不會在重開機後被還原清空

### 瀏覽器：Chrome 卡在 109 版，改用 Supermium
- 這台機器官方 Chrome 已無法再更新（Google 從 110 版起不支援 Windows 7/WES7），且此機器**沒有安裝 .NET Framework 4.x**、PowerShell 仍是 2.0（無 `Invoke-WebRequest`、TLS 只到 1.0，連不上 GitHub 等新版網站），故未在此機器上直接下載安裝，而是**在本機下載後用 SCP 傳過去**再解壓縮
- 已安裝 **Supermium 144（免安裝版）**：`C:\webpage_tools\Supermium_portable\Supermium\chrome.exe`
- 若要升級 PowerShell/`.NET`（讓這台能直接上網下載東西），需要先裝 .NET Framework 4.5.2+ 再裝 WMF 5.1，且需重開機——2026-08-19 已跟使用者確認**暫不進行**

### 開關機排程
- `start_floorboards_kiosk.bat`：開兩個 Supermium **獨立** kiosk 視窗（不是合併版 `renderer/floorboards`），左邊螢幕 `--window-position=0,0`、右邊螢幕 `--window-position=1080,0`，各 `--window-size=1080,1920`，各自指向 `screen10`／`screen11`
  - 用 `--kiosk`（非 `--app`）：因為兩台是各自獨立視窗、只對應單一螢幕，不像螢幕牆要跨螢幕，所以能用真正全螢幕無邊框的 kiosk 模式
  - 各自獨立 `--user-data-dir`：`C:\SupermiumFloorA` / `C:\SupermiumFloorB`
  - 2026-10-19 起不直接開 GitHub Pages，而是開本機 `file:///C:/webpage_tools/floor_loader.html#screen10`（原始檔在 `deploy/floorboards/`）：它每 10 秒檢查 GitHub Pages 是否回 200，通了才轉過去。起因是早上 08:00 網路還沒好時直接開網址，會卡在瀏覽器錯誤頁一整天（10/19 早上右螢幕就是這樣）。
  - 啟動前先跑 `fix_floor_exit.ps1`，把兩個 profile 的 `Preferences` 裡 `"exit_type":"Crashed"` 改回 `Normal`。實測**即使先不帶 /F 的 taskkill 正常關閉，Supermium 仍會記成 Crashed**，所以只能靠啟動前清除。PowerShell 2.0 以 UTF-8 無 BOM 讀寫（Preferences 含非 ASCII，不能用 VBS 以系統字碼頁讀寫）。
- `close_floorboards.bat`：先 `taskkill /IM chrome.exe`（正常關閉），等 10 秒（`ping -n 11 127.0.0.1`），再 `/F` 強制（Supermium 執行檔也叫 chrome.exe）
- 兩檔案已納入 git（專案根目錄），連同 `deploy/floorboards/` 兩個檔部署在該機器 `C:\webpage_tools\`（部署後用 `certutil -hashfile ... MD5` 比對，SCP 下載驗證在 Win7 不可靠）；管理後台「水牌管理」分頁下方有「水牌機執行檔」區塊可調整參數後重新下載（產生器 `generateFloorBat()`，內容須維持純 ASCII）
- Windows工作排程器（Task Scheduler）：
  - `FloorboardsOpen`：每天 08:00 執行 `start_floorboards_kiosk.bat`
  - `FloorboardsClose`：每天 21:00 執行 `close_floorboards.bat`
  - 兩者都設定登入模式為**「僅限互動」**（`/it`），因為 GUI 程式必須在使用者已登入的桌面工作階段才能顯示畫面，透過 SSH 或非互動工作階段啟動 kiosk 瀏覽器視窗會卡住沒有畫面（Session 0 隔離問題）
  - 前提：`Myuser` 需持續保持登入狀態（`console` session `使用中`），且電腦不關機

### .bat 檔中文編碼注意事項
Windows 7／WES7 用舊字碼頁（Big5）解讀 `.bat`，若檔案內含全形符號（中文括號、破折號）當註解，會把命令列切壞、產生亂碼指令。**跨機器部署的 `.bat` 檔一律只用純 ASCII 英文（含註解）**，不要用中文 `::` 或 `rem` 註解。

### 該機器上停用的軟體（2026-08-19）
- **TightVNC**：系統匣圖示（`tvncontrol` Run 機碼）已移除、背景服務 `tvnserver` 已停用（`sc config tvnserver start= disabled`），VNC 遠端連線功能已完全關閉。原登錄檔設定備份於 `C:\webpage_tools\Run_backup_before_change.reg`
- **AisWatcher.exe**：從共用啟動資料夾移出，備份於 `C:\webpage_tools\disabled_startup_items\`
- **AnyDesk**：使用者確認在用，保留不動

### `renderer/floorboards/index.html` 目前未使用
專案裡有一個用 iframe 把 screen10+screen11 合併成單一網頁的版本（跨螢幕視窗），但實際部署時改用「兩個獨立 kiosk 視窗」方案（可用 `--kiosk` 做到真正全螢幕，合併版因跨螢幕限制只能用 `--app`、會保留一條標題列）。這個檔案先保留在 repo 裡，未刪除。

---

## 已知限制
- screen5（圖片輪播）、screen6（影片播放）在 web 版無法用本地媒體（media() 回傳 []），只能用網址
- 橫式畫面設計為 1920×1080；screen10/11 為 1080×1920 直立；screen13 為 1920×2160（跨上下兩面）
- screen1 照片來自 chingjia.com，若對方伺服器擋 hotlink 需改用本地上傳
- 同一份資料在多台電腦同時編輯時是「最後備份者勝」（整份 backup.json 覆蓋），沒有逐筆合併
- 改 HTML/JS 請用 Edit 工具：`core.autocrlf=true`，工作區是 CRLF，用 LF 字串的腳本替換會比對失敗
