# 會議室預約管理後台改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把管理後台「會議室預約」分頁從單日列表改為月曆總表（顏色區分房間、未繳費紅框警示、點日期展開明細），房間清單收進收合面板，新增/編輯預約視窗改兩欄版面並加上業戶別／聯絡人／電話／已繳費欄位；同時把已上線的 5 個門口螢幕入口資料夾從 `room-a`~`room-e` 改名為 `room01`~`room05`。

**Architecture:** 全部改動集中在既有的 `renderer/admin/index.html`（單檔案 SPA），沿用既有的 `meetings.bookings` 資料結構直接擴充兩個新欄位（`tenant`、`paid`），不改 `shared/api.js` 的 schema（`bookings` 預設值本來就是空陣列，不需要遷移）。業戶別下拉選單讀取既有「水牌管理」的樓層公司名錄資料。入口資料夾改名用 `git mv`，純路徑異動，`shared/roomBoard.js` 等顯示邏輯完全不用改。

**Tech Stack:** 純 HTML/CSS/JavaScript（ES5 風格，無建置工具），localStorage + GitHub 備份同步（`shared/api.js`）。

**依據設計文件：** `docs/superpowers/specs/2026-09-18-meeting-room-admin-v2-design.md`

---

## 檔案異動總覽

| 檔案 | 動作 | 內容 |
|---|---|---|
| `renderer/admin/index.html` | 修改 | 業戶名錄載入、預約視窗兩欄改版、會議室預約分頁改為月曆總表、房間清單收合面板 |
| `renderer/room-a/` ~ `room-e/` | 改名搬移 | → `renderer/room01/` ~ `room05/`（內容不變） |

---

### Task 1: Admin — 載入水牌名錄資料供「業戶別」使用

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：新增預約視窗的「業戶別」下拉選單要讀取既有「水牌管理」（`floorList`）的樓層公司名錄。但 `floorList` 只有在使用者點開過「水牌管理」分頁時才會透過 `initFloorEditor()` 載入（`floorEditorInited` 懶載入旗標），如果使用者直接開「會議室預約」分頁新增預約，`floorList` 會是空陣列。這個任務新增一個獨立的 `tenantFloorList` 模組變數，跟其他資料一起在 `loadAll()` 裡主動載入，不依賴分頁造訪順序。

- [ ] **Step 1: 新增 `tenantFloorList` 模組變數**

找到既有模組變數宣告（`renderer/admin/index.html` 約第 580-586 行）：

Old:
```javascript
// State
var announcements  = { marquee:'', list:[] };
var announcementsV = { marquee:'', list:[] };
var meetings       = { rooms:[], bookings:[] };
var meetingAnnouncements = { marquee:'', list:[] };
var settings       = { windows:[] };
var _annDataset    = 'announcements'; // 目前 modal 操作的資料集
```

New：
```javascript
// State
var announcements  = { marquee:'', list:[] };
var announcementsV = { marquee:'', list:[] };
var meetings       = { rooms:[], bookings:[] };
var meetingAnnouncements = { marquee:'', list:[] };
var settings       = { windows:[] };
var _annDataset    = 'announcements'; // 目前 modal 操作的資料集
var tenantFloorList = []; // 業戶別下拉選單資料來源，獨立於水牌管理分頁的 floorList，主動在 loadAll() 載入
```

- [ ] **Step 2: `loadAll()` 一併載入 `floors` 資料**

找到 `loadAll()` 函式（約第 1646-1661 行）：

Old:
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

New（新增 `safeGet('floors')` 作為第 6 個項目，並移除已不存在的 `dateFilter` 參照）：
```javascript
function loadAll() {
  return Promise.all([safeGet('announcements'),safeGet('announcements_v'),safeGet('meetings'),safeGet('settings'),safeGet('meetingAnnouncements'),safeGet('floors')])
    .then(function(res){
      if(res[0]) announcements=res[0];
      if(res[1]) announcementsV=res[1];
      if(res[2]) meetings=res[2];
      if(res[3]) settings=res[3];
      if(res[4]) meetingAnnouncements=res[4];
      tenantFloorList = (res[5] && res[5].length) ? res[5] : window.FloorData.DEFAULT_FLOORS.map(function(f){
        return { floor:f.floor, company:f.company || '' };
      });
      // 把 api.js 合併後的 settings（含新視窗）存回 localStorage，確保視窗清單是最新的
      window.api.save('settings', settings);
      if($('topCommunity')) $('topCommunity').innerText=settings.communityName||'社區管理系統';
      renderAnnouncements();
      loadSettingsForm();
    });
}
```

（`dateFilter` 這個輸入框會在 Task 3 被月曆總表取代移除，這裡先把 `loadAll()` 裡對它的參照清乾淨，避免留著死程式碼；在 Task 3 完成前這一行移除不會造成任何行為變化，因為 `$('dateFilter')` 現在還存在、只是這行邏輯本來就只是設定預設日期，拿掉不影響任何既有功能。）

- [ ] **Step 3: `floors:updated` 背景同步監聽也一併更新 `tenantFloorList`**

找到既有監聽器（約第 2075-2080 行）：

Old:
```javascript
  window.api.on('floors:updated', function(d){
    floorList = (d && d.length) ? d : window.FloorData.DEFAULT_FLOORS.map(function(f){
      return { floor:f.floor, company:f.company || '', group:f.group || '' };
    });
    renderFloors();
  });
})();
```

New：
```javascript
  window.api.on('floors:updated', function(d){
    floorList = (d && d.length) ? d : window.FloorData.DEFAULT_FLOORS.map(function(f){
      return { floor:f.floor, company:f.company || '', group:f.group || '' };
    });
    tenantFloorList = (d && d.length) ? d : window.FloorData.DEFAULT_FLOORS.map(function(f){
      return { floor:f.floor, company:f.company || '' };
    });
    renderFloors();
  });
})();
```

- [ ] **Step 4: 用瀏覽器驗證 `tenantFloorList` 正確載入**

啟動本機靜態伺服器（例如 `python -m http.server 8765`，於 `C:\webpage` 目錄下用 Bash 執行並加 `run_in_background: true`），用 `mcp__Claude_Browser__*` 工具開啟 `http://localhost:8765/renderer/admin/index.html`。

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  location.reload();
})()
```

重新整理後：

```javascript
new Promise(function(resolve){
  setTimeout(function(){
    resolve({
      tenantFloorListLength: tenantFloorList.length,
      firstEntry: tenantFloorList[0],
      hasCompanyField: tenantFloorList.every(function(f){ return 'company' in f; })
    });
  }, 500);
})
```

Expected：`tenantFloorListLength` 大於 0（等於 `window.FloorData.DEFAULT_FLOORS` 的筆數，因為此時 `bbs_floors` 還沒被設定過），`firstEntry` 是一個有 `floor`/`company` 屬性的物件，`hasCompanyField` 為 `true`。

- [ ] **Step 5: 確認無 console 錯誤**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

Expected：無錯誤。

- [ ] **Step 6: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 管理後台主動載入水牌名錄資料，供會議室預約的業戶別欄位使用"
```

---

### Task 2: Admin — 新增/編輯預約視窗兩欄改版（業戶別／聯絡人／電話／已繳費）

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：現有的 `openBookModal()`/`saveBooking()` 只有會議室/日期/時間/主旨/聯絡人五個欄位，單欄排版。這個任務改成兩欄：左欄業戶別（下拉選水牌名錄，選「其他」可手動輸入）＋聯絡人＋電話，右欄維持會議室/日期/時間/主旨；下方新增「已收取場地費」勾選框。`booking` 物件新增 `tenant`／`phone`／`paid` 三個欄位（`person` 欄位語意不變，仍是聯絡人姓名）。

- [ ] **Step 1: 改寫 `openBookModal()`**

找到現有函式（`renderer/admin/index.html` 約第 1441-1466 行）：

Old:
```javascript
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
```

New：
```javascript
function openBookModal(id) {
  var b = (meetings.bookings||[]).find(function(x){ return x.id === id; }) || {};
  var isNew = !b.id;
  var rooms = meetings.rooms || [];
  var defaultDate = (typeof _selectedCalendarDate !== 'undefined' && _selectedCalendarDate) || today();

  var tenantOpts = tenantFloorList.filter(function(f){ return f.company; }).map(function(f){
    return f.floor + ' - ' + f.company;
  });
  var tenantIsKnown = !!b.tenant && tenantOpts.indexOf(b.tenant) > -1;
  var tenantSelectValue = b.tenant ? (tenantIsKnown ? b.tenant : '__other__') : '';
  var tenantManualValue = (b.tenant && !tenantIsKnown) ? b.tenant : '';
  var tenantOptionsHtml = '<option value="">── 請選擇 ──</option>' +
    tenantOpts.map(function(t){ return '<option value="'+esc(t)+'"'+(t===tenantSelectValue?' selected':'')+'>'+esc(t)+'</option>'; }).join('') +
    '<option value="__other__"'+(tenantSelectValue==='__other__'?' selected':'')+'>── 其他（手動輸入）──</option>';

  var paidChecked = isNew ? false : (b.paid !== false);

  $('modalTitle').innerText = isNew ? '新增預約' : '編輯預約';
  $('modalBody').innerHTML =
    '<div class="form-row" style="align-items:start">' +
      '<div>' +
        '<div class="form-group"><label>業戶別</label>' +
          '<select id="bkTenantSelect" onchange="toggleTenantManual()">'+tenantOptionsHtml+'</select>' +
          '<input type="text" id="bkTenantManual" placeholder="輸入業戶名稱" value="'+esc(tenantManualValue)+'" style="margin-top:8px;display:'+(tenantSelectValue==='__other__'?'block':'none')+'">' +
        '</div>' +
        '<div class="form-group"><label>聯絡人</label><input type="text" id="bkPerson" value="'+esc(b.person||'')+'"></div>' +
        '<div class="form-group"><label>電話</label><input type="text" id="bkPhone" value="'+esc(b.phone||'')+'"></div>' +
      '</div>' +
      '<div>' +
        '<div class="form-group"><label>會議室</label><select id="bkRoomId">' +
          rooms.map(function(r){ return '<option value="'+esc(r.id)+'"'+(b.roomId===r.id?' selected':'')+'>'+esc(r.name)+'</option>'; }).join('') +
        '</select></div>' +
        '<div class="form-group"><label>日期</label><input type="date" id="bkDate" value="'+esc(b.date||defaultDate)+'"></div>' +
        '<div class="form-row">' +
          '<div class="form-group"><label>開始時間</label><input type="time" id="bkStartTime" value="'+esc(b.startTime||'09:00')+'"></div>' +
          '<div class="form-group"><label>結束時間</label><input type="time" id="bkEndTime" value="'+esc(b.endTime||'10:00')+'"></div>' +
        '</div>' +
        '<div class="form-group"><label>會議主旨</label><input type="text" id="bkTopic" value="'+esc(b.topic||'')+'"></div>' +
      '</div>' +
    '</div>' +
    '<div style="margin-top:4px;padding-top:16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px">' +
      '<input type="checkbox" id="bkPaid" style="width:18px;height:18px"'+(paidChecked?' checked':'')+'>' +
      '<label for="bkPaid" style="margin:0;cursor:pointer">已收取場地費（未勾選會在總表用紅框警示）</label>' +
    '</div>';

  $('modalFooter').innerHTML =
    (isNew ? '' : '<button class="btn btn-warning" onclick="deleteBooking('+id+')">刪除</button>') +
    '<div style="flex:1"></div>' +
    '<button class="btn btn-ghost" onclick="closeModal()">取消</button>' +
    '<button class="btn btn-primary" onclick="saveBooking('+(id||0)+')">儲存</button>';
  $('modalBackdrop').classList.add('open');
}

function toggleTenantManual() {
  var sel = $('bkTenantSelect'), manual = $('bkTenantManual');
  if (!sel || !manual) return;
  manual.style.display = (sel.value === '__other__') ? 'block' : 'none';
}
```

（`defaultDate` 那行用 `typeof _selectedCalendarDate !== 'undefined'` 防呆是因為 `_selectedCalendarDate` 這個變數要到 Task 3 才會被宣告；這樣寫可以讓 Task 2 單獨測試時不會因為變數不存在而報錯，Task 3 完成後這個防呆判斷仍然正確運作，不需要再改。）

- [ ] **Step 2: 改寫 `saveBooking()` 儲存新欄位**

找到現有函式（約第 1468-1498 行）：

Old:
```javascript
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
```

New：
```javascript
function saveBooking(id) {
  var tenantSelect = $('bkTenantSelect').value;
  var tenant = tenantSelect === '__other__' ? $('bkTenantManual').value.trim() : tenantSelect;
  var updated = {
    id: id || new Date().getTime(),
    roomId: $('bkRoomId').value,
    date: $('bkDate').value,
    startTime: $('bkStartTime').value,
    endTime: $('bkEndTime').value,
    topic: $('bkTopic').value,
    person: $('bkPerson').value,
    phone: $('bkPhone').value,
    tenant: tenant,
    paid: $('bkPaid').checked
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
    if (typeof renderCalendar === 'function') renderCalendar();
    renderBookings();
    closeModal();
    triggerBackup();
  });
}
```

（`if (typeof renderCalendar === 'function') renderCalendar();` 這個防呆判斷是因為 `renderCalendar()` 要到 Task 3 才會定義；Task 3 完成後這個判斷永遠為真，正常呼叫。）

- [ ] **Step 3: 用瀏覽器驗證新版預約視窗**

沿用 Task 1 已啟動的本機伺服器與登入繞過方式。

```javascript
(function(){
  meetings.rooms = [{id:'A',name:'A會議室',capacity:40}];
  meetings.bookings = [];
  tenantFloorList = [{floor:'4A',company:'威傑士國際開發有限公司'},{floor:'8D',company:'想想國際餐飲集團'}];

  openBookModal(0);
  var hasBkTenantSelect = !!document.getElementById('bkTenantSelect');
  var hasBkPhone = !!document.getElementById('bkPhone');
  var paidCheckedByDefault = document.getElementById('bkPaid').checked;
  var tenantOptionCount = document.getElementById('bkTenantSelect').options.length;

  return {
    hasBkTenantSelect: hasBkTenantSelect,
    hasBkPhone: hasBkPhone,
    paidCheckedByDefaultForNew: paidCheckedByDefault,
    tenantOptionCount: tenantOptionCount
  };
})()
```

Expected：`hasBkTenantSelect`/`hasBkPhone` 皆為 `true`，`paidCheckedByDefaultForNew` 為 `false`（新增預約預設不勾選已繳費），`tenantOptionCount` 為 4（請選擇 + 2 間水牌業戶 + 其他）。

測試選「其他」手動輸入業戶名稱、填完表單、儲存：

```javascript
(function(){
  var sel = document.getElementById('bkTenantSelect');
  sel.value = '__other__';
  toggleTenantManual();
  var manualVisible = document.getElementById('bkTenantManual').style.display !== 'none';

  document.getElementById('bkTenantManual').value = '社區住戶自治會';
  document.getElementById('bkDate').value = '2026-09-25';
  document.getElementById('bkStartTime').value = '10:00';
  document.getElementById('bkEndTime').value = '11:00';
  document.getElementById('bkTopic').value = '住戶座談';
  document.getElementById('bkPerson').value = '陳先生';
  document.getElementById('bkPhone').value = '0912-345-678';
  document.getElementById('bkPaid').checked = true;
  saveBooking(0);

  return new Promise(function(resolve){
    setTimeout(function(){
      var saved = meetings.bookings[0];
      resolve({
        manualVisible: manualVisible,
        savedTenant: saved.tenant,
        savedPhone: saved.phone,
        savedPaid: saved.paid
      });
    }, 200);
  });
})()
```

Expected：`manualVisible` 為 `true`，`savedTenant` 為 `'社區住戶自治會'`，`savedPhone` 為 `'0912-345-678'`，`savedPaid` 為 `true`。

測試編輯剛剛存的預約，確認業戶別下拉正確回填「其他」且手動欄位帶出原值，已繳費勾選狀態正確回填：

```javascript
(function(){
  var id = meetings.bookings[0].id;
  openBookModal(id);
  return {
    tenantSelectValue: document.getElementById('bkTenantSelect').value,
    tenantManualValue: document.getElementById('bkTenantManual').value,
    tenantManualVisible: document.getElementById('bkTenantManual').style.display !== 'none',
    paidChecked: document.getElementById('bkPaid').checked
  };
})()
```

Expected：`tenantSelectValue` 為 `'__other__'`，`tenantManualValue` 為 `'社區住戶自治會'`，`tenantManualVisible` 為 `true`，`paidChecked` 為 `true`。

再測試編輯一筆「沒有 `paid` 欄位」的舊資料，確認視為已繳費（勾選）：

```javascript
(function(){
  meetings.bookings.push({ id:999, roomId:'A', date:'2026-09-01', startTime:'09:00', endTime:'10:00', topic:'舊資料測試', person:'舊聯絡人' });
  openBookModal(999);
  return { legacyPaidChecked: document.getElementById('bkPaid').checked };
})()
```

Expected：`legacyPaidChecked` 為 `true`（沒有 `paid` 欄位的舊資料視為已繳費）。

- [ ] **Step 4: 確認無 console 錯誤，清除測試資料**

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

- [ ] **Step 5: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 新增/編輯預約視窗改兩欄版面，加入業戶別/聯絡人/電話/已繳費欄位"
```

---

### Task 3: Admin — 會議室預約分頁重建：月曆總表 + 房間清單收合面板

**Files:**
- Modify: `renderer/admin/index.html`

**背景**：這是本次改版的核心任務。把「日期選擇器 + 每天固定顯示 5 張房間卡片」的舊版面，改成「月曆總表為主，點日期才展開當天明細」；房間清單維護表格收進預設收合的面板；月曆格子用固定顏色區分房間，當天有未繳費預約的日期格子要有紅色外框警示。

- [ ] **Step 1: 替換 `tab-meetings` 的 HTML 結構**

找到現有的 `tab-meetings` HTML（`renderer/admin/index.html` 約第 268-291 行）：

Old:
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

New：
```html
    <!-- Meetings -->
    <div id="tab-meetings" style="display:none">
      <div class="page-header">
        <div class="page-title">會議室<span>預約</span></div>
        <button class="btn btn-primary" onclick="openBookModal(0)">＋ 新增預約</button>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:12px">
          <button class="btn btn-ghost btn-sm" onclick="changeCalendarMonth(-1)">◀</button>
          <div id="calendarLabel" style="font-size:18px;font-weight:700;min-width:120px;text-align:center"></div>
          <button class="btn btn-ghost btn-sm" onclick="changeCalendarMonth(1)">▶</button>
        </div>
        <div id="roomColorLegend" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-bottom:14px;font-size:12px"></div>
        <div id="calendarGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px"></div>
      </div>
      <div id="bookingCards"></div>
      <div class="card">
        <div class="card-title" style="cursor:pointer" onclick="toggleRoomListPanel()">
          <span id="roomListToggleIcon">▸</span> 房間清單設定
        </div>
        <div id="roomListPanel" style="display:none;margin-top:14px">
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
      </div>
    </div>
```

- [ ] **Step 2: 新增月曆狀態變數、房間顏色對照、收合面板切換函式**

在既有 `nextRoomId()` 函式（`renderRoomList()` 之前，約第 1380 行附近，搜尋 `function nextRoomId`）**之前**加入：

```javascript
/* ══════════════════════════════════════════════════════════════
   會議室月曆總表
   ══════════════════════════════════════════════════════════════ */
var _calendarYear, _calendarMonth; // _calendarMonth 為 0-11（JS Date 慣例）
var _selectedCalendarDate = null;  // 目前展開明細的日期字串（YYYY-MM-DD），null = 未展開

var ROOM_COLOR_MAP = { A:'#3b82f6', B:'#22c55e', C:'#f59e0b', D:'#a855f7', E:'#ef4444' };
function roomColor(roomId) { return ROOM_COLOR_MAP[roomId] || '#6b7280'; }

function isBookingPaid(b) { return b.paid !== false; }

function pad2(n) { return n < 10 ? '0'+n : ''+n; }

function initCalendarState() {
  if (_calendarYear === undefined) {
    var now = new Date();
    _calendarYear = now.getFullYear();
    _calendarMonth = now.getMonth();
  }
}

function changeCalendarMonth(delta) {
  initCalendarState();
  _calendarMonth += delta;
  if (_calendarMonth < 0) { _calendarMonth = 11; _calendarYear--; }
  if (_calendarMonth > 11) { _calendarMonth = 0; _calendarYear++; }
  renderCalendar();
}

function selectCalendarDay(dateStr) {
  _selectedCalendarDate = dateStr;
  renderCalendar();
  renderBookings();
}

function renderRoomLegend() {
  var el = $('roomColorLegend'); if (!el) return;
  var rooms = meetings.rooms || [];
  el.innerHTML = rooms.map(function(r){
    return '<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:12px;height:12px;border-radius:3px;background:'+roomColor(r.id)+';display:inline-block"></span>'+esc(r.name)+'</span>';
  }).join('');
}

function renderCalendar() {
  var grid = $('calendarGrid'), label = $('calendarLabel');
  if (!grid || !label) return;
  initCalendarState();
  renderRoomLegend();
  label.innerText = _calendarYear + '年' + (_calendarMonth+1) + '月';

  var firstDay = new Date(_calendarYear, _calendarMonth, 1);
  var startWeekday = firstDay.getDay();
  var daysInMonth = new Date(_calendarYear, _calendarMonth+1, 0).getDate();
  var bookings = meetings.bookings || [];

  var html = '';
  var weekdayNames = ['日','一','二','三','四','五','六'];
  for (var w=0; w<7; w++) html += '<div style="text-align:center;color:var(--text2);font-size:12px;padding:4px 0">'+weekdayNames[w]+'</div>';

  for (var i=0; i<startWeekday; i++) html += '<div></div>';

  for (var d=1; d<=daysInMonth; d++) {
    var dateStr = _calendarYear+'-'+pad2(_calendarMonth+1)+'-'+pad2(d);
    var dayBookings = bookings.filter(function(b){ return b.date === dateStr; });
    var hasUnpaid = dayBookings.some(function(b){ return !isBookingPaid(b); });
    var isSelected = dateStr === _selectedCalendarDate;
    var chips = dayBookings.map(function(b){
      return '<div style="background:'+roomColor(b.roomId)+';color:#fff;border-radius:3px;padding:1px 5px;margin-top:2px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(b.roomId)+' '+esc(b.startTime)+'-'+esc(b.endTime)+'</div>';
    }).join('');
    var border = hasUnpaid ? '2px solid #ef4444' : (isSelected ? '2px solid var(--accent)' : '1px solid var(--border)');
    var bg = hasUnpaid ? 'rgba(239,68,68,.08)' : (isSelected ? 'rgba(255,255,255,.06)' : 'transparent');
    html += '<div onclick="selectCalendarDay(\''+dateStr+'\')" style="border:'+border+';background:'+bg+';min-height:70px;padding:4px;border-radius:6px;cursor:pointer">'+
      '<div style="font-size:12px;opacity:.7">'+d+'</div>'+chips+'</div>';
  }

  grid.innerHTML = html;
}

function toggleRoomListPanel() {
  var panel = $('roomListPanel'), icon = $('roomListToggleIcon');
  if (!panel) return;
  var open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (icon) icon.innerText = open ? '▸' : '▾';
}
```

- [ ] **Step 3: 改寫 `renderBookings()`，改為渲染「目前展開日期」的明細，並加上未繳費紅色標示**

找到現有函式（約第 1511-1534 行）：

Old:
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

New：
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

- [ ] **Step 4: `deleteBooking()` 儲存後一併刷新月曆**

找到現有函式（約第 1500-1509 行）：

Old:
```javascript
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

New：
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

- [ ] **Step 5: `showTab()` 的 `meetings` 分支加入月曆渲染**

找到 `showTab()` 函式（約第 596-608 行）：

Old:
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

New：
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

- [ ] **Step 6: `meetings:updated` 背景同步監聽加入月曆刷新**

找到既有監聽器（搜尋 `meetings:updated`）：

Old:
```javascript
  window.api.on('meetings:updated', function(d){ meetings = d; renderRoomList(); renderBookings(); });
```

New：
```javascript
  window.api.on('meetings:updated', function(d){ meetings = d; renderRoomList(); renderCalendar(); renderBookings(); });
```

- [ ] **Step 7: 用瀏覽器驗證月曆總表、未繳費紅框、點日展開、房間清單收合**

沿用前面任務已啟動的本機伺服器與登入繞過方式。

```javascript
(function(){
  sessionStorage.setItem('adm_auth','1');
  meetings.rooms = [
    { id:'A', name:'A會議室', capacity:40 },
    { id:'B', name:'B1會議室', capacity:20 }
  ];
  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth()+1;
  function pad(n){ return n<10?'0'+n:''+n; }
  var dateStr = y+'-'+pad(m)+'-'+pad(15);
  meetings.bookings = [
    { id:1, roomId:'A', date: dateStr, startTime:'14:00', endTime:'15:00', topic:'測試會議', person:'王小姐', paid:true },
    { id:2, roomId:'B', date: dateStr, startTime:'10:00', endTime:'11:00', topic:'未繳費測試', person:'陳先生', paid:false }
  ];
  showTab('meetings');

  var legendHtml = document.getElementById('roomColorLegend').innerHTML;
  var gridCells = document.querySelectorAll('#calendarGrid > div');
  var targetCell = Array.prototype.find.call(gridCells, function(c){ return c.innerHTML.indexOf('>15<') > -1 || c.textContent.trim().split('\n')[0] === '15'; });

  return {
    calendarLabelText: document.getElementById('calendarLabel').innerText,
    legendShowsRoomNames: /A會議室/.test(legendHtml) && /B1會議室/.test(legendHtml),
    day15HasRedBorder: targetCell ? /ef4444/.test(targetCell.getAttribute('style')) : 'CELL_NOT_FOUND',
    day15ShowsChips: targetCell ? (/A 14:00-15:00/.test(targetCell.innerHTML) && /B 10:00-11:00/.test(targetCell.innerHTML)) : 'CELL_NOT_FOUND'
  };
})()
```

Expected：`calendarLabelText` 是「YYYY年M月」格式且年月等於今天所在月份，`legendShowsRoomNames` 為 `true`，`day15HasRedBorder` 為 `true`（因為當天有一筆 `paid:false`），`day15ShowsChips` 為 `true`。

測試點擊日期展開明細：

```javascript
(function(){
  var now = new Date();
  function pad(n){ return n<10?'0'+n:''+n; }
  var dateStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(15);
  selectCalendarDay(dateStr);

  var cardsHtml = document.getElementById('bookingCards').innerHTML;
  return {
    showsRoomA: /A會議室/.test(cardsHtml),
    showsRoomB: /B1會議室/.test(cardsHtml),
    showsUnpaidWarning: /⚠ 未繳費/.test(cardsHtml),
    showsPaidBookingWithoutWarning: (function(){
      var idx = cardsHtml.indexOf('測試會議');
      var snippet = cardsHtml.slice(Math.max(0,idx-50), idx+200);
      return snippet.indexOf('⚠') === -1;
    })()
  };
})()
```

Expected：`showsRoomA`/`showsRoomB` 皆為 `true`，`showsUnpaidWarning` 為 `true`（B1 會議室那筆），`showsPaidBookingWithoutWarning` 為 `true`（A 會議室那筆已繳費，不該有警示文字）。

測試月份切換：

```javascript
(function(){
  var before = document.getElementById('calendarLabel').innerText;
  changeCalendarMonth(1);
  var after = document.getElementById('calendarLabel').innerText;
  changeCalendarMonth(-1);
  var backToOriginal = document.getElementById('calendarLabel').innerText;
  return { before: before, after: after, backToOriginal: backToOriginal, changed: before !== after, restored: before === backToOriginal };
})()
```

Expected：`changed` 為 `true`，`restored` 為 `true`。

測試房間清單收合面板：

```javascript
(function(){
  var initiallyHidden = document.getElementById('roomListPanel').style.display === 'none';
  toggleRoomListPanel();
  var visibleAfterToggle = document.getElementById('roomListPanel').style.display !== 'none';
  var roomListBodyHtml = document.getElementById('roomListBody').innerHTML;
  toggleRoomListPanel();
  var hiddenAfterSecondToggle = document.getElementById('roomListPanel').style.display === 'none';
  return {
    initiallyHidden: initiallyHidden,
    visibleAfterToggle: visibleAfterToggle,
    roomListStillWorks: /A會議室/.test(roomListBodyHtml),
    hiddenAfterSecondToggle: hiddenAfterSecondToggle
  };
})()
```

Expected：全部為 `true`（預設收起、點擊展開能看到既有房間清單表格內容、再點一次收起）。

- [ ] **Step 8: 確認無 console 錯誤，清除測試資料**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

```javascript
(function(){
  localStorage.removeItem('bbs_meetings');
  return 'cleaned';
})()
```

- [ ] **Step 9: Commit**

```bash
git add renderer/admin/index.html
git commit -m "feat: 會議室預約分頁改為月曆總表（顏色區分房間、未繳費紅框、點日展開明細），房間清單改收合面板"
```

---

### Task 4: 入口資料夾改名 `room-a`~`room-e` → `room01`~`room05`

**Files:**
- Rename: `renderer/room-a/index.html` → `renderer/room01/index.html`
- Rename: `renderer/room-b/index.html` → `renderer/room02/index.html`
- Rename: `renderer/room-c/index.html` → `renderer/room03/index.html`
- Rename: `renderer/room-d/index.html` → `renderer/room04/index.html`
- Rename: `renderer/room-e/index.html` → `renderer/room05/index.html`

**背景**：舊系統（172.18.0.251）的門口螢幕看板網址是 `room01.html`~`room05.html`，這是現場 5 台實體螢幕已經熟悉、之後要沿用的命名慣例。內容完全不變（`ROOM_ID` 全域變數值不變，仍是 `'A'`~`'E'`，只是外層資料夾/網址路徑改名），對應順序：`room01`=A、`room02`=B、`room03`=C、`room04`=D、`room05`=E。

- [ ] **Step 1: 用 `git mv` 改名搬移 5 個資料夾**

```bash
git mv renderer/room-a/index.html renderer/room01/index.html
git mv renderer/room-b/index.html renderer/room02/index.html
git mv renderer/room-c/index.html renderer/room03/index.html
git mv renderer/room-d/index.html renderer/room04/index.html
git mv renderer/room-e/index.html renderer/room05/index.html
```

- [ ] **Step 2: 確認舊資料夾已消失、新資料夾內容正確**

```bash
ls renderer/room-a 2>&1 || echo "room-a 已不存在（正確）"
ls renderer/room-b 2>&1 || echo "room-b 已不存在（正確）"
ls renderer/room-c 2>&1 || echo "room-c 已不存在（正確）"
ls renderer/room-d 2>&1 || echo "room-d 已不存在（正確）"
ls renderer/room-e 2>&1 || echo "room-e 已不存在（正確）"
cat renderer/room01/index.html
cat renderer/room03/index.html
```

Expected：前 5 個指令都印出「已不存在（正確）」；`renderer/room01/index.html` 內容裡 `var ROOM_ID = 'A';` 值仍是 `'A'`（不是 `'01'`），`renderer/room03/index.html` 內容裡 `var ROOM_ID = 'C';` 值仍是 `'C'`。

- [ ] **Step 3: 確認 git 正確識別為「改名」而非「刪除+新增」**

```bash
git status
git diff --cached --stat
```

Expected：`git status` 顯示 5 個 `renamed:` 項目（例如 `renamed: renderer/room-a/index.html -> renderer/room01/index.html`），而不是分開的 `deleted:`/`new file:`；`git diff --cached --stat` 應該顯示每個檔案改動的行數是 0 或極少（因為內容完全沒變，只有路徑變了，git 應能偵測出高相似度）。

- [ ] **Step 4: 用瀏覽器驗證新網址仍能正常顯示**

沿用前面任務已啟動的本機伺服器。

```javascript
(function(){
  function pad(n){ return String(n).padStart(2,'0'); }
  var now = new Date();
  var todayStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
  var hmPlus1 = pad(now.getHours())+':'+pad((now.getMinutes()+1)%60);

  localStorage.setItem('bbs_meetings', JSON.stringify({
    rooms: [{ id:'A', name:'測試會議室', capacity: 30 }],
    bookings: [{ id:1, roomId:'A', date: todayStr, startTime:'00:00', endTime: hmPlus1, topic:'改名後測試' }]
  }));
  localStorage.setItem('bbs_meetingAnnouncements', JSON.stringify({ marquee:'', list: [] }));
  window.location.href = 'http://localhost:8765/renderer/room01/';
  return 'navigating';
})()
```

```javascript
new Promise(function(resolve){
  setTimeout(function(){
    var slides = document.querySelectorAll('.rb-slide');
    resolve({
      slideCount: slides.length,
      showsRoomName: slides.length ? /測試會議室/.test(slides[0].innerHTML) : 'NO_SLIDES',
      showsCurrentTopic: slides.length ? /改名後測試/.test(slides[0].innerHTML) : 'NO_SLIDES'
    });
  }, 800);
})
```

Expected：`slideCount` 大於 0，`showsRoomName`/`showsCurrentTopic` 皆為 `true`（證明 `renderer/room01/index.html` 改名後 `ROOM_ID='A'` 依然正確運作，能找到房間並顯示狀態）。

清除測試資料：

```javascript
(function(){
  localStorage.removeItem('bbs_meetings');
  localStorage.removeItem('bbs_meetingAnnouncements');
  return 'cleaned';
})()
```

- [ ] **Step 5: 確認無 console 錯誤**

```
mcp__Claude_Browser__read_console_messages({ onlyErrors: true })
```

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: 會議室門口顯示入口資料夾改名 room-a~room-e 為 room01~room05，對齊舊系統既有網址命名"
```

（`git mv` 已經把改動加進暫存區，這裡不需要再 `git add`。）

---

### Task 5: 端對端驗證 + 推送到 GitHub

**Files:** 無新增/修改檔案，純驗證與部署。

- [ ] **Step 1: 完整走一遍管理後台流程，確認 4 個任務整合起來沒有互相干擾**

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
    showTab('meetings');
    resolve({
      calendarRendered: !!document.getElementById('calendarGrid').innerHTML,
      roomListPanelCollapsedByDefault: document.getElementById('roomListPanel').style.display === 'none',
      tenantDataLoaded: tenantFloorList.length > 0
    });
  }, 600);
})
```

Expected：全部為 `true`。

完整跑一次「新增預約（含業戶別/電話/已繳費）→ 月曆顯示色塊與紅框 → 點日展開明細看到警示 → 編輯改成已繳費 → 紅框消失 → 刪除」的流程：

```javascript
(function(){
  var now = new Date();
  function pad(n){ return n<10?'0'+n:''+n; }
  var dateStr = now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(20);

  openBookModal(0);
  document.getElementById('bkRoomId').value = meetings.rooms[0].id;
  document.getElementById('bkDate').value = dateStr;
  document.getElementById('bkStartTime').value = '13:00';
  document.getElementById('bkEndTime').value = '14:00';
  document.getElementById('bkTopic').value = '端對端測試會議';
  document.getElementById('bkPerson').value = '測試人員';
  document.getElementById('bkPhone').value = '0900-000-000';
  // 業戶別留空、已繳費維持預設不勾（模擬最簡單的必填情境）
  saveBooking(0);

  return new Promise(function(resolve){
    setTimeout(function(){
      var cell = Array.prototype.find.call(document.querySelectorAll('#calendarGrid > div'), function(c){
        return c.textContent.trim().split('\n')[0] === '20';
      });
      resolve({
        savedUnpaidByDefault: meetings.bookings[0].paid === false,
        day20HasRedBorder: cell ? /ef4444/.test(cell.getAttribute('style')) : 'CELL_NOT_FOUND'
      });
    }, 300);
  });
})()
```

Expected：`savedUnpaidByDefault` 為 `true`（沒勾已繳費），`day20HasRedBorder` 為 `true`。

```javascript
(function(){
  var id = meetings.bookings[0].id;
  openBookModal(id);
  document.getElementById('bkPaid').checked = true;
  saveBooking(id);

  return new Promise(function(resolve){
    setTimeout(function(){
      var cell = Array.prototype.find.call(document.querySelectorAll('#calendarGrid > div'), function(c){
        return c.textContent.trim().split('\n')[0] === '20';
      });
      resolve({
        nowPaid: meetings.bookings[0].paid === true,
        day20RedBorderGone: cell ? !/ef4444/.test(cell.getAttribute('style')) : 'CELL_NOT_FOUND'
      });
    }, 300);
  });
})()
```

Expected：`nowPaid` 為 `true`，`day20RedBorderGone` 為 `true`（改成已繳費後紅框消失）。

```javascript
(function(){
  var origConfirm = window.confirm;
  window.confirm = function(){ return true; };
  deleteBooking(meetings.bookings[0].id);
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

- [ ] **Step 3: 檢查異動檔案範圍，確認沒有動到不相關的既有畫面**

```bash
git log --oneline -8
git diff HEAD~5 --stat
```

Expected：只列出 `renderer/admin/index.html`、5 個 `room0X` 改名項目——不應該出現 `renderer/screen*`、`renderer/wall`、`renderer/floorboards`、`shared/roomBoard.js`、`shared/roomBoardStyle.js`、`shared/api.js` 任何一項（這次改版完全不需要動這些檔案）。

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

1. 到管理後台「會議室預約」確認月曆總表正常顯示、房間顏色跟房間清單面板裡的房間對得上
2. 新增一筆預約，測試業戶別下拉選單能不能正確選到水牌名錄裡的公司；也測試選「其他」手動輸入
3. 故意不勾「已收取場地費」存檔，確認當天日期格子跟展開後的明細都有紅色警示；之後把它改成已勾選存檔，確認警示消失
4. 確認 5 台門口螢幕目前的網址如果之前已經照 `room-a`~`room-e` 設定過，這次要記得改成 `room01`~`room05`（網域維持不變，只改路徑最後那段）
