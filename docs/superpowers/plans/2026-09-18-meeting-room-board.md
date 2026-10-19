# 會議室門口顯示系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓社區 5 間會議室門口的直立螢幕（1080×1920）各自顯示本房間即時使用狀態與今日剩餘預約，並全螢幕輪播會議室專用公告；管理後台新增預約 CRUD、房間清單維護、會議室公告編輯，完全脫離舊系統（172.18.0.251）。

**Architecture:** 共用引擎（`shared/roomBoard.js`）+ 5 個極簡入口檔案（`renderer/room-a`~`room-e`），維持「一資料夾對應一實體螢幕」的既有慣例，同時邏輯只維護一份。會議室專用公告沿用既有公告資料形狀，擴充既有的公告編輯視窗支援第三種資料集，不新建編輯介面。

**Tech Stack:** 純 HTML/CSS/JavaScript（無框架、無建置工具），localStorage + GitHub Pages 靜態部署，資料透過 `shared/api.js` 的 `window.api`/`window.ghBackup` 機制存取與同步。

**依據設計文件：** `docs/superpowers/specs/2026-09-18-meeting-room-board-design.md`

---

## 檔案結構總覽

| 檔案 | 動作 | 職責 |
|---|---|---|
| `shared/api.js` | 修改 | `DATA_KEYS` 加入 `meetingAnnouncements`；`meetings.rooms` 預設值改為 `{id,name,capacity}` 物件形狀 |
| `shared/roomBoardStyle.js` | 新增 | 會議室門口螢幕（1080×1920）的公告投影片／狀態投影片版面常數，供 admin 預覽與 roomBoard.js 共用 |
| `shared/roomBoard.js` | 新增 | 門口顯示引擎：讀取預約/公告資料、計算房間狀態、全螢幕輪播（狀態頁穿插公告頁）、即時同步監聽 |
| `renderer/room-a/index.html` ~ `renderer/room-e/index.html` | 新增 | 5 個極簡入口檔案，各自指定 `ROOM_ID` 後載入共用引擎 |
| `renderer/admin/index.html` | 修改 | 補完會議室預約分頁（含房間清單維護、預約 CRUD）；新增會議室公告分頁（擴充既有公告編輯器支援第三種資料集）；公告預覽新增第三種版面模式 |

---

### Task 1: `shared/api.js` — 新增 `meetingAnnouncements` 資料鍵、修正 `meetings.rooms` 形狀

**Files:**
- Modify: `shared/api.js`

- [ ] **Step 1: `DATA_KEYS` 加入 `meetingAnnouncements`**

Old:
```javascript
  const DATA_KEYS = ['announcements', 'announcements_v', 'settings', 'meetings', 'news', 'screenLayout', 'floors'];
```

New:
```javascript
  const DATA_KEYS = ['announcements', 'announcements_v', 'settings', 'meetings', 'news', 'screenLayout', 'floors', 'meetingAnnouncements'];
```

- [ ] **Step 2: `meetings.rooms` 預設值改為物件形狀，並加入 `meetingAnnouncements` 預設值**

Old:
```javascript
    meetings: { rooms: ['會議室A', '會議室B', '會議室C'], bookings: [] },
    news: [],
    screenLayout: [],
    floors: [],
  };
```

New:
```javascript
    meetings: {
      rooms: [
        { id:'A', name:'會議室A', capacity: 40 },
        { id:'B', name:'會議室B', capacity: 20 },
        { id:'C', name:'會議室C', capacity: 20 },
        { id:'D', name:'會議室D', capacity: 10 },
        { id:'E', name:'會議室E', capacity: 10 }
      ],
      bookings: []
    },
    news: [],
    screenLayout: [],
    floors: [],
    meetingAnnouncements: { marquee:'', list: [] },
  };
```

- [ ] **Step 3: 驗證修改正確**

Run:
```bash
node -e "
var window = {}; var localStorage = { getItem:function(){return null;} };
var fs = require('fs');
eval(fs.readFileSync('shared/api.js', 'utf8').replace('window.addEventListener', '(function(){}).call'));
"
```

上面這個指令會因為瀏覽器專用 API（`window.addEventListener` 等）在 Node 環境不存在而不好直接執行，改用更簡單的靜態檢查：

Run:
```bash
grep -n "meetingAnnouncements" shared/api.js
grep -n "id:'A'" shared/api.js
```

Expected：第一個指令印出兩行（`DATA_KEYS` 那行、`DEFAULTS.meetingAnnouncements` 那行）；第二個指令印出 `rooms` 陣列裡 `id:'A'` 那一行，確認房間資料形狀已改成物件。

- [ ] **Step 4: Commit**

```bash
git add shared/api.js
git commit -m "feat: api.js 新增 meetingAnnouncements 資料鍵，meetings.rooms 改為 id/name/capacity 物件形狀"
```

---

### Task 2: `shared/roomBoardStyle.js` — 門口螢幕版面常數（新增）

**Files:**
- Create: `shared/roomBoardStyle.js`

**背景**：門口螢幕是 1080×1920 直式，既有公告預覽（admin 的即時預覽功能）是以 1920×2160（screen13 用）為基準設計字級。這裡用同一套等比例縮放，讓 admin 預覽跟門口螢幕實際呈現的字級/版面比例一致，兩邊共用同一份常數，不用各自維護一份數字。

- [ ] **Step 1: 建立檔案**

```javascript
/* shared/roomBoardStyle.js — 會議室門口螢幕（1080×1920）版面常數
   admin 的公告預覽（renderAnnPreview 的 'room' 模式）與 shared/roomBoard.js
   的實際顯示都讀這份常數，確保「預覽看到的」跟「門口螢幕實際顯示的」一致。 */
(function () {
  'use strict';

  var SCALE = 1080 / 1920; // 相對於既有公告預覽 1920 寬基準的縮放比例

  function r(n) { return Math.round(n * SCALE); }

  window.RoomBoardStyle = {
    CANVAS_W: 1080,
    CANVAS_H: 1920,

    /* 公告投影片版面（依既有 1920 寬直式公告的比例縮放而來） */
    ann: {
      badge: r(44),
      titleWithImg: r(96),
      titleNoImg: r(120),
      bodyWithImg: r(60),
      bodyNoImg: r(72),
      date: r(40),
      padV: r(60),
      padH: r(80),
      gapT: r(48),
      gapB: r(48),
      dateMarginTop: r(56),
      maxWidth: r(1720),
      imgMaxHeight: r(900),
      badgePadV: r(16),
      badgePadH: r(40)
    },

    /* 狀態投影片版面（全新設計，非縮放而來） */
    status: {
      roomName: 80,
      clock: 60,
      stateLabel: 90,
      topic: 56,
      timeRange: 44,
      upcomingHeader: 36,
      upcomingRow: 38
    }
  };
})();
```

- [ ] **Step 2: 驗證常數計算正確**

Run:
```bash
node -e "
var window = {};
var fs = require('fs');
eval(fs.readFileSync('shared/roomBoardStyle.js', 'utf8'));
var s = window.RoomBoardStyle;
console.log('badge:', s.ann.badge);
console.log('titleNoImg:', s.ann.titleNoImg);
console.log('maxWidth:', s.ann.maxWidth);
console.log('status.roomName:', s.status.roomName);
"
```

Expected output:
```
badge: 25
titleNoImg: 68
maxWidth: 968
status.roomName: 80
```

- [ ] **Step 3: Commit**

```bash
git add shared/roomBoardStyle.js
git commit -m "feat: 新增 shared/roomBoardStyle.js 會議室門口螢幕版面常數"
```

---

### Task 3: Admin — 房間清單維護 + 修正既有的 `renderBookings`/`renderStatus`

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：`meetings.rooms` 從純字串陣列改成 `{id,name,capacity}` 物件（Task 1），既有兩處直接把 `room` 當字串印出的程式碼會因此顯示 `[object Object]`，必須一併修正。同時這個任務新增房間清單維護 UI（新增/改名/改容納人數/刪除房間），沿用既有水牌管理分頁（`renderFloors`）的「表格內直接編輯」互動模式。

- [ ] **Step 1: 修正 `renderBookings()` 的房間比對邏輯**

找到這個既有函式（目前用 `b.room === room` 比對純字串）：

Old:
```javascript
function renderBookings() {
  var cards=$('bookingCards'); if(!cards) return;
  var date=$('dateFilter').value||today();
  var html='', rooms=meetings.rooms||[], bookings=meetings.bookings||[];
  for(var i=0;i<rooms.length;i++){
    var room=rooms[i];
    var rb=bookings.filter(function(b){return b.room===room&&b.date===date;});
    if(rb.length>0){
      html+='<div class="card"><div class="card-title">🏢 '+esc(room)+'</div>';
      for(var j=0;j<rb.length;j++){
        var b=rb[j];
        html+='<div class="booking-item"><div class="booking-time">'+b.startTime+' - '+b.endTime+'</div>'+
              '<div class="booking-info"><div class="booking-topic">'+esc(b.topic)+'</div><div class="booking-person">👤 '+esc(b.person)+'</div></div></div>';
      }
      html+='</div>';
    }
  }
  cards.innerHTML=html||'<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text2)">該日無預約行程</div>';
}
```

New（改用 `roomId` 比對，卡片一律顯示、無預約時顯示「本日無預約」而非整張卡片消失，並加上編輯/刪除按鈕）：
```javascript
function renderBookings() {
  var cards=$('bookingCards'); if(!cards) return;
  var date=$('dateFilter').value||today();
  var html='', rooms=meetings.rooms||[], bookings=meetings.bookings||[];
  for(var i=0;i<rooms.length;i++){
    var room=rooms[i];
    var rb=bookings.filter(function(b){return b.roomId===room.id&&b.date===date;})
                    .sort(function(a,b){return a.startTime<b.startTime?-1:1;});
    html+='<div class="card"><div class="card-title">🏢 '+esc(room.name)+'（'+(room.capacity||0)+'人）</div>';
    if(rb.length===0){
      html+='<div style="padding:16px;color:var(--text2);font-size:13px">本日無預約</div>';
    } else {
      for(var j=0;j<rb.length;j++){
        var b=rb[j];
        html+='<div class="booking-item"><div class="booking-time">'+esc(b.startTime)+' - '+esc(b.endTime)+'</div>'+
              '<div class="booking-info"><div class="booking-topic">'+esc(b.topic)+'</div><div class="booking-person">👤 '+esc(b.person)+'</div></div>'+
              '<div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" onclick="openBookModal('+b.id+')">編輯</button>'+
              '<button class="btn btn-danger btn-sm" onclick="deleteBooking('+b.id+')">刪除</button></div></div>';
      }
    }
    html+='</div>';
  }
  cards.innerHTML=html;
}
```

（`openBookModal`／`deleteBooking` 在 Task 4 才會實作，這一步先讓 `renderBookings()` 呼叫它們，Task 4 完成前點按鈕會報錯是預期中的暫時狀態，Task 4 結束後才算完整可用。）

- [ ] **Step 2: 修正 `renderStatus()` 的房間名稱顯示**

Old:
```javascript
function renderStatus() {
  var grid=$('statusGrid'); if(!grid) return;
  var html='', rooms=meetings.rooms||[];
  for(var i=0;i<rooms.length;i++) html+='<div class="room-row"><div class="room-name">🏢 '+esc(rooms[i])+'</div></div>';
  grid.innerHTML=html||'尚無資料';
}
```

New：
```javascript
function renderStatus() {
  var grid=$('statusGrid'); if(!grid) return;
  var html='', rooms=meetings.rooms||[];
  for(var i=0;i<rooms.length;i++) html+='<div class="room-row"><div class="room-name">🏢 '+esc(rooms[i].name)+'</div></div>';
  grid.innerHTML=html||'尚無資料';
}
```

- [ ] **Step 3: 在會議室預約分頁加入房間清單維護區塊**

找到既有的 `tab-meetings` HTML（目前只有日期選擇器、新增預約按鈕、`bookingCards` 容器）：

Old:
```html
    <!-- Meetings (hidden placeholder) -->
    <div id="tab-meetings" style="display:none">
      <div class="page-header">
        <div class="page-title">會議室<span>預約</span></div>
        <div style="display:flex;gap:12px;align-items:center">
          <input type="date" id="dateFilter" onchange="renderBookings()" style="width:160px">
          <button class="btn btn-primary" onclick="openBookModal(0)">＋ 新增預約</button>
        </div>
      </div>
      <div id="bookingCards"></div>
    </div>
```

New（改掉 `<!-- hidden placeholder -->` 註解，因為這個分頁這次要真正上線了；加入房間清單維護卡片）：
```html
    <!-- Meetings -->
    <div id="tab-meetings" style="display:none">
      <div class="page-header">
        <div class="page-title">會議室<span>預約</span></div>
        <div style="display:flex;gap:12px;align-items:center">
          <input type="date" id="dateFilter" onchange="renderBookings()" style="width:160px">
          <button class="btn btn-primary" onclick="openBookModal(0)">＋ 新增預約</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🏢 房間清單</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th style="width:100px">代碼</th><th>房間名稱</th><th style="width:140px">容納人數</th><th style="width:90px">操作</th></tr></thead>
            <tbody id="roomListBody"></tbody>
          </table>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px">
          <button class="btn btn-ghost" onclick="addRoomRow()">＋ 新增房間</button>
          <button class="btn btn-primary" onclick="saveRoomList()">💾 儲存房間清單</button>
        </div>
      </div>
      <div id="bookingCards"></div>
    </div>
```

- [ ] **Step 4: 加入房間清單維護的 JavaScript 函式**

在既有 `renderBookings()` 函式**之前**（同一個 `<script>` 區塊內）加入以下新函式：

```javascript
/* ══════════════════════════════════════════════════════════════
   房間清單維護（meetings.rooms）
   ══════════════════════════════════════════════════════════════ */
function nextRoomId() {
  var used = (meetings.rooms||[]).map(function(r){ return r.id; });
  var code = 65; // 'A'
  while (used.indexOf(String.fromCharCode(code)) > -1 && code < 91) code++;
  return code < 91 ? String.fromCharCode(code) : ('R' + Date.now());
}

function renderRoomList() {
  var body = $('roomListBody'); if (!body) return;
  var rooms = meetings.rooms || [];
  var html = '';
  rooms.forEach(function(room, i) {
    html += '<tr>'+
      '<td style="text-align:center;font-weight:700;color:var(--accent)">'+esc(room.id)+'</td>'+
      '<td><input type="text" value="'+esc(room.name)+'" oninput="updRoom('+i+',\'name\',this.value)" style="width:100%"></td>'+
      '<td><input type="number" min="0" value="'+(room.capacity||0)+'" oninput="updRoom('+i+',\'capacity\',parseInt(this.value)||0)" style="width:100%;text-align:center"></td>'+
      '<td><button class="btn btn-danger btn-sm" onclick="removeRoomRow('+i+')">✕</button></td>'+
      '</tr>';
  });
  body.innerHTML = html || '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--text2)">尚無房間</td></tr>';
}

function updRoom(i, field, val) {
  if (!meetings.rooms[i]) return;
  meetings.rooms[i][field] = val;
}

function addRoomRow() {
  meetings.rooms = meetings.rooms || [];
  meetings.rooms.push({ id: nextRoomId(), name: '新會議室', capacity: 10 });
  renderRoomList();
}

function removeRoomRow(i) {
  var room = meetings.rooms[i];
  if (!room) return;
  var hasBookings = (meetings.bookings||[]).some(function(b){ return b.roomId === room.id; });
  if (hasBookings && !confirm('「'+room.name+'」還有預約紀錄，確定要刪除這個房間嗎？（預約紀錄不會自動清除，但門口螢幕會顯示「找不到房間」）')) return;
  meetings.rooms.splice(i, 1);
  renderRoomList();
}

function saveRoomList() {
  window.api.save('meetings', meetings).then(function(){
    toast('房間清單已儲存');
    renderRoomList();
    renderBookings();
    triggerBackup();
  });
}
```

- [ ] **Step 5: `showTab('meetings')` 時一併渲染房間清單**

找到 `showTab()` 函式：

Old:
```javascript
function showTab(name) {
  ['announcements','annv','meetings','status','news','settings','layout','floors'].forEach(function(t){
    var p=$('tab-'+t), n=$('nav-'+t);
    if(p) p.style.display=(t===name?'':'none');
    if(n) n.classList.toggle('active', t===name);
  });
  if(name==='meetings') renderBookings();
  if(name==='status')   renderStatus();
  if(name==='layout')   initLayoutEditor();
  if(name==='annv')     renderAnnouncementsV();
  if(name==='floors')   initFloorEditor();
}
```

New：
```javascript
function showTab(name) {
  ['announcements','annv','meetings','status','news','settings','layout','floors'].forEach(function(t){
    var p=$('tab-'+t), n=$('nav-'+t);
    if(p) p.style.display=(t===name?'':'none');
    if(n) n.classList.toggle('active', t===name);
  });
  if(name==='meetings') { renderRoomList(); renderBookings(); }
  if(name==='status')   renderStatus();
  if(name==='layout')   initLayoutEditor();
  if(name==='annv')     renderAnnouncementsV();
  if(name==='floors')   initFloorEditor();
}
```

- [ ] **Step 6: 用 preview 工具驗證房間清單 CRUD**

啟動預覽伺服器並開啟 admin 頁面、登入：

```
mcp__Claude_Browser__preview_start({ name: "預覽伺服器" })
```

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  location.reload();
})()
```

重新整理後：

```javascript
(function(){
  showTab('meetings');
  var before = meetings.rooms.length;
  addRoomRow();
  var afterAdd = meetings.rooms.length;
  var newRoom = meetings.rooms[meetings.rooms.length-1];
  updRoom(meetings.rooms.length-1, 'name', '測試房間');
  var bodyHtml = document.getElementById('roomListBody').innerHTML;
  return {
    before: before, afterAdd: afterAdd,
    newRoomHasId: !!newRoom.id,
    nameUpdated: meetings.rooms[meetings.rooms.length-1].name === '測試房間',
    rowRendered: /新會議室|測試房間/.test(bodyHtml)
  };
})()
```

Expected：`afterAdd` 是 `before + 1`、`newRoomHasId` 為 `true`、`nameUpdated` 為 `true`、`rowRendered` 為 `true`（表示 `renderRoomList()` 呼叫後畫面有更新，`updRoom` 直接改記憶體不會自動重畫，這是預期行為，實際使用者是先打完字才按儲存，不需要每個字元都重畫表格）。

接著測試刪除跟儲存：

```javascript
(function(){
  var idxToRemove = meetings.rooms.length - 1;
  var origConfirm = window.confirm;
  window.confirm = function(){ return true; };
  removeRoomRow(idxToRemove);
  window.confirm = origConfirm;
  var afterRemove = meetings.rooms.length;

  saveRoomList();
  return new Promise(function(resolve){
    setTimeout(function(){
      resolve({
        afterRemove: afterRemove,
        savedToLocalStorage: JSON.parse(localStorage.getItem('bbs_meetings')).rooms.length === afterRemove
      });
    }, 300);
  });
})()
```

Expected：`afterRemove` 比新增前少 1（等於原本的 `before`），`savedToLocalStorage` 為 `true`。

- [ ] **Step 7: 確認沒有 console 錯誤**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

Expected：無錯誤。

- [ ] **Step 8: 清除測試資料**

```javascript
(function(){
  localStorage.removeItem('bbs_meetings');
  return 'cleaned';
})()
```

- [ ] **Step 9: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 會議室預約分頁新增房間清單維護，修正 renderBookings/renderStatus 適配新的房間資料形狀"
```

---

### Task 4: Admin — 預約 CRUD（`openBookModal`／儲存／刪除／重疊檢查）+ 側邊選單

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：`renderBookings()` 裡的「＋ 新增預約」按鈕呼叫 `openBookModal(0)`，這個函式目前完全不存在。這個任務要把它實作出來，並補上側邊選單目前完全沒有的入口。

- [ ] **Step 1: 側邊選單加入「🏢 會議室預約」**

找到既有側邊選單（在「🏢 水牌管理」跟「🖥️ 螢幕排版」中間插入）：

Old:
```html
    <div class="nav-item" id="nav-floors" onclick="showTab('floors')">
      <span class="nav-icon">🏢</span> 水牌管理
    </div>
    <div class="nav-item" id="nav-layout" onclick="showTab('layout')">
      <span class="nav-icon">🖥️</span> 螢幕排版
    </div>
```

New：
```html
    <div class="nav-item" id="nav-floors" onclick="showTab('floors')">
      <span class="nav-icon">🏢</span> 水牌管理
    </div>
    <div class="nav-item" id="nav-meetings" onclick="showTab('meetings')">
      <span class="nav-icon">📅</span> 會議室預約
    </div>
    <div class="nav-item" id="nav-layout" onclick="showTab('layout')">
      <span class="nav-icon">🖥️</span> 螢幕排版
    </div>
```

- [ ] **Step 2: 加入 `openBookModal`／`saveBooking`／`deleteBooking`（含重疊檢查）**

在 Task 3 加入的房間清單維護函式**之後**（同一個 `<script>` 區塊內）加入：

```javascript
/* ══════════════════════════════════════════════════════════════
   預約 CRUD（meetings.bookings）
   ══════════════════════════════════════════════════════════════ */
function bookingOverlaps(a, b) {
  return a.roomId === b.roomId && a.date === b.date &&
         a.startTime < b.endTime && a.endTime > b.startTime;
}

function openBookModal(id) {
  var b = (meetings.bookings||[]).find(function(x){ return x.id === id; }) || {};
  var isNew = !b.id;
  var rooms = meetings.rooms || [];
  var defaultDate = ($('dateFilter')||{}).value || today();

  $('modalTitle').innerText = isNew ? '新增預約' : '編輯預約';
  $('modalBody').innerHTML =
    '<div class="form-group"><label>會議室</label><select id="bkRoomId">' +
      rooms.map(function(r){ return '<option value="'+esc(r.id)+'"'+(b.roomId===r.id?' selected':'')+'>'+esc(r.name)+'</option>'; }).join('') +
    '</select></div>' +
    '<div class="form-group"><label>日期</label><input type="date" id="bkDate" value="'+esc(b.date||defaultDate)+'"></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>開始時間</label><input type="time" id="bkStartTime" value="'+esc(b.startTime||'09:00')+'"></div>' +
      '<div class="form-group"><label>結束時間</label><input type="time" id="bkEndTime" value="'+esc(b.endTime||'10:00')+'"></div>' +
    '</div>' +
    '<div class="form-group"><label>會議主旨</label><input type="text" id="bkTopic" value="'+esc(b.topic||'')+'"></div>' +
    '<div class="form-group"><label>聯絡人</label><input type="text" id="bkPerson" value="'+esc(b.person||'')+'"></div>';

  $('modalFooter').innerHTML =
    (isNew ? '' : '<button class="btn btn-warning" onclick="deleteBooking('+id+')">刪除</button>') +
    '<div style="flex:1"></div>' +
    '<button class="btn btn-ghost" onclick="closeModal()">取消</button>' +
    '<button class="btn btn-primary" onclick="saveBooking('+(id||0)+')">儲存</button>';
  $('modalBackdrop').classList.add('open');
}

function saveBooking(id) {
  var updated = {
    id: id || new Date().getTime(),
    roomId: $('bkRoomId').value,
    date: $('bkDate').value,
    startTime: $('bkStartTime').value,
    endTime: $('bkEndTime').value,
    topic: $('bkTopic').value,
    person: $('bkPerson').value
  };
  if (!updated.date || !updated.startTime || !updated.endTime) {
    toast('日期與時間為必填', 'error'); return;
  }
  if (updated.startTime >= updated.endTime) {
    toast('結束時間必須晚於開始時間', 'error'); return;
  }
  var list = meetings.bookings || [];
  var conflict = list.some(function(b){ return b.id !== updated.id && bookingOverlaps(b, updated); });
  if (conflict) {
    toast('這個時段跟同一間會議室的其他預約重疊了', 'error'); return;
  }
  var idx = list.findIndex(function(x){ return x.id === updated.id; });
  if (idx > -1) list[idx] = updated; else list.unshift(updated);
  meetings.bookings = list;
  window.api.save('meetings', meetings).then(function(){
    toast('預約已儲存');
    renderBookings();
    closeModal();
    triggerBackup();
  });
}

function deleteBooking(id) {
  if (!confirm('確定要刪除這筆預約嗎？')) return;
  meetings.bookings = (meetings.bookings||[]).filter(function(x){ return x.id !== id; });
  window.api.save('meetings', meetings).then(function(){
    toast('預約已刪除', 'warning');
    renderBookings();
    closeModal();
    triggerBackup();
  });
}
```

- [ ] **Step 3: 用 preview 工具驗證新增預約與重疊檢查**

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  showTab('meetings');
  meetings.rooms = [{id:'A',name:'會議室A',capacity:40}];
  meetings.bookings = [];
  renderRoomList(); renderBookings();

  openBookModal(0);
  document.getElementById('bkDate').value = '2026-09-20';
  document.getElementById('bkStartTime').value = '14:00';
  document.getElementById('bkEndTime').value = '15:00';
  document.getElementById('bkTopic').value = '第一筆會議';
  document.getElementById('bkPerson').value = '王小姐';
  saveBooking(0);

  return new Promise(function(resolve){
    setTimeout(function(){
      resolve({
        bookingCount: meetings.bookings.length,
        firstBooking: meetings.bookings[0]
      });
    }, 200);
  });
})()
```

Expected：`bookingCount` 為 `1`，`firstBooking` 包含剛剛填的資料且 `roomId` 為 `'A'`。

接著測試重疊擋下：

```javascript
(function(){
  var toastMsg = null;
  var origToast = window.toast;
  window.toast = function(msg, type){ toastMsg = {msg:msg, type:type}; };

  openBookModal(0);
  document.getElementById('bkDate').value = '2026-09-20';
  document.getElementById('bkStartTime').value = '14:30'; // 跟已存在的 14:00-15:00 重疊
  document.getElementById('bkEndTime').value = '15:30';
  document.getElementById('bkTopic').value = '重疊測試';
  saveBooking(0); // id=0 代表新增

  window.toast = origToast;
  return { blockedCorrectly: toastMsg && toastMsg.type==='error', bookingCountStillOne: meetings.bookings.length === 1 };
})()
```

Expected：`blockedCorrectly` 為 `true`，`bookingCountStillOne` 為 `true`（重疊的那筆沒有被存進去）。

再測試不重疊的時段可以正常新增：

```javascript
(function(){
  openBookModal(0);
  document.getElementById('bkDate').value = '2026-09-20';
  document.getElementById('bkStartTime').value = '16:00'; // 跟 14:00-15:00 不重疊
  document.getElementById('bkEndTime').value = '17:00';
  document.getElementById('bkTopic').value = '第二筆會議';
  document.getElementById('bkPerson').value = '陳先生';
  saveBooking(0);
  return new Promise(function(resolve){
    setTimeout(function(){ resolve({ bookingCount: meetings.bookings.length }); }, 200);
  });
})()
```

Expected：`bookingCount` 為 `2`。

最後測試刪除：

```javascript
(function(){
  var idToDelete = meetings.bookings[0].id;
  var origConfirm = window.confirm;
  window.confirm = function(){ return true; };
  deleteBooking(idToDelete);
  window.confirm = origConfirm;
  return new Promise(function(resolve){
    setTimeout(function(){ resolve({ bookingCount: meetings.bookings.length }); }, 200);
  });
})()
```

Expected：`bookingCount` 為 `1`。

- [ ] **Step 4: 確認無 console 錯誤，清除測試資料**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

```javascript
(function(){ localStorage.removeItem('bbs_meetings'); return 'cleaned'; })()
```

- [ ] **Step 5: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 會議室預約新增/編輯/刪除功能，含同房間同時段重疊檢查；側邊選單加入入口"
```

---

### Task 5: Admin — 會議室公告分頁（擴充既有公告編輯器支援第三種資料集）

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：既有公告編輯器（`openAnnModal`/`saveAnn`/`deleteAnn`/`moveAnn`/`copyAnnToOther`）目前用二選一的三元運算子判斷 `_annDataset` 是 `'announcements'` 還是 `'announcements_v'`，這個任務要把它擴充成支援第三種值 `'meetingAnnouncements'`。同時把目前指向外部系統的「會議室公告 ↗」連結，換成指向這個新分頁（設計文件已確定完全脫離舊系統）。

- [ ] **Step 1: 新增 `meetingAnnouncements` 模組變數**

找到既有模組變數宣告：

Old:
```javascript
var announcements  = { marquee:'', list:[] };
var announcementsV = { marquee:'', list:[] };
var meetings       = { rooms:[], bookings:[] };
```

New：
```javascript
var announcements  = { marquee:'', list:[] };
var announcementsV = { marquee:'', list:[] };
var meetings       = { rooms:[], bookings:[] };
var meetingAnnouncements = { marquee:'', list:[] };
```

- [ ] **Step 2: 新增 `annDataFor()` 輔助函式，取代所有二選一三元運算子**

在 `openAnnModal` 函式**之前**加入：

```javascript
/* 依 _annDataset 取得對應的公告資料物件，支援三種公告資料集 */
function annDataFor(dataset) {
  if (dataset === 'announcements_v') return announcementsV;
  if (dataset === 'meetingAnnouncements') return meetingAnnouncements;
  return announcements;
}
```

- [ ] **Step 3: `openAnnModal` 改用 `annDataFor()`，公告類型判斷擴充第三種**

找到：
```javascript
function openAnnModal(id, dataset) {
  _annDataset = dataset || 'announcements';
  var annData = _annDataset === 'announcements_v' ? announcementsV : announcements;
  var a=(annData.list||[]).find(function(x){return x.id===id;})||{};
  var isNew=!a.id, alwaysValid=a.alwaysValid!==false;
  var isV = _annDataset === 'announcements_v';
  $('modalTitle').innerText=isNew?(isV?'新增直立公告':'新增公告'):(isV?'編輯直立公告':'編輯公告');
```

改為：
```javascript
function openAnnModal(id, dataset) {
  _annDataset = dataset || 'announcements';
  var annData = annDataFor(_annDataset);
  var a=(annData.list||[]).find(function(x){return x.id===id;})||{};
  var isNew=!a.id, alwaysValid=a.alwaysValid!==false;
  var isV = _annDataset === 'announcements_v';
  var isRoom = _annDataset === 'meetingAnnouncements';
  var titleMap = { announcements:'公告', announcements_v:'直立公告', meetingAnnouncements:'會議室公告' };
  $('modalTitle').innerText=(isNew?'新增':'編輯')+titleMap[_annDataset];
```

- [ ] **Step 4: 複製按鈕只在原本兩種資料集之間顯示（會議室公告不提供複製）**

找到 `openAnnModal` 裡組 `modalFooter` 的部分：

Old:
```javascript
  $('modalFooter').innerHTML=
    (isNew?'':'<button class="btn btn-warning" onclick="deleteAnn('+id+')">刪除</button>')+
    '<div style="flex:1"></div>'+
    '<button class="btn btn-ghost" onclick="copyAnnToOther()" title="把標題與內容複製一份到另一個公告欄，之後兩邊可各自調整版面">⧉ 複製到'+(isV?'一般公告':'直立公告')+'</button>'+
    '<button class="btn btn-ghost" onclick="closeModal()">取消</button>'+
    '<button class="btn btn-primary" id="annSaveBtn" onclick="saveAnn('+(id||0)+')">儲存</button>';
```

New（會議室公告與大廳公告物理呈現差異太大，不提供互相複製，`isRoom` 時整段複製按鈕不出現）：
```javascript
  $('modalFooter').innerHTML=
    (isNew?'':'<button class="btn btn-warning" onclick="deleteAnn('+id+')">刪除</button>')+
    '<div style="flex:1"></div>'+
    (isRoom ? '' : '<button class="btn btn-ghost" onclick="copyAnnToOther()" title="把標題與內容複製一份到另一個公告欄，之後兩邊可各自調整版面">⧉ 複製到'+(isV?'一般公告':'直立公告')+'</button>')+
    '<button class="btn btn-ghost" onclick="closeModal()">取消</button>'+
    '<button class="btn btn-primary" id="annSaveBtn" onclick="saveAnn('+(id||0)+')">儲存</button>';
```

- [ ] **Step 5: `saveAnn`／`deleteAnn` 改用 `annDataFor()`，重新渲染邏輯擴充第三種**

Old:
```javascript
function saveAnn(id) {
  if (_annImageUploading) { toast('圖片還在上傳中，請稍候再儲存', 'error'); return; }
  var annData = _annDataset === 'announcements_v' ? announcementsV : announcements;
  var list=annData.list||[];
  var editor=$('annContent');
  var updated={
    id:id||new Date().getTime(),
    title:$('annTitle').value, type:$('annType').value,
    duration: Math.max(3, parseInt(($('annDuration')||{}).value)||7),
    content: editor ? editor.innerHTML : '',
    imageUrl: ($('annImageUrl')||{}).value ? $('annImageUrl').value.trim() : '',
    alwaysValid:$('annAlwaysValid').checked,
    startDate:$('annStartDate').value, startTime:$('annStartTime').value,
    endDate:$('annEndDate').value,   endTime:$('annEndTime').value,
    date:today()
  };
  if(id){ var idx=list.findIndex(function(x){return x.id===id;}); if(idx>-1) list[idx]=updated; }
  else { list.unshift(updated); }
  annData.list=list;
  window.api.save(_annDataset, annData).then(function(){
    toast('公告已儲存');
    if(_annDataset==='announcements_v') renderAnnouncementsV(); else renderAnnouncements();
    closeModal(); triggerBackup();
  });
}

function deleteAnn(id) {
  if(!confirm('確定要刪除這則公告嗎？')) return;
  var annData = _annDataset === 'announcements_v' ? announcementsV : announcements;
  annData.list=(annData.list||[]).filter(function(x){return x.id!==id;});
  window.api.save(_annDataset, annData).then(function(){
    toast('公告已刪除','warning');
    if(_annDataset==='announcements_v') renderAnnouncementsV(); else renderAnnouncements();
    closeModal(); triggerBackup();
  });
}
```

New：
```javascript
function renderAnnByDataset(dataset) {
  if (dataset === 'announcements_v') renderAnnouncementsV();
  else if (dataset === 'meetingAnnouncements') renderMeetingAnnouncements();
  else renderAnnouncements();
}

function saveAnn(id) {
  if (_annImageUploading) { toast('圖片還在上傳中，請稍候再儲存', 'error'); return; }
  var annData = annDataFor(_annDataset);
  var list=annData.list||[];
  var editor=$('annContent');
  var updated={
    id:id||new Date().getTime(),
    title:$('annTitle').value, type:$('annType').value,
    duration: Math.max(3, parseInt(($('annDuration')||{}).value)||7),
    content: editor ? editor.innerHTML : '',
    imageUrl: ($('annImageUrl')||{}).value ? $('annImageUrl').value.trim() : '',
    alwaysValid:$('annAlwaysValid').checked,
    startDate:$('annStartDate').value, startTime:$('annStartTime').value,
    endDate:$('annEndDate').value,   endTime:$('annEndTime').value,
    date:today()
  };
  if(id){ var idx=list.findIndex(function(x){return x.id===id;}); if(idx>-1) list[idx]=updated; }
  else { list.unshift(updated); }
  annData.list=list;
  window.api.save(_annDataset, annData).then(function(){
    toast('公告已儲存');
    renderAnnByDataset(_annDataset);
    closeModal(); triggerBackup();
  });
}

function deleteAnn(id) {
  if(!confirm('確定要刪除這則公告嗎？')) return;
  var annData = annDataFor(_annDataset);
  annData.list=(annData.list||[]).filter(function(x){return x.id!==id;});
  window.api.save(_annDataset, annData).then(function(){
    toast('公告已刪除','warning');
    renderAnnByDataset(_annDataset);
    closeModal(); triggerBackup();
  });
}
```

- [ ] **Step 6: `moveAnn` 改用 `annDataFor()` 與 `renderAnnByDataset()`**

Old:
```javascript
function moveAnn(id, dir, dataset) {
  dataset = dataset || 'announcements';
  var annData = dataset === 'announcements_v' ? announcementsV : announcements;
  var list = annData.list || [];
  var idx = list.findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  var tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp;
  annData.list = list;
  window.api.save(dataset, annData).then(function(){
    if(dataset==='announcements_v') renderAnnouncementsV(); else renderAnnouncements();
    triggerBackup();
  });
}
```

New：
```javascript
function moveAnn(id, dir, dataset) {
  dataset = dataset || 'announcements';
  var annData = annDataFor(dataset);
  var list = annData.list || [];
  var idx = list.findIndex(function(x){ return x.id === id; });
  if (idx < 0) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  var tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp;
  annData.list = list;
  window.api.save(dataset, annData).then(function(){
    renderAnnByDataset(dataset);
    triggerBackup();
  });
}
```

- [ ] **Step 7: 新增 `renderMeetingAnnouncements()`（比照 `renderAnnouncementsV()`）**

在 `renderAnnouncementsV()` 函式**之後**加入：

```javascript
function renderMeetingAnnouncements() {
  var body=$('meetingAnnBody'); if(!body) return;
  if($('marqueeMeetingInput')) $('marqueeMeetingInput').value=meetingAnnouncements.marquee||'';
  var html='', list=meetingAnnouncements.list||[];
  for(var i=0;i<list.length;i++){
    var a=list[i];
    var sc=isAnnActive(a);
    var sh=sc===1?'<span style="color:#10b981;font-weight:700">顯示中</span>':sc===0?'<span style="color:#fbbf24;font-weight:700">待發布</span>':'<span style="color:#f43f5e;font-weight:700">已結束</span>';
    var ds=(a.alwaysValid!==false)?'常駐':((a.startDate||'')+' ~ '+(a.endDate||''));
    var durBadge='<span style="color:var(--text2);font-size:12px;margin-left:6px">⏱ '+(a.duration||7)+'s</span>';
    var upBtn = i > 0
      ? '<button class="btn btn-ghost btn-sm" onclick="moveAnn('+a.id+',-1,\'meetingAnnouncements\')" style="padding:4px 8px;min-width:30px">▲</button>'
      : '<button class="btn btn-ghost btn-sm" disabled style="padding:4px 8px;min-width:30px;opacity:0.15;cursor:default">▲</button>';
    var dnBtn = i < list.length-1
      ? '<button class="btn btn-ghost btn-sm" onclick="moveAnn('+a.id+',1,\'meetingAnnouncements\')" style="padding:4px 8px;min-width:30px">▼</button>'
      : '<button class="btn btn-ghost btn-sm" disabled style="padding:4px 8px;min-width:30px;opacity:0.15;cursor:default">▼</button>';
    html+='<tr><td>'+esc(a.title)+durBadge+'</td><td><span class="tag tag-'+(a.type||'general')+'">'+esc(a.type||'一般')+'</span></td><td>'+ds+'</td><td>'+sh+'</td>'+
      '<td style="white-space:nowrap">'+upBtn+' '+dnBtn+'&nbsp; <button class="btn btn-ghost btn-sm" onclick="openAnnModal('+a.id+',\'meetingAnnouncements\')">編輯</button></td></tr>';
  }
  body.innerHTML=html||'<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text2)">尚無會議室公告</td></tr>';
}

function saveMarqueeMeeting() {
  meetingAnnouncements.marquee = ($('marqueeMeetingInput')||{}).value || '';
  window.api.save('meetingAnnouncements', meetingAnnouncements).then(function(){
    toast('跑馬燈已存');
    triggerBackup();
  });
}
```

- [ ] **Step 8: 新增分頁 HTML（比照 `tab-annv`），並把外部連結換成內部分頁入口**

找到既有的「公告管理（直立型）」分頁**之後**、「Meetings」分頁**之前**插入新分頁：

Old（`tab-annv` 結尾，緊接著就是 `<!-- Meetings -->`）：
```html
    <!-- Announcements V (直立型) -->
    <div id="tab-annv" style="display:none">
      <div class="page-header">
        <div class="page-title">公告<span>（直立型）</span></div>
        <button class="btn btn-primary" onclick="openAnnModal(0,'announcements_v')">＋ 新增公告</button>
      </div>
      <div class="card">
        <div class="card-title">🎯 跑馬燈內容（直立螢幕）</div>
        <div class="input-group">
          <input type="text" id="marqueeVInput" placeholder="輸入跑馬燈文字...">
          <button class="btn btn-warning" onclick="saveMarqueeV()">儲存</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📋 直立版公告列表</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>標題</th><th>類型</th><th>日期</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody id="annVBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Meetings -->
```

New：
```html
    <!-- Announcements V (直立型) -->
    <div id="tab-annv" style="display:none">
      <div class="page-header">
        <div class="page-title">公告<span>（直立型）</span></div>
        <button class="btn btn-primary" onclick="openAnnModal(0,'announcements_v')">＋ 新增公告</button>
      </div>
      <div class="card">
        <div class="card-title">🎯 跑馬燈內容（直立螢幕）</div>
        <div class="input-group">
          <input type="text" id="marqueeVInput" placeholder="輸入跑馬燈文字...">
          <button class="btn btn-warning" onclick="saveMarqueeV()">儲存</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📋 直立版公告列表</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>標題</th><th>類型</th><th>日期</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody id="annVBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Meeting Room Announcements -->
    <div id="tab-meetingann" style="display:none">
      <div class="page-header">
        <div class="page-title">會議室<span>公告</span></div>
        <button class="btn btn-primary" onclick="openAnnModal(0,'meetingAnnouncements')">＋ 新增公告</button>
      </div>
      <div class="card">
        <div class="card-title">🎯 跑馬燈內容（會議室門口螢幕，目前未使用，保留欄位供未來擴充）</div>
        <div class="input-group">
          <input type="text" id="marqueeMeetingInput" placeholder="輸入跑馬燈文字...">
          <button class="btn btn-warning" onclick="saveMarqueeMeeting()">儲存</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📋 會議室公告列表</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>標題</th><th>類型</th><th>日期</th><th>狀態</th><th>操作</th></tr></thead>
            <tbody id="meetingAnnBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Meetings -->
```

找到側邊選單裡指向外部系統的連結：

Old:
```html
    <div class="nav-item" onclick="window.open('http://172.18.0.251/cc71/rwd/view/reservation/board_editor.html','_blank','noopener')" title="在新分頁開啟會議室公告編輯系統（內部網段，需與該系統同一網路才能連上）">
      <span class="nav-icon">📅</span> 會議室公告 ↗
    </div>
```

New（改成指向新分頁，拿掉外部連結與 `↗` 符號）：
```html
    <div class="nav-item" id="nav-meetingann" onclick="showTab('meetingann')">
      <span class="nav-icon">📋</span> 會議室公告
    </div>
```

- [ ] **Step 9: `showTab()` 加入 `meetingann`**

Old:
```javascript
function showTab(name) {
  ['announcements','annv','meetings','status','news','settings','layout','floors'].forEach(function(t){
    var p=$('tab-'+t), n=$('nav-'+t);
    if(p) p.style.display=(t===name?'':'none');
    if(n) n.classList.toggle('active', t===name);
  });
  if(name==='meetings') { renderRoomList(); renderBookings(); }
  if(name==='status')   renderStatus();
  if(name==='layout')   initLayoutEditor();
  if(name==='annv')     renderAnnouncementsV();
  if(name==='floors')   initFloorEditor();
}
```

New：
```javascript
function showTab(name) {
  ['announcements','annv','meetingann','meetings','status','news','settings','layout','floors'].forEach(function(t){
    var p=$('tab-'+t), n=$('nav-'+t);
    if(p) p.style.display=(t===name?'':'none');
    if(n) n.classList.toggle('active', t===name);
  });
  if(name==='meetings')    { renderRoomList(); renderBookings(); }
  if(name==='status')      renderStatus();
  if(name==='layout')      initLayoutEditor();
  if(name==='annv')        renderAnnouncementsV();
  if(name==='meetingann')  renderMeetingAnnouncements();
  if(name==='floors')      initFloorEditor();
}
```

- [ ] **Step 10: `loadAll()` 一併讀取 `meetingAnnouncements`**

Old:
```javascript
function loadAll() {
  return Promise.all([safeGet('announcements'),safeGet('announcements_v'),safeGet('meetings'),safeGet('settings')])
    .then(function(res){
      if(res[0]) announcements=res[0];
      if(res[1]) announcementsV=res[1];
      if(res[2]) meetings=res[2];
      if(res[3]) settings=res[3];
      // 把 api.js 合併後的 settings（含新視窗）存回 localStorage，確保視窗清單是最新的
      window.api.save('settings', settings);
      if($('topCommunity')) $('topCommunity').innerText=settings.communityName||'社區管理系統';
      renderAnnouncements();
      loadSettingsForm();
      if($('dateFilter')&&!$('dateFilter').value) $('dateFilter').value=today();
    });
}
```

New：
```javascript
function loadAll() {
  return Promise.all([safeGet('announcements'),safeGet('announcements_v'),safeGet('meetings'),safeGet('settings'),safeGet('meetingAnnouncements')])
    .then(function(res){
      if(res[0]) announcements=res[0];
      if(res[1]) announcementsV=res[1];
      if(res[2]) meetings=res[2];
      if(res[3]) settings=res[3];
      if(res[4]) meetingAnnouncements=res[4];
      // 把 api.js 合併後的 settings（含新視窗）存回 localStorage，確保視窗清單是最新的
      window.api.save('settings', settings);
      if($('topCommunity')) $('topCommunity').innerText=settings.communityName||'社區管理系統';
      renderAnnouncements();
      loadSettingsForm();
      if($('dateFilter')&&!$('dateFilter').value) $('dateFilter').value=today();
    });
}
```

- [ ] **Step 11: 補上背景同步監聽**

找到既有的 `window.api.on('announcements_v:updated', ...)` 那一行，在它之後加入新的一行：

Old:
```javascript
  window.api.on('announcements:updated', function(d){ announcements = d; renderAnnouncements(); });
  window.api.on('announcements_v:updated', function(d){ announcementsV = d; renderAnnouncementsV(); });
  window.api.on('meetings:updated', function(d){ meetings = d; renderBookings(); });
```

New：
```javascript
  window.api.on('announcements:updated', function(d){ announcements = d; renderAnnouncements(); });
  window.api.on('announcements_v:updated', function(d){ announcementsV = d; renderAnnouncementsV(); });
  window.api.on('meetingAnnouncements:updated', function(d){ meetingAnnouncements = d; renderMeetingAnnouncements(); });
  window.api.on('meetings:updated', function(d){ meetings = d; renderRoomList(); renderBookings(); });
```

- [ ] **Step 12: 用 preview 工具驗證三個資料集互不污染**

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  announcements.list = []; announcementsV.list = []; meetingAnnouncements.list = [];

  openAnnModal(0, 'meetingAnnouncements');
  document.getElementById('annTitle').value = '會議室測試公告';
  saveAnn(0);

  return new Promise(function(resolve){
    setTimeout(function(){
      resolve({
        meetingAnnCount: meetingAnnouncements.list.length,
        announcementsCount: announcements.list.length,
        announcementsVCount: announcementsV.list.length,
        savedTitle: meetingAnnouncements.list[0] ? meetingAnnouncements.list[0].title : null
      });
    }, 200);
  });
})()
```

Expected：`meetingAnnCount` 為 `1`，`announcementsCount` 與 `announcementsVCount` 都是 `0`（沒有互相污染），`savedTitle` 為 `'會議室測試公告'`。

再驗證會議室公告分頁列表正確渲染、複製按鈕不出現：

```javascript
(function(){
  showTab('meetingann');
  var bodyHtml = document.getElementById('meetingAnnBody').innerHTML;
  openAnnModal(meetingAnnouncements.list[0].id, 'meetingAnnouncements');
  var footerHtml = document.getElementById('modalFooter').innerHTML;
  return {
    listShowsTitle: /會議室測試公告/.test(bodyHtml),
    noCopyButton: footerHtml.indexOf('複製到') === -1
  };
})()
```

Expected：`listShowsTitle` 為 `true`，`noCopyButton` 為 `true`。

- [ ] **Step 13: 確認無 console 錯誤，清除測試資料**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

```javascript
(function(){
  closeModal();
  localStorage.removeItem('bbs_meetingAnnouncements');
  return 'cleaned';
})()
```

- [ ] **Step 14: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 新增會議室公告分頁，擴充公告編輯器支援第三種資料集，移除外部系統連結"
```

---

### Task 6: Admin — 公告預覽新增「會議室門口螢幕」版面模式

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：既有公告即時預覽（`renderAnnPreview`）只有橫式（1920×1080）跟直式（1920×2160）兩種，會議室公告是 1080×1920，直接沿用既有直式模式的比例會失真（寬高比不同）。這個任務讀取 Task 2 建立的 `shared/roomBoardStyle.js` 常數，新增第三種預覽模式。

- [ ] **Step 1: 載入 `shared/roomBoardStyle.js`**

找到既有的 script 標籤：

Old:
```html
<script src="../../shared/api.js"></script>
<script src="../../shared/screenDefs.js"></script>
<script src="../../shared/floorData.js"></script>
```

New：
```html
<script src="../../shared/api.js"></script>
<script src="../../shared/screenDefs.js"></script>
<script src="../../shared/floorData.js"></script>
<script src="../../shared/roomBoardStyle.js"></script>
```

- [ ] **Step 2: `openAnnModal` 開啟會議室公告時，預覽固定用新模式、隱藏橫直切換按鈕**

找到 `openAnnModal` 裡組預覽面板 HTML 的部分：

Old:
```javascript
    '<div class="ann-preview-pane">'+
      '<div class="ann-preview-head">'+
        '<label style="margin:0">實際畫面預覽</label>'+
        '<div class="tb-group">'+
          '<button class="preset-btn'+(isV?'':' tb-on')+'" id="annPvH" onclick="setAnnPreviewMode(\'h\')">橫式 1920×1080</button>'+
          '<button class="preset-btn'+(isV?' tb-on':'')+'" id="annPvV" onclick="setAnnPreviewMode(\'v\')">直式 1920×2160</button>'+
        '</div>'+
      '</div>'+
```

New（`isRoom` 時不顯示切換按鈕，因為只有一種可能）：
```javascript
    '<div class="ann-preview-pane">'+
      '<div class="ann-preview-head">'+
        '<label style="margin:0">實際畫面預覽</label>'+
        (isRoom ? '<span style="font-size:12px;color:var(--text2)">會議室門口螢幕 1080×1920</span>' :
        '<div class="tb-group">'+
          '<button class="preset-btn'+(isV?'':' tb-on')+'" id="annPvH" onclick="setAnnPreviewMode(\'h\')">橫式 1920×1080</button>'+
          '<button class="preset-btn'+(isV?' tb-on':'')+'" id="annPvV" onclick="setAnnPreviewMode(\'v\')">直式 1920×2160</button>'+
        '</div>')+
      '</div>'+
```

找到 `openAnnModal` 裡設定 `_annPreviewMode` 初始值的地方：

Old:
```javascript
  _annPreviewMode = isV ? 'v' : 'h';
```

New：
```javascript
  _annPreviewMode = isRoom ? 'room' : (isV ? 'v' : 'h');
```

- [ ] **Step 3: `renderAnnPreview()` 支援第三種模式**

找到函式開頭的尺寸與版面常數計算：

Old:
```javascript
function renderAnnPreview() {
  var stage = $('annPreviewStage'), canvas = $('annPreviewCanvas');
  if (!stage || !canvas) return;

  var isV = _annPreviewMode === 'v';
  var W = 1920, H = isV ? 2160 : 1080;
  var title   = ($('annTitle')||{}).value || '';
  var type    = ($('annType')||{}).value || 'general';
  var content = (document.getElementById('annContent')||{}).innerHTML || '';
  /* 剛上傳的圖片優先用本機網址顯示（雲端網址要等部署完成才讀得到） */
  var img     = _annImgLocalUrl || ($('annImageUrl')||{}).value || '';
  var hasText = !!(title || content.replace(/<[^>]*>/g,'').trim());

  /* 字級與間距對齊 screen2 / screen13 的實際 CSS */
  var S = isV
    ? { badge:44, title:(img?96:120), body:(img?60:72), date:40, pad:'60px 80px', gapT:48, gapB:48 }
    : { badge:24, title:64,           body:40,          date:24, pad:'60px 80px', gapT:32, gapB:36 };
```

New（`isRoom` 時 `W`/`H` 改用 1080×1920，`S` 改讀 `RoomBoardStyle.ann`）：
```javascript
function renderAnnPreview() {
  var stage = $('annPreviewStage'), canvas = $('annPreviewCanvas');
  if (!stage || !canvas) return;

  var isV = _annPreviewMode === 'v';
  var isRoom = _annPreviewMode === 'room';
  var W = isRoom ? 1080 : 1920;
  var H = isRoom ? 1920 : (isV ? 2160 : 1080);
  var title   = ($('annTitle')||{}).value || '';
  var type    = ($('annType')||{}).value || 'general';
  var content = (document.getElementById('annContent')||{}).innerHTML || '';
  /* 剛上傳的圖片優先用本機網址顯示（雲端網址要等部署完成才讀得到） */
  var img     = _annImgLocalUrl || ($('annImageUrl')||{}).value || '';
  var hasText = !!(title || content.replace(/<[^>]*>/g,'').trim());

  /* 字級與間距對齊 screen2 / screen13 的實際 CSS；會議室門口螢幕讀共用常數 */
  var RB = window.RoomBoardStyle ? window.RoomBoardStyle.ann : null;
  var S = isRoom && RB
    ? { badge:RB.badge, title:(img?RB.titleWithImg:RB.titleNoImg), body:(img?RB.bodyWithImg:RB.bodyNoImg), date:RB.date, pad:RB.padV+'px '+RB.padH+'px', gapT:RB.gapT, gapB:RB.gapB }
    : isV
    ? { badge:44, title:(img?96:120), body:(img?60:72), date:40, pad:'60px 80px', gapT:48, gapB:48 }
    : { badge:24, title:64,           body:40,          date:24, pad:'60px 80px', gapT:32, gapB:36 };
```

找到後面用到 `isV` 判斷排版樣式（上圖下文 vs 橫式左圖右文）的地方：

Old:
```javascript
  var inner;
  if (img && !hasText) {
    /* 純圖：滿版 */
    inner = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000">'+
            '<img src="'+esc(img)+'" style="width:100%;height:100%;object-fit:contain">'+
            '</div>';
  } else if (img && isV) {
    /* 直式上圖下文 */
    inner = '<div style="max-width:1720px;width:100%;text-align:left">'+
            '<div style="width:100%;max-height:900px;display:flex;align-items:center;justify-content:center;margin-bottom:60px">'+
            '<img src="'+esc(img)+'" style="max-width:100%;max-height:900px;object-fit:contain;border-radius:28px">'+
            '</div><div>'+textBlock+'</div></div>';
  } else if (img) {
    /* 橫式左圖右文 */
    inner = '<div style="max-width:1400px;width:100%;display:flex;align-items:center;gap:60px;text-align:left">'+
            '<div style="flex-shrink:0;width:640px;height:640px;display:flex;align-items:center;justify-content:center">'+
            '<img src="'+esc(img)+'" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:20px">'+
            '</div><div style="flex:1;min-width:0">'+textBlock+'</div></div>';
  } else {
    inner = '<div style="max-width:'+(isV?1720:1400)+'px;width:100%;text-align:'+(isV?'left':'center')+'">'+textBlock+'</div>';
  }
```

New（`isRoom` 跟 `isV` 一樣走「上圖下文」排版，只是最大寬度/圖片高度改讀共用常數）：
```javascript
  var inner;
  var stacked = isV || isRoom; // 直式與會議室門口螢幕都是上圖下文排版
  var stackMaxWidth = isRoom && RB ? RB.maxWidth : 1720;
  var stackImgMaxHeight = isRoom && RB ? RB.imgMaxHeight : 900;
  if (img && !hasText) {
    /* 純圖：滿版 */
    inner = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000">'+
            '<img src="'+esc(img)+'" style="width:100%;height:100%;object-fit:contain">'+
            '</div>';
  } else if (img && stacked) {
    /* 直式／會議室：上圖下文 */
    inner = '<div style="max-width:'+stackMaxWidth+'px;width:100%;text-align:left">'+
            '<div style="width:100%;max-height:'+stackImgMaxHeight+'px;display:flex;align-items:center;justify-content:center;margin-bottom:60px">'+
            '<img src="'+esc(img)+'" style="max-width:100%;max-height:'+stackImgMaxHeight+'px;object-fit:contain;border-radius:28px">'+
            '</div><div>'+textBlock+'</div></div>';
  } else if (img) {
    /* 橫式左圖右文 */
    inner = '<div style="max-width:1400px;width:100%;display:flex;align-items:center;gap:60px;text-align:left">'+
            '<div style="flex-shrink:0;width:640px;height:640px;display:flex;align-items:center;justify-content:center">'+
            '<img src="'+esc(img)+'" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:20px">'+
            '</div><div style="flex:1;min-width:0">'+textBlock+'</div></div>';
  } else {
    inner = '<div style="max-width:'+(stacked?stackMaxWidth:1400)+'px;width:100%;text-align:'+(stacked?'left':'center')+'">'+textBlock+'</div>';
  }
```

- [ ] **Step 4: 用 preview 工具驗證會議室模式的預覽尺寸與版面**

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  openAnnModal(0, 'meetingAnnouncements');
  document.getElementById('annTitle').value = '測試會議室公告';

  var canvas = document.getElementById('annPreviewCanvas');
  var toggleVisible = !!document.getElementById('annPvH');

  return {
    previewMode: _annPreviewMode,
    canvasWidth: canvas.style.width,
    canvasHeight: canvas.style.height,
    toggleButtonsHidden: !toggleVisible
  };
})()
```

Expected：`previewMode` 為 `'room'`，`canvasWidth` 為 `'1080px'`，`canvasHeight` 為 `'1920px'`，`toggleButtonsHidden` 為 `true`。

再確認一般公告／直立公告的預覽沒有被這次改動影響：

```javascript
(function(){
  openAnnModal(0, 'announcements');
  var canvasH = document.getElementById('annPreviewCanvas');
  var modeH = _annPreviewMode;
  var toggleVisibleH = !!document.getElementById('annPvH');

  openAnnModal(0, 'announcements_v');
  var canvasV = document.getElementById('annPreviewCanvas');
  var modeV = _annPreviewMode;

  return {
    modeH: modeH, widthH: canvasH.style.width, heightH: canvasH.style.height, toggleVisibleH: toggleVisibleH,
    modeV: modeV, widthV: canvasV.style.width, heightV: canvasV.style.height
  };
})()
```

Expected：`modeH` 為 `'h'`、`widthH`/`heightH` 為 `'1920px'`/`'1080px'`、`toggleVisibleH` 為 `true`；`modeV` 為 `'v'`、`widthV`/`heightV` 為 `'1920px'`/`'2160px'`（跟這次改動前完全一樣，證明既有兩種模式沒有回歸）。

- [ ] **Step 5: 確認無 console 錯誤**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

- [ ] **Step 6: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 公告即時預覽新增會議室門口螢幕（1080x1920）版面模式"
```

---

### Task 7: `shared/roomBoard.js` — 門口顯示引擎（新增）

**Files:**
- Create: `shared/roomBoard.js`

**背景**：這是實際跑在 5 台會議室門口螢幕上的邏輯，讀取 `ROOM_ID`（由入口檔案在載入這支程式之前設定）、`meetings`、`meetingAnnouncements`，計算本房間狀態、全螢幕輪播「狀態頁 → 公告1 → 狀態頁 → 公告2 → …」。

- [ ] **Step 1: 建立檔案，含房間比對、狀態計算、公告篩選邏輯**

```javascript
/* shared/roomBoard.js — 會議室門口螢幕顯示引擎
   使用前必須先定義全域變數 ROOM_ID（例如 'A'），並依序載入：
   shared/api.js → shared/roomBoardStyle.js → shared/roomBoard.js
   由 renderer/room-a ~ room-e 五個極簡入口檔案各自帶入自己的 ROOM_ID 使用。 */
(function () {
  'use strict';

  if (typeof ROOM_ID === 'undefined') {
    document.body.innerHTML = '<div style="color:#fff;background:#000;height:100vh;display:flex;align-items:center;justify-content:center;font-size:32px;font-family:sans-serif">設定錯誤：未指定 ROOM_ID</div>';
    return;
  }

  var STYLE = window.RoomBoardStyle;
  var STATUS_SLIDE_MS = 8000;
  var UPCOMING_MAX = 6;

  /* 民國年日期相容（跟 screen13 同一套邏輯） */
  function rocToWestern(d) { var p = d.split('-'), y = +p[0]; return (y < 1900 ? y + 1911 : y) + '-' + p[1] + '-' + p[2]; }
  function isAnnActive(a) {
    if (a.alwaysValid !== false && !a.startDate) return true;
    if (a.alwaysValid) return true;
    var now = new Date().getTime();
    var start = a.startDate ? new Date(rocToWestern(a.startDate) + 'T' + (a.startTime || '00:00')).getTime() : 0;
    var end   = a.endDate   ? new Date(rocToWestern(a.endDate)   + 'T' + (a.endTime   || '23:59:59')).getTime() : Infinity;
    return now >= start && now <= end;
  }

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function today() { var n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
  function nowHM() { var n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); }

  /* 找出本房間現在使用中的預約（若有），以及今日剩餘（尚未到期）的預約清單 */
  function computeRoomState(meetings) {
    var bookings = (meetings.bookings || []).filter(function (b) { return b.roomId === ROOM_ID && b.date === today(); });
    var hm = nowHM();
    var current = bookings.filter(function (b) { return b.startTime <= hm && hm < b.endTime; })[0] || null;
    var upcoming = bookings.filter(function (b) { return b.endTime > hm; })
                            .sort(function (a, b) { return a.startTime < b.startTime ? -1 : 1; })
                            .slice(0, UPCOMING_MAX);
    return { current: current, upcoming: upcoming };
  }

  window.RoomBoard = { computeRoomState: computeRoomState, isAnnActive: isAnnActive, esc: esc };
})();
```

- [ ] **Step 2: 用 Node 驗證 `computeRoomState` 邏輯正確**

Run:
```bash
node -e "
global.window = {};
global.ROOM_ID = 'A';
global.document = { body: { innerHTML: '' } };
var fs = require('fs');
eval(fs.readFileSync('shared/roomBoard.js', 'utf8'));

function pad(n){ return String(n).padStart(2,'0'); }
var now = new Date();
var todayStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
var hm = pad(now.getHours())+':'+pad(now.getMinutes());
var hmPlus1 = pad(now.getHours())+':'+pad((now.getMinutes()+1)%60);

var meetings = {
  bookings: [
    { id:1, roomId:'A', date: todayStr, startTime:'00:00', endTime: hmPlus1, topic:'進行中會議' },
    { id:2, roomId:'A', date: todayStr, startTime: hmPlus1, endTime:'23:59', topic:'待會的會議' },
    { id:3, roomId:'B', date: todayStr, startTime:'00:00', endTime:'23:59', topic:'別間房不該出現' },
    { id:4, roomId:'A', date: '2000-01-01', startTime:'00:00', endTime:'23:59', topic:'很久以前的資料不該出現' }
  ]
};
var state = window.RoomBoard.computeRoomState(meetings);
console.log('current:', state.current ? state.current.topic : null);
console.log('upcomingCount:', state.upcoming.length);
console.log('upcomingTopic:', state.upcoming[0] ? state.upcoming[0].topic : null);
"
```

Expected output:
```
current: 進行中會議
upcomingCount: 2
upcomingTopic: 進行中會議
```

（說明：`upcoming` 定義是「結束時間還沒到」，所以正在進行中的那筆也會出現在 `upcoming` 清單的第一筆，這是設計文件裡「今日剩餘預約」的正確行為——它本來就該包含現在進行中的這筆，不是只列「還沒開始」的。）

- [ ] **Step 3: Commit**

```bash
git add shared/roomBoard.js
git commit -m "feat: 新增 shared/roomBoard.js 房間狀態計算核心邏輯"
```

---

### Task 8: `shared/roomBoard.js` — 全螢幕輪播渲染（狀態頁 + 公告頁）

**Files:**
- Modify: `shared/roomBoard.js`

**背景**：Task 7 只做了資料層（狀態計算）。這個任務加上實際畫面渲染：DOM 建構、CSS、輪播排程、即時同步監聽。沿用螢幕牆（`shared/wall`，如果存在的話）跟其他既有畫面已經踩過的坑——重新渲染時要清掉舊的計時器，否則資料更新時會有兩組輪播同時跑。

- [ ] **Step 1: 加入 DOM 初始化、房間比對防呆、CSS**

在 `computeRoomState` 函式**之後**（`window.RoomBoard = {...}` 那行**之前**）加入：

```javascript
  /* ── 找不到房間的防呆 ── */
  function findRoom(meetings) {
    return (meetings.rooms || []).filter(function (r) { return r.id === ROOM_ID; })[0] || null;
  }

  function showRoomNotFound() {
    document.body.innerHTML = '<div style="color:#fff;background:#000;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:\'Microsoft JhengHei\',sans-serif;gap:16px">'+
      '<div style="font-size:48px">⚠️</div>'+
      '<div style="font-size:32px">找不到房間代碼「'+esc(ROOM_ID)+'」</div>'+
      '<div style="font-size:18px;opacity:.6">請確認管理後台的房間清單，或這台螢幕的網址是否正確</div>'+
      '</div>';
  }

  /* ── 版面初始化 ── */
  var root, style;
  function initDom() {
    style = document.createElement('style');
    style.textContent =
      '*{margin:0;padding:0;box-sizing:border-box;}'+
      'html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:"Microsoft JhengHei","PingFang TC",sans-serif;}'+
      '#rb-stage{position:absolute;top:0;left:0;width:'+STYLE.CANVAS_W+'px;height:'+STYLE.CANVAS_H+'px;transform-origin:0 0;}'+
      '.rb-slide{position:absolute;inset:0;display:none;}'+
      '.rb-slide.active{display:flex;}';
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'rb-stage';
    document.body.appendChild(root);

    /* 寬高各自撐滿可視區域（沿用 renderer/wall/index.html 已驗證過的做法） */
    function fit() {
      var sx = window.innerWidth / STYLE.CANVAS_W;
      var sy = window.innerHeight / STYLE.CANVAS_H;
      root.style.transform = 'scale(' + sx + ',' + sy + ')';
    }
    fit();
    window.addEventListener('resize', fit);
    [300, 1000, 3000].forEach(function (delay) { setTimeout(fit, delay); });
  }
```

- [ ] **Step 2: 加入狀態投影片與公告投影片的渲染函式**

繼續加在後面：

```javascript
  /* ── 狀態投影片 ── */
  function renderStatusSlideHtml(room, state) {
    var S = STYLE.status;
    var stateHtml = state.current
      ? '<div style="font-size:'+S.stateLabel+'px;font-weight:900;color:#ff4d4d;margin-bottom:16px">【使用中】</div>'+
        '<div style="font-size:'+S.topic+'px;font-weight:700;margin-bottom:8px">'+esc(state.current.topic)+'</div>'+
        '<div style="font-size:'+S.timeRange+'px;opacity:.7">'+esc(state.current.startTime)+' ~ '+esc(state.current.endTime)+'</div>'
      : '<div style="font-size:'+S.stateLabel+'px;font-weight:900;color:#2ecc71">【未使用】</div>';

    var upcomingHtml = '';
    if (state.upcoming.length) {
      upcomingHtml = '<div style="margin-top:60px;width:100%;max-width:900px">'+
        '<div style="font-size:'+S.upcomingHeader+'px;opacity:.5;text-align:center;margin-bottom:20px">─ 今日剩餘預約 ─</div>'+
        state.upcoming.map(function (b) {
          return '<div style="font-size:'+S.upcomingRow+'px;display:flex;justify-content:space-between;padding:10px 20px;border-bottom:1px solid rgba(255,255,255,.1)">'+
                 '<span>'+esc(b.startTime)+'-'+esc(b.endTime)+'</span><span>'+esc(b.topic)+'</span></div>';
        }).join('') +
        '</div>';
    }

    return '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:60px;background:radial-gradient(ellipse at center, rgba(0,40,80,.5) 0%, transparent 70%), #0c0b09">'+
      '<div style="position:absolute;top:60px;left:0;right:0;text-align:center">'+
        '<div style="font-size:'+S.roomName+'px;font-weight:900">🏢 '+esc(room.name)+'（'+(room.capacity||0)+'人）</div>'+
        '<div id="rb-clock" style="font-size:'+S.clock+'px;opacity:.6;margin-top:12px"></div>'+
      '</div>'+
      stateHtml + upcomingHtml +
      '</div>';
  }

  /* ── 公告投影片（版面常數與 admin 預覽的 'room' 模式共用同一份 RoomBoardStyle.ann） ── */
  var ANN_TYPE_LABEL = { general: '一般公告', urgent: '緊急通知', event: '活動公告', notice: '重要通知' };
  function renderAnnSlideHtml(a) {
    var RB = STYLE.ann;
    var img = a.imageUrl || '';
    var hasText = !!(a.title || String(a.content || '').replace(/<[^>]*>/g, '').trim());
    var badgeColor = { general: '#f0a500', urgent: '#ff4d4d', event: '#2ecc71', notice: '#f59e0b' }[a.type] || '#f0a500';
    var textBlock =
      '<div style="display:inline-block;padding:'+RB.badgePadV+'px '+RB.badgePadH+'px;border-radius:60px;font-size:'+RB.badge+'px;font-weight:700;margin-bottom:'+RB.gapT+'px;border:1px solid;color:'+badgeColor+';border-color:'+badgeColor+'66;background:'+badgeColor+'1a">'+(ANN_TYPE_LABEL[a.type] || '公告')+'</div>'+
      '<div style="font-size:'+(img ? RB.titleWithImg : RB.titleNoImg)+'px;font-weight:900;line-height:1.4;margin-bottom:'+RB.gapB+'px;color:#fff">'+esc(a.title)+'</div>'+
      '<div style="font-size:'+(img ? RB.bodyWithImg : RB.bodyNoImg)+'px;line-height:2.0;color:rgba(255,255,255,.8)">'+(a.content || '')+'</div>';

    var inner;
    if (img && !hasText) {
      inner = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000">'+
              '<img src="'+esc(img)+'" style="width:100%;height:100%;object-fit:contain"></div>';
    } else if (img) {
      inner = '<div style="max-width:'+RB.maxWidth+'px;width:100%;text-align:left">'+
              '<div style="width:100%;max-height:'+RB.imgMaxHeight+'px;display:flex;align-items:center;justify-content:center;margin-bottom:34px">'+
              '<img src="'+esc(img)+'" style="max-width:100%;max-height:'+RB.imgMaxHeight+'px;object-fit:contain;border-radius:28px"></div>'+
              '<div>'+textBlock+'</div></div>';
    } else {
      inner = '<div style="max-width:'+RB.maxWidth+'px;width:100%;text-align:left">'+textBlock+'</div>';
    }

    return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;padding:'+RB.padV+'px '+RB.padH+'px;background:radial-gradient(ellipse at center, rgba(0,40,80,.5) 0%, transparent 70%), #0c0b09;overflow:hidden">'+inner+'</div>';
  }
```

- [ ] **Step 3: 加入輪播排程邏輯**

繼續加在後面：

```javascript
  /* ── 輪播排程：狀態頁穿插在每則公告之間 ── */
  var pendingTimers = [];
  var clockInterval = null;
  var slideIndex = 0;
  var slides = [];

  function clearAllTimers() {
    pendingTimers.forEach(function (id) { clearTimeout(id); });
    pendingTimers = [];
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
  }

  function buildSlides(room, state, announcements) {
    var activeAnns = (announcements.list || []).filter(isAnnActive);
    var list = [];
    if (!activeAnns.length) {
      list.push({ type: 'status' });
    } else {
      activeAnns.forEach(function (a) {
        list.push({ type: 'status' });
        list.push({ type: 'ann', data: a });
      });
    }
    return list;
  }

  function renderSlideDom(slide, room, state) {
    var el = document.createElement('div');
    el.className = 'rb-slide';
    el.innerHTML = slide.type === 'status' ? renderStatusSlideHtml(room, state) : renderAnnSlideHtml(slide.data);
    return el;
  }

  function showSlide(i) {
    var children = root.querySelectorAll('.rb-slide');
    children.forEach(function (c, idx) { c.classList.toggle('active', idx === i); });
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    if (slides[i] && slides[i].type === 'status') {
      var clockEl = root.querySelector('.rb-slide.active #rb-clock');
      function tick() {
        if (clockEl) {
          var n = new Date();
          clockEl.textContent = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0') + ':' + String(n.getSeconds()).padStart(2, '0');
        }
      }
      tick();
      clockInterval = setInterval(tick, 1000);
    }
  }

  function scheduleNext(room, state) {
    var dur = slides[slideIndex].type === 'status' ? STATUS_SLIDE_MS : Math.max(3, parseInt(slides[slideIndex].data.duration) || 7) * 1000;
    var id = setTimeout(function () {
      slideIndex = (slideIndex + 1) % slides.length;
      showSlide(slideIndex);
      scheduleNext(room, state);
    }, dur);
    pendingTimers.push(id);
  }

  function renderAll(meetings, announcements) {
    clearAllTimers();
    var room = findRoom(meetings);
    if (!room) { showRoomNotFound(); return; }
    var state = computeRoomState(meetings);
    slides = buildSlides(room, state, announcements);
    root.innerHTML = '';
    slides.forEach(function (slide) {
      root.appendChild(renderSlideDom(slide, room, state));
    });
    slideIndex = 0;
    showSlide(0);
    scheduleNext(room, state);
  }
```

- [ ] **Step 4: 加入初始化、資料讀取、即時同步監聽**

繼續加在後面（取代原本檔案結尾的 `window.RoomBoard = {...}` 那一行，改放在最後）：

```javascript
  /* ── 初始化：讀取資料、監聽背景更新 ── */
  var _meetings = { rooms: [], bookings: [] };
  var _meetingAnnouncements = { marquee: '', list: [] };

  async function init() {
    initDom();
    if (window.ghBackup) await window.ghBackup.autoRestore();
    var m = await window.api.get('meetings');
    var a = await window.api.get('meetingAnnouncements');
    _meetings = m || _meetings;
    _meetingAnnouncements = a || _meetingAnnouncements;
    renderAll(_meetings, _meetingAnnouncements);

    /* 狀態每分鐘重新計算一次，不用整頁重新整理即可反映預約開始/結束 */
    setInterval(function () { renderAll(_meetings, _meetingAnnouncements); }, 60000);
  }

  window.api.on('meetings:updated', function (d) { _meetings = d; renderAll(_meetings, _meetingAnnouncements); });
  window.api.on('meetingAnnouncements:updated', function (d) { _meetingAnnouncements = d; renderAll(_meetings, _meetingAnnouncements); });

  window.RoomBoard = { computeRoomState: computeRoomState, isAnnActive: isAnnActive, esc: esc };

  init();
})();
```

- [ ] **Step 5: 用 preview 工具驗證輪播順序、狀態顯示、即時更新**

啟動預覽伺服器，建立一個測試用的房間頁面（這個檔案還沒建立，Task 9 才會建立正式的 5 個入口檔案；這裡先用暫時的 HTML 頁面驗證 `roomBoard.js` 本身邏輯是否正確）：

```
mcp__Claude_Browser__preview_start({ name: "預覽伺服器" })
```

```javascript
(function(){
  // 先寫入測試資料
  function pad(n){ return String(n).padStart(2,'0'); }
  var now = new Date();
  var todayStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
  var hmPlus1 = pad(now.getHours())+':'+pad((now.getMinutes()+1)%60);

  localStorage.setItem('bbs_meetings', JSON.stringify({
    rooms: [{ id:'A', name:'測試會議室', capacity: 30 }],
    bookings: [{ id:1, roomId:'A', date: todayStr, startTime:'00:00', endTime: hmPlus1, topic:'測試進行中會議' }]
  }));
  localStorage.setItem('bbs_meetingAnnouncements', JSON.stringify({
    marquee:'', list: [
      { id:1, title:'測試公告一', type:'general', duration:3, content:'內容一', imageUrl:'', alwaysValid:true },
      { id:2, title:'測試公告二', type:'event', duration:3, content:'內容二', imageUrl:'', alwaysValid:true }
    ]
  }));
  window.location.href = 'http://localhost:8765/renderer/room-a/'; // Task 9 建立後才存在，先記錄測試腳本
  return 'prepared';
})()
```

（這一步的實際執行要等 Task 9 建立好 `renderer/room-a/index.html` 之後才能跑，這裡先把測試腳本寫好記錄下來，實際驗證動作併入 Task 9 的驗證步驟一起做，避免驗證一半又要重跑。）

- [ ] **Step 6: Commit**

```bash
git add shared/roomBoard.js
git commit -m "feat: roomBoard.js 加入全螢幕輪播渲染（狀態頁穿插公告頁）與即時同步監聽"
```

---

### Task 9: 5 個入口檔案 + 端對端驗證

**Files:**
- Create: `renderer/room-a/index.html`
- Create: `renderer/room-b/index.html`
- Create: `renderer/room-c/index.html`
- Create: `renderer/room-d/index.html`
- Create: `renderer/room-e/index.html`

- [ ] **Step 1: 建立 5 個極簡入口檔案**

`renderer/room-a/index.html`：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="1800">
<title>會議室 A 門口顯示</title>
</head>
<body>
<script>var ROOM_ID = 'A';</script>
<script src="../../shared/api.js"></script>
<script src="../../shared/roomBoardStyle.js"></script>
<script src="../../shared/roomBoard.js"></script>
</body>
</html>
```

`renderer/room-b/index.html`（同上，只改 `ROOM_ID` 與 `<title>`）：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="1800">
<title>會議室 B 門口顯示</title>
</head>
<body>
<script>var ROOM_ID = 'B';</script>
<script src="../../shared/api.js"></script>
<script src="../../shared/roomBoardStyle.js"></script>
<script src="../../shared/roomBoard.js"></script>
</body>
</html>
```

`renderer/room-c/index.html`：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="1800">
<title>會議室 C 門口顯示</title>
</head>
<body>
<script>var ROOM_ID = 'C';</script>
<script src="../../shared/api.js"></script>
<script src="../../shared/roomBoardStyle.js"></script>
<script src="../../shared/roomBoard.js"></script>
</body>
</html>
```

`renderer/room-d/index.html`：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="1800">
<title>會議室 D 門口顯示</title>
</head>
<body>
<script>var ROOM_ID = 'D';</script>
<script src="../../shared/api.js"></script>
<script src="../../shared/roomBoardStyle.js"></script>
<script src="../../shared/roomBoard.js"></script>
</body>
</html>
```

`renderer/room-e/index.html`：
```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="1800">
<title>會議室 E 門口顯示</title>
</head>
<body>
<script>var ROOM_ID = 'E';</script>
<script src="../../shared/api.js"></script>
<script src="../../shared/roomBoardStyle.js"></script>
<script src="../../shared/roomBoard.js"></script>
</body>
</html>
```

- [ ] **Step 2: 用 preview 工具跑 Task 8 Step 5 記錄的測試腳本**

```
mcp__Claude_Browser__preview_start({ name: "預覽伺服器" })
```

```javascript
(function(){
  function pad(n){ return String(n).padStart(2,'0'); }
  var now = new Date();
  var todayStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
  var hmPlus1 = pad(now.getHours())+':'+pad((now.getMinutes()+1)%60);

  localStorage.setItem('bbs_meetings', JSON.stringify({
    rooms: [{ id:'A', name:'測試會議室', capacity: 30 }],
    bookings: [{ id:1, roomId:'A', date: todayStr, startTime:'00:00', endTime: hmPlus1, topic:'測試進行中會議' }]
  }));
  localStorage.setItem('bbs_meetingAnnouncements', JSON.stringify({
    marquee:'', list: [
      { id:1, title:'測試公告一', type:'general', duration:3, content:'內容一', imageUrl:'', alwaysValid:true },
      { id:2, title:'測試公告二', type:'event', duration:3, content:'內容二', imageUrl:'', alwaysValid:true }
    ]
  }));
  window.location.href = 'http://localhost:8765/renderer/room-a/';
  return 'navigating';
})()
```

等待載入後，確認輪播結構正確：

```javascript
new Promise(function(resolve){
  setTimeout(function(){
    var slides = document.querySelectorAll('.rb-slide');
    var activeIdx = Array.prototype.findIndex.call(slides, function(s){ return s.classList.contains('active'); });
    resolve({
      slideCount: slides.length, // 預期 4：狀態、公告1、狀態、公告2
      activeIdx: activeIdx,
      firstSlideShowsStatus: /使用中|未使用/.test(slides[0].innerHTML),
      firstSlideShowsRoomName: /測試會議室/.test(slides[0].innerHTML),
      firstSlideShowsCurrentTopic: /測試進行中會議/.test(slides[0].innerHTML)
    });
  }, 800);
})
```

Expected：`slideCount` 為 `4`，`activeIdx` 為 `0`，`firstSlideShowsStatus`／`firstSlideShowsRoomName`／`firstSlideShowsCurrentTopic` 皆為 `true`（第一張投影片是狀態頁，顯示房間名稱與正在進行中的會議主旨）。

- [ ] **Step 3: 驗證輪播會依序切換到公告頁**

```javascript
new Promise(function(resolve){
  setTimeout(function(){
    var slides = document.querySelectorAll('.rb-slide');
    var activeIdx = Array.prototype.findIndex.call(slides, function(s){ return s.classList.contains('active'); });
    var activeHtml = slides[activeIdx].innerHTML;
    resolve({
      activeIdxAfter8s: activeIdx, // 狀態頁停留 8 秒後應該切到 index 1（第一則公告）
      showsAnnTitle: /測試公告一/.test(activeHtml)
    });
  }, 8500); // 狀態頁 8 秒 + 緩衝
})
```

Expected：`activeIdxAfter8s` 為 `1`，`showsAnnTitle` 為 `true`（切到第一則公告投影片）。

- [ ] **Step 4: 驗證找不到房間時的防呆畫面**

```javascript
(function(){
  window.location.href = 'http://localhost:8765/renderer/room-b/'; // room-b 對應的房間資料不存在（測試資料只放了 A）
  return 'navigating';
})()
```

```javascript
new Promise(function(resolve){
  setTimeout(function(){
    resolve({
      showsNotFoundMessage: /找不到房間代碼「B」/.test(document.body.innerHTML)
    });
  }, 800);
})
```

Expected：`showsNotFoundMessage` 為 `true`。

- [ ] **Step 5: 驗證即時同步（背景資料更新後 1 分鐘內畫面反映，這裡直接模擬 storage 事件測試監聽有沒有接對）**

```javascript
(function(){
  window.location.href = 'http://localhost:8765/renderer/room-a/';
  return 'navigating';
})()
```

```javascript
new Promise(function(resolve){
  setTimeout(function(){
    var newData = { rooms:[{id:'A',name:'改名後的會議室',capacity:30}], bookings:[] };
    localStorage.setItem('bbs_meetings', JSON.stringify(newData));
    window.dispatchEvent(new StorageEvent('storage', { key:'bbs_meetings', newValue: JSON.stringify(newData), storageArea: localStorage }));
    setTimeout(function(){
      resolve({ roomNameUpdated: /改名後的會議室/.test(document.body.innerHTML) });
    }, 300);
  }, 800);
})
```

Expected：`roomNameUpdated` 為 `true`（不用重新整理頁面，畫面直接反映房間改名跟「本房間目前沒有任何預約」的新狀態）。

- [ ] **Step 6: 確認無 console 錯誤**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

- [ ] **Step 7: 清除測試資料**

```javascript
(function(){
  localStorage.removeItem('bbs_meetings');
  localStorage.removeItem('bbs_meetingAnnouncements');
  return 'cleaned';
})()
```

- [ ] **Step 8: 檢查所有異動檔案，確認沒有動到既有 screen1~13、renderer/wall、renderer/floorboards**

Run:
```bash
git log --oneline -10
git diff HEAD~8 --stat
```

Expected：`git diff --stat` 只列出 `shared/api.js`、`shared/roomBoardStyle.js`（新增）、`shared/roomBoard.js`（新增）、`renderer/admin/index.html`、`renderer/room-a`~`room-e/index.html`（新增），**不應該出現**任何 `renderer/screen*`、`renderer/wall`、`renderer/floorboards` 底下的檔案。

- [ ] **Step 9: 推送到 GitHub**

```bash
git add renderer/room-a/index.html renderer/room-b/index.html renderer/room-c/index.html renderer/room-d/index.html renderer/room-e/index.html
git commit -m "feat: 新增會議室門口顯示系統 5 個入口檔案（room-a ~ room-e）"
git status
git fetch origin main
git log origin/main..HEAD --oneline
git push
```

若 `git push` 被拒絕（遠端有新 commit），執行：

```bash
git pull --rebase
git push
```

Expected：`git push` 成功，輸出顯示本地分支已推送到 `origin/main`。

---

## 部署後現場驗證（無法在本機模擬，必須到現場執行）

1. 到管理後台「🏢 會議室預約」確認房間清單是你要的 5 間房間名稱/容納人數（預設是 A~E，可在這裡改名）
2. 新增幾筆真實預約，到「📋 會議室公告」新增至少一則會議室公告
3. 把 5 台門口螢幕現在指向舊系統的網址，逐一改成對應的新網址（例如 `https://tpower1060601-sudo.github.io/community-bulletin-board/renderer/room-a/`）
4. 現場觀察至少一次完整輪播週期，確認狀態頁與公告頁切換正常、時間到了預約狀態會自動變化（不用重新整理頁面）
5. 在管理後台新增/刪除一筆預約，確認對應的門口螢幕在 1 分鐘內自動反映
