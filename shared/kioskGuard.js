/* shared/kioskGuard.js — 展示畫面自我恢復（取代 <meta http-equiv="refresh">）
   meta refresh 是盲目重載：重載那一刻若剛好斷網或 GitHub Pages 回 5xx，畫面會停在
   瀏覽器錯誤頁，錯誤頁上沒有任何程式碼，之後永遠不會再重試。
   這裡改成「先確認伺服器有回 200 才重載」，連不上就保留目前畫面，1 分鐘後再試。
   刻意寫成 ES5（水牌機是 Win7 + Supermium）。 */
(function () {
  'use strict';
  var RELOAD_MS = 30 * 60 * 1000; // 正常每 30 分鐘重載一次，順便拿到新版程式
  var RETRY_MS  = 60 * 1000;      // 連不上時每 1 分鐘重試

  function check() {
    var xhr = new XMLHttpRequest();
    var url = location.href.split('#')[0];
    url += (url.indexOf('?') === -1 ? '?' : '&') + '_kg=' + Date.now();
    xhr.open('GET', url, true);
    xhr.timeout = 20000;
    xhr.onload = function () {
      if (xhr.status === 200) location.reload();
      else setTimeout(check, RETRY_MS);
    };
    xhr.onerror = xhr.ontimeout = function () { setTimeout(check, RETRY_MS); };
    try { xhr.send(); } catch (e) { setTimeout(check, RETRY_MS); }
  }

  setTimeout(check, RELOAD_MS);
})();
