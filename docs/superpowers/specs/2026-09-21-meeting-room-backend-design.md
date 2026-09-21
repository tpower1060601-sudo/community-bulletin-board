# 會議室預約系統後端重建設計

日期：2026-09-21

## 背景

會議室門口的 5 台平板螢幕，硬體被鎖死只能連到內網的 172.18.0.251（社區門禁對講保全主機，2014 年「超媒體管家」物業系統）。原訂計畫是把該機器上的 `room01.html`~`room05.html` 換成轉址頁，導去本專案在 GitHub Pages 上的即時顯示畫面——已實際部署並驗證轉址本身正確運作，但到現場才發現**平板本身連不到外部網際網路**，導轉去外部網址完全打不開。

進一步調查：
- 172.18.0.251 本身雖有對外連線（ping 通、DNS 可解析），但 .NET Framework 4.5.2 不支援 TLS 1.2，連不上 GitHub（HTTPS 連線直接被拒絕），也沒有 `curl` 之類的現代工具，無法自己抓取外部資料
- 社區內網裡沒有其他機器同時符合「有外網連線」+「碰得到 172.18.0.251」兩個條件
- 使用者自己的 **office 機器**（100.95.24.81，Ubuntu，已經在跑同一個社區的 `qinjia-finance-app` 財務系統）確認可以直接連到 172.18.0.251（ping 1-4ms、SSH port 22 開放），且本身全時運作、有正常外網連線

在確認需要建立「office → 172.18.0.251」的定時資料同步機制後，使用者決定不做小範圍的權宜同步腳本，而是藉這個機會把整個會議室預約＋公告管理後台，從現在的「GitHub Pages 靜態網頁 + localStorage + GitHub 備份」架構，改建成跟 `qinjia-finance-app` 一樣的真正後端服務（FastAPI + PostgreSQL），一次到位解決資料同步跟後台老舊架構兩個問題。

## 目標

- 物業人員在新的獨立管理頁面（`https://meetings.shoyubook.com`）管理會議室房間、預約、公告，資料存在真正的資料庫（PostgreSQL），可對外連線使用
- 後端每 5 分鐘自動把「今日有效預約」＋「目前有效的會議室公告」推送進 172.18.0.251，5 台門口平板螢幕能在純內網環境下正常顯示即時狀態＋公告輪播，不再依賴平板或 172.18.0.251 連外網
- 預約軟刪除後永久保留在資料庫（不再像之前設計的「7天後真刪除」），供日後查詢歷史紀錄
- 業戶別下拉選單即時讀取 GitHub Pages 既有的水牌名錄資料，不用另外維護一份
- 現有 GitHub Pages 管理後台裡的「會議室預約」「會議室公告」兩個分頁移除，改為提示訊息導向新系統，避免兩邊資料各自為政

## 非目標（本次不做）

- 不搬遷/影響管理後台其他既有功能（大廳公告、水牌管理、螢幕排版等），這些繼續留在 GitHub Pages + localStorage 架構，跟這次重建完全無關
- 不做多帳號/角色權限系統，沿用現行單一共用密碼登入
- 不對「office → 172.18.0.251」這條同步管道本身開放任何對外 API 或介面，純粹是後端內部排程任務
- 不改動 172.18.0.251 上除了 `room01.html`~`room05.html` 以外的任何檔案／設定（該機器唯讀原則不變）
- 不處理業戶別資料的雙向同步或落地保存，純即時讀取 GitHub Pages 現有資料，新系統自己不維護一份水牌名錄副本

## 架構

```
┌─────────────────────────────────────────────────────────┐
│ office 機器（100.95.24.81，Ubuntu，Docker）                │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ qinjia-room-booking（新 Docker 服務）              │   │
│  │                                                     │   │
│  │  ┌──────────────┐   ┌──────────────────────────┐ │   │
│  │  │ FastAPI 後端  │──▶│ PostgreSQL（既有共用實例，  │ │   │
│  │  │  - CRUD API   │   │  新 schema：rooms/         │ │   │
│  │  │  - 單一密碼登入│   │  bookings/                 │ │   │
│  │  │  - 背景排程    │   │  meeting_announcements）    │ │   │
│  │  └──────┬───────┘   └──────────────────────────┘ │   │
│  │         │                                          │   │
│  │         │ 每 5 分鐘：組出今日有效預約＋有效公告 JSON  │   │
│  │         ▼                                          │   │
│  │   SSH/SCP 推送（沿用既有 EBA 金鑰授權）              │   │
│  └─────────┼───────────────────────────────────────┘   │
│            │                                              │
│  ┌─────────┼──────────────┐                              │
│  │ 靜態前端（獨立頁面）      │  ← Cloudflare Tunnel        │
│  │  https://meetings.       │    meetings.shoyubook.com  │
│  │  shoyubook.com           │                              │
│  └───────────────────────┘                              │
└───────────────┼───────────────────────────────────────────┘
                 │（內網，SSH）
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 172.18.0.251（社區門禁對講保全主機，Windows 7，唯讀原則）    │
│                                                           │
│  reservation\room01.html ~ room05.html（真正的顯示頁）      │
│  reservation\roomdata.json（office 每 5 分鐘同步寫入）       │
│                              │                              │
│                              ▼ 內網 HTTP，同源 fetch         │
│                         5 台會議室門口平板（無外網）          │
└─────────────────────────────────────────────────────────┘
```

## 資料模型

在 office 既有共用 PostgreSQL 新開一個獨立資料庫（`qinjia_room_booking`，比照 qinjia_city_plaza/qinjia_meetings 的既有模式，同一個共用 Postgres 執行個體底下各自一個 DB，不是 schema），三張表：

```sql
CREATE TABLE rooms (
  id          VARCHAR(10) PRIMARY KEY,   -- 'A'~'E'，延續現行代碼，room01~05 依序對應
  name        VARCHAR(50) NOT NULL,
  capacity    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bookings (
  id          SERIAL PRIMARY KEY,
  room_id     VARCHAR(10) REFERENCES rooms(id),
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  topic       VARCHAR(200),
  person      VARCHAR(100),
  phone       VARCHAR(50),
  tenant      VARCHAR(200),
  paid        BOOLEAN NOT NULL DEFAULT false,
  deleted_at  TIMESTAMPTZ,               -- 軟刪除標記，NULL=有效；有值=已隱藏但永久保留，供歷史查詢
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE meeting_announcements (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(200),
  type          VARCHAR(20),             -- general/urgent/event/notice
  duration      INTEGER DEFAULT 7,
  content       TEXT,
  image_url     TEXT,
  always_valid  BOOLEAN DEFAULT true,
  start_date    DATE,
  start_time    TIME,
  end_date      DATE,
  end_time      TIME,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

（`bookings.deleted_at` 語意調整：不再有「7 天後真刪除」的排程，一旦軟刪除就永久保留，只是預設查詢會排除它，查詢歷史紀錄時可以明確帶條件把它撈出來。）

## API 設計

FastAPI，前綴 `/api`，除了 `/api/auth/login` 外其他端點都需要登入後的 session/cookie：

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/api/auth/login` | 帶密碼登入，回傳 session cookie |
| GET | `/api/rooms` | 房間清單 |
| POST | `/api/rooms` | 新增房間 |
| PUT | `/api/rooms/{id}` | 編輯房間（名稱/容納人數） |
| DELETE | `/api/rooms/{id}` | 刪除房間 |
| GET | `/api/bookings?date=YYYY-MM-DD` | 查詢某天有效預約（依日期） |
| GET | `/api/bookings?room_id=A&include_deleted=true` | 查歷史紀錄（含軟刪除） |
| POST | `/api/bookings` | 新增預約（含重疊檢查） |
| PUT | `/api/bookings/{id}` | 編輯預約（含重疊檢查） |
| DELETE | `/api/bookings/{id}` | 軟刪除（設定 `deleted_at`） |
| POST | `/api/bookings/{id}/restore` | 復原（清除 `deleted_at`，需重新檢查時段衝突） |
| GET | `/api/meeting-announcements` | 公告列表 |
| POST | `/api/meeting-announcements` | 新增公告 |
| PUT | `/api/meeting-announcements/{id}` | 編輯公告 |
| DELETE | `/api/meeting-announcements/{id}` | 刪除公告 |
| GET | `/api/tenants` | 即時代理讀取 GitHub Pages 水牌資料，回傳業戶別下拉選單選項 |

重疊檢查沿用既有公式：`新.start_time < 既有.end_time && 新.end_time > 既有.start_time`（同房間、同日期、排除自己與已軟刪除的項目）。

## 背景同步任務

後端啟動時註冊一個排程（例如 APScheduler，每 5 分鐘跑一次）：

1. 查詢所有房間、今天日期的有效預約（`deleted_at IS NULL`）、目前有效的會議室公告（依 `always_valid`／日期區間判斷，邏輯比照現行 `isAnnActive`）
2. 組成 JSON：`{ rooms: [...], bookings: [...], meetingAnnouncements: { marquee, list } }`
3. 寫入本機暫存檔，透過 SSH/SCP（用 office 自己的金鑰，需先把 office 的公鑰加進 `EBA@172.18.0.251` 的 `authorized_keys`）覆蓋到 `C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\roomdata.json`
4. 若這一輪 GitHub 讀取或 SSH 推送失敗，記錄錯誤但**不覆蓋**遠端既有檔案——平板會繼續顯示上一次同步成功的資料，不會變成空白或報錯畫面

## 172.18.0.251 端顯示頁

把 `room01.html`~`room05.html` 從轉址頁改回真正的顯示頁，對應順序不變（`room01`=A、`room02`=B、`room03`=C、`room04`=D、`room05`=E）：

```html
<script>var ROOM_ID = 'A'; var ROOM_DATA_URL = './roomdata.json';</script>
<script src="./roomBoardStyle.js"></script>
<script src="./roomBoard.js"></script>
```

`shared/roomBoard.js` 新增一個資料來源開關：目前的 `init()` 是透過 `window.api.get('meetings')`／`window.api.get('meetingAnnouncements')`（走 localStorage + GitHub 備份）取得資料；新增判斷——如果頁面定義了全域變數 `ROOM_DATA_URL`，改用 `fetch(ROOM_DATA_URL)` 讀取同源的本機 JSON 檔，取出 `meetings`／`meetingAnnouncements` 兩個欄位餵給既有的 `computeRoomState()`／`renderAll()`／輪播邏輯——這些既有的渲染邏輯完全不用改，只有「資料從哪裡來」這一段需要分支。`shared/roomBoardStyle.js` 不需要修改，直接原樣複製一份過去（純樣式常數，幾乎不會變動，不需要跟著每 5 分鐘同步）。

這個開關同時保留了現行「GitHub Pages 版」的運作方式（`ROOM_DATA_URL` 未定義時，行為跟現在完全一樣），所以這一版改動不影響任何可能還在使用 GitHub Pages 版顯示頁的地方。

## 資料搬遷

一次性腳本：讀取現有 `data/backup.json` 的 `meetings.rooms`／`meetings.bookings`／`meetingAnnouncements.list`，寫入新 PostgreSQL 的三張表。房間 `id` 直接沿用（A~E），預約與公告的既有欄位一一對應到新 schema（`deletedAt` 有值的預約，匯入時保留其 `deleted_at` 值，不因為改成永久保留而重新變成有效狀態）。

## 舊系統收尾

`renderer/admin/index.html` 的「會議室預約」（`tab-meetings`）與「會議室公告」（`tab-meetingann`）兩個分頁移除，側邊選單對應的項目改成一個提示卡片：「會議室預約與公告已搬遷至新系統，請至 https://meetings.shoyubook.com 管理」，並附連結。`shared/api.js` 裡的 `meetings`／`meetingAnnouncements` 資料鍵、`shared/roomBoard.js`／`shared/roomBoardStyle.js`（GitHub Pages 版的部分）予以保留不刪除，避免影響其他可能的既有引用；只是不再是資料維護的入口。

## 部署與網路

- `qinjia-room-booking` 比照 `qinjia-finance-app` 的 docker-compose 模式，新增一個容器（FastAPI，綁定僅限 `127.0.0.1` 或 Tailscale IP 的某個 port），沿用既有共用 PostgreSQL 容器（不另開一個資料庫容器）
- 上線 SOP 比照 `P:\共用設定\README.md` 第 3 章：確認本機 port 可通 → `cloudflared tunnel route dns shoyubook meetings` → 改 `/etc/cloudflared/config.yml` ingress（fallback 404 必須在最後）→ `sudo systemctl restart cloudflared` → 瀏覽器驗證
- office 需要把自己的 SSH 公鑰（`shoyufang@shoyufang-All-Series`）加進 `EBA@172.18.0.251` 的 `authorized_keys`，這是對 172.18.0.251 的又一次「唯讀原則例外」，範圍僅限新增一行公鑰，不改動其他任何設定

## 測試與驗收

- 資料搬遷腳本跑完後，比對新資料庫筆數與 `data/backup.json` 原始筆數一致
- 新前端能完成登入、房間 CRUD、預約 CRUD（含重疊檢查擋下衝突）、公告 CRUD
- 軟刪除一筆預約，確認它從一般查詢消失但用 `include_deleted=true` 查得到，且 7 天後（模擬時間）仍然存在、不會被清除
- 手動觸發一次背景同步，確認 172.18.0.251 上的 `roomdata.json` 正確更新，且 5 個 `room0N.html` 都能正確讀取本機資料顯示（用瀏覽器連 `http://172.18.0.251/cc71/rwd/view/reservation/room01.html` 驗證，不透過任何外部網址）
- 模擬同步失敗（例如暫時中斷 SSH 或 GitHub 讀取），確認 172.18.0.251 上的舊資料不會被清空或覆蓋成壞資料，畫面持續顯示上次同步成功的內容
- `https://meetings.shoyubook.com` 對外可正常存取，未登入時要求密碼
- 確認 GitHub Pages 管理後台的舊「會議室預約」「會議室公告」分頁已改成正確導向新系統的提示訊息
- **現場驗收**：到會議室門口實地確認 5 台平板都正確顯示新畫面（這是這次問題的最終驗收標準，前面所有測試都只是必要條件，不是充分條件）
