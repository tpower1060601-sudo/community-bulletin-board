'use strict';
const { app, BrowserWindow, ipcMain } = require('electron');
const path   = require('path');
const fs     = require('fs');
const http   = require('http');
const https  = require('https');
const urlMod = require('url');

// ── Data ──────────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(app.getPath('userData'), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

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
      { id: 'screen1', title: '公告欄 A',       enabled: true  },
      { id: 'screen2', title: '公告欄 B',        enabled: false },
      { id: 'screen3', title: '匯率時鐘',        enabled: false },
      { id: 'screen4', title: '即時天氣與新聞',  enabled: false },
      { id: 'screen5', title: '圖片輪播',        enabled: false },
      { id: 'screen6', title: '影片播放',        enabled: false },
      { id: 'screen7', title: '即時新聞看板',    enabled: false },
    ],
  },
  meetings: { rooms: ['會議室A', '會議室B', '會議室C'], bookings: [] },
  news: [],
};

function filePath(key) { return path.join(DATA_DIR, key + '.json'); }

function readData(key) {
  try {
    if (fs.existsSync(filePath(key)))
      return JSON.parse(fs.readFileSync(filePath(key), 'utf8'));
  } catch (e) { console.error('[data] read error', key, e.message); }
  return JSON.parse(JSON.stringify(DEFAULTS[key] != null ? DEFAULTS[key] : null));
}

function writeData(key, val) {
  try {
    fs.writeFileSync(filePath(key), JSON.stringify(val, null, 2), 'utf8');
    return true;
  } catch (e) { console.error('[data] write error', key, e.message); return false; }
}

for (const key of Object.keys(DEFAULTS)) {
  if (!fs.existsSync(filePath(key))) writeData(key, DEFAULTS[key]);
}

// ── Broadcast ─────────────────────────────────────────────────────────────────
function broadcast(channel, data) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────
function saveData(key, data) {
  const ok = writeData(key, data);
  if (ok) {
    broadcast(key + ':updated', data);
    if (key === 'settings') {
      startHttp(data.adminPort || 8080);
      scheduleNews();
    }
  }
  return ok;
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('data:get',  (_, key)       => readData(key));
ipcMain.handle('data:save', (_, key, data) => ({ ok: saveData(key, data) }));

// ── HTTP Server ───────────────────────────────────────────────────────────────
let httpServer = null;

function startHttp(port) {
  if (httpServer) { try { httpServer.close(); } catch (e) {} httpServer = null; }

  httpServer = http.createServer((req, res) => {
    const p = urlMod.parse(req.url, true).pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (p === '/api/login' && req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const obj = JSON.parse(body);
          const s = readData('settings');
          if (obj.password === (s.adminPassword || 'admin')) {
            const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ token }));
          } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '密碼錯誤' }));
          }
        } catch (e) { res.writeHead(400); res.end('{}'); }
      });
      return;
    }

    const m = p.match(/^\/api\/data\/(\w+)$/);
    if (m) {
      if (req.method === 'GET') {
        const d = readData(m[1]);
        res.writeHead(d !== null ? 200 : 404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(d !== null ? d : { error: 'not found' }));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const ok = saveData(m[1], data);
            res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok }));
          } catch (e) { res.writeHead(400); res.end('{}'); }
        });
        return;
      }
    }

    if (p === '/' || p === '/admin' || p === '/admin/') {
      try {
        const html = fs.readFileSync(path.join(__dirname, 'renderer', 'admin', 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch (e) { res.writeHead(500); res.end('Internal Error'); }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log('[http] Admin -> http://localhost:' + port);
  });
  httpServer.on('error', e => console.error('[http] error:', e.message));
}

// ── RSS ───────────────────────────────────────────────────────────────────────
let newsTimer = null;

function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) !== null && items.length < 30) {
    const x = m[1];
    const title = (/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i.exec(x) || [])[1] || '';
    const link  = (/<link>(.*?)<\/link>/i.exec(x) || [])[1] || '';
    const pub   = (/<pubDate>(.*?)<\/pubDate>/i.exec(x) || [])[1] || '';
    if (title.trim()) items.push({ title: title.trim(), link: link.trim(), pubDate: pub.trim() });
  }
  return items;
}

function fetchRss(feedUrl) {
  return new Promise((resolve, reject) => {
    const mod = feedUrl.startsWith('https') ? https : http;
    const req = mod.get(feedUrl, { timeout: 10000 }, res => {
      let xml = '';
      res.on('data', c => { xml += c; });
      res.on('end', () => resolve(parseRss(xml)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function scheduleNews() {
  if (newsTimer) { clearInterval(newsTimer); newsTimer = null; }
  const s = readData('settings');
  if (!s.newsEnabled || !s.newsSource) return;

  const doFetch = () =>
    fetchRss(s.newsSource)
      .then(items => {
        if (items.length) { writeData('news', items); broadcast('news:updated', items); }
      })
      .catch(e => console.error('[rss] fetch error:', e.message));

  doFetch();
  newsTimer = setInterval(doFetch, 5 * 60 * 1000);
}

// ── Windows ───────────────────────────────────────────────────────────────────
const DEV = process.argv.includes('--dev') || !app.isPackaged;
const screenWins = new Map();
let adminWin = null;

const PRELOAD_OPTS = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
};

function openScreen(id) {
  if (screenWins.has(id) && !screenWins.get(id).isDestroyed()) return;
  const win = new BrowserWindow({
    fullscreen: !DEV,
    width:  DEV ? 1280 : undefined,
    height: DEV ? 720  : undefined,
    frame:  DEV,
    title:  id,
    webPreferences: PRELOAD_OPTS,
  });
  win.loadFile(path.join(__dirname, 'renderer', id, 'index.html'));
  if (DEV) win.webContents.openDevTools({ mode: 'detach' });
  screenWins.set(id, win);
  win.on('closed', () => screenWins.delete(id));
}

function openAdmin() {
  if (adminWin && !adminWin.isDestroyed()) { adminWin.focus(); return; }
  adminWin = new BrowserWindow({
    width: 1280, height: 800,
    title: '管理後台',
    webPreferences: PRELOAD_OPTS,
  });
  adminWin.loadFile(path.join(__dirname, 'renderer', 'admin', 'index.html'));
  if (DEV) adminWin.webContents.openDevTools({ mode: 'detach' });
  adminWin.on('closed', () => { adminWin = null; });
}

// ── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const s = readData('settings');
  startHttp(s.adminPort || 8080);
  scheduleNews();
  openAdmin();
  for (const w of (s.windows || [])) {
    if (w.enabled) openScreen(w.id);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});