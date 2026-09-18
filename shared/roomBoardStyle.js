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
