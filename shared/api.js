/* shared/api.js — localStorage-based window.api for GitHub Pages deployment */
(function () {
  'use strict';

  const PREFIX = 'bbs_';
  const DATA_KEYS = ['announcements', 'announcements_v', 'settings', 'meetings', 'news', 'screenLayout', 'floors', 'meetingAnnouncements'];

  const DEFAULTS = {
    announcements:   { marquee: '歡迎光臨！', list: [] },
    announcements_v: { marquee: '歡迎光臨！', list: [] },
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
        { id: 'screen13', title: '公告欄（直立型）',   enabled: true  },
      ],
    },
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

  /* ── localStorage helpers ─────────────────────────────────────────────── */
  function lsGet(key) {
    try {
      let raw = localStorage.getItem(PREFIX + key);
      if (raw) {
        // 舊資料的圖片網址改寫為 GitHub Pages 網域（raw.githubusercontent.com 有流量限制會 429）
        raw = raw.replace(
          /https:\/\/raw\.githubusercontent\.com\/tpower1060601-sudo\/community-bulletin-board\/main\/data\/images\//g,
          'https://tpower1060601-sudo.github.io/community-bulletin-board/data/images/'
        );
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

  // source：'local'＝本分頁自己 api.save；'remote'＝雲端輪詢或其他分頁寫入
  function emit(key, data, source) {
    const cbs = listeners[key + ':updated'];
    if (cbs) cbs.forEach(function (cb) { try { cb(data, { source: source }); } catch (e) { console.error(e); } });
  }

  // 其他分頁 / 同源 iframe 寫入 localStorage 時，瀏覽器會自動送真正的 storage 事件過來。
  // 本分頁自己的寫入由 api.save / poll 直接呼叫 emit()，不再額外派送合成事件
  // （以前兩條路都會觸發，同一個監聽器每次更新跑兩遍）。
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key.indexOf(PREFIX) !== 0 || !e.newValue) return;
    const dataKey = e.key.slice(PREFIX.length);
    if (DATA_KEYS.indexOf(dataKey) === -1) return;
    try { emit(dataKey, JSON.parse(e.newValue), 'remote'); } catch (ex) { /* ignore */ }
  });

  /* ── 尚未備份的本機修改（dirty） ─────────────────────────────────────────
     api.save 改了資料就記下 key 與時間；備份成功後才清掉。
     輪詢到雲端新版時，dirty 的 key 不會被覆蓋，避免剛存的編輯被舊版蓋回去。 */
  const GH_DIRTY_KEY = 'bbs_gh_dirty';
  function getDirty() {
    try { return JSON.parse(localStorage.getItem(GH_DIRTY_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function setDirty(map) {
    try {
      if (Object.keys(map).length) localStorage.setItem(GH_DIRTY_KEY, JSON.stringify(map));
      else localStorage.removeItem(GH_DIRTY_KEY);
    } catch (e) { /* ignore */ }
  }
  function markDirty(key) {
    const m = getDirty();
    m[key] = Date.now();
    setDirty(m);
  }

  /* ── GitHub 備份模組 ──────────────────────────────────────────────────── */
  const GH_REPO = 'tpower1060601-sudo/community-bulletin-board';
  const GH_FILE = 'data/backup.json';
  const GH_TOKEN_KEY    = 'bbs_gh_token';
  const GH_LAST_KEY     = 'bbs_gh_lastBackup';
  const GH_KNOWN_AT_KEY = 'bbs_gh_knownAt';   // 遠端輪詢：上次已同步的 _savedAt

  window.ghBackup = {
    _api: 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE,
    _raw: 'https://raw.githubusercontent.com/' + GH_REPO + '/main/' + GH_FILE,
    // raw.githubusercontent.com 有流量限制（會 429），失敗時改讀 GitHub Pages（約晚 1~2 分鐘部署）
    _pages: 'https://tpower1060601-sudo.github.io/community-bulletin-board/' + GH_FILE,

    token: function () { return localStorage.getItem(GH_TOKEN_KEY) || ''; },
    setToken: function (t) { localStorage.setItem(GH_TOKEN_KEY, t); },
    lastBackup: function () { return localStorage.getItem(GH_LAST_KEY) || ''; },
    /** 有沒有還沒成功備份的本機修改 */
    hasPending: function () { return Object.keys(getDirty()).length > 0; },

    /** 從 GitHub 讀取備份（公開網址，不需 token） */
    load: function () {
      var self = this;
      function get(url) {
        return fetch(url + '?t=' + Date.now(), { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; });
      }
      return get(self._raw).then(function (b) { return b || get(self._pages); });
    },

    /** 把所有 bbs_ 資料寫入 GitHub data/backup.json。
     *  同一時間只會有一個上傳在跑；跑的期間再呼叫會排在後面合併成一次。 */
    save: function () {
      var self = this;
      if (self._running) {
        if (!self._queued) {
          self._queued = self._running.then(function () {
            self._queued = null;
            return self.save();
          });
        }
        return self._queued;
      }
      self._running = self._saveOnce().then(function (r) {
        self._running = null;
        return r;
      });
      return self._running;
    },

    _saveOnce: function () {
      var self = this;
      var token = this.token();
      if (!token) return Promise.resolve({ ok: false, reason: 'no-token' });

      var dirtyAtStart = getDirty();
      var allData = { _savedAt: new Date().toISOString() };
      DATA_KEYS.forEach(function (k) {
        var v = localStorage.getItem(PREFIX + k);
        if (v) { try { allData[k] = JSON.parse(v); } catch (e) {} }
      });
      var content = btoa(unescape(encodeURIComponent(JSON.stringify(allData, null, 2))));
      var headers = { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' };

      function attempt(retriesLeft) {
        // sha 一定要拿最新的（no-store），否則別台電腦剛推過時會拿到舊 sha → 409
        return fetch(self._api + '?t=' + Date.now(), { headers: headers, cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; })
          .then(function (existing) {
            var body = { message: 'backup: ' + allData._savedAt, content: content };
            if (existing && existing.sha) body.sha = existing.sha;
            return fetch(self._api, {
              method: 'PUT',
              headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
              body: JSON.stringify(body)
            });
          })
          .then(function (r) {
            if (r.ok) return { ok: true };
            // 409/422：sha 過期（另一個上傳剛完成），重新取 sha 再試
            if ((r.status === 409 || r.status === 422) && retriesLeft > 0) return attempt(retriesLeft - 1);
            return { ok: false, status: r.status };
          });
      }

      return attempt(2).then(function (res) {
        if (res.ok) {
          localStorage.setItem(GH_LAST_KEY, new Date().toISOString());
          // 這份就是雲端最新版，輪詢看到同一個 _savedAt 就不會再把它當新版本套回來
          localStorage.setItem(GH_KNOWN_AT_KEY, allData._savedAt);
          // 只清掉這次已經上傳的修改；上傳期間又改過的 key 保留 dirty
          var now = getDirty();
          Object.keys(dirtyAtStart).forEach(function (k) {
            if (now[k] === dirtyAtStart[k]) delete now[k];
          });
          setDirty(now);
        }
        return res;
      }).catch(function (e) { return { ok: false, reason: e.message }; });
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
        if (backup._savedAt) localStorage.setItem(GH_KNOWN_AT_KEY, backup._savedAt);
        return { restored: true, savedAt: backup._savedAt || '' };
      });
    },

    /** 強制從 GitHub 覆蓋本地資料（手動還原，會放棄尚未備份的修改） */
    forceRestore: function () {
      return this.load().then(function (backup) {
        if (!backup) return { restored: false };
        DATA_KEYS.forEach(function (k) {
          if (backup[k]) localStorage.setItem(PREFIX + k, JSON.stringify(backup[k]));
        });
        setDirty({});
        if (backup._savedAt) localStorage.setItem(GH_KNOWN_AT_KEY, backup._savedAt);
        return { restored: true, savedAt: backup._savedAt || '' };
      });
    },

    /** 自動輪詢 GitHub，偵測新版本後只套用「有變動」的資料、只通知那些 key */
    startAutoPoll: function (intervalMs) {
      var self = this;
      intervalMs = intervalMs || 60000;

      function poll() {
        self.load().then(function (backup) {
          if (!backup || !backup._savedAt) return;
          var known = localStorage.getItem(GH_KNOWN_AT_KEY) || '';
          // 只接受「比已知更新」的雲端版本（_savedAt 是 ISO 字串，可直接比大小）。
          // 用 !== 的話，剛備份成功後若讀到還沒更新完的舊版（讀取端有延遲），會把舊版當新版套回來，剛改的設定就被蓋回去。
          if (backup._savedAt <= known) return;

          var dirty = getDirty();
          var applied = [];
          DATA_KEYS.forEach(function (k) {
            if (backup[k] == null) return;
            if (dirty[k]) return; // 本機有還沒備份的修改，不要用雲端版本蓋掉
            var next = JSON.stringify(backup[k]);
            if (localStorage.getItem(PREFIX + k) === next) return; // 沒變就不通知，畫面不必重載
            try { localStorage.setItem(PREFIX + k, next); } catch (e) { console.error('[api] localStorage write error:', e); return; }
            applied.push(k);
            emit(k, backup[k], 'remote');
          });
          localStorage.setItem(GH_KNOWN_AT_KEY, backup._savedAt);
          if (applied.length) console.log('[api] 已套用 GitHub 新版本 ' + backup._savedAt + '：' + applied.join(', '));
        }).catch(function (e) { console.error('[api] poll error:', e); });
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

    /** opts.silent：只寫入本機（例如補上新視窗清單），不算使用者修改、不通知監聽器 */
    save: function (key, data, opts) {
      const changed = localStorage.getItem(PREFIX + key) !== JSON.stringify(data);
      const ok = lsSet(key, data);
      if (ok && !(opts && opts.silent)) {
        if (changed) markDirty(key);
        emit(key, data, 'local');
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
