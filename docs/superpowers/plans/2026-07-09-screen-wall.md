# 螢幕牆單頁模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一個 `renderer/wall/index.html` 螢幕牆頁面，用 iframe 依管理後台的螢幕排版資料把既有 screen1~13 拼成一個 5760×2160 的單頁畫面，取代目前開 6 個獨立瀏覽器視窗的做法，藉此把多個瀏覽器 process 合併成 1 個以節省記憶體；完全不修改既有的 13 個 screen 頁面。

**Architecture:** 抽出一個 `shared/screenDefs.js` 共用模組（`SCREEN_DEFS` + `DEFAULT_LAYOUT`），讓 admin 頁面與新的螢幕牆頁面共用同一份資料，避免上次發生過的「兩邊座標不同步」問題。排版資料透過既有的 `window.api` + GitHub 自動備份機制跨電腦同步。螢幕牆頁面依排版資料動態生成 iframe，錯開初始載入時間，完全依賴各 screen 頁面既有的 `meta refresh` 做定時保底重載，不新增任何重載管理邏輯。

**Tech Stack:** 純 HTML/CSS/JavaScript（無建置工具、無框架，遵循本專案現有慣例），localStorage + GitHub Pages 靜態部署，驗證用 Node 腳本（邏輯層）與瀏覽器 preview 工具（DOM/執行期層，本專案沒有既有測試框架，過去修復都是用這個方式驗證）。

**依據設計文件：** `docs/superpowers/specs/2026-07-09-screen-wall-design.md`

---

## 檔案結構總覽

| 檔案 | 動作 | 職責 |
|---|---|---|
| `shared/screenDefs.js` | 新增 | `SCREEN_DEFS`（畫面定義）+ `DEFAULT_LAYOUT`（預設排版），供 admin 與 wall 共用 |
| `shared/api.js` | 修改 | `DATA_KEYS` 加入 `'screenLayout'`，`DEFAULTS` 加入對應預設值 `[]` |
| `renderer/admin/index.html` | 修改 | 改用共用資料模組；排版存檔改走 `window.api.save`（自動同步 GitHub）；新增「輸出模式」切換（多視窗／螢幕牆）；`generateBatContent()` 新增螢幕牆分支 |
| `renderer/wall/index.html` | 新增 | 螢幕牆容器頁面，讀取排版資料、動態生成 iframe |
| `renderer/screen1~13/index.html` | **不修改** | — |

---

### Task 1: 建立共用資料模組 `shared/screenDefs.js`

**Files:**
- Create: `shared/screenDefs.js`

- [ ] **Step 1: 建立檔案**

把目前寫死在 `renderer/admin/index.html` 裡的 `SCREEN_DEFS`（13 個畫面定義）與 `DEFAULT_LAYOUT`（預設排版）原封不動搬到這個共用檔案，掛在 `window.ScreenDefs`：

```javascript
/* shared/screenDefs.js — 螢幕排版共用資料
   同時被 renderer/admin/index.html（螢幕排版編輯器）與 renderer/wall/index.html（螢幕牆）引用，
   避免兩邊各自維護一份座標資料造成不同步（2026-07 曾發生過座標沒對齊、產生錯誤 .bat 的問題）。 */
(function () {
  'use strict';

  var SCREEN_DEFS = [
    { id:'screen1',  label:'大廳公佈欄',  w:1920, h:1080, color:'#1d4ed8' },
    { id:'screen2',  label:'公告欄 B',    w:1920, h:1080, color:'#6d28d9' },
    { id:'screen3',  label:'全球市場',    w:1920, h:1080, color:'#065f46' },
    { id:'screen4',  label:'即時天氣',    w:1920, h:1080, color:'#0369a1' },
    { id:'screen5',  label:'圖片輪播',    w:1920, h:1080, color:'#92400e' },
    { id:'screen6',  label:'影片播放',    w:1920, h:1080, color:'#991b1b' },
    { id:'screen7',  label:'即時新聞',    w:1920, h:1080, color:'#9d174d' },
    { id:'screen8',  label:'YouTube 1',  w:1920, h:1080, color:'#c2410c' },
    { id:'screen9',  label:'YouTube 2',  w:1920, h:1080, color:'#6b21a8' },
    { id:'screen10', label:'樓層告示 A', w:1080, h:1920, color:'#374151' },
    { id:'screen11', label:'樓層告示 B', w:1080, h:1920, color:'#1f2937' },
    { id:'screen12', label:'台股熱力圖', w:1920, h:1080, color:'#3f6212' },
    { id:'screen13', label:'公告欄（直立型）', w:1920, h:2160, color:'#7f1d1d' },
  ];

  var DEFAULT_LAYOUT = [
    { screenId:'screen1', physX:-1920, physY:-1080 },
    { screenId:'screen4', physX:0,    physY:-1080 },
    { screenId:'screen3', physX:1920, physY:-1080 },
    { screenId:'screen2', physX:-1920, physY:0    },
    { screenId:'screen7', physX:0,    physY:0     },
    { screenId:'screen8', physX:1920, physY:0     },
  ];

  window.ScreenDefs = {
    SCREEN_DEFS: SCREEN_DEFS,
    DEFAULT_LAYOUT: DEFAULT_LAYOUT
  };
})();
```

- [ ] **Step 2: 驗證檔案內容正確（Node 腳本，不需瀏覽器）**

Run:
```bash
node -e "
var window = {};
var fs = require('fs');
eval(fs.readFileSync('shared/screenDefs.js', 'utf8'));
var d = window.ScreenDefs;
console.log('count:', d.SCREEN_DEFS.length);
console.log('screen13:', JSON.stringify(d.SCREEN_DEFS.filter(function(s){return s.id==='screen13';})[0]));
console.log('layout count:', d.DEFAULT_LAYOUT.length);
"
```

Expected output:
```
count: 13
screen13: {"id":"screen13","label":"公告欄（直立型）","w":1920,"h":2160,"color":"#7f1d1d"}
layout count: 6
```

- [ ] **Step 3: Commit**

```bash
git add shared/screenDefs.js
git commit -m "feat: 新增 shared/screenDefs.js 共用螢幕排版資料"
```

---

### Task 2: `shared/api.js` 加入 `screenLayout` 資料鍵

**Files:**
- Modify: `shared/api.js`

- [ ] **Step 1: `DATA_KEYS` 加入 `'screenLayout'`**

Old:
```javascript
  const DATA_KEYS = ['announcements', 'announcements_v', 'settings', 'meetings', 'news'];
```

New:
```javascript
  const DATA_KEYS = ['announcements', 'announcements_v', 'settings', 'meetings', 'news', 'screenLayout'];
```

- [ ] **Step 2: `DEFAULTS` 加入 `screenLayout` 預設值（空陣列代表尚未自訂排版）**

Old:
```javascript
    meetings: { rooms: ['會議室A', '會議室B', '會議室C'], bookings: [] },
    news: [],
  };
```

New:
```javascript
    meetings: { rooms: ['會議室A', '會議室B', '會議室C'], bookings: [] },
    news: [],
    screenLayout: [],
  };
```

- [ ] **Step 3: 驗證修改正確**

Run:
```bash
grep -n "screenLayout" shared/api.js
```

Expected output（兩行，行號可能不同但內容一致）：
```
6:  const DATA_KEYS = ['announcements', 'announcements_v', 'settings', 'meetings', 'news', 'screenLayout'];
37:    screenLayout: [],
```

- [ ] **Step 4: Commit**

```bash
git add shared/api.js
git commit -m "feat: api.js 加入 screenLayout 資料鍵，納入既有的 GitHub 自動備份機制"
```

---

### Task 3: admin 頁面改用共用資料模組

**Files:**
- Modify: `renderer/admin/index.html`

- [ ] **Step 1: 引入 `shared/screenDefs.js`**

Old:
```html
<script src="../../shared/api.js"></script>
<script>
'use strict';
function $(id) { return document.getElementById(id); }
```

New:
```html
<script src="../../shared/api.js"></script>
<script src="../../shared/screenDefs.js"></script>
<script>
'use strict';
function $(id) { return document.getElementById(id); }
```

- [ ] **Step 2: 移除本地重複定義，改指向共用模組**

Old:
```javascript
var LAY_SCALE = 8; // 物理像素 ÷ 8 = canvas 像素

var SCREEN_DEFS = [
  { id:'screen1',  label:'大廳公佈欄',  w:1920, h:1080, color:'#1d4ed8' },
  { id:'screen2',  label:'公告欄 B',    w:1920, h:1080, color:'#6d28d9' },
  { id:'screen3',  label:'全球市場',    w:1920, h:1080, color:'#065f46' },
  { id:'screen4',  label:'即時天氣',    w:1920, h:1080, color:'#0369a1' },
  { id:'screen5',  label:'圖片輪播',    w:1920, h:1080, color:'#92400e' },
  { id:'screen6',  label:'影片播放',    w:1920, h:1080, color:'#991b1b' },
  { id:'screen7',  label:'即時新聞',    w:1920, h:1080, color:'#9d174d' },
  { id:'screen8',  label:'YouTube 1',  w:1920, h:1080, color:'#c2410c' },
  { id:'screen9',  label:'YouTube 2',  w:1920, h:1080, color:'#6b21a8' },
  { id:'screen10', label:'樓層告示 A', w:1080, h:1920, color:'#374151' },
  { id:'screen11', label:'樓層告示 B', w:1080, h:1920, color:'#1f2937' },
  { id:'screen12', label:'台股熱力圖', w:1920, h:1080, color:'#3f6212' },
  { id:'screen13', label:'公告欄（直立型）', w:1920, h:2160, color:'#7f1d1d' },
];

var DEFAULT_LAYOUT = [
  { screenId:'screen1', physX:-1920, physY:-1080 },
  { screenId:'screen4', physX:0,    physY:-1080 },
  { screenId:'screen3', physX:1920, physY:-1080 },
  { screenId:'screen2', physX:-1920, physY:0    },
  { screenId:'screen7', physX:0,    physY:0     },
  { screenId:'screen8', physX:1920, physY:0     },
];
```

New:
```javascript
var LAY_SCALE = 8; // 物理像素 ÷ 8 = canvas 像素

// SCREEN_DEFS、DEFAULT_LAYOUT 改由 shared/screenDefs.js 提供，
// 同一份資料也給 renderer/wall/index.html 用，避免兩邊各自維護不同步。
var SCREEN_DEFS = window.ScreenDefs.SCREEN_DEFS;
var DEFAULT_LAYOUT = window.ScreenDefs.DEFAULT_LAYOUT;
```

其餘程式碼（`renderPalette`、`renderMonitorWall`、`layDrop`、`generateBatContent` 等）都是透過這兩個變數名稱引用，不需要另外修改呼叫端。

- [ ] **Step 3: 驗證沒有殘留的本地定義**

Run:
```bash
grep -n "^var SCREEN_DEFS = \[" renderer/admin/index.html
grep -n "^var DEFAULT_LAYOUT = \[" renderer/admin/index.html
```

Expected: 兩個指令都**沒有輸出**（代表陣列字面值定義已移除，只剩指向 `window.ScreenDefs` 的賦值）。

Run:
```bash
grep -n "window.ScreenDefs" renderer/admin/index.html
```

Expected output（兩行）：
```
<行號>:<script src="../../shared/screenDefs.js"></script>
<行號>:var SCREEN_DEFS = window.ScreenDefs.SCREEN_DEFS;
```

（第二個 grep 只會抓到含 `window.ScreenDefs` 字樣的行，`<script>` 那行因為沒有這個字串不會出現在第二次結果——若要同時看到 script 標籤，改用 `grep -n "ScreenDefs" renderer/admin/index.html` 即可看到三行：script 標籤 + 兩個賦值。）

- [ ] **Step 4: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: admin 螢幕排版改用共用 shared/screenDefs.js"
```

---

### Task 4: admin 排版存檔改走 `window.api.save`（自動同步 GitHub）+ 舊資料遷移

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：目前排版資料直接寫 `localStorage.setItem('bbs_screen_layout', ...)`，只存在你當下操作的那台電腦，不會同步到大廳電腦。改用 `window.api.save('screenLayout', ...)` 之後，實際存放的 key 會變成 `bbs_screenLayout`（`window.api` 內部用 `PREFIX + key` 組字串，`PREFIX` 是 `'bbs_'`），跟舊的 `bbs_screen_layout`（注意底線位置不同）不是同一把 key，所以需要做一次性遷移，避免既有排版（含你稍早已經修好的 3840→1920 座標）遺失。

- [ ] **Step 1: 修改 `initLayoutEditor`，改用 `window.api.get` 並遷移舊資料**

Old:
```javascript
function initLayoutEditor() {
  if (!layEditorInited) {
    try {
      var saved = localStorage.getItem('bbs_screen_layout');
      layoutWindows = saved ? JSON.parse(saved) : DEFAULT_LAYOUT.map(function(x){ return {screenId:x.screenId,physX:x.physX,physY:x.physY}; });
      // 座標遷移：3840 是舊版才有的無效座標，修正為 1920
      var needSave = false;
      layoutWindows.forEach(function(w){ if (w.physX >= 3840) { w.physX = 1920; needSave = true; } });
      if (needSave) saveLayoutLocal();
    } catch(e) {
      layoutWindows = DEFAULT_LAYOUT.map(function(x){ return {screenId:x.screenId,physX:x.physX,physY:x.physY}; });
    }
    layEditorInited = true;
  }
  renderPalette();
  renderMonitorWall();
  previewBat();
}
```

New:
```javascript
function initLayoutEditor() {
  if (layEditorInited) {
    renderPalette();
    renderMonitorWall();
    previewBat();
    return;
  }
  layEditorInited = true;

  window.api.get('screenLayout').then(function(saved) {
    if (saved && saved.length) {
      layoutWindows = saved;
      // 座標遷移：3840 是舊版才有的無效座標，修正為 1920
      var needFix = false;
      layoutWindows.forEach(function(w){ if (w.physX >= 3840) { w.physX = 1920; needFix = true; } });
      if (needFix) saveLayoutLocal();
      renderPalette(); renderMonitorWall(); previewBat();
      return;
    }

    // 新資料鍵是空的：嘗試從舊版 raw localStorage key 遷移過來（一次性）
    var legacy = null;
    try { legacy = JSON.parse(localStorage.getItem('bbs_screen_layout') || 'null'); } catch(e) {}
    if (legacy && legacy.length) {
      legacy.forEach(function(w){ if (w.physX >= 3840) w.physX = 1920; });
      layoutWindows = legacy;
      localStorage.removeItem('bbs_screen_layout');
      saveLayoutLocal(); // 寫入新資料鍵，觸發 GitHub 同步
    } else {
      layoutWindows = DEFAULT_LAYOUT.map(function(x){ return {screenId:x.screenId,physX:x.physX,physY:x.physY}; });
    }
    renderPalette();
    renderMonitorWall();
    previewBat();
  });
}
```

- [ ] **Step 2: 修改 `saveLayoutLocal`，改走 `window.api.save` + 觸發備份**

Old:
```javascript
function saveLayoutLocal() {
  try { localStorage.setItem('bbs_screen_layout', JSON.stringify(layoutWindows)); } catch(e) {}
}
```

New:
```javascript
function saveLayoutLocal() {
  window.api.save('screenLayout', layoutWindows).then(function(){ triggerBackup(); });
}
```

`triggerBackup()` 是既有函式（檔案後段已定義，公告、設定存檔都是用同一個函式觸發 GitHub 備份），不需要另外新增。

- [ ] **Step 3: 用 preview 工具驗證存檔與遷移行為**

啟動預覽伺服器並打開 admin 頁面（若前面任務已啟動可略過重啟）：

```
mcp__Claude_Preview__preview_start({ name: "預覽伺服器" })
```

在瀏覽器情境中執行（用 `mcp__Claude_Preview__preview_eval`）：

```javascript
(function(){
  // 模擬舊版遺留資料
  localStorage.setItem('bbs_screen_layout', JSON.stringify([{screenId:'screen1', physX:3840, physY:-1080}]));
  localStorage.removeItem('bbs_screenLayout');
  return 'legacy data seeded';
})()
```

導覽到 admin 頁面並登入後（若需要登入，先用既有登入流程），呼叫：

```javascript
initLayoutEditor();
```

等待約 500ms 後執行：

```javascript
(function(){
  return {
    newKeyRaw: localStorage.getItem('bbs_screenLayout'),
    legacyKeyGone: localStorage.getItem('bbs_screen_layout') === null,
    layoutWindows: layoutWindows
  };
})()
```

Expected:
- `legacyKeyGone` 為 `true`
- `newKeyRaw` 不是 `null`，內容包含 `"physX":1920`（3840 已被修正）
- `layoutWindows` 陣列第一項 `physX` 為 `1920`

- [ ] **Step 4: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 螢幕排版存檔改走 window.api.save 自動同步 GitHub，含舊資料一次性遷移"
```

---

### Task 5: admin 新增「輸出模式」切換 + `generateBatContent` 螢幕牆分支

**Files:**
- Modify: `renderer/admin/index.html`

- [ ] **Step 1: 在「執行檔設定」卡片加入模式切換 UI**

Old:
```html
      <!-- BAT 設定與預覽 -->
      <div class="card" id="batSection" style="margin-top:16px">
        <div class="card-title">⚙️ 執行檔設定</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px">
          <div class="form-group" style="margin-bottom:0">
            <label>瀏覽器</label>
```

New:
```html
      <!-- BAT 設定與預覽 -->
      <div class="card" id="batSection" style="margin-top:16px">
        <div class="card-title">⚙️ 執行檔設定</div>
        <div class="form-group" style="margin-bottom:16px">
          <label>輸出模式</label>
          <div style="display:flex;gap:16px;align-items:center;margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;font-weight:400;cursor:pointer">
              <input type="radio" name="batMode" value="multi" checked onchange="previewBat()"> 多視窗模式（每格一個瀏覽器視窗）
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-weight:400;cursor:pointer">
              <input type="radio" name="batMode" value="wall" onchange="previewBat()"> 螢幕牆模式（單一視窗，iframe 拼接）
            </label>
          </div>
        </div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px">
          <div class="form-group" style="margin-bottom:0">
            <label>瀏覽器</label>
```

- [ ] **Step 2: `generateBatContent()` 新增螢幕牆分支**

Old:
```javascript
function generateBatContent() {
  var initDelay = parseInt(($('batInitDelay')||{}).value) || 15;
  var winDelay  = parseInt(($('batWinDelay') ||{}).value) || 10;
  var exePath   = getBatBrowserPath();
  var bsel = ($('browserSelect')||{}).value || 'edge';
  var varName = bsel==='chrome' ? 'CHROME' : bsel==='supermium' ? 'BROWSER' : 'EDGE';

  // 去重（同 screenId 只保留第一個）+ 依上排→下排、左→右排序
  var seen = {};
  var sorted = layoutWindows.slice().filter(function(w){
    if (seen[w.screenId]) return false;
    seen[w.screenId] = true;
    return true;
  }).sort(function(a,b){
    if (a.physY !== b.physY) return a.physY - b.physY;
    return a.physX - b.physX;
  });

  var lines = [
    '@echo off',
    'timeout /t ' + initDelay + ' /nobreak',
    '',
    'set ' + varName + '="' + exePath + '"',
    'set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars',
    ''
  ];

  if (!sorted.length) {
    lines.push(':: 尚未配置任何螢幕');
    return lines.join('\r\n');
  }

  var lastRow = null;
  sorted.forEach(function(w, i) {
    var def = SCREEN_DEFS.find(function(s){ return s.id===w.screenId; });
    if (!def) return;
    var rowLabel = w.physY===-1080 ? '上排' : (w.physY===0 ? '下排' : 'Y:'+w.physY);
    if (rowLabel !== lastRow) { lines.push(':: ' + rowLabel); lastRow = rowLabel; }
    var url = LAY_BASE_URL + def.id + '/';
    var userDir = 'C:\\EdgeP' + (i + 1);
    var isNonStd = def.h > 1080;
    var cmd = isNonStd
      ? 'start "" %' + varName + '% %FLAGS% --user-data-dir="' + userDir + '" --window-position=' + w.physX + ',' + w.physY + ' --window-size=' + def.w + ',' + def.h + ' --app="' + url + '"'
      : 'start "" %' + varName + '% %FLAGS% --user-data-dir="' + userDir + '" --window-position=' + w.physX + ',' + w.physY + ' --window-size=' + def.w + ',' + def.h + ' --kiosk "' + url + '"';
    lines.push(cmd);
    if (i < sorted.length - 1) lines.push('timeout /t ' + winDelay + ' /nobreak');
  });

  return lines.join('\r\n');
}
```

New:
```javascript
function generateBatContent() {
  var initDelay = parseInt(($('batInitDelay')||{}).value) || 15;
  var winDelay  = parseInt(($('batWinDelay') ||{}).value) || 10;
  var exePath   = getBatBrowserPath();
  var bsel = ($('browserSelect')||{}).value || 'edge';
  var varName = bsel==='chrome' ? 'CHROME' : bsel==='supermium' ? 'BROWSER' : 'EDGE';
  var modeEl = document.querySelector('input[name="batMode"]:checked');
  var mode = modeEl ? modeEl.value : 'multi';

  var lines = [
    '@echo off',
    'timeout /t ' + initDelay + ' /nobreak',
    '',
    'set ' + varName + '="' + exePath + '"',
    'set FLAGS=--no-first-run --no-default-browser-check --disable-translate --disable-infobars',
    ''
  ];

  if (mode === 'wall') {
    var wallUrl = LAY_BASE_URL + 'wall/';
    lines.push(':: 螢幕牆模式（單一視窗，5760x2160，涵蓋全部螢幕位置，iframe 拼接）');
    lines.push('start "" %' + varName + '% %FLAGS% --user-data-dir="C:\\EdgeWall" --window-position=-1920,-1080 --window-size=5760,2160 --app="' + wallUrl + '"');
    return lines.join('\r\n');
  }

  // 去重（同 screenId 只保留第一個）+ 依上排→下排、左→右排序
  var seen = {};
  var sorted = layoutWindows.slice().filter(function(w){
    if (seen[w.screenId]) return false;
    seen[w.screenId] = true;
    return true;
  }).sort(function(a,b){
    if (a.physY !== b.physY) return a.physY - b.physY;
    return a.physX - b.physX;
  });

  if (!sorted.length) {
    lines.push(':: 尚未配置任何螢幕');
    return lines.join('\r\n');
  }

  var lastRow = null;
  sorted.forEach(function(w, i) {
    var def = SCREEN_DEFS.find(function(s){ return s.id===w.screenId; });
    if (!def) return;
    var rowLabel = w.physY===-1080 ? '上排' : (w.physY===0 ? '下排' : 'Y:'+w.physY);
    if (rowLabel !== lastRow) { lines.push(':: ' + rowLabel); lastRow = rowLabel; }
    var url = LAY_BASE_URL + def.id + '/';
    var userDir = 'C:\\EdgeP' + (i + 1);
    var isNonStd = def.h > 1080;
    var cmd = isNonStd
      ? 'start "" %' + varName + '% %FLAGS% --user-data-dir="' + userDir + '" --window-position=' + w.physX + ',' + w.physY + ' --window-size=' + def.w + ',' + def.h + ' --app="' + url + '"'
      : 'start "" %' + varName + '% %FLAGS% --user-data-dir="' + userDir + '" --window-position=' + w.physX + ',' + w.physY + ' --window-size=' + def.w + ',' + def.h + ' --kiosk "' + url + '"';
    lines.push(cmd);
    if (i < sorted.length - 1) lines.push('timeout /t ' + winDelay + ' /nobreak');
  });

  return lines.join('\r\n');
}
```

- [ ] **Step 3: 用 preview 工具驗證兩種模式輸出**

```javascript
(function(){
  document.querySelector('input[name="batMode"][value="wall"]').checked = true;
  previewBat();
  var wallOutput = document.getElementById('batPreview').value;

  document.querySelector('input[name="batMode"][value="multi"]').checked = true;
  previewBat();
  var multiOutput = document.getElementById('batPreview').value;

  return {
    wallHasSingleStart: (wallOutput.match(/start ""/g) || []).length === 1,
    wallHasWallUrl: wallOutput.indexOf('/renderer/wall/') !== -1,
    wallHasFullSize: wallOutput.indexOf('--window-size=5760,2160') !== -1,
    multiHasMultipleStart: (multiOutput.match(/start ""/g) || []).length > 1
  };
})()
```

Expected：全部四個值都是 `true`。

- [ ] **Step 4: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: admin 新增輸出模式切換，產生 .bat 支援螢幕牆單頁模式"
```

---

### Task 6: 新增 `renderer/wall/index.html`

**Files:**
- Create: `renderer/wall/index.html`

- [ ] **Step 1: 建立螢幕牆頁面**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>螢幕牆</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:5760px; height:2160px; overflow:hidden; background:#000; }
.wall-frame { position:absolute; border:0; background:#000; }
</style>
</head>
<body>
<div id="wall"></div>

<script src="../../shared/api.js"></script>
<script src="../../shared/screenDefs.js"></script>
<script>
'use strict';

var STAGGER_MS = 3000; // 每格延遲載入間隔，避免同時發起多條連線（尤其 YouTube 兩格）

function frameSrc(screenId) {
  return '../' + screenId + '/';
}

function renderWall(layout) {
  var wall = document.getElementById('wall');
  wall.innerHTML = '';
  var defs = window.ScreenDefs.SCREEN_DEFS;

  layout.forEach(function(w, i) {
    var def = null;
    for (var j = 0; j < defs.length; j++) {
      if (defs[j].id === w.screenId) { def = defs[j]; break; }
    }
    if (!def) return;

    // 畫布左上角對應實體座標 (-1920, -1080)
    var left = w.physX + 1920;
    var top  = w.physY + 1080;

    var iframe = document.createElement('iframe');
    iframe.className = 'wall-frame';
    iframe.setAttribute('allow', 'autoplay');
    iframe.style.left = left + 'px';
    iframe.style.top = top + 'px';
    iframe.style.width = def.w + 'px';
    iframe.style.height = def.h + 'px';
    wall.appendChild(iframe);

    setTimeout(function() {
      iframe.src = frameSrc(def.id);
    }, i * STAGGER_MS);
  });
}

async function init() {
  if (window.ghBackup) await window.ghBackup.autoRestore();
  var layout = await window.api.get('screenLayout');
  if (!layout || !layout.length) layout = window.ScreenDefs.DEFAULT_LAYOUT;
  renderWall(layout);
}

window.api.on('screenLayout:updated', function(layout) {
  if (!layout || !layout.length) layout = window.ScreenDefs.DEFAULT_LAYOUT;
  renderWall(layout);
});

init();
</script>
</body>
</html>
```

- [ ] **Step 2: 用 preview 工具驗證座標換算與 iframe 生成**

啟動預覽伺服器（若前面任務已啟動可略過）：

```
mcp__Claude_Preview__preview_start({ name: "預覽伺服器" })
```

先寫入一組已知排版資料到 localStorage，再導覽到螢幕牆頁面：

```javascript
(function(){
  var layout = [
    { screenId:'screen1', physX:-1920, physY:-1080 },
    { screenId:'screen13', physX:1920, physY:-1080 }
  ];
  localStorage.setItem('bbs_screenLayout', JSON.stringify(layout));
  window.location.href = 'http://localhost:8765/renderer/wall/';
  return 'navigating';
})()
```

等頁面載入後執行：

```javascript
(function(){
  var frames = document.querySelectorAll('.wall-frame');
  return Array.prototype.map.call(frames, function(f){
    return {
      left: f.style.left, top: f.style.top,
      width: f.style.width, height: f.style.height,
      allow: f.getAttribute('allow'),
      srcNow: f.src || '(空，尚未錯開載入)'
    };
  });
})()
```

Expected（第一格 screen1，第二格 screen13）：
```json
[
  { "left": "0px", "top": "0px", "width": "1920px", "height": "1080px", "allow": "autoplay", "srcNow": "(空，尚未錯開載入)" },
  { "left": "3840px", "top": "0px", "width": "1920px", "height": "2160px", "allow": "autoplay", "srcNow": "..." }
]
```

- `left`/`top`/`width`/`height` 需與計算結果一致：screen1 在 (-1920,-1080) → 換算後 (0,0)；screen13 在 (1920,-1080) → 換算後 (3840,0)，高度 2160（跨版）
- 第一格 `srcNow` 應為空字串（因為 `i=0` 但仍會經過 `setTimeout`，第 0 格延遲 0 秒，若驗證時序抓太快看到空字串是正常的，等待 1 秒後重新查詢應該會有值）

等待 4 秒後（確保兩格都已錯開載入完成）再次執行同一段查詢，確認兩格的 `srcNow` 都已變成 `http://localhost:8765/renderer/screen1/` 與 `http://localhost:8765/renderer/screen13/`。

- [ ] **Step 3: 用截圖確認實際渲染畫面沒有明顯錯位或白屏**

```
mcp__Claude_Preview__preview_screenshot({ serverId: "<步驟2的serverId>" })
```

Expected：截圖中可看到 screen1（大廳公佈欄）與 screen13（直立公告欄）的內容分別出現在畫面左側與右側對應位置，沒有整片空白或明顯的 JS 錯誤畫面。

- [ ] **Step 4: Commit**

```bash
git add renderer/wall/index.html
git commit -m "feat: 新增螢幕牆單頁模式（renderer/wall/index.html）"
```

---

### Task 7: 端對端整合驗證 + 推送

**Files:** 無新增／修改，純驗證與收尾。

- [ ] **Step 1: 在 admin 螢幕排版頁面實際拖放，確認同步到螢幕牆**

用 preview 工具打開 admin 頁面、登入、切到「螢幕排版」，用 `mcp__Claude_Preview__preview_eval` 直接呼叫既有的 `layDrop` 邏輯模擬拖放（比起真的模擬滑鼠拖拉更穩定）：

```javascript
(function(){
  // 清空現有排版，改成只放 screen4 在左上格
  layoutWindows = [];
  layDrop({ preventDefault:function(){}, currentTarget:{classList:{remove:function(){}}}, dataTransfer:{getData:function(){return 'screen4';}} }, -1920, -1080);
  return { layoutWindows: layoutWindows, storedKey: localStorage.getItem('bbs_screenLayout') };
})()
```

Expected：`layoutWindows` 只有一筆 `{screenId:'screen4', physX:-1920, physY:-1080}`，`storedKey` 是同樣內容的 JSON 字串。

- [ ] **Step 2: 重新整理螢幕牆頁面，確認套用剛才存的排版**

```javascript
window.location.href = 'http://localhost:8765/renderer/wall/'
```

等待載入後：

```javascript
(function(){
  var frames = document.querySelectorAll('.wall-frame');
  return { count: frames.length, left: frames[0] ? frames[0].style.left : null, top: frames[0] ? frames[0].style.top : null };
})()
```

Expected：`count` 為 `1`，`left` 為 `"0px"`，`top` 為 `"0px"`（screen4 在 -1920,-1080 換算後的位置）。

- [ ] **Step 3: 檢查所有異動檔案，確認沒有動到 screen1~13**

Run:
```bash
git log --oneline -8
git diff HEAD~6 --stat
```

Expected：`git diff --stat` 只列出 `shared/screenDefs.js`（新增）、`shared/api.js`、`renderer/admin/index.html`、`renderer/wall/index.html`（新增），**不應該出現** `renderer/screen1/index.html` 到 `renderer/screen13/index.html` 任何一個。

- [ ] **Step 4: 推送到 GitHub**

先確認遠端沒有新的變更（本次對話多次發生過遠端有其他 commit 需要 rebase 的狀況，需照這個順序執行）：

```bash
git status
git fetch origin main
git log origin/main..HEAD --oneline   # 確認要推送的 commit 清單
git push
```

若 `git push` 被拒絕（遠端有新 commit），執行：

```bash
git pull --rebase
git push
```

Expected：`git push` 成功，輸出顯示本地分支已推送到 `origin/main`。

---

## 部署後現場驗證（無法在本機模擬，必須在大廳電腦執行）

這不是這份計畫的任務範圍（本機環境只有 1 台螢幕），但完成以上 7 個任務、推送後，必須提醒使用者到大廳電腦執行以下驗收，才能確認整個功能真正可用：

1. 在 admin 頁面「螢幕排版」切到**螢幕牆模式**，下載 `.bat`
2. 在大廳電腦執行該 `.bat`，確認能開出一個涵蓋全部螢幕的無邊框視窗，畫面內容跟排版設定一致
3. 觀察至少 30 分鐘，確認個別畫面（尤其 YouTube 兩格）到期後有自動重新整理，且畫面沒有整體卡死
4. 若跨螢幕顯示有錯位或黑邊，回報給我，這代表「單一視窗跨 6 個螢幕位置」在該台電腦的顯示卡/驅動下有相容性問題，需要另外處理（設計文件已標註這是本次最大技術風險）
