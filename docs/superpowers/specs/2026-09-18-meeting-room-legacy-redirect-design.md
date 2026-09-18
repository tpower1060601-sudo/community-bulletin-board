# 會議室門口平板轉址設計

日期：2026-09-18

## 背景

會議室門口的 5 台平板螢幕硬體被鎖死，瀏覽器只能連到舊系統（172.18.0.251，社區的門禁對講保全主機，Windows 7，跑著 2014 年「超媒體管家」物業管理軟體）上原本的 `room01.html`~`room05.html`。原訂計畫是把平板改指向我們自己在 GitHub Pages 上新做的 `renderer/room01/`~`room05/` 頁面，但平板硬體無法變更瀏覽器可連的網址。

已確認可以透過 SSH 連線到 172.18.0.251（帳號 `EBA`，金鑰登入，連線資訊記錄於 `P:\共用設定\EBA門禁主機-連線說明.md`），可以直接置換該機器上 `room01.html`~`room05.html` 這 5 個檔案。該機器的既有規範是「唯讀原則，經同意才能動 reservation 目錄下特定檔案」，這次置換已取得使用者明確同意，屬於新增的例外。

## 目標

- 平板實際連到 `172.18.0.251` 的 `room01.html`~`room05.html` 時，最終看到的是我們新做的即時房間狀態 + 公告輪播內容
- 顯示邏輯維持「單一份程式碼來源」——完全在這個 repo 裡（`shared/roomBoard.js`），不在舊伺服器上另外複製一份維護
- 只動舊伺服器上這 5 個檔案，不影響該機器上任何其他功能（門禁對講、EBA.exe 監聽埠、MySQL、`board_editor.html`、`list_eba.html` 等）
- 換之前備份舊檔案，換完之後可以隨時復原回舊版本

## 非目標（本次不做）

- 不修改舊系統本身的任何程式邏輯（PHP、MySQL、`board_editor.html` 等），舊系統除了這 5 個檔案以外完全不動
- 不嘗試把新系統的登入/資料寫回舊系統的 MySQL（`cc71` 資料庫），兩邊完全獨立，舊系統的 MySQL 資料庫不再被使用
- 不處理平板瀏覽器本身的快取問題（如果平板瀏覽器有積極快取舊版 `room01.html` 導致轉址沒有立即生效，這是平板本身的行為，不在本次範圍內排查）

## 方案：轉址頁

把舊伺服器上 `room01.html`~`room05.html` 的內容全部換成極簡的轉址頁，導向我們已經上線的 GitHub Pages 對應頁面：

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

（`room02.html`~`room05.html` 內容相同，只有網址結尾的 `room01`~`room05` 跟 `<title>` 跟著換。）

`<meta http-equiv="refresh">` 跟 `<script>location.replace(...)</script>` 雙重保險：萬一平板瀏覽器版本太舊不支援 JS 或 JS 被停用，靠 meta refresh 一樣能轉址；反之如果 meta refresh 因故沒生效，JS 立刻補上。用 `location.replace()` 而非 `location.href` 是為了不在瀏覽器歷史記錄留下轉址前的那一筆，避免使用者按「上一頁」卡在轉址頁。

實際的即時狀態計算、公告輪播邏輯，全部由 GitHub Pages 上已經上線、已經過完整測試的 `renderer/room01/`~`room05/`（載入 `shared/roomBoard.js`）負責——舊伺服器這 5 個檔案自始至終只是一層轉址，不含任何業務邏輯，往後這個功能有任何調整，只需要改這個 repo，完全不需要再碰舊伺服器。

## 部署流程

1. 透過 SSH（`ssh -i ~/.ssh/id_ed25519 EBA@172.18.0.251`）先把現有 5 個檔案備份成 `room01.html.bak_20260918` ~ `room05.html.bak_20260918`（放在原本同一個目錄，方便日後需要復原時直接改檔名换回來）
2. 用 SCP 把新產生的 5 個轉址頁上傳，覆蓋 `C:\Progra~2\Apache~1\Apache2.2\htdocs\cc71\rwd\view\reservation\room01.html`~`room05.html`（8.3 短路徑，遠端機器是 Windows 7 + 舊版 Apache）
3. 用瀏覽器直接開啟 `http://172.18.0.251/cc71/rwd/view/reservation/room01.html`（透過內網連線）驗證：頁面應該立即轉址到 `https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room01/` 並正確顯示 A 會議室的即時狀態
4. 5 個檔案都驗證過轉址正確、目的地房間對應正確（`room01`→A、`room02`→B1、`room03`→B2、`room04`→C1、`room05`→C2）後才算完成

## 測試與驗收

- 5 個轉址頁分別用瀏覽器開啟，確認最終網址跟畫面內容都正確對應到各自的房間
- 確認轉址頁本身沒有任何 JS 錯誤（開發者工具檢查 console）
- 確認舊伺服器上其他既有功能（`board_editor.html`、`list_eba.html`、社區網站首頁）沒有受到影響，仍正常運作
- 備份檔案確實存在於遠端伺服器上，檔名跟原始檔案在同一個目錄，方便需要時手動復原
