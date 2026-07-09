# 螢幕牆單頁模式（Screen Wall）設計

日期：2026-07-09

## 背景與目標

目前大廳的多螢幕展示是用 `start_display.bat` 開 6 個獨立 kiosk 瀏覽器視窗，每個視窗都是一個獨立的 `--user-data-dir`（獨立瀏覽器 process）。這造成記憶體開銷疊加（每個 Chromium process 基礎開銷約 80-150MB，6 個視窗光基礎開銷就有 500MB-1GB）。

目標：新增一個「螢幕牆」網頁，尺寸 5760×2160，用 iframe 把既有的 screen1~13 依照管理後台「螢幕排版」功能記錄的座標動態拼起來，取代多視窗做法，改成單一瀏覽器 process 顯示全部畫面。

**非目標**：
- 不重寫任何既有的 screen1~13 頁面內容邏輯
- 不做即時當機偵測（改用定時重載保底，見下方「重載策略」）
- 不移除既有的多視窗模式，兩種模式並存，由管理後台切換

## 架構總覽

```
renderer/wall/index.html          ← 新增：螢幕牆容器頁面
shared/screenDefs.js              ← 新增：SCREEN_DEFS + DEFAULT_LAYOUT 共用資料
shared/api.js                     ← 修改：DATA_KEYS 加入 'screenLayout'
renderer/admin/index.html         ← 修改：改用共用資料模組、排版存檔走 window.api.save、
                                     「產生 .bat」新增輸出模式切換
renderer/screen1~13/index.html    ← 不修改
```

## 元件設計

### 1. `shared/screenDefs.js`（新增）

把目前寫死在 `admin/index.html` 裡的兩份資料抽出來，成為 admin 頁面與螢幕牆頁面共用的唯一資料來源：

- `SCREEN_DEFS`：每個畫面的定義（`id`、`title`、`w`、`h`、`color` 等），例如 screen1 是 1920×1080、screen13 是 1920×2160
- `DEFAULT_LAYOUT`：預設排版，`[{ screenId, physX, physY }, ...]`，座標範圍 X: -1920/0/1920，Y: -1080/0

以 `window.ScreenDefs = { SCREEN_DEFS, DEFAULT_LAYOUT }` 掛在全域，純 `<script>` 引入，不用打包工具（跟現有 `shared/api.js` 一致的模式）。

admin 頁面移除本地重複定義的 `SCREEN_DEFS`、`DEFAULT_LAYOUT`，改為引用 `ScreenDefs.*`。

### 2. `shared/api.js`（修改）

`DATA_KEYS` 新增 `'screenLayout'`，`DEFAULTS.screenLayout` 預設為空陣列 `[]`（代表「尚未自訂排版」，由讀取端自行決定退回 `ScreenDefs.DEFAULT_LAYOUT`，避免 `api.js` 直接依賴 `screenDefs.js` 造成載入順序耦合）。

排版資料因此自動納入現有的 GitHub 自動備份／`autoRestore`／`startAutoPoll` 機制，跟公告、設定的同步方式完全一致。

### 3. `renderer/admin/index.html`（修改）

- 排版編輯器（`initLayoutEditor`、`layDrop`、`layRemove`）的存檔動作改為呼叫 `window.api.save('screenLayout', layoutWindows)`，取代目前直接寫 `localStorage.setItem('bbs_screen_layout', ...)`。存檔會自動觸發「備份到 GitHub」流程（沿用既有機制，若未設定 Token 會顯示既有的橘色警告，行為不變）。
- 讀取時改用 `window.api.get('screenLayout')`，若為空陣列則退回 `ScreenDefs.DEFAULT_LAYOUT`。
- 「執行檔設定」區塊新增**輸出模式**切換（單選）：
  - **多視窗模式**（預設，維持現有行為）：`generateBatContent()` 邏輯不變，每格輸出一行 `--window-position=x,y --window-size=w,h --kiosk/--app "url"`
  - **螢幕牆模式**：忽略個別格子的視窗指令，只輸出一行，開啟涵蓋全部螢幕範圍的單一視窗：
    ```
    start "" %BROWSER% %FLAGS% --user-data-dir="C:\EdgeWall" --window-position=-1920,-1080 --window-size=5760,2160 --app="https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/wall/"
    ```
  - 兩種模式共用同一份排版資料（哪格放哪個 screen），只差在「怎麼轉成瀏覽器指令」

### 4. `renderer/wall/index.html`（新增）

**初始化流程**：
1. `await window.ghBackup.autoRestore()` — 本機無資料時從 GitHub 還原
2. `var layout = await window.api.get('screenLayout')` — 若為空陣列，退回 `ScreenDefs.DEFAULT_LAYOUT`
3. 依排版資料與 `SCREEN_DEFS` 計算每格 iframe 的相對位置與尺寸，動態產生 iframe
4. 監聽 `window.api.on('screenLayout:updated', rerenderGrid)`，之後在別台電腦改排版並成功同步後，螢幕牆會自動套用新版面，不需重開瀏覽器

**座標轉換**（畫布左上角對應實體座標 -1920, -1080）：
```
left = physX + 1920
top  = physY + 1080
```
寬高直接取 `SCREEN_DEFS` 對應項目的 `w`、`h`。

**iframe 產生（含錯開載入）**：
逐格建立 iframe 元素但不立即設定 `src`，改用 `setTimeout(() => iframe.src = url, index * 3000)` 依序延遲載入（模擬現有 `start_display.bat` 每視窗間隔啟動的效果），避免多格同時發起載入（尤其 YouTube 兩格）造成瞬間資源尖峰。錯開載入也讓各 iframe 內部既有的 `meta refresh` 計時器自然錯開，不需要額外的重載管理程式碼。

```html
<iframe src="" data-target="../screen1/" allow="autoplay"
        style="position:absolute; left:0px; top:0px; width:1920px; height:1080px; border:0"></iframe>
```

**沒有配置的格子**：排版資料中若某位置沒有對應的 screen，該區域維持空白背景，不套用預設值。

## 重載策略

**不修改任何既有 screen1~13 頁面**。既有的 `<meta http-equiv="refresh" content="1800">` 在 iframe 內依然獨立生效——每個 iframe 是獨立文件，其 `meta refresh` 不受外層頁面影響，會照常在載入後 30 分鐘重新整理自己。

螢幕牆唯一需要新增的邏輯是「錯開初始載入時間」（見上方 iframe 產生段落），讓 30 分鐘計時器的到期時間點自然分散，不需要額外撰寫重載管理程式碼、也不需要當機偵測心跳機制。

## YouTube 巢狀 iframe

screen8、screen9 內部已有一層 YouTube iframe。被螢幕牆再包一層後變成三層巢狀（螢幕牆 → screen8/9 → YouTube）。螢幕牆產生的 iframe 標籤加上 `allow="autoplay"` 屬性，確保最內層 YouTube 的自動靜音播放不會被外層策略擋掉。此項目需要在實作後於本機以 preview 工具實際驗證播放是否正常。

## 錯誤處理

- 排版資料未同步到大廳電腦（例如忘記設定 GitHub Token）：沿用既有機制的橘色警告提示，螢幕牆會使用退回的 `DEFAULT_LAYOUT` 或上次成功同步的版本
- 個別 iframe 內容出錯（網址異常、頁面 JS 錯誤）：該格空白或停滯，等下一次 `meta refresh`（最長 30 分鐘）自動恢復，不影響其他格、不影響整個瀏覽器 process
- 螢幕牆頁面本身載入失敗：風險與現有任一 screen 頁面相同，非本次新增風險

## 測試與驗收

**可在本機（開發環境）驗證**：
- 用假的 `bbs_screen_layout` 資料，確認 iframe 位置與尺寸計算正確
- 確認 YouTube 三層巢狀 iframe 加上 `allow="autoplay"` 後仍可自動靜音播放
- 確認排版資料透過 `window.api` 存取／廣播更新正常運作

**無法在本機驗證，需在大廳電腦上測試**：
- 單一無邊框瀏覽器視窗能否真正跨 3 台實體螢幕（橫向）+ 2 台（縱向）顯示成一個連續畫布。screen13 先前已驗證跨 2 台螢幕可行，但這次是完整 5760×2160、跨 6 個螢幕位置的組合，屬於本次實作的主要技術風險，**必須在正式環境完成後至現場測試一次**才能確認可用

## 範圍外（本次不做）

- 即時當機偵測（心跳機制）
- 螢幕牆網頁上的除錯角標／狀態顯示
- 移除既有多視窗模式（維持並存）
