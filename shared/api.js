/* shared/api.js — localStorage-based window.api for GitHub Pages deployment */
(function () {
  'use strict';

  const PREFIX = 'bbs_';

  const DEFAULTS = {
    announcements: { marquee: '歡迎光臨！', list: [] },
    settings: {
      communityName: '幸福社區',
      weatherApiKey: '', weatherCity: 'Taipei',
      newsEnabled: false, newsSource: '',
      youtubeId: '', youtubeId2: '',
      meetingsUrl: '', meetingsZoom: 1.0,
      adminPassword: 'admin', adminPort: 8080,
      windows: [
        { id: 'screen1', title: '公告欄 A',      enabled: true  },
        { id: 'screen2', title: '公告欄 B',       enabled: true  },
        { id: 'screen3', title: '匯率時鐘',       enabled: true  },
        { id: 'screen4', title: '即時天氣',       enabled: true  },
        { id: 'screen5', title: '圖片輪播',       enabled: true  },
        { id: 'screen6', title: '影片播放',       enabled: true  },
        { id: 'screen7', title: '即時新聞看板',   enabled: true  },
        { id: 'screen8', title: 'YouTube 頻道 1', enabled: true  },
        { id: 'screen9', title: 'YouTube 頻道 2', enabled: true  },
      ],
    },
    meetings: { rooms: ['會議室A', '會議室B', '會議室C'], bookings: [] },
    news: [],
  };

  /* ── localStorage helpers ─────────────────────────────────────────────── */
  function lsGet(key) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) {
        const stored = JSON.parse(raw);
        // 當 key 為 settings，自動補上 DEFAULTS 裡有但 localStorage 沒有的視窗，
        // 同時更新已有視窗的標題（避免舊快取顯示過時名稱）
        if (key === 'settings' && DEFAULTS.settings.windows) {
          const wins = stored.windows || [];
          DEFAULTS.settings.windows.forEach(function(dw) {
            const idx = wins.findIndex(function(w) { return w.id === dw.id; });
            if (idx === -1) {
              wins.push(JSON.parse(JSON.stringify(dw))); // 補上缺少的視窗
            } else {
              wins[idx].title = dw.title; // 更新標題
            }
          });
          stored.windows = wins;
        }
        return stored;
      }
    } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULTS[key] != null ? DEFAULTS[key] : null));
  }

  function lsSet(key, val) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.error('[api] localStorage write error:', e);
      return false;
    }
  }

  /* ── Event bus ────────────────────────────────────────────────────────── */
  // channel → [callback, ...]
  const listeners = Object.create(null);

  // Cross-tab: another tab called localStorage.setItem → fires 'storage' event here
  window.addEventListener('storage', function (e) {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const dataKey = e.key.slice(PREFIX.length);
    const cbs = listeners[dataKey + ':updated'];
    if (cbs && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        cbs.forEach(function (cb) { cb(data); });
      } catch (ex) { /* ignore */ }
    }
  });

  /* ── Public API ───────────────────────────────────────────────────────── */
  window.api = {

    /** Read a data key. Returns a Promise resolving to the stored value. */
    get: function (key) {
      return Promise.resolve(lsGet(key));
    },

    /** Write a data key and broadcast to all listeners (same + other tabs). */
    save: function (key, data) {
      const ok = lsSet(key, data);
      if (ok) {
        // Notify same-tab listeners immediately
        const cbs = listeners[key + ':updated'];
        if (cbs) cbs.forEach(function (cb) { cb(data); });

        // Notify other tabs via StorageEvent (only fires in other tabs normally,
        // so we dispatch manually for the same tab above)
        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: PREFIX + key,
            newValue: JSON.stringify(data),
            storageArea: localStorage,
          }));
        } catch (e) { /* old browsers: already notified same-tab above */ }
      }
      return Promise.resolve({ ok: ok });
    },

    /** Subscribe to data-change events pushed from save() or other tabs. */
    on: function (channel, cb) {
      if (!listeners[channel]) listeners[channel] = [];
      listeners[channel].push(cb);
    },

    /**
     * Electron-only: returns local media file list.
     * On web, always resolves to [] so screens show their empty-state UI.
     */
    media: function (_type) {
      return Promise.resolve([]);
    },
  };

})();