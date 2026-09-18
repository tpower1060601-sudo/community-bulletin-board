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
