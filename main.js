const { app, BrowserWindow, ipcMain, dialog, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Single Instance Lock: Prevents phantom background duplicate processes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Universal Compatibility Switch:
// Do NOT force aggressive GPU rasterization or ignore GPU blocklist, which deadlocks old Intel HD graphics!
// Standard Chromium hardware acceleration is kept, with fallback if GPU is unavailable.
app.commandLine.appendSwitch('disable-gpu-process-crash-limit');
app.commandLine.appendSwitch('no-sandbox');

// Configure custom isolated cache directory to prevent access denied error on Windows
const customUserData = path.join(app.getPath('appData'), 'FDR_DRAMAS_DL_USERDATA');
app.setPath('userData', customUserData);

const DramaDownloader = require('./src/downloader');
const VideoSniffer = require('./src/sniffer');
const DramaApi = require('./src/api');
const LicenseManager = require('./src/license');
const KHQRManager = require('./src/khqr');
const { downloadAndDecryptHongguo, resolveHongguoPlayUrl } = require('./src/hongguo');
const { createCastingService } = require('./src/hongguo/casting');
const castingService = createCastingService();

// Resolve writable dataDir (handles development & packaged app.asar environment)
const isPackaged = app.isPackaged;
const dataDir = isPackaged 
  ? path.join(app.getPath('userData'), 'data')
  : path.join(__dirname, 'data');

function ensureDataDir() {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const seedDir = path.join(__dirname, 'data');
    if (isPackaged && fs.existsSync(seedDir)) {
      const seedFiles = fs.readdirSync(seedDir);
      for (const f of seedFiles) {
        const dest = path.join(dataDir, f);
        if (!fs.existsSync(dest)) {
          try {
            fs.copyFileSync(path.join(seedDir, f), dest);
          } catch (e) {}
        }
      }
    }
  } catch (err) {}
}
ensureDataDir();

const licenseManager = new LicenseManager({ dataDir });
const khqrManager = new KHQRManager({ dataDir });

// Global crash prevention guards (guarantees app NEVER closes by itself unexpectedly)
process.on('uncaughtException', (err) => {
  console.error('[Main Process Guard] Uncaught Exception caught safely:', err.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Main Process Guard] Unhandled Rejection caught safely:', reason);
});

let mainWindow = null;
const api = new DramaApi({ dataDir });
const sniffer = new VideoSniffer();

// Paths
const sourcesFile = path.join(dataDir, 'sources.json');
const settingsFile = path.join(dataDir, 'settings.json');
const downloadsFile = path.join(dataDir, 'downloads.json');
const historyFile = path.join(dataDir, 'history.json');
const favoritesFile = path.join(dataDir, 'favorites.json');

// Helper to safely read JSON
function readJson(filePath, defaultVal = []) {
  try {
    if (!fs.existsSync(filePath)) return defaultVal;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return defaultVal;
  }
}

// Helper to safely write JSON
function writeJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to write JSON:', filePath, e.message);
    return false;
  }
}

function resolveFfmpegPath() {
  if (process.resourcesPath) {
    const packagedPaths = [
      path.join(process.resourcesPath, 'bin', 'ffmpeg.exe'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'ffmpeg.exe'),
      path.join(path.dirname(process.execPath || ''), 'resources', 'bin', 'ffmpeg.exe'),
      path.join(path.dirname(process.execPath || ''), 'bin', 'ffmpeg.exe')
    ];
    for (const p of packagedPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  const devPaths = [
    path.join(__dirname, 'bin', 'ffmpeg.exe'),
    path.join(__dirname, '..', 'bin', 'ffmpeg.exe')
  ];
  for (const p of devPaths) {
    if (fs.existsSync(p)) return p;
  }
  return 'ffmpeg';
}

const defaultFfmpeg = resolveFfmpegPath();

const defaultDownloadDir = isPackaged 
  ? path.join(app.getPath('downloads'), 'FDR Drama Downloads')
  : path.join(__dirname, 'downloads');

// Initialize settings
let currentSettings = readJson(settingsFile, {
  downloadDir: defaultDownloadDir,
  maxConcurrent: 3,
  concurrentDownloads: 3,
  autoMerge: true,
  language: 'km',
  theme: 'luxury-gold',
  quality: '1080p',
  notifications: true,
  ffmpegPath: defaultFfmpeg
});

// Initialize downloader
const downloader = new DramaDownloader({
  downloadDir: currentSettings.downloadDir || defaultDownloadDir,
  maxConcurrent: currentSettings.maxConcurrent || currentSettings.concurrentDownloads || 3,
  ffmpegPath: defaultFfmpeg
});

// Restore saved downloads if any (clean up interrupted states on boot)
const savedDownloads = readJson(downloadsFile, []);
if (Array.isArray(savedDownloads)) {
  downloader.queue = savedDownloads.map(t => {
    if (t.status === 'downloading') {
      return { ...t, status: 'waiting', speed: '0 KB/s' };
    }
    return t;
  });
}

// Asynchronous, non-blocking queue persistence (prevents UI freeze/stutter)
let persistTimer = null;
let isPersisting = false;
function persistDownloads(immediate = false) {
  if (immediate) {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    try {
      fs.mkdirSync(path.dirname(downloadsFile), { recursive: true });
      fs.writeFileSync(downloadsFile, JSON.stringify(downloader.queue, null, 2), 'utf-8');
    } catch (e) {}
    return;
  }

  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (isPersisting) return;
    isPersisting = true;
    fs.promises.mkdir(path.dirname(downloadsFile), { recursive: true })
      .then(() => fs.promises.writeFile(downloadsFile, JSON.stringify(downloader.queue, null, 2), 'utf-8'))
      .catch(() => {})
      .finally(() => { isPersisting = false; });
  }, 800);
}

// Helper: Safe IPC sender (never throws even if window is closing/destroyed)
function safeSend(channel, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  } catch (err) {
    // Ignore destroyed window send errors
  }
}

// Downloader event forwarding to renderer
downloader.on('task-added', (task) => {
  persistDownloads();
  safeSend('download-event', { type: 'added', task });
});

downloader.on('task-progress', (task) => {
  safeSend('download-event', { type: 'progress', task });
});

downloader.on('task-status-changed', (task) => {
  persistDownloads();
  safeSend('download-event', { type: 'status-changed', task });
});

downloader.on('task-completed', (task) => {
  persistDownloads();
  safeSend('download-event', { type: 'completed', task });
});

downloader.on('task-error', (task) => {
  persistDownloads();
  safeSend('download-event', { type: 'error', task });
});

app.on('before-quit', () => {
  persistDownloads(true);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 620,
    frame: false,
    center: true,
    resizable: true,
    icon: path.join(__dirname, 'FDR Download Drama.ico'),
    backgroundColor: '#0a0b10',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log(`[Renderer]: ${message}`);
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Fallback show
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }, 1200);

  // If renderer process crashes, reload automatically
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[Window Guard] Renderer process gone:', details.reason);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// When a second instance is launched, focus the existing main window instead of creating phantom background process
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers: Window Controls
ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  } else {
    mainWindow.maximize();
    return true;
  }
});

ipcMain.handle('window:launch-main', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(960, 620);
    mainWindow.setSize(1280, 800);
    mainWindow.center();
    return true;
  }
  return false;
});

ipcMain.handle('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// IPC Handlers: Sources
ipcMain.handle('sources:get', () => {
  return readJson(sourcesFile, []);
});

ipcMain.handle('sources:save', (e, newSources) => {
  return writeJson(sourcesFile, newSources);
});

ipcMain.handle('sources:test', async (e, source) => {
  const start = Date.now();
  try {
    const url = new URL(source.api);
    url.searchParams.set('ac', 'videolist');
    url.searchParams.set('pg', '1');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000)
    });
    const data = await res.json();
    return {
      success: true,
      latencyMs: Date.now() - start,
      total: data.total || 0
    };
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      error: err.message
    };
  }
});

// IPC Handlers: Settings
ipcMain.handle('settings:get', () => {
  currentSettings = readJson(settingsFile, currentSettings);
  return currentSettings;
});

ipcMain.handle('settings:save', (e, newSettings) => {
  currentSettings = { ...currentSettings, ...newSettings };
  const concurrent = newSettings.maxConcurrent || newSettings.concurrentDownloads;
  if (concurrent) {
    currentSettings.maxConcurrent = concurrent;
    currentSettings.concurrentDownloads = concurrent;
    downloader.setMaxConcurrent(concurrent);
  }
  writeJson(settingsFile, currentSettings);
  if (newSettings.downloadDir) {
    downloader.setDownloadDir(newSettings.downloadDir, true);
    persistDownloads(true);
  }
  return true;
});

ipcMain.handle('settings:select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: currentSettings.downloadDir
  });
  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC Handlers: History
ipcMain.handle('history:get', () => {
  return readJson(historyFile, []);
});

ipcMain.handle('history:add', (e, item) => {
  let hist = readJson(historyFile, []);
  hist = hist.filter(h => h.id !== item.id && h.title !== item.title);
  hist.unshift({ ...item, visitedAt: Date.now() });
  if (hist.length > 50) hist = hist.slice(0, 50);
  writeJson(historyFile, hist);
  return hist;
});

ipcMain.handle('history:clear', () => {
  writeJson(historyFile, []);
  return [];
});

// IPC Handlers: Drama Catalog Search & Detail
ipcMain.handle('dramas:search', async (e, params) => {
  return await api.search(params);
});

ipcMain.handle('dramas:detail', async (e, params) => {
  return await api.getDetail(params);
});

ipcMain.handle('dramas:latest', async () => {
  return await api.getLatestReleases();
});

ipcMain.handle('dramas:sync', async () => {
  return await api.syncLatestDramas();
});

// IPC Handlers: Sniffer
ipcMain.handle('sniffer:sniff', async (e, targetUrl) => {
  return await sniffer.sniff(targetUrl);
});

// IPC Handlers: Downloads
ipcMain.handle('downloads:add', (e, task) => {
  return downloader.addTask(task);
});

ipcMain.handle('downloads:add-batch', (e, tasks) => {
  return downloader.addBatch(tasks);
});

ipcMain.handle('downloads:pause', (e, taskId) => {
  return downloader.pauseTask(taskId);
});

ipcMain.handle('downloads:resume', (e, taskId) => {
  return downloader.resumeTask(taskId);
});

ipcMain.handle('downloads:cancel', (e, taskId) => {
  return downloader.cancelTask(taskId);
});

ipcMain.handle('downloads:pause-all', () => {
  downloader.pauseAll();
  persistDownloads();
  return true;
});

ipcMain.handle('downloads:resume-all', () => {
  downloader.resumeAll();
  persistDownloads();
  return true;
});

ipcMain.handle('downloads:clear-completed', () => {
  downloader.clearCompleted();
  persistDownloads();
  return true;
});

ipcMain.handle('downloads:start-drama', (e, dramaTitle) => {
  downloader.startDrama(dramaTitle);
  persistDownloads();
  return true;
});

ipcMain.handle('downloads:remove-drama', (e, dramaTitle) => {
  downloader.removeDrama(dramaTitle);
  persistDownloads();
  return true;
});

ipcMain.handle('downloads:start-all-waiting', () => {
  downloader.startAllWaiting();
  persistDownloads();
  return true;
});

ipcMain.handle('downloads:merge-series', async (e, { dramaTitle, destDir }) => {
  return await downloader.mergeDrama(dramaTitle, destDir);
});

ipcMain.handle('downloads:extract-audio', async (e, { dramaTitle, destDir }) => {
  return await downloader.extractDramaAudio(dramaTitle, destDir);
});

ipcMain.handle('downloads:update-folder', (e, { dramaTitle, newDir }) => {
  const ok = downloader.updateDramaFolder(dramaTitle, newDir);
  persistDownloads();
  return ok;
});

ipcMain.handle('downloads:get-all', () => {
  return downloader.getAllTasks();
});

// IPC Handler: Screen Preview Resolver (Resolves & caches preview episode for instant streaming)
ipcMain.handle('preview:resolve', async (e, params) => {
  try {
    const { vid, dramaId, episodeIndex, dramaTitle, existingPath, url: directUrl } = params || {};

    // 0. If direct HTTP stream is passed (.m3u8 or .mp4), return directly
    if (directUrl && /^https?:\/\//i.test(directUrl)) {
      return { success: true, url: directUrl, isStream: true };
    }

    // 1. If an existing downloaded file path is passed and valid, return immediately
    if (existingPath && fs.existsSync(existingPath)) {
      return { success: true, url: `file://${existingPath.replace(/\\/g, '/')}`, isLocal: true };
    }

    // 2. Check in user download directory for existing completed episode
    if (currentSettings.downloadDir && dramaTitle) {
      const epNum = episodeIndex || 1;
      const pad = epNum < 10 ? `0${epNum}` : `${epNum}`;
      const possiblePaths = [
        path.join(currentSettings.downloadDir, dramaTitle, `${dramaTitle} - ភាគ ${pad}.mp4`),
        path.join(currentSettings.downloadDir, dramaTitle, `ភាគ ${pad}.mp4`),
        path.join(currentSettings.downloadDir, `${dramaTitle} - ភាគ ${pad}.mp4`)
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p) && fs.statSync(p).size > 100000) {
          return { success: true, url: `file://${p.replace(/\\/g, '/')}`, isLocal: true };
        }
      }
    }

    // 3. Check in preview_cache directory
    const previewCacheDir = path.join(dataDir, 'preview_cache');
    try { fs.mkdirSync(previewCacheDir, { recursive: true }); } catch (e) {}

    const cleanDramaId = String(dramaId || 'drama').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanVid = String(vid || 'novid').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cacheFileName = `prev_${cleanDramaId}_ep${episodeIndex || 1}_${cleanVid}.mp4`;
    const cacheFilePath = path.join(previewCacheDir, cacheFileName);

    if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).size > 100000) {
      return { success: true, url: `file://${cacheFilePath.replace(/\\/g, '/')}`, isCached: true };
    }

    // 4. Resolve & download preview via pure Node.js VIP engine
    if (!vid) {
      return { success: false, error: 'មិនមាន Video ID សម្រាប់ Preview ភាគនេះឡើយ' };
    }

    try {
      await downloadAndDecryptHongguo(vid, cacheFilePath, () => {});
      if (fs.existsSync(cacheFilePath) && fs.statSync(cacheFilePath).size > 100000) {
        return { success: true, url: `file://${cacheFilePath.replace(/\\/g, '/')}` };
      }
    } catch (vipErr) {
      console.warn('[Preview] VIP engine preview warning:', vipErr.message);
    }

    return { success: false, error: 'មិនអាចបើកចាក់វីដេអូភាគនេះបានទេ' };
  } catch (err) {
    console.error('[Preview] Error resolving preview:', err.message);
    return { success: false, error: err.message };
  }
});

// IPC Handlers: Smart TV & DLNA Casting
ipcMain.handle('tv:discover-devices', async () => {
  try {
    const list = await castingService.discover();
    return { success: true, devices: list || [] };
  } catch (err) {
    return { success: false, error: err.message, devices: [] };
  }
});

ipcMain.handle('tv:cast', async (e, { deviceId, filePath, title }) => {
  try {
    const res = await castingService.start(deviceId, { filePath, title });
    return { success: true, name: res?.name };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('tv:stop-cast', async () => {
  try {
    await castingService.control('Stop');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC Handlers: System Shell & Disk Monitor
ipcMain.handle('system:open-path', (e, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('system:open-external', async (e, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('system:show-in-folder', (e, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('system:get-disk-space', async (e, targetPath) => {
  try {
    const checkPath = targetPath || currentSettings.downloadDir || 'D:\\';
    let target = checkPath;
    if (!fs.existsSync(target)) {
      target = path.parse(checkPath).root || 'D:\\';
    }
    const stats = await fs.promises.statfs(target);
    const freeBytes = stats.bavail * stats.bsize;
    const totalBytes = stats.blocks * stats.bsize;
    const freeGb = (freeBytes / (1024 ** 3)).toFixed(1);
    const totalGb = (totalBytes / (1024 ** 3)).toFixed(1);
    const rootDrive = path.parse(target).root.replace(/\\/g, '');
    return {
      success: true,
      freeBytes,
      totalBytes,
      freeGb,
      totalGb,
      driveLabel: rootDrive ? `Drive ${rootDrive}` : 'Drive'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC Handlers: Favorites / Bookmarks
ipcMain.handle('favorites:get', () => {
  return readJson(favoritesFile, []);
});

ipcMain.handle('favorites:toggle', (e, drama) => {
  let favs = readJson(favoritesFile, []);
  const existingIdx = favs.findIndex(f => String(f.id) === String(drama.id) || f.title === drama.title);
  let isFav = false;
  if (existingIdx !== -1) {
    favs.splice(existingIdx, 1);
    isFav = false;
  } else {
    favs.unshift({
      id: String(drama.id),
      title: drama.title,
      cover: drama.cover,
      category: drama.category || 'VIP',
      episodesCount: drama.episodesCount || 80,
      savedAt: Date.now()
    });
    isFav = true;
  }
  writeJson(favoritesFile, favs);
  return { success: true, isFav, favorites: favs };
});

// IPC Handlers: Windows Auto-Shutdown
let shutdownTimerProcess = null;
ipcMain.handle('system:shutdown-pc', (e, seconds = 60) => {
  try {
    const proc = spawn('shutdown', ['/s', '/t', String(seconds)]);
    return { success: true, seconds };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system:cancel-shutdown', () => {
  try {
    spawn('shutdown', ['/a']);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC Handlers: Clipboard & Text File Export
ipcMain.handle('system:copy-clipboard', (e, text) => {
  try {
    clipboard.writeText(text || '');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('system:save-text-file', async (e, { defaultFileName, content }) => {
  try {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Export បញ្ជីភាគជា File Text',
      defaultPath: defaultFileName || 'drama_episodes.txt',
      filters: [{ name: 'Text Documents (*.txt)', extensions: ['txt'] }]
    });
    if (!res.canceled && res.filePath) {
      fs.writeFileSync(res.filePath, content, 'utf-8');
      return { success: true, filePath: res.filePath };
    }
    return { canceled: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Helper: Recursive delete folder contents safely
function deleteFolderContents(dir) {
  let freed = 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          freed += deleteFolderContents(fullPath);
          fs.rmdirSync(fullPath);
        } else {
          freed += fs.statSync(fullPath).size;
          fs.unlinkSync(fullPath);
        }
      } catch (e) {}
    }
  } catch (e) {}
  return freed;
}

// Helper: Recursive delete .part and .tmp files in download directory
function deletePartFilesRecursive(dir, maxDepth = 3) {
  let freed = 0;
  if (maxDepth <= 0) return 0;
  try {
    if (!fs.existsSync(dir)) return 0;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          freed += deletePartFilesRecursive(fullPath, maxDepth - 1);
        } else if (entry.name.endsWith('.part') || entry.name.endsWith('.tmp')) {
          freed += fs.statSync(fullPath).size;
          fs.unlinkSync(fullPath);
        }
      } catch (e) {}
    }
  } catch (e) {}
  return freed;
}

// IPC Handler: Clean Temp & Cache Files
ipcMain.handle('system:clean-cache', async () => {
  let freedBytes = 0;

  // 1. Clean preview_cache
  const previewDir = path.join(dataDir, 'preview_cache');
  freedBytes += deleteFolderContents(previewDir);

  // 2. Clean scratch folder
  const scratchDir = path.join(__dirname, 'scratch');
  freedBytes += deleteFolderContents(scratchDir);

  // 3. Clean .part / .tmp files in download folder
  const dlDir = currentSettings.downloadDir;
  if (dlDir && fs.existsSync(dlDir)) {
    freedBytes += deletePartFilesRecursive(dlDir);
  }

  // 4. Clean temp_streams in python project if exists
  const tempStreamsDir = path.join(__dirname, 'short-drama-downloader-main', 'short-drama-downloader-main', '源码_开源版', 'temp_streams');
  freedBytes += deleteFolderContents(tempStreamsDir);

  // 5. Clean Electron session cache
  if (mainWindow && mainWindow.webContents && mainWindow.webContents.session) {
    try {
      await mainWindow.webContents.session.clearCache();
    } catch (e) {}
  }

  let formattedFreed = '';
  if (freedBytes >= 1024 * 1024 * 1024) {
    formattedFreed = (freedBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  } else {
    formattedFreed = (freedBytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return { success: true, freedBytes, formattedFreed };
});

// IPC Handlers: License & Key Activation
ipcMain.handle('license:status', () => {
  return licenseManager.getStatus();
});

ipcMain.handle('license:activate', (e, key) => {
  return licenseManager.activate(key);
});

ipcMain.handle('license:deactivate', () => {
  return licenseManager.deactivate();
});

// IPC Handlers: KHQR Online Payment & Auto-Activation
ipcMain.handle('khqr:generate', async (e, params) => {
  return await khqrManager.generateKHQRDataURL(params);
});

ipcMain.handle('khqr:check', async (e, md5) => {
  return await khqrManager.checkPaymentStatus(md5);
});

ipcMain.handle('khqr:test-token', async (e, token) => {
  return await khqrManager.testBakongToken(token);
});

ipcMain.handle('khqr:get-config', () => {
  return khqrManager.getConfig();
});

ipcMain.handle('khqr:save-config', (e, cfg) => {
  return khqrManager.saveConfig(cfg);
});

ipcMain.handle('license:generate-key', (e, { deviceId, planType }) => {
  const cleanId = deviceId || licenseManager.getDeviceId();
  return {
    deviceId: cleanId,
    planType: planType || 'LIFETIME',
    key: licenseManager.generateKey(cleanId, planType || 'LIFETIME')
  };
});

ipcMain.handle('khqr:auto-activate', (e, payload) => {
  let targetId = licenseManager.getDeviceId();
  let planType = 'LIFETIME';

  if (typeof payload === 'string') {
    targetId = payload;
  } else if (payload && typeof payload === 'object') {
    targetId = payload.deviceId || targetId;
    planType = payload.planType || 'LIFETIME';
  }

  const key = licenseManager.generateKey(targetId, planType);
  return licenseManager.activate(key);
});

// Auto-Updater Integration via electron-updater (GitHub Releases)
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
try {
  autoUpdater.logger = console;
} catch (e) {}

autoUpdater.on('checking-for-update', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { 
      status: 'checking', 
      message: 'កំពុងពិនិត្យមើលកំណែថ្មីពី GitHub...' 
    });
  }
});

autoUpdater.on('update-available', (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { 
      status: 'available', 
      version: info.version, 
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || 'កំណែអាប់ដេតថ្មីចុងក្រោយបង្អស់',
      message: `🎉 រកឃើញកំណែថ្មី v${info.version}!`
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { 
      status: 'not-available', 
      version: app.getVersion(),
      message: `✅ កម្មវិធីជាកំណែចុងក្រោយបង្អស់ (v${app.getVersion()}) ហើយ!` 
    });
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const percent = Math.round(progressObj.percent || 0);
    mainWindow.webContents.send('updater:status', { 
      status: 'downloading', 
      percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond,
      message: `⚡ កំពុងទាញយកកំណែថ្មី... (${percent}%)` 
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { 
      status: 'downloaded', 
      version: info.version,
      message: `🎉 ទាញយកចប់សព្វគ្រប់! រួចរាល់ក្នុងការដំឡើង (v${info.version})` 
    });
  }
});

autoUpdater.on('error', (err) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { 
      status: 'error', 
      error: err.message,
      message: `❌ បរាជ័យក្នុងការពិនិត្យ Update: ${err.message}` 
    });
  }
});

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) {
    return { 
      status: 'dev', 
      version: app.getVersion(), 
      message: `🛠️ កំពុងដំណើរការក្នុង Development Mode (v${app.getVersion()})។ ការ Auto-Update នឹងដំណើរការ ១០០% ពេល Build ជា .exe!` 
    };
  }
  try {
    const res = await autoUpdater.checkForUpdates();
    return { success: true, version: res?.updateInfo?.version };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

let activeDownloadAbort = null;
let downloadedInstallerFile = null;

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

// Native streaming download with real-time progress, speed, auto-resume & auto-retry
ipcMain.handle('updater:download', async (event, opts = {}) => {
  let targetUrl = opts?.downloadUrl;
  let targetVer = opts?.version || 'latest';
  let totalBytes = opts?.downloadSize || opts?.totalBytes || 0;

  // If no URL passed, fetch latest release asset URL from GitHub
  if (!targetUrl) {
    try {
      const res = await fetch('https://api.github.com/repos/DePong-989/fdr-drama-dl-pro/releases/latest', {
        headers: { 'User-Agent': 'FDR-Drama-DL-Pro-Updater' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const d = await res.json();
        targetVer = (d.tag_name || '').replace(/^v/i, '').trim();
        const assets = Array.isArray(d.assets) ? d.assets : [];
        const setupAsset = assets.find(a => a.name.endsWith('.exe') && /setup/i.test(a.name)) || assets.find(a => a.name.endsWith('.exe'));
        if (setupAsset) {
          targetUrl = setupAsset.browser_download_url;
          if (!totalBytes && setupAsset.size) totalBytes = setupAsset.size;
        }
      }
    } catch (e) {}
  }

  if (!targetUrl) {
    const errMsg = 'រកមិនឃើញតំណភ្ជាប់ឯកសារ Update នៅលើ GitHub Releases ឡើយ!';
    safeSend('updater:status', { status: 'error', error: errMsg, message: `❌ ${errMsg}` });
    return { success: false, error: errMsg };
  }

  // Cancel any existing download
  if (activeDownloadAbort) {
    try { activeDownloadAbort.abort(); } catch (e) {}
    activeDownloadAbort = null;
  }

  const abortCtrl = new AbortController();
  activeDownloadAbort = abortCtrl;

  const tempFilePath = path.join(app.getPath('temp'), `FDR-Drama-Setup-v${targetVer}.exe`);
  downloadedInstallerFile = tempFilePath;

  // Probe total size via HEAD request if not yet known
  if (!totalBytes) {
    try {
      const probe = await fetch(targetUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'FDR-Drama-DL-Pro-Downloader' }
      });
      const cl = probe.headers.get('content-length');
      if (cl) totalBytes = parseInt(cl, 10);
    } catch (e) {}
  }

  // Inspect existing partially or fully downloaded file in %TEMP%
  let existingBytes = 0;
  if (fs.existsSync(tempFilePath)) {
    try {
      const stat = fs.statSync(tempFilePath);
      existingBytes = stat.size;

      // If already fully downloaded (matches size and > 10MB)
      if (totalBytes > 10 * 1024 * 1024 && existingBytes === totalBytes) {
        safeSend('updater:status', {
          status: 'downloaded',
          version: targetVer,
          installerPath: tempFilePath,
          totalFormatted: formatBytes(totalBytes),
          message: `🎉 បានទាញយកកំណែថ្មី v${targetVer} រួចរាល់!`
        });
        activeDownloadAbort = null;
        return { success: true, installerPath: tempFilePath };
      }

      // If existing file is somehow larger than target, reset to avoid corruption
      if (totalBytes > 0 && existingBytes > totalBytes) {
        fs.unlinkSync(tempFilePath);
        existingBytes = 0;
      }
    } catch (e) {
      existingBytes = 0;
    }
  }

  let downloadedBytes = existingBytes;
  let totalFormatted = totalBytes > 0 ? formatBytes(totalBytes) : '...';

  safeSend('updater:status', {
    status: 'downloading',
    percent: totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0,
    transferred: downloadedBytes,
    total: totalBytes,
    transferredFormatted: formatBytes(downloadedBytes),
    totalFormatted,
    speedFormatted: '0 MB/s',
    message: downloadedBytes > 0
      ? `⚡ កំពុងបន្តទាញយក v${targetVer} ពី ${formatBytes(downloadedBytes)}...`
      : `⚡ កំពុងចាប់ផ្តើមទាញយក v${targetVer}...`
  });

  const maxRetries = 12;
  let retryCount = 0;

  try {
    while (totalBytes === 0 || downloadedBytes < totalBytes) {
      if (abortCtrl.signal.aborted) {
        throw new Error('Download aborted by user');
      }

      try {
        const reqHeaders = {
          'User-Agent': 'FDR-Drama-DL-Pro-Downloader',
          'Accept-Encoding': 'identity'
        };

        // Resume from byte offset if we already have partial data
        if (downloadedBytes > 0) {
          reqHeaders['Range'] = `bytes=${downloadedBytes}-`;
        }

        const resp = await fetch(targetUrl, {
          signal: abortCtrl.signal,
          headers: reqHeaders,
          redirect: 'follow'
        });

        if (!resp.ok && resp.status !== 206) {
          throw new Error(`HTTP Error ${resp.status}: ${resp.statusText}`);
        }

        const isPartial = resp.status === 206;

        // If server sent full 200 instead of 206 when we requested Range, reset downloadedBytes
        if (!isPartial && downloadedBytes > 0) {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
          downloadedBytes = 0;
        }

        // Determine total size from headers if not known yet
        if (!totalBytes) {
          const contentRange = resp.headers.get('content-range');
          if (contentRange) {
            const m = contentRange.match(/\/(\d+)$/);
            if (m) totalBytes = parseInt(m[1], 10);
          } else {
            const cl = resp.headers.get('content-length');
            if (cl) totalBytes = parseInt(cl, 10);
          }
          totalFormatted = totalBytes > 0 ? formatBytes(totalBytes) : '...';
        }

        // Append to existing file if partial resume, or write fresh
        const fileStream = fs.createWriteStream(tempFilePath, {
          flags: downloadedBytes > 0 ? 'a' : 'w',
          highWaterMark: 1024 * 1024
        });

        const reader = resp.body.getReader();
        let lastProgressTime = Date.now();
        let bytesInWindow = 0;
        let currentSpeed = '0 MB/s';
        let streamFinished = false;

        try {
          while (true) {
            if (abortCtrl.signal.aborted) {
              throw new Error('Download aborted by user');
            }

            // Inactivity watchdog: Auto-reconnect if no chunk received for 12s
            let chunkTimer = null;
            const chunkTimeoutPromise = new Promise((_, reject) => {
              chunkTimer = setTimeout(() => reject(new Error('Network stalled (12s inactivity timeout)')), 12000);
            });

            const { done, value } = await Promise.race([
              reader.read(),
              chunkTimeoutPromise
            ]).finally(() => {
              if (chunkTimer) clearTimeout(chunkTimer);
            });

            if (done) {
              streamFinished = true;
              break;
            }

            const canWrite = fileStream.write(value);
            downloadedBytes += value.length;
            bytesInWindow += value.length;

            if (!canWrite) {
              await new Promise((resolve) => fileStream.once('drain', resolve));
            }

            const now = Date.now();
            const elapsed = now - lastProgressTime;
            if (elapsed >= 300) {
              const speedBps = (bytesInWindow / (elapsed / 1000));
              currentSpeed = speedBps >= 1024 * 1024
                ? `${(speedBps / (1024 * 1024)).toFixed(1)} MB/s`
                : `${Math.round(speedBps / 1024)} KB/s`;
              bytesInWindow = 0;
              lastProgressTime = now;

              const percent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
              safeSend('updater:status', {
                status: 'downloading',
                percent,
                transferred: downloadedBytes,
                total: totalBytes,
                transferredFormatted: formatBytes(downloadedBytes),
                totalFormatted,
                speedFormatted: currentSpeed,
                message: `⚡ កំពុងទាញយក... ${percent}% (${formatBytes(downloadedBytes)} / ${totalFormatted})`
              });
            }
          }
        } finally {
          fileStream.end();
          await new Promise((resolve) => fileStream.on('finish', resolve));
        }

        // Check if finished
        if (totalBytes > 0 && downloadedBytes >= totalBytes) {
          break;
        }

        if (streamFinished && (totalBytes === 0 || downloadedBytes >= totalBytes)) {
          break;
        }

        // If socket ended prematurely without reaching totalBytes, throw to trigger resume
        throw new Error('Connection closed prematurely before completing file');

      } catch (streamErr) {
        if (abortCtrl.signal.aborted) {
          throw streamErr;
        }

        retryCount++;
        if (retryCount > maxRetries) {
          throw new Error(`បរាជ័យក្នុងការទាញយកបន្ទាប់ពីព្យាយាម ${maxRetries} ដង (${streamErr.message})`);
        }

        const waitSec = Math.min(retryCount * 2, 6);
        const percent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0;

        safeSend('updater:status', {
          status: 'downloading',
          percent,
          transferred: downloadedBytes,
          total: totalBytes,
          transferredFormatted: formatBytes(downloadedBytes),
          totalFormatted,
          speedFormatted: '0 MB/s',
          message: `🔄 បណ្ដាញរអាក់រអួល (${percent}%). កំពុងភ្ជាប់បន្តដោយស្វ័យប្រវត្តិ... (${retryCount}/${maxRetries})`
        });

        await new Promise((r) => setTimeout(r, waitSec * 1000));
      }
    }

    activeDownloadAbort = null;

    safeSend('updater:status', {
      status: 'downloaded',
      version: targetVer,
      installerPath: tempFilePath,
      totalFormatted: formatBytes(downloadedBytes),
      message: `🎉 បានទាញយកកំណែថ្មី v${targetVer} រួចរាល់!`
    });

    return { success: true, installerPath: tempFilePath };
  } catch (err) {
    if (abortCtrl.signal.aborted) {
      safeSend('updater:status', { status: 'cancelled', message: 'ការទាញយកត្រូវបានបោះបង់' });
      return { success: false, cancelled: true };
    }
    safeSend('updater:status', { status: 'error', error: err.message, message: `❌ បរាជ័យក្នុងការទាញយក: ${err.message}` });
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updater:cancel-download', () => {
  if (activeDownloadAbort) {
    activeDownloadAbort.abort();
    activeDownloadAbort = null;
  }
  return { success: true };
});

ipcMain.handle('updater:install', () => {
  if (downloadedInstallerFile && fs.existsSync(downloadedInstallerFile)) {
    try {
      const { spawn } = require('child_process');
      // Execute silent background installer with automatic relaunch (/S --force-run --updated)
      const child = spawn(downloadedInstallerFile, ['/S', '--force-run', '--updated'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      setTimeout(() => {
        app.quit();
      }, 500);
      return { success: true };
    } catch (e) {
      console.error('Failed to spawn silent installer:', e);
    }
  }

  try {
    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('updater:get-version', () => {
  return app.getVersion();
});

// Semver comparison helper
function isNewerVersion(remoteVer, currentVer) {
  const clean = (v) => String(v || '').replace(/^v/i, '').trim().split('.').map(n => parseInt(n, 10) || 0);
  const r = clean(remoteVer);
  const c = clean(currentVer);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rVal = r[i] || 0;
    const cVal = c[i] || 0;
    if (rVal > cVal) return true;
    if (rVal < cVal) return false;
  }
  return false;
}

// Silent GitHub Releases checker
ipcMain.handle('updater:check-silent', async () => {
  const curVer = app.getVersion();
  try {
    const res = await fetch('https://api.github.com/repos/DePong-989/fdr-drama-dl-pro/releases/latest', {
      headers: { 'User-Agent': 'FDR-Drama-DL-Pro-Updater' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return { hasUpdate: false, currentVersion: curVer };
    const data = await res.json();
    const remoteVer = (data.tag_name || '').replace(/^v/i, '').trim();

    const isNewer = isNewerVersion(remoteVer, curVer);

    const assets = Array.isArray(data.assets) ? data.assets : [];
    const setupAsset = assets.find(a => a.name.endsWith('.exe') && /setup/i.test(a.name)) || assets.find(a => a.name.endsWith('.exe'));
    const downloadUrl = setupAsset ? setupAsset.browser_download_url : null;
    const downloadSize = setupAsset ? setupAsset.size : null;

    return {
      hasUpdate: isNewer,
      currentVersion: curVer,
      latestVersion: remoteVer,
      releaseNotes: data.body || '',
      releaseUrl: data.html_url,
      downloadUrl,
      downloadSize
    };
  } catch (err) {
    return { hasUpdate: false, error: err.message, currentVersion: curVer };
  }
});



