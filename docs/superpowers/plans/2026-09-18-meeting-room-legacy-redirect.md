# 會議室門口平板轉址 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把舊系統（172.18.0.251）上會議室門口平板唯一能連到的 `room01.html`~`room05.html`，換成極簡轉址頁，導向本 repo 已上線的 GitHub Pages `renderer/room01/`~`room05/`，讓硬體被鎖死的平板也能顯示新的即時狀態＋公告輪播內容。

**Architecture:** 在本 repo 建立 5 個純轉址用的靜態 HTML 檔案（不含任何業務邏輯，只有 `meta refresh` + `location.replace` 雙重轉址），透過 SSH／SCP 部署到舊伺服器，取代該機器上原本的 5 個檔案；部署前先備份舊檔案供日後復原。顯示邏輯 100% 維持在本 repo 的 `shared/roomBoard.js`，舊伺服器端完全不含邏輯。

**Tech Stack:** 純靜態 HTML（轉址頁），OpenSSH／SCP（部署到 Windows 7 遠端主機），無建置工具。

**依據設計文件：** `docs/superpowers/specs/2026-09-18-meeting-room-legacy-redirect-design.md`

---

## 重要背景（執行前必讀）

- 目標主機 `172.18.0.251` 是社區的**門禁對講保全主機**（正式運作中的生產系統，非測試機），Windows 7 + PowerShell v2.0（極舊），跑 Apache + 2014 年「超媒體管家」物業管理軟體。
- 連線資訊：`ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251`（帳號 `EBA`，本機 Administrator 權限，金鑰已設定免密碼登入；連線細節記錄於 `P:\共用設定\EBA門禁主機-連線說明.md`）。**注意**：該文件寫的是 `id_rsa`，但實測需要用 `id_ed25519` 才能連上，執行前務必自己先測試一次連線，不要照抄文件裡的金鑰路徑。
- 該機器的既有規範是「唯讀原則，只有經同意的例外才能改」，這次置換 `room01.html`~`room05.html` 是使用者已經明確同意的例外，**只能動這 5 個檔案，不可以動該機器上任何其他東西**（門禁對講、EBA.exe、MySQL、`board_editor.html`、`list_eba.html`、社區網站首頁等一律不碰）。
- 遠端目標路徑（Windows 8.3 短路徑，比較不會踩到空白/中文路徑問題）：
  ```
  C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\
  ```
- 遠端 shell 是 cmd.exe（不是 PowerShell），下指令時用 cmd 語法，不要用 PowerShell 語法。
- **每一步操作前都先確認指令本身，不要一次下太多指令、不要用會清掉其他檔案的萬用字元刪除指令。**

---

## 檔案異動總覽

| 檔案 | 動作 | 內容 |
|---|---|---|
| `deploy/legacy-room-redirect/room01.html` ~ `room05.html` | 新增（本 repo） | 5 個轉址頁原始檔，作為部署到舊伺服器內容的單一來源存底 |
| `172.18.0.251` 上的 `room01.html`~`room05.html` | 遠端覆蓋 | 換成上面 5 個轉址頁的內容 |
| `172.18.0.251` 上的 `room01.html.bak_20260918`~`room05.html.bak_20260918` | 遠端新增 | 部署前的備份，供日後復原用 |

---

### Task 1: 建立 5 個轉址頁原始檔（存在本 repo）

**Files:**
- Create: `deploy/legacy-room-redirect/room01.html`
- Create: `deploy/legacy-room-redirect/room02.html`
- Create: `deploy/legacy-room-redirect/room03.html`
- Create: `deploy/legacy-room-redirect/room04.html`
- Create: `deploy/legacy-room-redirect/room05.html`

**背景**：這 5 個檔案是實際會部署到舊伺服器（172.18.0.251）上、覆蓋掉同名舊檔的內容。放在 `deploy/legacy-room-redirect/` 資料夾裡並 commit 進 repo，作為「舊伺服器目前應該長怎樣」的單一存底來源——之後如果需要重新部署或稽核內容，直接看這個資料夾即可，不需要再連回舊伺服器確認。這個資料夾底下的檔案**只會被部署到外部舊伺服器，不會出現在 GitHub Pages 網站本身**（跟 `renderer/` 底下的檔案是兩回事）。

- [ ] **Step 1: 建立 `room01.html`（對應 A 會議室）**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room01/">
<title>會議室 A 門口顯示</title>
<script>location.replace('https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room01/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 2: 建立 `room02.html`（對應 B1 會議室）**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room02/">
<title>會議室 B1 門口顯示</title>
<script>location.replace('https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room02/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 3: 建立 `room03.html`（對應 B2 會議室）**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room03/">
<title>會議室 B2 門口顯示</title>
<script>location.replace('https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room03/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 4: 建立 `room04.html`（對應 C1 會議室）**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room04/">
<title>會議室 C1 門口顯示</title>
<script>location.replace('https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room04/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 5: 建立 `room05.html`（對應 C2 會議室）**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="0; url=https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room05/">
<title>會議室 C2 門口顯示</title>
<script>location.replace('https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room05/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 6: 逐一檢查 5 個檔案內容正確、URL 一一對應**

```bash
grep -H "url=" deploy/legacy-room-redirect/room0*.html
```

Expected：印出 5 行，`room01.html` 對應 `.../renderer/room01/`，`room02.html` 對應 `.../renderer/room02/`，以此類推到 `room05.html` 對應 `.../renderer/room05/`，網址結尾數字跟檔名數字必須一致（這是最容易手滑打錯的地方，務必逐行核對）。

- [ ] **Step 7: Commit**

```bash
git add deploy/legacy-room-redirect/
git commit -m "feat: 新增會議室門口平板轉址頁原始檔，準備部署到舊系統伺服器"
```

---

### Task 2: 備份舊伺服器上現有的 5 個檔案

**Files:** 無本機檔案異動，純遠端操作。

**背景**：正式覆蓋前，先在遠端把現有的 `room01.html`~`room05.html` 各自備份一份，檔名加上 `.bak_20260918` 後綴，放在原本同一個資料夾。這樣如果部署後發現有問題要復原，直接把備份檔改名蓋回去即可，不需要再重新設計/重寫。

- [ ] **Step 1: 測試 SSH 連線**

```bash
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "echo connected"
```

Expected：輸出 `connected`。如果被拒絕（`Permission denied`），停下來——不要嘗試其他金鑰或用密碼硬連，回報使用者確認連線方式是否有變動。

- [ ] **Step 2: 確認遠端目標資料夾存在、目前有這 5 個檔案**

```bash
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "dir C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room0*.html"
```

Expected：列出 `room01.html` 到 `room05.html` 這 5 個檔案，都有檔案大小跟修改時間（確認路徑正確、檔案確實存在，避免備份/覆蓋到錯誤路徑）。

- [ ] **Step 3: 備份 5 個現有檔案**

```bash
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "copy C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room01.html C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room01.html.bak_20260918"
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "copy C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room02.html C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room02.html.bak_20260918"
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "copy C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room03.html C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room03.html.bak_20260918"
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "copy C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room04.html C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room04.html.bak_20260918"
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "copy C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room05.html C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room05.html.bak_20260918"
```

Expected：每一行指令都輸出 `已複製         1 個檔案。`（cmd.exe 的 `copy` 指令成功訊息，中文可能因遠端主機是 Big5 系統顯示成亂碼，只要沒出現 "找不到檔案" 之類的錯誤訊息即算成功）。

- [ ] **Step 4: 確認備份檔案確實存在**

```bash
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "dir C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room0*.bak_20260918"
```

Expected：列出 5 個 `.bak_20260918` 檔案，檔案大小應該跟 Step 2 看到的原始檔一致（因為是直接複製）。

---

### Task 3: 上傳新的轉址頁，覆蓋舊檔案

**Files:** 無本機檔案異動，純遠端部署操作。

**背景**：確認備份都做好之後，才把 Task 1 建立的 5 個轉址頁透過 SCP 上傳，覆蓋掉舊伺服器上原本的 5 個檔案。

- [ ] **Step 1: 用 SCP 上傳 5 個新檔案**

```bash
scp -i ~/.ssh/id_ed25519 deploy/legacy-room-redirect/room01.html "EBA@172.18.0.251:C:\\Progra~2\\Apache~1\\Apache2.2\\htdocs\\cc71\\rwd\\view\\reservation\\room01.html"
scp -i ~/.ssh/id_ed25519 deploy/legacy-room-redirect/room02.html "EBA@172.18.0.251:C:\\Progra~2\\Apache~1\\Apache2.2\\htdocs\\cc71\\rwd\\view\\reservation\\room02.html"
scp -i ~/.ssh/id_ed25519 deploy/legacy-room-redirect/room03.html "EBA@172.18.0.251:C:\\Progra~2\\Apache~1\\Apache2.2\\htdocs\\cc71\\rwd\\view\\reservation\\room03.html"
scp -i ~/.ssh/id_ed25519 deploy/legacy-room-redirect/room04.html "EBA@172.18.0.251:C:\\Progra~2\\Apache~1\\Apache2.2\\htdocs\\cc71\\rwd\\view\\reservation\\room04.html"
scp -i ~/.ssh/id_ed25519 deploy/legacy-room-redirect/room05.html "EBA@172.18.0.251:C:\\Progra~2\\Apache~1\\Apache2.2\\htdocs\\cc71\\rwd\\view\\reservation\\room05.html"
```

Expected：每一行都印出傳輸進度並在結尾顯示 100% 完成，沒有 `Permission denied`、`No such file or directory` 之類的錯誤。

- [ ] **Step 2: 從遠端把剛上傳的檔案抓回來，逐一比對內容是否跟本機一致**

```bash
scp -i ~/.ssh/id_ed25519 "EBA@172.18.0.251:C:\\Progra~2\\Apache~1\\Apache2.2\\htdocs\\cc71\\rwd\\view\\reservation\\room01.html" /tmp/verify_room01.html
diff deploy/legacy-room-redirect/room01.html /tmp/verify_room01.html
scp -i ~/.ssh/id_ed25519 "EBA@172.18.0.251:C:\\Progra~2\\Apache~1\\Apache2.2\\htdocs\\cc71\\rwd\\view\\reservation\\room05.html" /tmp/verify_room05.html
diff deploy/legacy-room-redirect/room05.html /tmp/verify_room05.html
```

Expected：兩次 `diff` 都沒有任何輸出（代表遠端檔案內容跟本機來源檔案逐位元組一致）。這裡只抽驗 `room01`／`room05`（第一個跟最後一個）作為代表，不用 5 個全部都下載比對，抽驗兩端已經足以確認 SCP 傳輸過程沒有出錯（例如編碼被轉換、被截斷）。

---

### Task 4: 端對端驗證 5 個轉址頁都正確運作

**Files:** 無檔案異動，純驗證。

- [ ] **Step 1: 用瀏覽器逐一開啟舊網址，確認正確轉址到新系統並顯示對應房間**

You have access to `mcp__Claude_Browser__*` tools. 依序對 5 個房間執行以下驗證（範例以 room01 為例，其餘 4 個比照辦理，只改網址跟預期房間名稱）：

```
mcp__Claude_Browser__navigate({ url: "http://172.18.0.251/cc71/rwd/view/reservation/room01.html" })
```

等待 1-2 秒讓轉址完成，然後：

```javascript
window.location.href
```

Expected：回傳值是 `https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room01/`（確認瀏覽器真的被轉址過去了，不是還停在舊網址）。

```
mcp__Claude_Browser__get_page_text({})
```

Expected：頁面文字內容應該顯示「A會議室」相關資訊（房間名稱、使用中/未使用狀態），不是舊系統的公告圖片畫面。

對 `room02.html`~`room05.html` 重複同樣的檢查，分別預期轉址到 `renderer/room02/`~`renderer/room05/`，並顯示對應房間名稱（B1會議室、B2新會議室、C1新會議室、C2新會議室——實際名稱以管理後台「房間清單設定」目前設定的為準，如果跟這裡預期的不同，以管理後台實際顯示的為準，不是本計畫寫錯）。

- [ ] **Step 2: 確認每個轉址頁本身沒有 console 錯誤**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

Expected：無錯誤（每個房間頁面都檢查一次）。

- [ ] **Step 3: 確認舊系統其他既有功能沒有受影響**

```
mcp__Claude_Browser__navigate({ url: "http://172.18.0.251/cc71/rwd/view/reservation/board_editor.html" })
```

```
mcp__Claude_Browser__get_page_text({})
```

Expected：頁面能正常打開、顯示公告編輯器介面內容（不是錯誤頁），證明這次部署沒有影響到 `reservation` 目錄下的其他既有檔案。

- [ ] **Step 4: 回報部署完成，附上復原方式**

跟使用者確認驗證結果都正確之後，明確告知：如果之後發現轉址有問題需要復原，遠端伺服器上的復原方式是（不需要再連這個 session，日後任何人都能照著做）：

```
ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251 "copy /Y C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room01.html.bak_20260918 C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room01.html"
```

（`room02`~`room05` 比照辦理，把檔名數字換掉即可。）

---

## 部署後現場確認（無法在本機/遠端模擬，需要人到現場看）

1. 到 5 間會議室門口實地確認平板螢幕畫面已經變成新的即時狀態＋公告輪播畫面，不是還停在舊的公告圖片畫面
2. 如果平板螢幕還是顯示舊畫面，先確認平板瀏覽器有沒有重新整理過（部分瀏覽器可能快取了舊版 `room01.html`，需要手動重新整理或重開機一次讓它重新抓取新內容）
