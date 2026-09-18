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
