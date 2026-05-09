# 社區佈告欄系統 — Claude Code 工作筆記

## 專案性質
Electron + GitHub Pages 雙模式社區大廳佈告欄系統。
目前以 **GitHub Pages 靜態網頁模式**為主，資料存在 `localStorage`，並自動備份至 GitHub `data/backup.json`。

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

設定方式：管理後台 → 備份與還原 → 貼上 `ghp_xxxx` Token → 儲存
Token 申請：GitHub → Settings → Developer settings → Personal access tokens

### 自動備份行為
每次在管理後台執行以下操作後，系統自動觸發備份至 GitHub：
- 儲存 / 刪除公告
- 更新跑馬燈文字
- 儲存系統設定

若未設定 Token → 顯示警告但不中斷操作（資料仍存本機）
若 Token 有效 → 靜默備份，右上角顯示「✅ 自動備份：HH:MM:SS」

---

## 檔案結構
```
C:\webpage\
├── index.html              # 導覽主頁（11 張畫面卡片 + admin 入口）
├── shared/api.js           # localStorage 版 window.api（核心，所有畫面都載入它）
├── data/backup.json        # 自動備份檔（含所有設定與 API Key）
├── promo/index.html        # 親家市政廣場形象影片（HTML 動畫版，可錄製成 MP4）
├── .nojekyll               # GitHub Pages 必要空白檔
├── 上傳到GitHub.bat         # 一鍵上傳腳本
├── main.js / preload.js    # Electron 桌面版（次要）
└── renderer/
    ├── screen1/   大廳公佈欄（全螢幕建築照片輪播、公告大字覆蓋、跑馬燈）
    ├── screen2/   公告欄 B（投影片公告輪播）
    ├── screen3/   全球市場儀表板（龍頭股、外匯、虛擬貨幣、世界時鐘）
    ├── screen4/   即時天氣（OpenWeather API，全螢幕）
    ├── screen5/   圖片輪播（Ken Burns 效果）
    ├── screen6/   影片播放（本地影片 HUD）
    ├── screen7/   即時新聞看板（4 列 RSS）
    ├── screen8/   YouTube 頻道 1（全螢幕 iframe）
    ├── screen9/   YouTube 頻道 2（全螢幕 iframe）
    ├── screen10/  樓層告示牌 A
    ├── screen11/  樓層告示牌 B
    └── admin/     管理後台
```

---

## API Keys（均存於 localStorage / backup.json）

| 用途 | 設定欄位 | 說明 |
|------|---------|------|
| 天氣 | `weatherApiKey` | OpenWeather API Key |
| 天氣城市 | `weatherCity` | 預設 `Taichung` |
| 股市（FMP）| `fmpKey1` / `fmpKey2` / `fmpKey3` | Financial Modeling Prep × 3 組（備用） |
| 股市（TD） | `tdKey1` / `tdKey2` / `tdKey3` | Twelve Data × 3 組，輪流使用 |
| YouTube 1 | `youtubeId` | 目前：非凡財經24H |
| YouTube 2 | `youtubeId2` | 目前：LiveⒼ01天氣觀測 |

**注意**：API Keys 不寫在程式碼中，全部透過管理後台儲存，並隨 backup.json 備份至 GitHub。

---

## screen1 大廳公佈欄（2026 年重製）

### 原設計
時鐘 + 快訊跑馬燈 + 會議室 iframe

### 現在設計
全螢幕照片輪播（Ken Burns 動畫）＋ 公告文字大字覆蓋

```
┌─────────────── HEADER (120px) ────────────────────────────────┐
│  🏢 親家市政廣場  亞太新核心・七期智慧商辦    80px時鐘 / 日期   │
├──────────────────── 全螢幕照片 ───────────────────────────────┤
│  背景：12 張親家市政廣場高清照片（chingjia.com）輪播           │
│        + 管理後台上傳的額外圖片                               │
│                                                               │
│  【有公告時】：半透明卡片覆蓋於照片上                          │
│    左：公告附圖（560px）                                       │
│    右：公告標題（64px）+ 內容（34px）                          │
│                                                               │
│  【無公告時】：建案名稱 100px 置中大字                         │
├──────────────── BOTTOM BAR (130px) ───────────────────────────┤
│  跑馬燈文字（30px，金色）                                      │
└────────────────────────────────────────────────────────────────┘
```

### 照片來源
- 12 張高清原圖來自 `https://www.chingjia.com/portfolio-content.php?index_id=46`
- 管理後台「圖片網址清單」可追加額外圖片

---

## screen3 全球市場儀表板（2026 年重製）

### 現在設計（4 層佈局）
```
┌──────────── 世界時鐘 Bar（7城市）─────────────────────────┐
├──────────── 市場時段 Timeline（24h UTC 可視化）────────────┤
├─ 外匯匯率 ─┬────── 📈 全球龍頭股 ──────┬─ 貨幣/商品 ──────┤
│ 8組匯率    │ 亞洲欄 ｜ 歐美欄           │ 6幣 + 黃金 + 油 │
└────────────┴────────────────────────────┴─────────────────┘
```

### 資料來源
| 資料 | API | Key | 刷新 |
|------|-----|-----|------|
| 外匯 | ExchangeRate-API v4 | 不需要 | 10 min |
| 龍頭股 + 商品 | Twelve Data（3 組輪流） | tdKey1/2/3 | 8 min |
| 虛擬貨幣 | CoinGecko | 不需要 | 3 min |
| 世界時鐘 | `Intl.DateTimeFormat` | — | 1 sec |

### 股市清單（15 支）
**亞洲欄**：台積電(2330.TW)、台積電ADR(TSM)、聯發科(2454.TW)、台達電(2308.TW)、豐田(TM)、騰訊(0700.HK)、阿里巴巴(BABA)、三星(005930.KS)

**歐美欄**：ASML、輝達(NVDA)、蘋果(AAPL)、微軟(MSFT)、亞馬遜(AMZN)、Google(GOOGL)、Intel(INTC)

### TD 批次分配（3 keys 平均分配，各 ≤ 6 symbols/次）
17 symbols ÷ 3 keys = 6 / 6 / 5，每批同時送出（Promise.all），不超過 8 credits/min 限制。

### 顏色慣例
- 上漲：🔴 紅色 `▲`（東亞慣例）
- 下跌：🟢 綠色 `▼`

### 資料來源選型歷程
Yahoo Finance → CORS 封鎖 → Stooq 反爬蟲 → Twelve Data 403（免費不含指數）→ FMP 403（同樣不含國際指數）→ **改抓龍頭個股，使用 Twelve Data 免費帳號**

---

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
- `window.ghBackup.autoRestore()` → 自動從 GitHub 還原（localStorage 空時）
- `window.ghBackup.forceRestore()` → 強制從 GitHub 覆蓋本地
- `window.ghBackup.save()` → 上傳備份至 GitHub（需 token）
- `window.ghBackup.token()` → 取得目前儲存的 Token

**重要**：lsGet 讀取 settings 時會自動把 DEFAULTS.windows 裡有但 localStorage 沒有的視窗補上，不需要手動清除快取。

---

## screen7 即時新聞注意事項
- rss2json proxy **不可加 count= 參數**（付費功能，免費會回傳 error）
- 正確用法：`https://api.rss2json.com/v1/api.json?rss_url=...`
- 台灣財經用 Yahoo Finance：`https://tw.news.yahoo.com/rss/finance`（已驗證）
- 切換間隔 10 秒，動畫 1.2 秒

---

## admin 登入
- 網頁版（GitHub Pages）：預設密碼 `admin`（可在系統設定修改）
- 密碼存在 `localStorage` 的 `bbs_settings` 欄位

---

## localStorage 結構
| key | 說明 |
|---|---|
| `bbs_announcements` | `{ marquee: '', list: [...] }` |
| `bbs_settings` | 所有設定（communityName, weatherApiKey, fmpKey1~3, tdKey1~3, youtubeId, windows...） |
| `bbs_meetings` | `{ rooms: [...], bookings: [...] }` |
| `bbs_news` | `[...]` |
| `bbs_gh_token` | GitHub Personal Access Token（自動備份用，每台電腦各自設定）|

---

## 已知限制
- screen5（圖片輪播）、screen6（影片播放）在 web 版無法用本地媒體（media() 回傳 []）
- Twelve Data 免費方案不含股市指數（^GSPC 等），故改用龍頭個股替代
- FMP 免費方案同樣不含國際指數
- 所有畫面設計為 1920×1080，已確認不溢出
- screen1 照片來自 chingjia.com，若對方伺服器擋 hotlink 需改用本地上傳
