# 會議室預約軟刪除（7天緩衝期）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 會議室預約的刪除改成軟刪除：刪除後標記 `deletedAt` 並保留 7 天緩衝期（可復原、可立即永久刪除），緩衝期內釋放時段給新預約，過期後在進入會議室預約分頁時自動真正清除；門口螢幕顯示引擎同步排除軟刪除的預約。

**Architecture:** 資料層只新增一個 `deletedAt` 欄位，不改資料結構其他部分。`renderer/admin/index.html` 新增 `restoreBooking()`/`hardDeleteBooking()`/`purgeExpiredBookings()` 三個函式，並修改既有的 `deleteBooking()`/`saveBooking()`/`renderBookings()`/`renderCalendar()`/`showTab()`。`shared/roomBoard.js`（門口螢幕顯示引擎）的 `computeRoomState()` 加一個排除條件。

**Tech Stack:** 純 HTML/CSS/JavaScript（ES5 風格，無建置工具），localStorage + GitHub 備份同步（`shared/api.js`）。

**依據設計文件：** `docs/superpowers/specs/2026-09-18-meeting-room-soft-delete-design.md`

---

## 檔案異動總覽

| 檔案 | 動作 | 內容 |
|---|---|---|
| `renderer/admin/index.html` | 修改 | 軟刪除核心邏輯（Task 1）、月曆與明細列表顯示（Task 2） |
| `shared/roomBoard.js` | 修改 | `computeRoomState()` 排除軟刪除預約（Task 3） |

---

### Task 1: Admin — 軟刪除核心邏輯（刪除／復原／永久刪除／過期清除）

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：把「刪除即真正移除」改成「刪除即標記 `deletedAt`」，並新增復原、立即永久刪除、進分頁時清除過期軟刪除項目的邏輯。

- [ ] **Step 1: 改寫 `deleteBooking()` 為軟刪除**

找到現有函式（`renderer/admin/index.html`，搜尋 `function deleteBooking`）：

Old:
```javascript
function deleteBooking(id) {
  if (!confirm('確定要刪除這筆預約嗎？')) return;
  meetings.bookings = (meetings.bookings||[]).filter(function(x){ return x.id !== id; });
  window.api.save('meetings', meetings).then(function(){
    toast('預約已刪除', 'warning');
    renderCalendar();
    renderBookings();
    closeModal();
    triggerBackup();
  });
}
```

New：
```javascript
function deleteBooking(id) {
  if (!confirm('確定要刪除這筆預約嗎？（會保留 7 天，期限內可復原）')) return;
  var b = (meetings.bookings||[]).find(function(x){ return x.id === id; });
  if (!b) return;
  b.deletedAt = new Date().toISOString();
  window.api.save('meetings', meetings).then(function(){
    toast('預約已刪除，7 天內可在明細列表復原', 'warning');
    renderCalendar();
    renderBookings();
    closeModal();
    triggerBackup();
  });
}
```

- [ ] **Step 2: `saveBooking()` 的重疊檢查排除軟刪除項目**

找到現有函式裡的重疊檢查那一行（搜尋 `var conflict = list.some`）：

Old:
```javascript
  var conflict = list.some(function(b){ return b.id !== updated.id && bookingOverlaps(b, updated); });
```

New：
```javascript
  var conflict = list.some(function(b){ return b.id !== updated.id && !b.deletedAt && bookingOverlaps(b, updated); });
```

（軟刪除中的預約不再視為佔用時段，新預約可以使用同一時段。）

- [ ] **Step 3: 新增 `restoreBooking()`／`hardDeleteBooking()`／`purgeExpiredBookings()`**

在 `deleteBooking()` 函式（Step 1 改寫後的版本）**之後**加入：

```javascript
var SOFT_DELETE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

function restoreBooking(id) {
  var b = (meetings.bookings||[]).find(function(x){ return x.id === id; });
  if (!b) return;
  var conflict = (meetings.bookings||[]).some(function(x){
    return x.id !== id && !x.deletedAt && bookingOverlaps(x, b);
  });
  if (conflict) {
    toast('這個時段已經被別的預約佔用了，請先調整時間再復原', 'error');
    return;
  }
  delete b.deletedAt;
  window.api.save('meetings', meetings).then(function(){
    toast('預約已復原');
    renderCalendar();
    renderBookings();
    triggerBackup();
  });
}

function hardDeleteBooking(id) {
  if (!confirm('確定要永久刪除這筆已刪除的預約嗎？此動作無法復原。')) return;
  meetings.bookings = (meetings.bookings||[]).filter(function(x){ return x.id !== id; });
  window.api.save('meetings', meetings).then(function(){
    toast('已永久刪除', 'warning');
    renderCalendar();
    renderBookings();
    triggerBackup();
  });
}

function purgeExpiredBookings() {
  var now = Date.now();
  var before = (meetings.bookings||[]).length;
  meetings.bookings = (meetings.bookings||[]).filter(function(b){
    if (!b.deletedAt) return true;
    return (now - new Date(b.deletedAt).getTime()) <= SOFT_DELETE_GRACE_MS;
  });
  if (meetings.bookings.length !== before) {
    window.api.save('meetings', meetings).then(function(){ triggerBackup(); });
  }
}
```

（`SOFT_DELETE_GRACE_MS` 是模組層級變數，Task 2 的 `renderBookings()` 也會用到，放在這裡集中定義。`restoreBooking()` 用既有的 `bookingOverlaps()` 檢查是否跟其他「目前有效」預約衝突，有衝突就擋下不復原。`purgeExpiredBookings()` 只有在真的清掉東西時才存檔+觸發備份，避免每次切分頁都做不必要的寫入。）

- [ ] **Step 4: `showTab()` 的 `meetings` 分支呼叫過期清除**

找到 `showTab()` 函式（搜尋 `function showTab`）：

Old:
```javascript
function showTab(name) {
  ['announcements','annv','meetingann','meetings','status','news','settings','layout','floors'].forEach(function(t){
    var p=$('tab-'+t), n=$('nav-'+t);
    if(p) p.style.display=(t===name?'':'none');
    if(n) n.classList.toggle('active', t===name);
  });
  if(name==='meetings')    { renderRoomList(); renderCalendar(); renderBookings(); }
  if(name==='status')      renderStatus();
  if(name==='layout')      initLayoutEditor();
  if(name==='annv')        renderAnnouncementsV();
  if(name==='meetingann')  renderMeetingAnnouncements();
  if(name==='floors')      initFloorEditor();
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
  if(name==='meetings')    { purgeExpiredBookings(); renderRoomList(); renderCalendar(); renderBookings(); }
  if(name==='status')      renderStatus();
  if(name==='layout')      initLayoutEditor();
  if(name==='annv')        renderAnnouncementsV();
  if(name==='meetingann')  renderMeetingAnnouncements();
  if(name==='floors')      initFloorEditor();
}
```

- [ ] **Step 5: 用瀏覽器驗證軟刪除、重疊釋放、復原衝突擋下、過期清除**

啟動本機靜態伺服器（`python -m http.server 8765`，於 `C:\webpage` 用 Bash 執行並加 `run_in_background: true`），用 `mcp__Claude_Browser__*` 工具開啟 `http://localhost:8765/renderer/admin/index.html`。

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  location.reload();
})()
```

重新整理後測試軟刪除 + 時段釋放：

```javascript
(function(){
  meetings.rooms = [{id:'A',name:'A會議室',capacity:40}];
  meetings.bookings = [
    { id:1, roomId:'A', date:'2026-09-25', startTime:'14:00', endTime:'15:00', topic:'原始預約', person:'王小姐' }
  ];
  var origConfirm = window.confirm;
  window.confirm = function(){ return true; };
  deleteBooking(1);
  window.confirm = origConfirm;

  return new Promise(function(resolve){
    setTimeout(function(){
      var b = meetings.bookings.find(function(x){return x.id===1;});
      resolve({
        hasDeletedAt: !!b.deletedAt,
        stillInArray: meetings.bookings.length === 1
      });
    }, 200);
  });
})()
```

Expected：`hasDeletedAt` 為 `true`（軟刪除，不是真的移除），`stillInArray` 為 `true`（資料還在陣列裡，只是標記了）。

測試同時段可以被新預約使用（因為原本那筆已軟刪除）：

```javascript
(function(){
  var toastMsg = null;
  var origToast = window.toast;
  window.toast = function(msg, type){ toastMsg = {msg:msg, type:type}; };

  openBookModal(0);
  document.getElementById('bkRoomId').value = 'A';
  document.getElementById('bkDate').value = '2026-09-25';
  document.getElementById('bkStartTime').value = '14:00';
  document.getElementById('bkEndTime').value = '15:00';
  document.getElementById('bkTopic').value = '新預約搶時段';
  saveBooking(0);

  window.toast = origToast;
  return new Promise(function(resolve){
    setTimeout(function(){
      resolve({
        noConflictBlocked: !(toastMsg && toastMsg.type==='error'),
        bookingCount: meetings.bookings.length
      });
    }, 200);
  });
})()
```

Expected：`noConflictBlocked` 為 `true`（沒被擋下），`bookingCount` 為 `2`（軟刪除那筆還在 + 新的那筆）。

測試復原時偵測到衝突會被擋下：

```javascript
(function(){
  var deletedId = meetings.bookings.find(function(b){ return b.deletedAt; }).id;
  var toastMsg = null;
  var origToast = window.toast;
  window.toast = function(msg, type){ toastMsg = {msg:msg, type:type}; };

  restoreBooking(deletedId);

  window.toast = origToast;
  var stillDeleted = !!meetings.bookings.find(function(b){ return b.id===deletedId; }).deletedAt;
  return {
    blockedCorrectly: toastMsg && toastMsg.type==='error',
    stillDeleted: stillDeleted
  };
})()
```

Expected：`blockedCorrectly` 為 `true`（因為時段已經被剛剛新增的那筆佔用），`stillDeleted` 為 `true`（復原沒有成功執行）。

測試把新預約也刪掉後，復原就不會衝突了：

```javascript
(function(){
  var newBookingId = meetings.bookings.find(function(b){ return b.topic==='新預約搶時段'; }).id;
  meetings.bookings = meetings.bookings.filter(function(b){ return b.id !== newBookingId; }); // 直接移除，模擬騰出時段

  var deletedId = meetings.bookings.find(function(b){ return b.deletedAt; }).id;
  restoreBooking(deletedId);

  return new Promise(function(resolve){
    setTimeout(function(){
      var b = meetings.bookings.find(function(x){ return x.id===deletedId; });
      resolve({ deletedAtCleared: !b.deletedAt });
    }, 200);
  });
})()
```

Expected：`deletedAtCleared` 為 `true`（`deletedAt` 已被清除，復原成功）。

測試永久刪除：

```javascript
(function(){
  var id = meetings.bookings[0].id;
  var origConfirm = window.confirm;
  window.confirm = function(){ return true; };
  hardDeleteBooking(id);
  window.confirm = origConfirm;
  return new Promise(function(resolve){
    setTimeout(function(){ resolve({ removedFromArray: !meetings.bookings.find(function(b){return b.id===id;}) }); }, 200);
  });
})()
```

Expected：`removedFromArray` 為 `true`。

測試過期自動清除（模擬一筆 8 天前軟刪除的、一筆 3 天前軟刪除的）：

```javascript
(function(){
  var now = Date.now();
  meetings.bookings = [
    { id:100, roomId:'A', date:'2026-09-01', startTime:'09:00', endTime:'10:00', topic:'過期8天', person:'A', deletedAt: new Date(now - 8*24*60*60*1000).toISOString() },
    { id:101, roomId:'A', date:'2026-09-02', startTime:'09:00', endTime:'10:00', topic:'未過期3天', person:'B', deletedAt: new Date(now - 3*24*60*60*1000).toISOString() }
  ];
  purgeExpiredBookings();
  return new Promise(function(resolve){
    setTimeout(function(){
      resolve({
        expiredOneRemoved: !meetings.bookings.find(function(b){return b.id===100;}),
        notExpiredOneKept: !!meetings.bookings.find(function(b){return b.id===101;})
      });
    }, 200);
  });
})()
```

Expected：`expiredOneRemoved` 為 `true`（8 天前的已被清除），`notExpiredOneKept` 為 `true`（3 天前的還保留）。

測試進入會議室預約分頁會自動觸發清除：

```javascript
(function(){
  var now = Date.now();
  meetings.bookings = [
    { id:200, roomId:'A', date:'2026-09-01', startTime:'09:00', endTime:'10:00', topic:'切分頁測試過期', person:'C', deletedAt: new Date(now - 10*24*60*60*1000).toISOString() }
  ];
  showTab('meetings');
  return new Promise(function(resolve){
    setTimeout(function(){
      resolve({ purgedOnTabSwitch: !meetings.bookings.find(function(b){return b.id===200;}) });
    }, 200);
  });
})()
```

Expected：`purgedOnTabSwitch` 為 `true`。

- [ ] **Step 6: 確認無 console 錯誤，清除測試資料**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

```javascript
(function(){
  closeModal();
  localStorage.removeItem('bbs_meetings');
  return 'cleaned';
})()
```

- [ ] **Step 7: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 會議室預約刪除改為軟刪除，保留7天緩衝期可復原，過期進分頁時自動清除"
```

---

### Task 2: Admin — 月曆與當天明細列表顯示軟刪除項目

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：月曆格子（色塊、未繳費紅框）要完全排除軟刪除中的預約；當天明細列表則要把軟刪除項目用反灰樣式列在正常預約之後，附上「復原」「永久刪除」按鈕跟剩餘天數提示。

- [ ] **Step 1: `renderCalendar()` 的 `dayBookings` 排除軟刪除項目**

找到 `renderCalendar()` 函式裡的這一行（搜尋 `var dayBookings = bookings.filter`）：

Old:
```javascript
    var dayBookings = bookings.filter(function(b){ return b.date === dateStr; });
```

New：
```javascript
    var dayBookings = bookings.filter(function(b){ return b.date === dateStr && !b.deletedAt; });
```

- [ ] **Step 2: 改寫 `renderBookings()`，加入軟刪除項目的反灰列表**

找到現有函式（搜尋 `function renderBookings`）：

Old:
```javascript
function renderBookings() {
  var cards=$('bookingCards'); if(!cards) return;
  if (!_selectedCalendarDate) { cards.innerHTML=''; return; }
  var date=_selectedCalendarDate;
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
        var unpaid = !isBookingPaid(b);
        html+='<div class="booking-item"'+(unpaid?' style="border:2px solid #ef4444"':'')+'>'+
              '<div class="booking-time">'+esc(b.startTime)+' - '+esc(b.endTime)+'</div>'+
              '<div class="booking-info"><div class="booking-topic">'+esc(b.topic)+'</div>'+
              '<div class="booking-person">👤 '+esc(b.person)+(b.tenant?'　🏢 '+esc(b.tenant):'')+(unpaid?'　<span style="color:#ef4444;font-weight:700">⚠ 未繳費</span>':'')+'</div></div>'+
              '<div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" onclick="openBookModal('+b.id+')">編輯</button>'+
              '<button class="btn btn-danger btn-sm" onclick="deleteBooking('+b.id+')">刪除</button></div></div>';
      }
    }
    html+='</div>';
  }
  cards.innerHTML=html;
}
```

New：
```javascript
function renderBookings() {
  var cards=$('bookingCards'); if(!cards) return;
  if (!_selectedCalendarDate) { cards.innerHTML=''; return; }
  var date=_selectedCalendarDate;
  var html='', rooms=meetings.rooms||[], bookings=meetings.bookings||[];
  for(var i=0;i<rooms.length;i++){
    var room=rooms[i];
    var rb=bookings.filter(function(b){return b.roomId===room.id&&b.date===date&&!b.deletedAt;})
                    .sort(function(a,b){return a.startTime<b.startTime?-1:1;});
    var deletedRb=bookings.filter(function(b){return b.roomId===room.id&&b.date===date&&b.deletedAt;})
                    .sort(function(a,b){return a.startTime<b.startTime?-1:1;});
    html+='<div class="card"><div class="card-title">🏢 '+esc(room.name)+'（'+(room.capacity||0)+'人）</div>';
    if(rb.length===0){
      html+='<div style="padding:16px;color:var(--text2);font-size:13px">本日無預約</div>';
    } else {
      for(var j=0;j<rb.length;j++){
        var b=rb[j];
        var unpaid = !isBookingPaid(b);
        html+='<div class="booking-item"'+(unpaid?' style="border:2px solid #ef4444"':'')+'>'+
              '<div class="booking-time">'+esc(b.startTime)+' - '+esc(b.endTime)+'</div>'+
              '<div class="booking-info"><div class="booking-topic">'+esc(b.topic)+'</div>'+
              '<div class="booking-person">👤 '+esc(b.person)+(b.tenant?'　🏢 '+esc(b.tenant):'')+(unpaid?'　<span style="color:#ef4444;font-weight:700">⚠ 未繳費</span>':'')+'</div></div>'+
              '<div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" onclick="openBookModal('+b.id+')">編輯</button>'+
              '<button class="btn btn-danger btn-sm" onclick="deleteBooking('+b.id+')">刪除</button></div></div>';
      }
    }
    for(var k=0;k<deletedRb.length;k++){
      var db=deletedRb[k];
      var daysLeft = Math.max(0, Math.ceil((SOFT_DELETE_GRACE_MS - (Date.now() - new Date(db.deletedAt).getTime())) / (24*60*60*1000)));
      html+='<div class="booking-item" style="opacity:0.5;filter:grayscale(1)">'+
            '<div class="booking-time">'+esc(db.startTime)+' - '+esc(db.endTime)+'</div>'+
            '<div class="booking-info"><div class="booking-topic">'+esc(db.topic)+'</div>'+
            '<div class="booking-person">👤 '+esc(db.person)+(db.tenant?'　🏢 '+esc(db.tenant):'')+'　<span style="font-weight:700">已刪除（還剩 '+daysLeft+' 天後永久移除）</span></div></div>'+
            '<div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" onclick="restoreBooking('+db.id+')">復原</button>'+
            '<button class="btn btn-danger btn-sm" onclick="hardDeleteBooking('+db.id+')">永久刪除</button></div></div>';
    }
    html+='</div>';
  }
  cards.innerHTML=html;
}
```

（`SOFT_DELETE_GRACE_MS` 是 Task 1 已定義的模組層級變數，這裡直接沿用。）

- [ ] **Step 3: 用瀏覽器驗證月曆排除軟刪除、明細列表反灰顯示**

沿用 Task 1 已啟動的本機伺服器與登入繞過方式。

```javascript
(function(){
  meetings.rooms = [{id:'A',name:'A會議室',capacity:40}];
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth()+1;
  function pad(n){ return n<10?'0'+n:''+n; }
  var dateStr = y+'-'+pad(m)+'-'+pad(18);
  meetings.bookings = [
    { id:1, roomId:'A', date: dateStr, startTime:'14:00', endTime:'15:00', topic:'已刪除預約', person:'測試', deletedAt: new Date().toISOString() }
  ];
  showTab('meetings');

  var gridCells = document.querySelectorAll('#calendarGrid > div');
  var targetCell = Array.prototype.find.call(gridCells, function(c){ return c.textContent.trim().split('\n')[0] === '18'; });

  return {
    day18HasNoChips: targetCell ? !/14:00-15:00/.test(targetCell.innerHTML) : 'CELL_NOT_FOUND',
    day18NoRedBorder: targetCell ? !/ef4444/.test(targetCell.getAttribute('style')) : 'CELL_NOT_FOUND'
  };
})()
```

Expected：`day18HasNoChips` 為 `true`（軟刪除的預約完全不在月曆格子顯示色塊），`day18NoRedBorder` 為 `true`（不會因為軟刪除的預約而顯示紅框，因為它根本不算進 `dayBookings`）。

測試點日期展開後能看到反灰的軟刪除項目：

```javascript
(function(){
  var now = new Date();
  function pad(n){ return n<10?'0'+n:''+n; }
  var dateStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(18);
  selectCalendarDay(dateStr);

  var cardsHtml = document.getElementById('bookingCards').innerHTML;
  return {
    showsNoBookingPlaceholder: /本日無預約/.test(cardsHtml),
    showsDeletedItem: /已刪除預約/.test(cardsHtml),
    showsDaysLeftText: /已刪除（還剩 \d+ 天後永久移除）/.test(cardsHtml),
    showsRestoreButton: /restoreBooking\(1\)/.test(cardsHtml),
    showsHardDeleteButton: /hardDeleteBooking\(1\)/.test(cardsHtml),
    hasGrayscaleStyle: /opacity:0\.5/.test(cardsHtml)
  };
})()
```

Expected：`showsNoBookingPlaceholder` 為 `true`（正常預約清單是空的，因為那筆已軟刪除，只顯示「本日無預約」），`showsDeletedItem`/`showsDaysLeftText`/`showsRestoreButton`/`showsHardDeleteButton`/`hasGrayscaleStyle` 皆為 `true`。

- [ ] **Step 4: 確認無 console 錯誤，清除測試資料**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

```javascript
(function(){
  localStorage.removeItem('bbs_meetings');
  return 'cleaned';
})()
```

- [ ] **Step 5: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 月曆總表排除軟刪除預約，當天明細列表反灰顯示軟刪除項目並提供復原/永久刪除按鈕"
```

---

### Task 3: `shared/roomBoard.js` — `computeRoomState()` 排除軟刪除預約

**Files:**
- Modify: `shared/roomBoard.js`

**背景**：門口螢幕顯示引擎目前計算房間使用狀態時，沒有排除軟刪除的預約，會導致已被管理員刪除（即使還在 7 天緩衝期內）的預約繼續在門口螢幕顯示為使用中或列在今日剩餘預約清單裡，誤導訪客。

- [ ] **Step 1: 修改 `computeRoomState()`**

找到現有函式（`shared/roomBoard.js`，搜尋 `function computeRoomState`）：

Old:
```javascript
  function computeRoomState(meetings) {
    var bookings = (meetings.bookings || []).filter(function (b) { return b.roomId === ROOM_ID && b.date === today(); });
    var hm = nowHM();
    var current = bookings.filter(function (b) { return b.startTime <= hm && hm < b.endTime; })[0] || null;
    var upcoming = bookings.filter(function (b) { return b.endTime > hm; })
                            .sort(function (a, b) { return a.startTime < b.startTime ? -1 : 1; })
                            .slice(0, UPCOMING_MAX);
    return { current: current, upcoming: upcoming };
  }
```

New：
```javascript
  function computeRoomState(meetings) {
    var bookings = (meetings.bookings || []).filter(function (b) { return b.roomId === ROOM_ID && b.date === today() && !b.deletedAt; });
    var hm = nowHM();
    var current = bookings.filter(function (b) { return b.startTime <= hm && hm < b.endTime; })[0] || null;
    var upcoming = bookings.filter(function (b) { return b.endTime > hm; })
                            .sort(function (a, b) { return a.startTime < b.startTime ? -1 : 1; })
                            .slice(0, UPCOMING_MAX);
    return { current: current, upcoming: upcoming };
  }
```

- [ ] **Step 2: 用 Node 驗證排除軟刪除預約的邏輯正確**

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
var hmPlus1 = pad(now.getHours())+':'+pad((now.getMinutes()+1)%60);

var meetings = {
  bookings: [
    { id:1, roomId:'A', date: todayStr, startTime:'00:00', endTime: hmPlus1, topic:'已刪除的進行中會議', deletedAt: new Date().toISOString() },
    { id:2, roomId:'A', date: todayStr, startTime: hmPlus1, endTime:'23:59', topic:'有效的待會會議' }
  ]
};
var state = window.RoomBoard.computeRoomState(meetings);
console.log('current:', state.current);
console.log('upcomingCount:', state.upcoming.length);
console.log('upcomingTopic:', state.upcoming[0] ? state.upcoming[0].topic : null);
"
```

Expected output:
```
current: null
upcomingCount: 1
upcomingTopic: 有效的待會會議
```

（說明：第一筆雖然時段符合「使用中」，但因為已軟刪除，`current` 應為 `null`；`upcoming` 只應該有第二筆有效預約，軟刪除的那筆完全不出現在任何欄位。）

- [ ] **Step 3: 確認既有的 Task 7（`shared/roomBoard.js` 原始功能）測試仍然通過（無軟刪除欄位的資料照舊正常運作）**

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
var hmPlus1 = pad(now.getHours())+':'+pad((now.getMinutes()+1)%60);

var meetings = {
  bookings: [
    { id:1, roomId:'A', date: todayStr, startTime:'00:00', endTime: hmPlus1, topic:'進行中會議' },
    { id:2, roomId:'A', date: todayStr, startTime: hmPlus1, endTime:'23:59', topic:'待會的會議' },
    { id:3, roomId:'B', date: todayStr, startTime:'00:00', endTime:'23:59', topic:'別間房不該出現' }
  ]
};
var state = window.RoomBoard.computeRoomState(meetings);
console.log('current:', state.current ? state.current.topic : null);
console.log('upcomingCount:', state.upcoming.length);
"
```

Expected output:
```
current: 進行中會議
upcomingCount: 2
```

（這是確認沒有 `deletedAt` 欄位的一般預約，行為跟改動前完全一致，沒有回歸。）

- [ ] **Step 4: Commit**

```bash
git add shared/roomBoard.js
git commit -m "fix: 門口螢幕顯示引擎的房間狀態計算排除軟刪除的預約"
```

---

### Task 4: 端對端驗證 + 推送到 GitHub

**Files:** 無新增/修改檔案，純驗證與部署。

- [ ] **Step 1: 完整走一遍「刪除→月曆排除→明細反灰→復原成功→再刪除→永久刪除」的流程**

沿用前面任務已啟動的本機伺服器，開啟 `http://localhost:8765/renderer/admin/index.html`。

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  location.reload();
})()
```

```javascript
new Promise(function(resolve){
  setTimeout(function(){
    meetings.rooms = [{id:'A',name:'A會議室',capacity:40}];
    var now = new Date();
    function pad(n){ return n<10?'0'+n:''+n; }
    var dateStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(22);
    meetings.bookings = [
      { id:1, roomId:'A', date: dateStr, startTime:'10:00', endTime:'11:00', topic:'端對端測試', person:'測試人員' }
    ];
    showTab('meetings');
    selectCalendarDay(dateStr);

    var origConfirm = window.confirm;
    window.confirm = function(){ return true; };
    deleteBooking(1);
    window.confirm = origConfirm;

    setTimeout(function(){
      var cardsHtml = document.getElementById('bookingCards').innerHTML;
      var gridCells = document.querySelectorAll('#calendarGrid > div');
      var targetCell = Array.prototype.find.call(gridCells, function(c){ return c.textContent.trim().split('\n')[0] === '22'; });
      resolve({
        calendarNoLongerShowsChip: targetCell ? !/10:00-11:00/.test(targetCell.innerHTML) : 'CELL_NOT_FOUND',
        detailShowsGrayedItem: /已刪除（還剩/.test(cardsHtml)
      });
    }, 300);
  }, 500);
})
```

Expected：`calendarNoLongerShowsChip` 為 `true`，`detailShowsGrayedItem` 為 `true`。

```javascript
(function(){
  var deletedId = meetings.bookings.find(function(b){ return b.deletedAt; }).id;
  restoreBooking(deletedId);
  return new Promise(function(resolve){
    setTimeout(function(){
      var cardsHtml = document.getElementById('bookingCards').innerHTML;
      var gridCells = document.querySelectorAll('#calendarGrid > div');
      var now = new Date();
      function pad(n){ return n<10?'0'+n:''+n; }
      var targetCell = Array.prototype.find.call(gridCells, function(c){ return c.textContent.trim().split('\n')[0] === '22'; });
      resolve({
        restoredSuccessfully: !meetings.bookings.find(function(b){return b.id===deletedId;}).deletedAt,
        calendarChipBack: targetCell ? /10:00-11:00/.test(targetCell.innerHTML) : 'CELL_NOT_FOUND',
        detailNoLongerGrayed: !/已刪除（還剩/.test(cardsHtml)
      });
    }, 300);
  });
})()
```

Expected：`restoredSuccessfully`/`calendarChipBack`/`detailNoLongerGrayed` 皆為 `true`。

```javascript
(function(){
  var origConfirm = window.confirm;
  window.confirm = function(){ return true; };
  deleteBooking(1);
  hardDeleteBooking(1);
  window.confirm = origConfirm;
  return new Promise(function(resolve){
    setTimeout(function(){ resolve({ bookingCount: meetings.bookings.length }); }, 300);
  });
})()
```

Expected：`bookingCount` 為 `0`。

- [ ] **Step 2: 確認無 console 錯誤，清除測試資料**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

```javascript
(function(){
  localStorage.removeItem('bbs_meetings');
  return 'cleaned';
})()
```

- [ ] **Step 3: 檢查異動檔案範圍**

```bash
git log --oneline -6
git diff HEAD~4 --stat
```

Expected：只列出 `renderer/admin/index.html`、`shared/roomBoard.js`——不應該出現 `renderer/screen*`、`renderer/wall`、`renderer/floorboards`、`renderer/room0X`、`shared/roomBoardStyle.js`、`shared/api.js` 任何一項。

- [ ] **Step 4: 推送到 GitHub**

```bash
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

1. 在管理後台刪除一筆測試預約，確認它從月曆消失但在當天明細反灰顯示，並帶「還剩 7 天」的文字
2. 確認同一時段可以被新預約使用
3. 把剛剛的軟刪除項目按「復原」，確認正常恢復
4. 再刪除一次，這次按「永久刪除」，確認立即消失
5. 確認 5 台門口螢幕不會顯示已刪除（即使還在緩衝期內）的預約為使用中
