/* shared/api.js — localStorage-based window.api for GitHub Pages deployment */
(function () {
  'use strict';

  const PREFIX = 'bbs_';
  const DATA_KEYS = ['announcements', 'settings', 'meetings', 'news'];

  const DEFAULTS = {
    announcements: { marquee: '歡迎光臨！', list: [] },
    settings: {
      communityName: '幸福社區',
      weatherApiKey: '', weatherCity: 'Taipei',
      newsEnabled: false, newsSource: '',
      youtubeId: '', youtubeId2: '',
      imageUrls: [], videoUrls: [],
      meetingsUrl: '', meetingsZoom: 1.0,
      adminPassword: 'admin', adminPort: 8080,
      windows: [
        { id: 'screen1', title: '大廳公佈欄',      enabled: true  },
        { id: 'screen2', title: '公告欄 B',       enabled: true  },
        { id: 'screen3', title: '全球市場儀表板',   enabled: true  },
        { id: 'screen4', title: '即時天氣',       enabled: true  },
        { id: 'screen5', title: '圖片輪播',       enabled: true  },
        { id: 'screen6', title: '影片播放',       enabled: true  },
        { id: 'screen7', title: '即時新聞看板',   enabled: true  },
        { id: 'screen8',  title: 'YouTube 頻道 1',  enabled: true  },
        { id: 'screen9',  title: 'YouTube 頻道 2',  enabled: true  },
        { id: 'screen10', title: '樓層告示牌 A',     enabled: true  },
        { id: 'screen11', title: '樓層告示牌 B',     enabled: true  },
        { id: 'screen12', title: '台股熱力圖',        enabled: true  },
        { id: 'screen13', title: '影片播放（雙螢幕）', enabled: true  },
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
        if (key === 'settings' && DEFAULTS.settings.windows) {
          const wins = stored.windows || [];
          DEFAULTS.settings.windows.forEach(function(dw) {
            const idx = wins.findIndex(function(w) { return w.id === dw.id; });
            if (idx === -1) {
              wins.push(JSON.parse(JSON.stringify(dw)));
            } else {
              wins[idx].title = dw.title;
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
  const listeners = Object.create(null);

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

  /* ── GitHub 備份模組 ──────────────────────────────────────────────────── */
  const GH_REPO = 'tpower1060601-sudo/community-bulletin-board';
  const GH_FILE = 'data/backup.json';
  const GH_TOKEN_KEY    = 'bbs_gh_token';
  const GH_LAST_KEY     = 'bbs_gh_lastBackup';
  const GH_KNOWN_AT_KEY = 'bbs_gh_knownAt';   // 遠端輪詢：上次已同步的 _savedAt

  window.ghBackup = {
    _api: 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE,
    _raw: 'https://raw.githubusercontent.com/' + GH_REPO + '/main/' + GH_FILE,

    token: function () { return localStorage.getItem(GH_TOKEN_KEY) || ''; },
    setToken: function (t) { localStorage.setItem(GH_TOKEN_KEY, t); },
    lastBackup: function () { return localStorage.getItem(GH_LAST_KEY) || ''; },

    /** 從 GitHub 讀取備份（公開 raw URL，不需 token） */
    load: function () {
      return fetch(this._raw + '?t=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    },

    /** 把所有 bbs_ 資料寫入 GitHub data/backup.json */
    save: function () {
      var self = this;
      var token = this.token();
      if (!token) return Promise.resolve({ ok: false, reason: 'no-token' });

      var allData = { _savedAt: new Date().toISOString() };
      DATA_KEYS.forEach(function (k) {
        var v = localStorage.getItem(PREFIX + k);
        if (v) { try { allData[k] = JSON.parse(v); } catch (e) {} }
      });

      var content = btoa(unescape(encodeURIComponent(JSON.stringify(allData, null, 2))));

      // 先取得現有檔案 SHA（更新檔案用）
      return fetch(self._api, {
        headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' }
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (existing) {
        var body = {
          message: 'backup: ' + new Date().toISOString(),
          content: content
        };
        if (existing && existing.sha) body.sha = existing.sha;

        return fetch(self._api, {
          method: 'PUT',
          headers: {
            'Authorization': 'token ' + token,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify(body)
        });
      })
      .then(function (r) {
        if (r && r.ok) {
          localStorage.setItem(GH_LAST_KEY, new Date().toISOString());
          return { ok: true };
        }
        return { ok: false, status: r ? r.status : 0 };
      })
      .catch(function (e) { return { ok: false, reason: e.message }; });
    },

    /** 如果 localStorage 完全沒有資料，從 GitHub 自動還原 */
    autoRestore: function () {
      var hasData = DATA_KEYS.some(function (k) {
        return !!localStorage.getItem(PREFIX + k);
      });
      if (hasData) return Promise.resolve({ restored: false });

      return this.load().then(function (backup) {
        if (!backup) return { restored: false };
        DATA_KEYS.forEach(function (k) {
          if (backup[k]) localStorage.setItem(PREFIX + k, JSON.stringify(backup[k]));
        });
        return { restored: true, savedAt: backup._savedAt || '' };
      });
    },

    /** 強制從 GitHub 覆蓋本地資料（手動還原） */
    forceRestore: function () {
      return this.load().then(function (backup) {
        if (!backup) return { restored: false };
        DATA_KEYS.forEach(function (k) {
          if (backup[k]) localStorage.setItem(PREFIX + k, JSON.stringify(backup[k]));
        });
        return { restored: true, savedAt: backup._savedAt || '' };
      });
    },

    /** 自動輪詢 GitHub，偵測新版本後自動還原並廣播更新 */
    startAutoPoll: function (intervalMs) {
      var self = this;
      intervalMs = intervalMs || 60000;

      function poll() {
        self.load().then(function (backup) {
          if (!backup || !backup._savedAt) return;
          var known = localStorage.getItem(GH_KNOWN_AT_KEY) || '';
          if (backup._savedAt === known) return;

          // 有新版本，還原所有資料並廣播更新
          console.log('[api] 偵測到 GitHub 新版本：' + backup._savedAt + '，自動同步…');
          DATA_KEYS.forEach(function (k) {
            if (backup[k] == null) return;
            localStorage.setItem(PREFIX + k, JSON.stringify(backup[k]));
            // 觸發 on() 監聽器
            var cbs = listeners[k + ':updated'];
            if (cbs) cbs.forEach(function (cb) { try { cb(backup[k]); } catch (e) {} });
            // 觸發跨分頁 storage 事件（同頁分頁同步用）
            try {
              window.dispatchEvent(new StorageEvent('storage', {
                key: PREFIX + k,
                newValue: JSON.stringify(backup[k]),
                storageArea: localStorage,
              }));
            } catch (e) {}
          });
          localStorage.setItem(GH_KNOWN_AT_KEY, backup._savedAt);
        }).catch(function () {});
      }

      setInterval(poll, intervalMs);
      poll(); // 頁面載入後立即執行一次
    },
  };

  // 自動啟動輪詢（所有畫面頁面載入時）
  window.ghBackup.startAutoPoll(60000);

  /* ── Public API ───────────────────────────────────────────────────────── */
  window.api = {

    get: function (key) {
      return Promise.resolve(lsGet(key));
    },

    save: function (key, data) {
      const ok = lsSet(key, data);
      if (ok) {
        const cbs = listeners[key + ':updated'];
        if (cbs) cbs.forEach(function (cb) { cb(data); });

        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: PREFIX + key,
            newValue: JSON.stringify(data),
            storageArea: localStorage,
          }));
        } catch (e) { /* ignore */ }
      }
      return Promise.resolve({ ok: ok });
    },

    on: function (channel, cb) {
      if (!listeners[channel]) listeners[channel] = [];
      listeners[channel].push(cb);
    },

    media: function (_type) {
      return Promise.resolve([]);
    },
  };

})();
