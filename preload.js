const { contextBridge, ipcRenderer } = require('electron');

const apiBridge = {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  launchMainApp: () => ipcRenderer.invoke('window:launch-main'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  selectFolder: async () => {
    const folder = await ipcRenderer.invoke('settings:select-folder');
    return { success: !!folder, folder };
  },
  selectDownloadFolder: () => ipcRenderer.invoke('settings:select-folder'),

  // Sources
  getSources: () => ipcRenderer.invoke('sources:get'),
  saveSources: (sources) => ipcRenderer.invoke('sources:save', sources),
  testSource: (source) => ipcRenderer.invoke('sources:test', source),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: (item) => ipcRenderer.invoke('history:add', item),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Dramas & Hongguo Catalog
  searchDramas: (params) => ipcRenderer.invoke('dramas:search', params),
  getDramaDetail: (params) => ipcRenderer.invoke('dramas:detail', params),
  getLatestReleases: () => ipcRenderer.invoke('dramas:latest'),
  syncLatestDramas: () => ipcRenderer.invoke('dramas:sync'),
  resolvePreview: (params) => ipcRenderer.invoke('preview:resolve', params),

  // Sniffer
  sniffUrl: (url) => ipcRenderer.invoke('sniffer:sniff', url),

  // Downloads Queue & Execution
  startDownload: (task) => ipcRenderer.invoke('downloads:add', task),
  addDownload: (task) => ipcRenderer.invoke('downloads:add', task),
  addBatchDownload: (tasks) => ipcRenderer.invoke('downloads:add-batch', tasks),
  startDrama: (dramaTitle) => ipcRenderer.invoke('downloads:start-drama', dramaTitle),
  removeDrama: (dramaTitle) => ipcRenderer.invoke('downloads:remove-drama', dramaTitle),
  startAllWaiting: () => ipcRenderer.invoke('downloads:start-all-waiting'),
  mergeSeries: (params) => ipcRenderer.invoke('downloads:merge-series', params),
  extractAudio: (params) => ipcRenderer.invoke('downloads:extract-audio', params),
  updateDramaFolder: (params) => ipcRenderer.invoke('downloads:update-folder', params),
  pauseDownload: (taskId) => ipcRenderer.invoke('downloads:pause', taskId),
  resumeDownload: (taskId) => ipcRenderer.invoke('downloads:resume', taskId),
  cancelDownload: (taskId) => ipcRenderer.invoke('downloads:cancel', taskId),
  pauseAllDownloads: () => ipcRenderer.invoke('downloads:pause-all'),
  resumeAllDownloads: () => ipcRenderer.invoke('downloads:resume-all'),
  clearCompletedDownloads: () => ipcRenderer.invoke('downloads:clear-completed'),
  getAllDownloads: () => ipcRenderer.invoke('downloads:get-all'),
  getDownloadQueue: () => ipcRenderer.invoke('downloads:get-all'),

  // Favorites
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  toggleFavorite: (drama) => ipcRenderer.invoke('favorites:toggle', drama),

  // System & Power Controls
  openFolder: (filePath) => ipcRenderer.invoke('system:open-path', filePath),
  openPath: (filePath) => ipcRenderer.invoke('system:open-path', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('system:show-in-folder', filePath),
  getDiskSpace: (folderPath) => ipcRenderer.invoke('system:get-disk-space', folderPath),
  shutdownPc: (seconds) => ipcRenderer.invoke('system:shutdown-pc', seconds),
  cancelShutdown: () => ipcRenderer.invoke('system:cancel-shutdown'),
  copyToClipboard: (text) => ipcRenderer.invoke('system:copy-clipboard', text),
  saveTextFile: (params) => ipcRenderer.invoke('system:save-text-file', params),
  cleanDiskCache: () => ipcRenderer.invoke('system:clean-cache'),

  // License & Key Activation
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  deactivateLicense: () => ipcRenderer.invoke('license:deactivate'),
  generateLicenseKey: (params) => ipcRenderer.invoke('license:generate-key', params),

  // NBC Bakong KHQR Online Payment & Auto-Activation
  generateKHQR: (params) => ipcRenderer.invoke('khqr:generate', params),
  checkKHQRPayment: (md5) => ipcRenderer.invoke('khqr:check', md5),
  testBakongToken: (token) => ipcRenderer.invoke('khqr:test-token', token),
  getPaymentConfig: () => ipcRenderer.invoke('khqr:get-config'),
  savePaymentConfig: (cfg) => ipcRenderer.invoke('khqr:save-config', cfg),
  autoActivateLicense: (deviceId) => ipcRenderer.invoke('khqr:auto-activate', deviceId),

  // Event Listeners
  onQueueUpdate: (callback) => {
    let debounceTimer = null;
    let pendingFetch = false;

    const fetchQueue = () => {
      if (pendingFetch) return;
      pendingFetch = true;
      ipcRenderer.invoke('downloads:get-all')
        .then(queue => {
          pendingFetch = false;
          callback(queue);
        })
        .catch(() => {
          pendingFetch = false;
        });
    };

    const handler = (event, val) => {
      // Throttle queue fetches to maximum 1 per 60ms to maintain smooth 60fps rendering without jitter
      if (!debounceTimer) {
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          fetchQueue();
        }, 60);
      }
    };
    ipcRenderer.on('download-event', handler);
    // Initial fetch
    fetchQueue();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      ipcRenderer.removeListener('download-event', handler);
    };
  },
  onDownloadEvent: (callback) => {
    const subscription = (event, val) => callback(val);
    ipcRenderer.on('download-event', subscription);
    return () => ipcRenderer.removeListener('download-event', subscription);
  },

  // Auto-Updater (GitHub Releases)
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getAppVersion: () => ipcRenderer.invoke('updater:get-version'),
  onUpdateStatus: (callback) => {
    const handler = (event, val) => callback(val);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  }
};

contextBridge.exposeInMainWorld('electronAPI', apiBridge);
contextBridge.exposeInMainWorld('api', apiBridge);
