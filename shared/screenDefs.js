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
